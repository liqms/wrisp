export enum PROJECT_TYPE {
    /** 小说 */
    NOVEL = 'novel',
    /** 系列 */
    SERIES = 'series',
    /** 书籍 */
    BOOK = 'book',
    /** 研究项目 */
    RESEARCH = 'research',
    /** 产品文档 */
    PRODUCT = 'product',
}

export type ProjectType = (typeof PROJECT_TYPE)[keyof typeof PROJECT_TYPE];