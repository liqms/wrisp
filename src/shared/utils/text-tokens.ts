/**
 * 行内语义 token（[[双链]] / #标签 / @人物）的统一解析。
 * 编辑器 Decorations 渲染与主进程保存同步共用同一套规则，保证所见即所存。
 */

/** token 类型：wiki=[[双链]] / tag=#标签 / mention=@人物 */
export type InlineTokenType = "wiki" | "tag" | "mention";

export interface InlineToken {
  type: InlineTokenType;
  /** token 起始偏移（含符号，基于传入文本的偏移量） */
  start: number;
  /** token 结束偏移（含符号/右括号，exclusive） */
  end: number;
  /** 前置符号长度：wiki=2（[[），tag/mention=1 */
  symbolLength: number;
  /** 去除符号后的内容 */
  value: string;
}

/** [[双链]]：同一行内闭合，内容不含中括号与换行 */
const WIKI_LINK_RE = /\[\[([^[\]\n]+)\]\]/g;
/** #标签：位于行首或空白后，首字符非数字（避开序号），内容不含空白与 # */
const TAG_RE = /(?<!\S)#(?!\d)[^\s#]+/g;
/** @人物：位于行首、空白后或 CJK 等非 ASCII 单词字符后（避开邮箱地址），内容不含空白、@ 与 # */
const MENTION_RE = /(?<!\w)@[^\s@#]+/g;

/**
 * 解析文本中的全部行内语义 token，按出现位置排序
 * @param text 纯文本（通常为单个 ProseMirror text node 的文本或整篇 markdown）
 */
export function extractInlineTokens(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];

  for (const match of text.matchAll(WIKI_LINK_RE)) {
    const start = match.index ?? 0;
    tokens.push({
      type: "wiki",
      start,
      end: start + match[0].length,
      symbolLength: 2,
      value: match[1],
    });
  }

  for (const match of text.matchAll(TAG_RE)) {
    const start = match.index ?? 0;
    tokens.push({
      type: "tag",
      start,
      end: start + match[0].length,
      symbolLength: 1,
      value: match[0].slice(1),
    });
  }

  for (const match of text.matchAll(MENTION_RE)) {
    const start = match.index ?? 0;
    tokens.push({
      type: "mention",
      start,
      end: start + match[0].length,
      symbolLength: 1,
      value: match[0].slice(1),
    });
  }

  tokens.sort((a, b) => a.start - b.start);
  return tokens;
}

/** 提取 markdown 中全部 #标签 名（去重，保持出现顺序） */
export function extractTagNames(markdown: string): string[] {
  const names = extractInlineTokens(markdown)
    .filter((t) => t.type === "tag")
    .map((t) => t.value);
  return [...new Set(names)];
}

/** 提取 markdown 中全部 @人物 名（去重，保持出现顺序） */
export function extractCharacterNames(markdown: string): string[] {
  const names = extractInlineTokens(markdown)
    .filter((t) => t.type === "mention")
    .map((t) => t.value);
  return [...new Set(names)];
}
