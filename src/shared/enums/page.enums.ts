/**
 * 页面文件类型枚举
 * 定义页面内容在文件系统中的分类存储路径
 */
export enum PAGE_TYPE {
  /** 作品设定 */
  PROJECT_SETTING = 'project_setting',
  /** 作品章节 */
  PROJECT_CHAPTER = 'project_chapter',
}

export type PageType = (typeof PAGE_TYPE)[keyof typeof PAGE_TYPE];
