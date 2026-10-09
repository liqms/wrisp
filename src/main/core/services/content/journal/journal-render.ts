/**
 * Journal 日文件（`{date}.md`）的确定性渲染与解析 —— 纯函数，无 DB / 无文件 IO / 无 Electron API
 *
 * 文件格式（spec §5.2）：
 *
 *   ```markdown
 *   <!-- wrisp:journal {"format":1,"date":"2026-10-09"} -->
 *   # 2026-10-09
 *
 *   **09:32**
 *   <!-- wrisp:entry {"id":"...","at":"2026-10-09T01:32:00.000Z","src":"desktop","type":"text","u":"..."} -->
 *   正文……
 *   ```
 *
 * 真源是 `journal_entries` 表，本文件只是它的确定性视图：
 * · 确定性 —— 相同条目集必得相同字节（排序键 `occurred_at` + `id`，不掺入当前时间）；
 * · 可往返 —— `renderJournalDay` 的产物经 `parseJournalDayFile` 还原后，再渲染字节不变；
 * · 向前兼容 —— 注释 JSON 里的未知键在解析时被忽略。
 *
 * 正文转义（三条，作用于围栏外的整行）：
 *   1. 形似条目头的时间戳行（`**HH:mm**` / `[[HH:mm]]` / 裸 `HH:mm`）加 `\` 前缀；
 *   2. 形似 `<!-- wrisp:entry {...} -->` 的整行加 `\` 前缀；
 *   3. 代码围栏内的行一律不转义、也不参与头识别（围栏语义交给切分器）。
 *
 * 已知限制（格式约定，不是 bug）：
 * · 逐条目正文的 ```/~~~ 围栏必须成对——渲染按「条目自身」判定围栏，解析按「整篇」判定，
 *   未闭合的围栏会把它之后所有条目的头吞进围栏内，导致条目被合并；
 * · 正文首尾空行/空白在往返中被 `trim()` 去除（条目内容本就不以空白表达语义）；
 * · 以 `\` 起头且去掉 `\` 后形似头/注释的正文行会丢掉那个 `\`（未对 `\` 自身二次转义）。
 */
import { NodeCryptoUtil } from "@/main/utils/crypto";
import { TimeUtil } from "@/shared/utils";
import { markCodeFenceLines } from "../splitting/structure";

/** 当前文件格式版本；写入文件标记，解析时不参与判定（版本升级需保持可读旧文件） */
export const JOURNAL_FILE_FORMAT = 1;

const DAY_MARKER_RE = /^\s*<!--\s*wrisp:journal\s+(\{.*\})\s*-->\s*$/;
const ENTRY_META_RE = /^\s*<!--\s*wrisp:entry\s+(\{.*\})\s*-->\s*$/;
/** Markdown 标题行（`# ` 起头）——文件级 H1 日期不属于任何条目 */
const HEADING_RE = /^\s*#\s/;
/** 条目头三种形态：加粗（可带日期）、[[HH:mm]]（可带日期）、裸时间戳。整行锚定。 */
const HEADER_BOLD_RE = /^\s*\*\*(?:(\d{4}-\d{2}-\d{2})[ T])?(\d{1,2}:\d{2})(?::(\d{2}))?\*\*\s*$/;
const HEADER_WIKI_RE = /^\s*\[\[(?:(\d{4}-\d{2}-\d{2})[ T])?(\d{1,2}:\d{2})(?::(\d{2}))?\]\]\s*$/;
const HEADER_BARE_RE = /^\s*(?:(\d{4}-\d{2}-\d{2})[ T])?(\d{1,2}:\d{2})(?::(\d{2}))?\s*$/;

/** `<!-- wrisp:entry {...} -->` 的载荷（键名刻意压短，减少正文噪音） */
export interface JournalEntryMetaPayload {
  id: string;
  at: string;
  src: string;
  type: string;
  u?: string;
  att?: string[];
  meta?: Record<string, unknown>;
}

/** `renderJournalDay` 的入参形状：Service 侧把 DAO 行的 JSON 文本列反序列化后传入 */
export interface JournalEntryRowLike {
  id: string;
  occurred_at: string;
  source: string;
  type: string;
  content: string;
  attachments: string[] | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
}

