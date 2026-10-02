import {
  DEFAULT_TEMPLATE_ICON,
  isTemplateIconName,
} from "@/shared/enums/template.enums";
import { PROFESSION } from "@/shared/enums";
import type { Profession } from "@/shared/enums/profession.enums";
import type {
  TemplatePageSkill,
  TemplateResourceFile,
} from "@/shared/types/template.types";

/**
 * 把内置模板 JSON 的原始对象规范化为 TemplateResourceFile。
 * 纯函数：不读文件、不碰 Electron，便于单测。
 * 既有行为保持不变：profession 过滤 custom、非法 icon 回退默认值。
 */
export function parseTemplateResource(
  raw: Partial<TemplateResourceFile>,
): TemplateResourceFile | null {
  if (!raw.id || typeof raw.id !== "string") return null;

  const skills = normalizeSkills(raw.skills);

  return {
    id: raw.id,
    version: typeof raw.version === "string" ? raw.version : "0.0.0",
    title: raw.title ?? { zh: raw.id, en: raw.id },
    description: raw.description ?? { zh: "", en: "" },
    icon: isTemplateIconName(raw.icon) ? raw.icon : DEFAULT_TEMPLATE_ICON,
    markdown: raw.markdown ?? { zh: "", en: "" },
    profession: Array.isArray(raw.profession)
      ? raw.profession.filter(
          (p): p is Profession =>
            typeof p === "string" && p !== PROFESSION.CUSTOM,
        )
      : [PROFESSION.GENERAL],
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    enabled: raw.enabled !== false,
    ...(skills ? { skills } : {}),
  };
}

/** 规范化页面级技能声明；无有效条目时返回 undefined（不注入空数组） */
function normalizeSkills(raw: unknown): TemplatePageSkill[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const items: TemplatePageSkill[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Partial<TemplatePageSkill>;
    if (typeof e.id !== "string" || typeof e.skillId !== "string") continue;

    items.push({
      id: e.id,
      skillId: e.skillId,
      ...(e.params ? { params: e.params } : {}),
      ...(e.requiresConfirm !== undefined
        ? { requiresConfirm: e.requiresConfirm }
        : {}),
    });
  }
  return items.length > 0 ? items : undefined;
}
