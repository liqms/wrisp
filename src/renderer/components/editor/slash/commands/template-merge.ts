import { LOCALE } from "@/shared/enums";
import type {
  LocalizedText,
  TemplateResourceFile,
  TemplateFile,
  TemplateItem,
} from "@/shared/types/template.types";
import type { Profession } from "@/shared/enums/profession.enums";

/** 解析单个 tag：新格式 LocalizedText 按语言取值，旧格式（string）直接使用 */
function resolveTag(tag: LocalizedText, useEn: boolean): string {
  // 历史数据兼容：旧资源文件的 tags 为 string 数组
  const raw = tag as string | LocalizedText;
  return typeof raw === "string" ? raw : useEn ? raw.en : raw.zh;
}

/**
 * 把内置模板（按当前语言解析）+ 自定义模板合并为统一列表。
 * 自定义模板排前，内置模板在后。slash 与 page 模板共用。
 * 内置模板 profession 为数组，取第一个非 CUSTOM 职业作为 TemplateItem.profession。
 */
export function mergeTemplates(
  builtins: TemplateResourceFile[],
  file: TemplateFile | null,
  locale: string,
): TemplateItem[] {
  const disabled = new Set(file?.disabledTemplateIds ?? []);
  const useEn = locale === LOCALE.EN;

  const builtinItems: TemplateItem[] = builtins.map((def) => ({
    id: def.id,
    title: useEn ? def.title.en : def.title.zh,
    description: useEn ? def.description.en : def.description.zh,
    icon: def.icon,
    markdown: useEn ? def.markdown.en : def.markdown.zh,
    profession: (def.profession[0] ?? "general") as Profession,
    professions: def.profession,
    version: def.version,
    tags: (def.tags ?? []).map((tag) => resolveTag(tag, useEn)),
    builtIn: true,
    skills: def.skills,
    enabled: !disabled.has(def.id),
  }));

  const customItems: TemplateItem[] = (file?.customTemplates ?? []).map(
    (c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      icon: c.icon,
      markdown: c.markdown,
      profession: c.profession,
      professions: [c.profession],
      version: "",
      tags: [],
      builtIn: false,
      skills: c.skills,
      enabled: c.enabled,
    }),
  );

  return [...customItems, ...builtinItems];
}
