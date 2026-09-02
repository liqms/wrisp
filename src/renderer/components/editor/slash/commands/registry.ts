import type { CommandGroup } from "./types";
import { buildDateTimeGroup } from "./dateTime.commands";
import { buildBasicBlocksGroup } from "./basic-blocks.commands";
import { buildTemplateGroup } from "./templates";
import { buildBlocksGroup } from "./blocks.commands";
import type { TemplateItem } from "@/shared/types/template.types";

export type { SlashCommand, CommandGroup, SlashCommandContext } from "./types";

/**
 * 全局命令组注册表：
 * - 基本块（正文/标题/列表/代码块/引用/分割线/图片/提及/公式）
 * - 通用命令固定返回（日期/时间）
 * - 自定义块（指标卡片等）由声明式注册表驱动
 * - 职业模板按「当前职业 + enabled」过滤后的条目动态追加
 */
export function getCommandGroups(
  t: (key: string) => string,
  templateItems: TemplateItem[],
): CommandGroup[] {
  const groups: CommandGroup[] = [
    buildBasicBlocksGroup(t),
    buildDateTimeGroup(t),
    buildBlocksGroup(t),
  ];
  const templateGroup = buildTemplateGroup(t, templateItems);
  if (templateGroup) groups.push(templateGroup);
  return groups;
}
