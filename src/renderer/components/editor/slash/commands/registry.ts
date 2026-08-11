import type { CommandGroup } from "./types";
import type { Profession } from "@/shared/enums/profession.enums";
import { dateTimeCommandGroup } from "./dateTime.commands";
import { buildTemplateGroup } from "./templates";

export type { SlashCommand, CommandGroup, SlashCommandContext } from "./types";

/** 全局命令组注册表：通用命令固定返回，职业模板按 profession 动态追加 */
export function getCommandGroups(
  t: (key: string) => string,
  profession: Profession,
): CommandGroup[] {
  const groups: CommandGroup[] = [dateTimeCommandGroup];
  const templateGroup = buildTemplateGroup(t, profession);
  if (templateGroup) groups.push(templateGroup);
  return groups;
}
