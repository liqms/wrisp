import {
  extractTagNames,
  extractCharacterNames,
  extractProjectNames,
} from "@/shared/utils/text-tokens";

/** 条目正文中的三类行内记号名称 */
export interface EntryTokens {
  tags: string[];
  projects: string[];
  characters: string[];
}

/**
 * 聚合解析条目正文的三种行内记号（#标签 / &作品 / @人物）。
 * 复用渲染端与整篇保存路径同一套 token 规则（`@/shared/utils/text-tokens`），
 * 保证「所见即所存」；名称只去首尾空白、**不裁剪标点**（`&作品，` 的 `，` 属于名称），
 * 带空格 / 标点的作品名请用方括号形式 `&[作品 名]`。
 */
export function parseEntryTokens(content: string): EntryTokens {
  return {
    tags: extractTagNames(content),
    projects: extractProjectNames(content),
    characters: extractCharacterNames(content),
  };
}
