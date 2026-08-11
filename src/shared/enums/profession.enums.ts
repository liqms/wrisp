/** 职业枚举：后续新增职业在此追加，模板通过 profession 标签归类 */
export const PROFESSION = {
  PM: "pm",
} as const;

export type Profession = (typeof PROFESSION)[keyof typeof PROFESSION];
