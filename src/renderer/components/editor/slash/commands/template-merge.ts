import { LOCALE } from "@/shared/enums";
import type {
  BuiltInTemplateDef,
  TemplateFile,
  TemplateItem,
} from "@/shared/types/template.types";

/**
 * 把内置模板（按当前语言解析）+ 自定义模板合并为统一列表。
 * 自定义模板排前，内置模板在后。纯函数，便于测试。slash 与 page 模板共用。
 */
export function mergeTemplates(
  builtins: BuiltInTemplateDef[],
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
    profession: def.profession,
    builtIn: true,
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
      builtIn: false,
      enabled: c.enabled,
    }),
  );

  return [...customItems, ...builtinItems];
}
