import { CHUNK_MAX_COARSE_CHARS } from "@/main/constants";
import type { CoarseBlock, Sentence } from "./types";

/** CJK（含日文假名、韩文）字符 */
const CJK_RE = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g;
/** 句子终止符（中英标点） */
const TERMINATORS = "。！？…!?";
/** 终止符后可并入句尾的收尾符号（引号、括号） */
const CLOSERS = "”’\"')）】」』";
/** 句点前若为此类缩写则不切分（按小写比较） */
const ABBREVIATIONS = new Set([
  "e.g",
  "i.e",
  "etc",
  "vs",
  "dr",
  "mr",
  "mrs",
  "ms",
  "prof",
  "fig",
  "no",
  "st",
  "jr",
  "sr",
  "approx",
]);
/**
 * 段内硬边界：列表项、引用、表格行、任务项各自是一个句子。
 * 它们常被写在不空行分隔的相邻行里，只靠标点会漏切。
 */
const STRUCTURAL_LINE_RE = /^\s*(?:[-*+]|\d+[.)]|>|\||\[\s])/;

export interface Paragraph {
  lines: string[];
  /** 1-based */
  startLine: number;
  /** 1-based */
  endLine: number;
}

/** 粗略统计字数：CJK 字符按字计，其余按空白分词计 */
export function countWords(text: string): number {
  const cjk = (text.match(CJK_RE) ?? []).length;
  const latin = text
    .replace(CJK_RE, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk + latin;
}

/** L2 触发条件：字符数超阈值（长度口径唯一，不再叠加 Token 估算） */
export function exceedsLengthLimit(text: string): boolean {
  return text.length > CHUNK_MAX_COARSE_CHARS;
}

/** 按空行把行数组拆成段落，并保留每段的绝对行号区间 */
export function splitParagraphs(
  lines: string[],
  blockStartLine: number,
): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let buffer: string[] = [];
  let startLocal = 0;

  const flush = (endLocal: number): void => {
    if (buffer.length === 0) return;
    paragraphs.push({
      lines: buffer,
      startLine: blockStartLine + startLocal,
      endLine: blockStartLine + endLocal,
    });
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "") {
      flush(i - 1);
    } else {
      if (buffer.length === 0) startLocal = i;
      buffer.push(lines[i]);
    }
  }
  flush(lines.length - 1);

  return paragraphs;
}

/** 句点是否应作为句子边界（排除小数、缩写、无空格的 a.b） */
function isPeriodBoundary(text: string, index: number): boolean {
  const prev = text[index - 1] ?? "";
  const next = text[index + 1] ?? "";
  if (/\d/.test(prev) && /\d/.test(next)) return false;
  if (next !== "" && next !== " " && next !== "\t" && next !== "\n") return false;
  const word = /[A-Za-z.]+$/.exec(text.slice(0, index))?.[0] ?? "";
  return !ABBREVIATIONS.has(word.replace(/\.$/, "").toLowerCase());
}

/**
 * 找出段落内所有句子结束位置（字符偏移，闭区间右端 +1）。
 * 中英终止符 + 段内结构行（列表/引用/表格）都算边界。
 */
function findSentenceEnds(text: string): number[] {
  const ends: number[] = [];
  const structuralStarts: number[] = [];

  const lineStarts: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") lineStarts.push(i + 1);
  }
  for (let li = 1; li < lineStarts.length; li++) {
    const start = lineStarts[li];
    const next = text.indexOf("\n", start);
    const line = text.slice(start, next === -1 ? text.length : next);
    if (STRUCTURAL_LINE_RE.test(line)) structuralStarts.push(start);
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (TERMINATORS.includes(ch)) {
      let j = i;
      while (j < text.length && TERMINATORS.includes(text[j])) j++;
      while (j < text.length && CLOSERS.includes(text[j])) j++;
      ends.push(j);
      i = j - 1;
      continue;
    }
    if (ch === "." && isPeriodBoundary(text, i)) {
      let j = i + 1;
      while (j < text.length && CLOSERS.includes(text[j])) j++;
      ends.push(j);
    }
  }

  return [...ends, ...structuralStarts].sort((a, b) => a - b);
}

/** 把单个段落（行数组）切成句子，并映射回绝对行号 */
export function splitParagraphSentences(
  lines: string[],
  paragraphStartLine: number,
): Sentence[] {
  const text = lines.join("\n");
  if (text.trim() === "") return [];

  const newlinePrefix: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    newlinePrefix.push(newlinePrefix[i] + (text[i] === "\n" ? 1 : 0));
  }
  const lineIndexOf = (offset: number): number =>
    newlinePrefix[Math.min(offset, newlinePrefix.length - 1)];

  const sentences: Sentence[] = [];
  let from = 0;
  for (const end of findSentenceEnds(text)) {
    if (end <= from) continue;
    pushSentence(sentences, text.slice(from, end), paragraphStartLine + lineIndexOf(from), paragraphStartLine + lineIndexOf(end - 1));
    from = end;
    while (from < text.length && (text[from] === " " || text[from] === "\n")) from++;
  }
  if (from < text.length) {
    const tail = text.slice(from);
    pushSentence(sentences, tail, paragraphStartLine + lineIndexOf(from), paragraphStartLine + lineIndexOf(text.length - 1));
  }

  return sentences;
}

function pushSentence(
  out: Sentence[],
  raw: string,
  startLine: number,
  endLine: number,
): void {
  const trimmed = raw.replace(/^\s+|\s+$/g, "");
  if (trimmed === "") return;
  const leading = raw.slice(0, raw.length - raw.trimStart().length);
  const adjustedStart = startLine + (leading.match(/\n/g)?.length ?? 0);
  out.push({ text: trimmed, startLine: adjustedStart, endLine });
}

/** 取粗块内的全部句子（跨段落，按文档顺序） */
export function collectSentences(block: CoarseBlock): Sentence[] {
  const sentences: Sentence[] = [];
  for (const paragraph of splitParagraphs(block.lines, block.startLine)) {
    sentences.push(...splitParagraphSentences(paragraph.lines, paragraph.startLine));
  }
  return sentences;
}
