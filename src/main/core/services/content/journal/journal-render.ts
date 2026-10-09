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
 * · 确定性 —— 相同条目集必得相同字节（排序键 `occurred_at` + `id`，按码点比较，不掺当前时间、不依赖 locale）；
 * · 可往返 —— `renderJournalDay` 的产物经 `parseJournalDayFile` 还原后，再渲染字节不变；
 * · 向前兼容 —— 注释 JSON 里的未知键在解析时被忽略。
 *
 * 正文转义（spec §5.2，逐字符转义「参与头匹配的锚定标点」，作用于围栏外的整行）：
 *   1. 整行匹配条目头模式 → 只转义该形态参与匹配的那个标点，逐字符加反斜杠：
 *      · 粗体形式把每个 `*` 转义为 `\*`（`**09:30**` → `\*\*09:30\*\*`）；
 *      · 裸形式转义冒号（`09:30` → `09\:30`）；
 *      · 方括号形式转义首个左括号（`[[09:30]]` → `\[[09:30]]`）。
 *      解析时按同一套字符集 `\* \[ \: \<` 逐个剥离反斜杠还原，绝不「剥掉全部反斜杠」，
 *      以免吞掉用户本就写下的 `\d`、`\\` 等。还原是纯字符串操作，不解析 Markdown。
 *   2. 整行即 `<!-- wrisp:entry {...} -->` 形状 → 转义首个字符为 `\<!-- …`（CommonMark 按字面渲染
 *      `\<`）；仅「行中包含但不整行匹配」该注释的（如「样例 <!-- wrisp:entry {} --> 结束」）不转义
 *      —— 解析器整行锚定，中间出现不产生歧义。不使用 HTML 实体 `&#60;`。
 *   3. 代码围栏（```/~~~）内的行一律不转义、也不参与头识别（沿用 `splitting/structure.ts` 的围栏语义）。
 *      例外（§5.2 规则 3 补充）：`**HH:mm**` 行紧随一行 `<!-- wrisp:entry ... -->` 的两行组合是**权威条目
 *      边界**，即使处于「围栏内」也生效，并在此处重置围栏状态。这样某条目正文含未闭合围栏时，其后条目
 *      不会因「整文件恒为围栏内」而被静默合并、丢 id；代价是「代码块里粘贴一个完整两行头部样例」会把
 *      一条拆成两条（用户可见、可手工合并），是远更轻的失效模式。
 *
 * 已知限制（格式约定，不是 bug）：
 * · 正文首尾空行/空白在往返中被 `trim()` 去除（条目内容本就不以空白表达语义）；
 * · 逐字符转义规则下，正文里用户本就写下的字面 `\*` `\[` `\:` `\<` 序列会在还原时丢掉那个 `\`
 *   —— 这是逐字符规则的固有代价，已接受。
 */
import { NodeCryptoUtil } from "@/main/utils/crypto";
import { TimeUtil } from "@/shared/utils";
import { markCodeFenceLines } from "../splitting/structure";

/** 当前文件格式版本；写入文件标记，解析时不参与判定（版本升级需保持可读旧文件） */
export const JOURNAL_FILE_FORMAT = 1;

/** 日志日期（YYYY-MM-DD）正则源：边界校验与日文件名解析共用这一处定义 */
export const JOURNAL_DATE_RE_SOURCE = "\\d{4}-\\d{2}-\\d{2}";

const JOURNAL_DATE_RE = new RegExp(`^${JOURNAL_DATE_RE_SOURCE}$`);

/** 值是否为符合日志日期约定的字符串（IPC / 队列载荷边界的 date 校验） */
export function isJournalDate(value: unknown): value is string {
  return typeof value === "string" && JOURNAL_DATE_RE.test(value);
}

const DAY_MARKER_RE = /^\s*<!--\s*wrisp:journal\s+(\{.*\})\s*-->\s*$/;
const ENTRY_META_RE = /^\s*<!--\s*wrisp:entry\s+(\{.*\})\s*-->\s*$/;
/** 代码围栏起始行（``` 或 ~~~）——解析侧自管围栏态，规则 3 例外需逐行推进 */
const CODE_FENCE_RE = /^\s*(`{3,}|~{3,})/;
/** 条目头三种形态：加粗（可带日期）、[[HH:mm]]（可带日期）、裸时间戳。整行锚定。 */
const HEADER_BOLD_RE = /^\s*\*\*(?:(\d{4}-\d{2}-\d{2})[ T])?(\d{1,2}:\d{2})(?::(\d{2}))?\*\*\s*$/;
const HEADER_WIKI_RE = /^\s*\[\[(?:(\d{4}-\d{2}-\d{2})[ T])?(\d{1,2}:\d{2})(?::(\d{2}))?\]\]\s*$/;
const HEADER_BARE_RE = /^\s*(?:(\d{4}-\d{2}-\d{2})[ T])?(\d{1,2}:\d{2})(?::(\d{2}))?\s*$/;
/** 逐字符还原时剥离反斜杠的字符集（与转义目标标点一致）：\* \[ \: \< */
const UNESCAPE_RE = /\\([*[:<])/g;

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

/** 条目头形态 */
type HeaderForm = "bold" | "wiki" | "bare";

/**
 * 该 markdown 是否为「条目接管的日文件」（首行带 `<!-- wrisp:journal {...} -->` 标记）。
 *
 * 用途：文件级切块（`ChunkIndexService.processFile`）据此让位给条目管线 —— 条目块同时携带
 * `file_id` 与 `entry_id`，若再按 `file_id` 差异同步会选中这批块并删除重烧。
 */
export function isEntryOwnedJournalMarkdown(markdown: string): boolean {
  const firstLine = (markdown || "").replace(/\r\n/g, "\n").split("\n")[0] ?? "";
  return DAY_MARKER_RE.test(firstLine);
}

/** 条目头的时间信息（小时/分已补齐为两位） */
interface EntryHeader {
  time: string;
  sec: string | null;
}

function pad2(value: string): string {
  return value.length === 1 ? `0${value}` : value;
}

/** 码点比较（不用 localeCompare——其依赖 locale/ICU，会破坏跨机器字节一致） */
function cmpCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 把 `2026-10-09` 之类日期安全嵌入正则 */
function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 头形态识别（渲染转义与解析切分共用同一判定，避免两处漂移）。
 * 行首 `\` 是转义标记，永不算头；三种正则各自整行锚定。
 */
function headerForm(line: string): HeaderForm | null {
  if (line.startsWith("\\")) return null;
  if (HEADER_BOLD_RE.test(line)) return "bold";
  if (HEADER_WIKI_RE.test(line)) return "wiki";
  if (HEADER_BARE_RE.test(line)) return "bare";
  return null;
}

function matchHeader(line: string): EntryHeader | null {
  const form = headerForm(line);
  if (!form) return null;
  const re = form === "bold" ? HEADER_BOLD_RE : form === "wiki" ? HEADER_WIKI_RE : HEADER_BARE_RE;
  const m = re.exec(line);
  if (!m) return null;
  const [hh, mm] = m[2].split(":");
  return { time: `${pad2(hh)}:${pad2(mm)}`, sec: m[3] ?? null };
}

/** 粗体形态：转义每个 `*`（`\*\*09:30\*\*`）——只转首个 `*` 会让 CommonMark 把余下配对成游离强调 */
function escapeBoldHeader(line: string): string {
  return line.replace(/\*/g, "\\*");
}

/** 方括号形态：只转义首个左括号（`\[[09:30]]`） */
function escapeWikiHeader(line: string): string {
  return `\\${line}`;
}

/** 裸形态：转义第一个冒号（`09\:30`） */
function escapeBareHeader(line: string): string {
  const idx = line.indexOf(":");
  return idx < 0 ? line : `${line.slice(0, idx)}\\${line.slice(idx)}`;
}

/** 整行注释形态（规则 2）：转义首个字符 `<` */
function escapeCommentLine(line: string): string {
  return `\\${line}`;
}

/** 正文行渲染：围栏内原样（规则 3）；围栏外按形态逐字符转义（规则 1、2） */
function escapeBodyLine(line: string, insideFence: boolean): string {
  if (insideFence) return line;
  const form = headerForm(line);
  if (form === "bold") return escapeBoldHeader(line);
  if (form === "wiki") return escapeWikiHeader(line);
  if (form === "bare") return escapeBareHeader(line);
  if (ENTRY_META_RE.test(line)) return escapeCommentLine(line);
  return line;
}

/** 仅按同一套字符集（`\*` `\[` `\:` `\<`）逐个剥离反斜杠；其余反斜杠保留 */
function unescapeBodyLine(line: string): string {
  return line.replace(UNESCAPE_RE, "$1");
}

function unescapeAll(text: string): string {
  return text.split("\n").map(unescapeBodyLine).join("\n");
}

/** 渲染头时间戳：条目时间 → 本地时区 HH:mm */
export function localTimeHeader(occurredAtIso: string): string {
  const d = new Date(occurredAtIso);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`localTimeHeader: 无法解析条目时间，拒绝生成损坏的头部: ${occurredAtIso}`);
  }
  return TimeUtil.format(occurredAtIso, "HH:mm");
}

/**
 * 旧格式条目（无注释元数据）的确定性 id：同 (date, occurred_at, content) 必得同一
 * 8-4-4-4-12 形状串，重复导入因此幂等。
 *
 * 这是 sha256 摘要十六进制前 32 位按 8-4-4-4-12 排布、version 半字节固定为 `5`、variant
 * 固定为 `a` 派生出的 **UUID 形状**确定性 id，**不是** RFC 4122 的 name-based（UUIDv5）算法。
 * 任何外部实现（含未来移动端）必须复刻本定义，否则同一手工条目会算出不同 id。
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

/**
 * 逐行推进，同时产出「围栏内」标记与「条目边界」标记。
 * · 权威边界（规则 3 例外）：粗体头 + 紧随整行 wrisp:entry 注释 —— 与围栏态无关，命中即视为边界
 *   并把围栏态重置为「外」；
 * · 普通边界：围栏外的头形态行。
 */
function scanLines(lines: string[]): { inside: boolean[]; boundary: boolean[] } {
  const n = lines.length;
  const inside = new Array<boolean>(n).fill(false);
  const boundary = new Array<boolean>(n).fill(false);
  const authoritative = new Array<boolean>(n).fill(false);

  for (let i = 0; i < n; i++) {
    if (
      headerForm(lines[i]) === "bold" &&
      i + 1 < n &&
      ENTRY_META_RE.test(lines[i + 1])
    ) {
      authoritative[i] = true;
    }
  }

  let marker: string | null = null;
  for (let i = 0; i < n; i++) {
    if (authoritative[i]) {
      marker = null; // 规则 3 例外：在此重置围栏态
      boundary[i] = true;
      // 权威头行本身不是围栏行，继续走正常围栏判定（保持 inside[i]=false）
    }
    const match = CODE_FENCE_RE.exec(lines[i]);
    if (marker) {
      inside[i] = true;
      if (match && match[1][0] === marker) marker = null;
      continue;
    }
    if (match) {
      marker = match[1][0];
      inside[i] = true;
      continue;
    }
    if (!authoritative[i] && matchHeader(lines[i])) boundary[i] = true;
  }

  return { inside, boundary };
}

function nextBoundaryIndex(boundary: boolean[], start: number): number {
  for (let i = start; i < boundary.length; i++) {
    if (boundary[i]) return i;
  }
  return boundary.length;
}

/**
 * 把一天的条目渲染为 `{date}.md` 正文（不含文件路径写入）。
 * 条目顺序、JSON 键序、头时间戳全部确定 → 同输入必得同字节。
 */
export function renderJournalDay(date: string, entries: JournalEntryRowLike[]): string {
  const sorted = [...entries].sort(
    (a, b) => cmpCodePoint(a.occurred_at, b.occurred_at) || cmpCodePoint(a.id, b.id),
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
  const { inside, boundary } = scanLines(lines);
  const out: ParsedJournalEntry[] = [];

  // 前言：只跳过文件标记、渲染器自身的 `# <date>` 标题、以及它们周围的空行。
  // 其它标题（如手写的 `# 今日安排`）不属于此处，落到正文/散落正文分支保留（不再丢失）。
  const dateHeadingRe = new RegExp(`^#\\s*${escapeForRegExp(date)}\\s*$`);
  let i = 0;
  while (
    i < lines.length &&
    !inside[i] &&
    !boundary[i] &&
    (DAY_MARKER_RE.test(lines[i]) || dateHeadingRe.test(lines[i].trim()) || lines[i].trim() === "")
  ) {
    i++;
  }

  while (i < lines.length) {
    if (!boundary[i]) {
      // 首个条目头之前的散落正文 → 归为一条推断条目
      const next = nextBoundaryIndex(boundary, i);
      const body = unescapeAll(lines.slice(i, next).join("\n")).trim();
      if (body) out.push(importInferred(date, `${date}T00:00:00`, body));
      i = next;
      continue;
    }

    const header = matchHeader(lines[i])!;
    const headerOccurredAt = `${date}T${header.time}${header.sec ? `:${header.sec}` : ":00"}`;
    let j = i + 1;
    let meta: Record<string, unknown> | null = null;
    if (j < lines.length && !inside[j] && ENTRY_META_RE.test(lines[j])) {
      const raw = ENTRY_META_RE.exec(lines[j])![1];
      j++; // 无论 JSON 是否可解析，都消费这行注释，避免它残留进正文破坏往返
      try {
        meta = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        meta = null; // 注释 JSON 损坏 → 该条按推断条目处理（但注释行已被消费）
      }
    }

    const bodyStart = j;
    j = nextBoundaryIndex(boundary, j);
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
