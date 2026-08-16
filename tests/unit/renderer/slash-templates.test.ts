import { describe, it, expect } from "vitest";
import { PROFESSION } from "@/shared/enums/profession.enums";
import { LOCALE } from "@/shared/enums/config.enums";
import {
  builtinTemplates,
  buildTemplateGroup,
} from "@/renderer/components/editor/slash/commands/templates";
import { mergeTemplates } from "@/renderer/components/editor/slash/commands/template-merge";
import { getCommandGroups } from "@/renderer/components/editor/slash/commands/registry";
import type { SlashTemplateItem } from "@/shared/types/template.types";

const t = (key: string) => key;

describe("Slash 内置模板", () => {
  it("内置模板均带有效职业标签", () => {
    for (const tpl of builtinTemplates) {
      expect(Object.values(PROFESSION)).toContain(tpl.profession);
    }
  });

  it("内置模板 id 唯一", () => {
    const ids = builtinTemplates.map((tpl) => tpl.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("内置模板标题/描述/正文均为中英双语", () => {
    for (const tpl of builtinTemplates) {
      expect(tpl.title.zh.length).toBeGreaterThan(0);
      expect(tpl.title.en.length).toBeGreaterThan(0);
      expect(tpl.description.zh.length).toBeGreaterThan(0);
      expect(tpl.description.en.length).toBeGreaterThan(0);
      expect(tpl.markdown.zh.length).toBeGreaterThan(0);
      expect(tpl.markdown.en.length).toBeGreaterThan(0);
    }
  });

  it("buildTemplateGroup 空数组返回 null", () => {
    expect(buildTemplateGroup(t, [])).toBeNull();
  });

  it("buildTemplateGroup 为非空条目返回命令组，命令带可执行 action", () => {
    const items: SlashTemplateItem[] = mergeTemplates(
      builtinTemplates,
      null,
      LOCALE.ZH,
    );
    const group = buildTemplateGroup(t, items);
    expect(group).not.toBeNull();
    expect(group!.id).toBe("template");
    expect(group!.items.length).toBeGreaterThan(0);
    for (const item of group!.items) {
      expect(typeof item.action).toBe("function");
      expect(typeof item.title).toBe("string");
    }
  });

  it("getCommandGroups 包含日期时间组与模板组", () => {
    const items = mergeTemplates(builtinTemplates, null, LOCALE.ZH);
    const groups = getCommandGroups(t, items);
    const ids = groups.map((g) => g.id);
    expect(ids).toContain("dateTime");
    expect(ids).toContain("template");
  });
});
