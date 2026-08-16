/** 职业枚举：后续新增职业在此追加，模板通过 profession 标签归类 */
export const PROFESSION = {
  /** 通用职业标签：标记为 general 的模板对所有职业可用 */
  GENERAL: "general",
  PM: "pm",
  STUDENT: "student",
  WRITER: "writer",
  RESEARCHER: "researcher",
  DEVELOPER: "developer",
  /** 自定义模板专属职业：仅此类模板提供编辑/删除操作 */
  CUSTOM: "custom",
} as const;

export type Profession = (typeof PROFESSION)[keyof typeof PROFESSION];
