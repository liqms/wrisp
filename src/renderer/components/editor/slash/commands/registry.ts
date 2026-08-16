import type { CommandGroup } from "./types";
import { buildDateTimeGroup } from "./dateTime.commands";
import { buildTemplateGroup } from "./templates";
import type { SlashTemplateItem } from "@/shared/types/template.types";

export type { SlashCommand, CommandGroup, SlashCommandContext } from "./types";

/**
 * 全局命令组注册表：
 * - 通用命令固定返回（日期/时间）
 * - 职业模板按「当前职业 + enabled」过滤后的条目动态追加
 */
export function getCommandGroups(
  t: (key: string) => string,
  templateItems: SlashTemplateItem[],
): CommandGroup[] {
  const groups: CommandGroup[] = [buildDateTimeGroup(t)];
  const templateGroup = buildTemplateGroup(t, templateItems);
  if (templateGroup) groups.push(templateGroup);
  return groups;
}
