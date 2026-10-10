/** 概念标题归一化键的最长长度（按 Unicode 字符计，避免代理对被截断） */
const TITLE_KEY_MAX_CHARS = 24;

/** 首尾需要剥离的空白与标点（\p{P} 含中文全角标点，\p{S} 含全角括号等符号） */
const EDGE_NOISE = /^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu;

/**
 * 概念标题归一化键：NFKC → 转小写 → 折叠空白 → 去首尾标点（含中文全角）→ 截断 24 字符。
 *
 * 只作幂等合并键（`concepts.title_key`），不进全文索引，因此可以激进归一而不影响检索展示。
 * @param title - 模型输出或用户输入的概念标题
 * @returns 归一化键；标题归一后为空时返回空字符串（调用方应跳过）
 */
export function normalizeConceptTitle(title: string): string {
  const folded = title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .replace(EDGE_NOISE, "");

  return Array.from(folded).slice(0, TITLE_KEY_MAX_CHARS).join("");
}