/** `parseJournalDayFile` 的产物：字段名对齐 `journal_entries` 列名，便于 Service 直接落库 */
export interface ParsedJournalEntry {
  id: string;
  occurred_at: string;
  source: string;
  type: string;
  updated_at: string | null;
  content: string;
  attachments: string[] | null;
  metadata: Record<string, unknown> | null;
  /** 是否带 `<!-- wrisp:entry -->` 注释（false 表示旧格式推断而来） */
  has_meta: boolean;
}

/** 条目头的时间信息（小时/分已补齐为两位） */
interface EntryHeader {
  time: string;
  sec: string | null;
}

function pad2(value: string): string {
  return value.length === 1 ? `0${value}` : value;
}

/**
 * 头识别（渲染转义与解析切分共用同一判定，避免两处漂移）。
 * 行首 `\` 是转义标记，永不算头。
 */
function matchHeader(line: string): EntryHeader | null {
  if (line.startsWith("\\")) return null;
  for (const re of [HEADER_BOLD_RE, HEADER_WIKI_RE, HEADER_BARE_RE]) {
    const m = re.exec(line);
    if (m) {
      const [hh, mm] = m[2].split(":");
      return { time: `${pad2(hh)}:${pad2(mm)}`, sec: m[3] ?? null };
    }
  }
  return null;
}

/** 该行渲染时是否需要 `\` 前缀保护（转义规则 1、2） */
function needsEscape(line: string): boolean {
  return matchHeader(line) !== null || ENTRY_META_RE.test(line);
}

function escapeBodyLine(line: string, insideFence: boolean): string {
  if (insideFence) return line;
  return needsEscape(line) ? `\\${line}` : line;
}

/** 仅剥离为保护而加的 `\` 前缀；其余内容原样（不做 Markdown 反转义） */
function unescapeBodyLine(line: string): string {
  if (!line.startsWith("\\")) return line;
  const rest = line.slice(1);
  return matchHeader(rest) !== null || ENTRY_META_RE.test(rest) ? rest : line;
}

function unescapeAll(text: string): string {
  return text.split("\n").map(unescapeBodyLine).join("\n");
}

/** 渲染头时间戳：条目时间 → 本地时区 HH:mm */
export function localTimeHeader(occurredAtIso: string): string {
  return TimeUtil.format(occurredAtIso, "HH:mm");
}

/**
 * 旧格式条目（无注释元数据）的确定性 id：同 (date, occurred_at, content) 必得同一
 * 8-4-4-4-12 形状串，重复导入因此幂等。
 */
