/** 围栏开启行：`:::blockType`（L1 粗块与正文字数统计共用同一判定） */
export const FENCE_OPEN_RE = /^\s*:::\s*([a-zA-Z][\w-]*)[ \t]*$/;
/** 围栏闭合行：`:::`（多冒号同样接受，与渲染层 md-codec 一致） */
const FENCE_CLOSE_RE = /^\s*:::+[ \t]*$/;
/** 字段行：`key: value` */
const FIELD_LINE_RE = /^([a-zA-Z][\w-]*)[ \t]*:[ \t]*(.*)$/;

export interface FenceBlock {
  /** 块类型名（`:::metric` → metric） */
  blockType: string;
  /** 围栏内字段（保持出现顺序，即 md 序列化顺序） */
  fields: Array<{ key: string; value: string }>;
}

/**
 * 从开启行下一行找到闭合围栏行下标。
 * 未闭合返回 -1（调用方按普通文本处理，与渲染层"降级为普通段落"的行为对齐）。
 */
export function findFenceClose(lines: string[], openIndex: number): number {
  for (let i = openIndex + 1; i < lines.length; i++) {
    if (FENCE_CLOSE_RE.test(lines[i])) return i;
  }
  return -1;
}

/** 解析围栏块（入参为含开启/闭合行的完整围栏行区间） */
export function parseFence(lines: string[]): FenceBlock | null {
  if (lines.length < 2) return null;
  const open = FENCE_OPEN_RE.exec(lines[0]);
  if (!open) return null;

  const fields: Array<{ key: string; value: string }> = [];
  for (let i = 1; i < lines.length - 1; i++) {
    const match = FIELD_LINE_RE.exec(lines[i]);
    if (match) fields.push({ key: match[1], value: match[2].trim() });
  }
  return { blockType: open[1], fields };
}

/** 围栏正文是否为完整围栏块（用于向量化时识别原子块） */
export function isFenceContent(content: string): boolean {
  const lines = content.split(/\r?\n/);
  return (
    lines.length >= 2 &&
    FENCE_OPEN_RE.test(lines[0]) &&
    FENCE_CLOSE_RE.test(lines[lines.length - 1])
  );
}

/**
 * 把围栏字段拼成一句可嵌入文本（`metric: label DAU, value 12k`）。
 *
 * 字段级信息全部保留、按 schema 顺序成词，因此指标名与数值会一起进入
 * 同一条向量：问「DAU 多少」能命中卡片，而不需要为每个字段单开向量行。
 * 解析是类型无关的——新增块类型只要仍是 `:::type` + `key: value` 就不用改这里。
 */
export function fenceToEmbeddingText(fence: FenceBlock): string {
  const pairs = fence.fields
    .filter((f) => f.value !== "")
    .map((f) => `${f.key} ${f.value}`)
    .join(", ");
  return pairs ? `${fence.blockType}: ${pairs}` : fence.blockType;
}
