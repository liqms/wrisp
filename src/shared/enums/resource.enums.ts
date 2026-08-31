/**
 * 远程资源类型枚举。
 * 用于 manifest.json 中标注每个文件归属的子系统，
 * 后续新增类型（如 prompt/snippet）在此追加。
 */
export const RESOURCE_TYPE = {
  SLASH: "slash",
  PAGE: "page",
  SKILL: "skill",
} as const;

export type ResourceType = (typeof RESOURCE_TYPE)[keyof typeof RESOURCE_TYPE];

export const RESOURCE_TYPES: readonly ResourceType[] = [
  RESOURCE_TYPE.SLASH,
  RESOURCE_TYPE.PAGE,
  RESOURCE_TYPE.SKILL,
];

export function isResourceType(value: unknown): value is ResourceType {
  return (
    typeof value === "string" &&
    (RESOURCE_TYPES as readonly string[]).includes(value)
  );
}
