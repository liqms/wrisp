import { RESOURCE_TYPE } from "@/shared/enums/resource.enums";

/** 从 manifest 条目路径解析资源 id：
 *  "slash/article.json" → "article"
 *  "page/page-prd.json" → "page-prd"
 *  "skills/polish.skill.json" → "polish"
 */
export function resourceIdFromPath(entryPath: string, type: string): string {
  let base = entryPath.split("/").pop() ?? entryPath;
  if (base.endsWith(".json")) base = base.slice(0, -".json".length);
  if (type === RESOURCE_TYPE.SKILL && base.endsWith(".skill")) {
    base = base.slice(0, -".skill".length);
  }
  return base;
}

/** 由类型与 id 反推 manifest 相对路径（安装/卸载用） */
export function resourcePathFromId(type: string, id: string): string {
  return type === RESOURCE_TYPE.SKILL
    ? `skills/${id}.skill.json`
    : `${type}/${id}.json`;
}
