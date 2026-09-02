import type { CommandGroup, SlashCommand } from "./types";
import type { TemplateItem } from "@/shared/types/template.types";
import { insertMarkdownTemplate } from "./helpers";
import { resolveTemplateIcon } from "./template-icons";

/** 由模板条目数组构建 Slash 命令组；空数组返回 null */
export function buildTemplateGroup(
  t: (key: string) => string,
  items: TemplateItem[],
): CommandGroup | null {
  if (items.length === 0) return null;
  const commands: SlashCommand[] = items.map((tpl) => ({
    id: tpl.id,
    title: tpl.title,
    description: tpl.description,
    icon: resolveTemplateIcon(tpl.icon),
    action: ({ editor, pos }) => {
      insertMarkdownTemplate(editor, pos, tpl.markdown);
    },
  }));
  return {
    id: "template",
    label: t("EDITOR.SLASH.TEMPLATE.GROUP_LABEL"),
    items: commands,
  };
}
