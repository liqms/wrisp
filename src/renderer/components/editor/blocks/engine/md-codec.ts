import type { WrispBlockField } from "../registry";

/**
 * md 字段行编解码：`key: value` 行的解析、校验回退与确定性序列化。
 * marked tokenizer（md → 桥接 HTML）与 parseHTML（桥接 HTML → 节点）共用同一套校验，
 * 保证"未知字段丢弃、非法枚举/格式回退默认值"在两条链路行为一致。
 */

/** 字段行格式：`key: value`（key 限字母开头，允许字母数字下划线连字符） */
const FIELD_LINE_RE = /^([a-zA-Z][\w-]*)[ \t]*:[ \t]*(.*)$/;

/** 围栏行：开启（:::name）与闭合（:::） */
const FENCE_CLOSE_RE = /^:::+[ \t]*$/;

/** HTML 属性值转义（写入桥接 HTML 的 data-* 属性） */
export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 属性名转 kebab-case（trendDir → trend-dir），用于 data-f-* 属性 */
export function kebabCase(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * 单字段校验：非字符串/超长截断/枚举词表外/格式不通过 → 回退默认值。
 * 空字符串视为"未填写"，text 保留空、enum 回退默认值。
 */
export function sanitizeFieldValue(raw: unknown, field: WrispBlockField): string {
  if (typeof raw !== "string") return String(field.default);
  let value = raw.trim();
  if (field.maxLength && value.length > field.maxLength) {
    value = value.slice(0, field.maxLength);
  }
  if (value === "") {
    return field.type === "enum" ? String(field.default) : "";
  }
  if (field.type === "enum") {
    const valid = (field.enumValues ?? []).some((item) => item.value === value);
    return valid ? value : String(field.default);
  }
  if (field.pattern && !field.pattern.test(value)) {
    return String(field.default);
  }
  return value;
}

/** 全字段校验：返回与 schema 字段集对齐的干净 attrs */
export function sanitizeAttrs(
  raw: Record<string, unknown>,
  fields: WrispBlockField[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) {
    out[field.key] = sanitizeFieldValue(raw[field.key], field);
  }
  return out;
}

/**
 * 确定性序列化：按 schema 顺序输出 `key: value` 行；
 * 空值与等于默认值的字段省略，保证 round-trip 幂等且 md 干净。
 */
export function serializeFields(
  attrs: Record<string, unknown>,
  fields: WrispBlockField[],
): string[] {
  const lines: string[] = [];
  for (const field of fields) {
    const value = typeof attrs[field.key] === "string" ? (attrs[field.key] as string).trim() : "";
    if (!value || value === String(field.default)) continue;
    lines.push(`${field.key}: ${value}`);
  }
  return lines;
}

export interface ParsedFence {
  /** 围栏内原始字段（key: value，未校验，渲染时统一走 sanitizeAttrs） */
  fields: Record<string, string>;
  /** 闭合围栏所在行号 */
  endLine: number;
}

/**
 * 解析单个围栏体：从 openLine 的下一行读取字段行，直到闭合围栏行。
 * 不匹配字段格式的行忽略（容错外部手改）；未闭合返回 null（交回 marked 降级为普通段落）。
 */
export function parseFence(lines: string[], openLine: number): ParsedFence | null {
  const fields: Record<string, string> = {};
  for (let i = openLine + 1; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE_CLOSE_RE.test(line)) {
      return { fields, endLine: i };
    }
    const match = FIELD_LINE_RE.exec(line);
    if (match) {
      fields[match[1]] = match[2].trim();
    }
  }
  return null;
}

/**
 * 将单个块序列化为 md 围栏文本（无尾部换行）。
 * 形如 `:::metric\nlabel: DAU\n:::`。
 */
export function serializeFence(
  mdName: string,
  attrs: Record<string, unknown>,
  fields: WrispBlockField[],
): string {
  const body = serializeFields(attrs, fields).join("\n");
  return `:::${mdName}\n${body ? `${body}\n` : ""}:::`;
}
