import { describe, it, expect } from "vitest";
import { PROFESSION } from "@/shared/enums/profession.enums";
import {
  templates,
  getTemplatesByProfession,
  buildTemplateGroup,
} from "@/renderer/components/editor/slash/commands/templates";
import { getCommandGroups } from "@/renderer/components/editor/slash/commands/registry";

const t = (key: string) => key;

describe("Slash 职业模板", () => {
  it("内置模板均带有效职业标签", () => {
    for (const tpl of templates) {
      expect(Object.values(PROFESSION)).toContain(tpl.profession);
    }
  });

  it("getTemplatesByProfession 按职业过滤", () => {
    const pmTemplates = getTemplatesByProfession(templates, PROFESSION.PM);
    expect(pmTemplates.length).toBeGreaterThan(0);
    expect(pmTemplates.every((tpl) => tpl.profession === PROFESSION.PM)).toBe(true);
  });

  it("buildTemplateGroup 为未知职业返回 null", () => {
    expect(buildTemplateGroup(t, "engineer" as never)).toBeNull();
  });

  it("buildTemplateGroup 为 PM 返回非空命令组", () => {
    const group = buildTemplateGroup(t, PROFESSION.PM);
    expect(group).not.toBeNull();
    expect(group!.items.length).toBeGreaterThan(0);
    // 每个命令都带可执行的 action
    for (const item of group!.items) {
      expect(typeof item.action).toBe("function");
      expect(typeof item.title).toBe("string");
    }
  });

  it("getCommandGroups 包含通用日期时间组与职业模板组", () => {
    const groups = getCommandGroups(t, PROFESSION.PM);
    const ids = groups.map((g) => g.id);
    expect(ids).toContain("dateTime");
    expect(ids).toContain("template");
  });
});