export function inferEntryId(date: string, occurredAt: string, content: string): string {
  const hex = NodeCryptoUtil.sha256(`${date}|${occurredAt}|${content}`);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `a${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

function importInferred(date: string, occurredAt: string, content: string): ParsedJournalEntry {
  return {
    id: inferEntryId(date, occurredAt, content),
    occurred_at: occurredAt,
    source: "import",
    type: "text",
    updated_at: null,
    content,
    attachments: null,
    metadata: null,
    has_meta: false,
  };
}

/** 注释元数据 → 条目；缺 id 视为非元数据条目（返回 null，由调用方降级为推断条目） */
function fromMetaPayload(
  meta: Record<string, unknown>,
  headerOccurredAt: string,
  content: string,
): ParsedJournalEntry | null {
  if (typeof meta.id !== "string") return null;
  return {
    id: meta.id,
    occurred_at: typeof meta.at === "string" ? meta.at : headerOccurredAt,
    source: typeof meta.src === "string" ? meta.src : "import",
    type: typeof meta.type === "string" ? meta.type : "text",
    updated_at: typeof meta.u === "string" ? meta.u : null,
    content,
    attachments: Array.isArray(meta.att) ? (meta.att as string[]) : null,
    metadata:
      meta.meta && typeof meta.meta === "object" && !Array.isArray(meta.meta)
        ? (meta.meta as Record<string, unknown>)
        : null,
    has_meta: true,
  };
}

/** 从 start 起下一个条目头的下标（围栏内的行不参与识别）；没有则返回 lines.length */
function nextHeaderIndex(lines: string[], fences: Set<number>, start: number): number {
  for (let i = start; i < lines.length; i++) {
    if (!fences.has(i) && matchHeader(lines[i])) return i;
  }
  return lines.length;
}

/**
 * 把一天的条目渲染为 `{date}.md` 正文（不含文件路径写入）。
 * 条目顺序、JSON 键序、头时间戳全部确定 → 同输入必得同字节。
 */
export function renderJournalDay(date: string, entries: JournalEntryRowLike[]): string {
  const sorted = [...entries].sort(
    (a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.id.localeCompare(b.id),
  );
  const parts: string[] = [
    `<!-- wrisp:journal {"format":${JOURNAL_FILE_FORMAT},"date":"${date}"} -->`,
    `# ${date}`,
  ];

  for (const entry of sorted) {
    const payload: JournalEntryMetaPayload = {
      id: entry.id,
      at: entry.occurred_at,
      src: entry.source,
      type: entry.type,
      u: entry.updated_at,
    };
    if (entry.attachments) payload.att = entry.attachments;
    if (entry.metadata) payload.meta = entry.metadata;

    const bodyLines = entry.content.split("\n");
    const fences = markCodeFenceLines(bodyLines);
    const body = bodyLines.map((line, i) => escapeBodyLine(line, fences.has(i))).join("\n");

    parts.push(
      `**${localTimeHeader(entry.occurred_at)}**\n<!-- wrisp:entry ${JSON.stringify(payload)} -->\n${body}`,
    );
  }

  return `${parts.join("\n\n")}\n`;
}

/**
 * 解析日文件为条目集（新格式与旧格式共用一套头识别）。
 * · 新格式：头 + `<!-- wrisp:entry -->` 注释 → 全字段还原，未知键忽略；
 * · 旧格式：裸 `09:30` / `**09:30**` / `[[09:30]]` 各自成条，缺元数据时用 `importInferred`；
 * · 无任何时间戳行 → 整篇一条（`{date}T00:00:00`）。
 * 入参 `date` 是文件所属日期，也是裸头拼 `occurred_at` 的日期部分。
 */
export function parseJournalDayFile(date: string, markdown: string): ParsedJournalEntry[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const fences = markCodeFenceLines(lines);
  const out: ParsedJournalEntry[] = [];

  // 跳过文件标记、H1 日期标题与它们周围的空行（不属于任何条目）
  let i = 0;
  while (
    i < lines.length &&
    !fences.has(i) &&
    (DAY_MARKER_RE.test(lines[i]) || HEADING_RE.test(lines[i]) || lines[i].trim() === "")
  ) {
    i++;
  }

  while (i < lines.length) {
    const header = fences.has(i) ? null : matchHeader(lines[i]);

    if (!header) {
      // 首个条目头之前的散落正文 → 归为一条推断条目
      const next = nextHeaderIndex(lines, fences, i);
      const body = unescapeAll(lines.slice(i, next).join("\n")).trim();
      if (body) out.push(importInferred(date, `${date}T00:00:00`, body));
      i = next;
      continue;
    }

    const headerOccurredAt = `${date}T${header.time}${header.sec ? `:${header.sec}` : ":00"}`;
    let j = i + 1;
    let meta: Record<string, unknown> | null = null;
    if (j < lines.length && !fences.has(j)) {
      const raw = ENTRY_META_RE.exec(lines[j])?.[1];
      if (raw) {
        try {
          meta = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          meta = null; // 注释 JSON 损坏 → 整条按推断条目处理
        }
      }
      if (meta) j++;
    }

    const bodyStart = j;
    j = nextHeaderIndex(lines, fences, j);
    const content = unescapeAll(lines.slice(bodyStart, j).join("\n")).trim();

    const metaEntry = meta ? fromMetaPayload(meta, headerOccurredAt, content) : null;
    if (metaEntry) {
      out.push(metaEntry);
    } else if (content) {
      out.push(importInferred(date, headerOccurredAt, content));
    }
    i = j;
  }

  return out;
}
