// as const 对象（项目 enums 规范）：string enum 的成员是名义类型，
// 会导致 (typeof PROJECT_TYPE)[keyof ...] 不接受 'novel' 等字符串字面量
export const PROJECT_TYPE = {
  /** 小说 */
  NOVEL: "novel",
  /** 系列 */
  SERIES: "series",
  /** 书籍 */
  BOOK: "book",
  /** 研究项目 */
  RESEARCH: "research",
  /** 产品文档 */
  PRODUCT: "product",
} as const;

export type ProjectType = (typeof PROJECT_TYPE)[keyof typeof PROJECT_TYPE];