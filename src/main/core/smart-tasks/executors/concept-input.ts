import type { Chunk } from "@/main/types/db";
import { normalizeConceptTitle } from "@/shared/utils";
import {
  CONCEPT_CANDIDATES_PER_BLOCK,
  CONCEPT_EVIDENCE_MAX_CHARS,
  CONCEPT_EXTRACT_SYSTEM_PROMPT,
  CONCEPT_EXTRACT_USER_TEMPLATE,
  CONCEPT_GENERALITY_STOPWORDS,
  CONCEPT_MAX_PER_BLOCK,
  CONCEPT_MIN_CONFIDENCE,
  CONCEPT_PROMPT_BUDGET_CHARS,
  CONCEPT_TITLE_MAX_CHARS,
  CONCEPT_TITLE_MIN_CHARS,
} from "@/main/constants/concept.constants";

/** 模型输出的单个概念（已通过格式校验） */
export interface ParsedConcept {
  title: string;
  aliases: string[];
  evidence: string;
  confidence: number;
}

/** 解析失败时抛出：调用方据此把整块记为失败，不做降级切分（设计 D8） */
export class ConceptParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConceptParseError";
  }
}

/**
 * 组装概念抽取输入：摘要作导语 + 原文窗口。
 *
 * 只喂 `ai_summary` 会让概念退化成「摘要的摘要」，而整篇原文又超出本地 4096 context，
 * 因此取原文前 `windowChars` 字为主体，摘要仅作定位导语。
 * 摘要与正文相同（短块的摘要就是原文）时不重复输出。
 */
export function buildConceptInput(block: Chunk, windowChars: number): string {
  const body = block.content.slice(0, Math.max(1, windowChars));
  const summary = block.ai_summary?.trim();
  if (!summary || summary === block.content.trim()) {
    return `[正文节选] ${body}`;
  }
  return `[摘要] ${summary}\n[正文节选] ${body}`;
}

/**
 * 构造带预算约束的抽取消息。
 *
 * 超预算时先裁剪候选列表（它对「复用写法」有帮助但非必需），
 * 再裁剪原文窗口（窗口变短只影响召回，不影响已有概念的复用）。
 */
export function buildConceptMessages(
  block: Chunk,
  windowChars: number,
  candidates: string[],
): { system: string; user: string } {
  const trimmed = candidates.slice(0, CONCEPT_CANDIDATES_PER_BLOCK);

  const assemble = (candidateList: string[], chars: number) => ({
    system: CONCEPT_EXTRACT_SYSTEM_PROMPT,
    user: CONCEPT_EXTRACT_USER_TEMPLATE.replace(
      "{candidates}",
      candidateList.join("、") || "（无）",
    ).replace("{input}", buildConceptInput(block, chars)),
  });

  let messages = assemble(trimmed, windowChars);
  if (messages.system.length + messages.user.length > CONCEPT_PROMPT_BUDGET_CHARS) {
    messages = assemble([], windowChars);
  }
  while (
    messages.system.length + messages.user.length > CONCEPT_PROMPT_BUDGET_CHARS &&
    messages.user.length > 0
  ) {
    windowChars = Math.max(80, Math.floor(windowChars * 0.7));
    const next = assemble([], windowChars);
    // 窗口已触底仍超预算：接受当前长度，交给下游 maxTokens 限制输出
    if (next.user === messages.user) break;
    messages = next;
  }
  return messages;
}

/**
 * 容错解析概念抽取输出。
 *
 * 本地模型不支持 response_format，格式全靠 prompt 约束，因此这里要能吃掉
 * 代码栅栏与前后缀说明；但一旦拿到数组，任一项非法就整块判失败——
 * 半截概念列表比没有更糟（会污染去重键）。
 *
 * @param raw - 模型原始输出
 * @returns 通过校验的概念（已过滤泛化词、超出条数上限的部分）
 * @throws ConceptParseError 结构不可解析或任一项非法
 */
export function parseConceptJson(raw: string): ParsedConcept[] {
  const jsonText = extractArrayLiteral(raw);
  if (!jsonText) {
    throw new ConceptParseError("输出中未找到 JSON 数组");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new ConceptParseError(`JSON 解析失败: ${String(error)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new ConceptParseError("输出不是 JSON 数组");
  }

  return parsed.map((item, index) => validateConcept(item, index)).slice(0, CONCEPT_MAX_PER_BLOCK);
}

/** 去掉 ```json 栅栏后，截取首个 `[` 到最后一个 `]` */
function extractArrayLiteral(raw: string): string | null {
  const withoutFence = raw
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = withoutFence.indexOf("[");
  const end = withoutFence.lastIndexOf("]");
  if (start === -1 || end <= start) {
    return null;
  }
  return withoutFence.slice(start, end + 1);
}

function validateConcept(item: unknown, index: number): ParsedConcept {
  if (typeof item !== "object" || item === null) {
    throw new ConceptParseError(`第 ${index + 1} 项不是对象`);
  }

  const record = item as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const key = normalizeConceptTitle(title);

  if (!title) {
    throw new ConceptParseError(`第 ${index + 1} 项缺少 title`);
  }
  if (
    Array.from(key).length < CONCEPT_TITLE_MIN_CHARS ||
    Array.from(key).length > CONCEPT_TITLE_MAX_CHARS
  ) {
    throw new ConceptParseError(`第 ${index + 1} 项 title 长度非法: ${title}`);
  }

  const confidence = typeof record.confidence === "number" ? record.confidence : 0;
  if (confidence < CONCEPT_MIN_CONFIDENCE || confidence > 1) {
    throw new ConceptParseError(`第 ${index + 1} 项 confidence 非法: ${confidence}`);
  }

  return {
    title,
    aliases: toStringList(record.aliases),
    evidence: clampEvidence(record.evidence),
    confidence,
  };
}

/** 别名列表：按归一化键去重，但**保留首次出现的原始写法**（别名要能给人看） */
function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seenKeys = new Set<string>();
  const aliases: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const alias = item.trim();
    if (!alias) continue;
    const key = normalizeConceptTitle(alias);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);
    aliases.push(alias);
  }
  return aliases;
}

function clampEvidence(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, CONCEPT_EVIDENCE_MAX_CHARS);
}

/** 泛化词命中判定：用归一化键比对，避免「方法。」这类写法漏网 */
export function isGeneralConcept(title: string): boolean {
  const key = normalizeConceptTitle(title);
  return CONCEPT_GENERALITY_STOPWORDS.some((stop) => normalizeConceptTitle(stop) === key);
}
