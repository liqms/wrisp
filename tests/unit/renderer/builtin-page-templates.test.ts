import { describe, it, expect } from "vitest";
import { PROFESSION } from "@/shared/enums/profession.enums";
import { isTemplateIconName } from "@/shared/enums/template.enums";
import { builtinPageTemplates } from "@/renderer/templates/builtin-page-templates";

describe("内置页面模板", () => {
  it("内置页面模板均带有效职业标签", () => {
    for (const tpl of builtinPageTemplates) {
      expect(Object.values(PROFESSION)).toContain(tpl.profession);
    }
  });

  it("内置页面模板 id 唯一且带 page- 前缀（与 slash 内置 id 隔离）", () => {
    const ids = builtinPageTemplates.map((tpl) => tpl.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.startsWith("page-")).toBe(true);
    }
  });

  it("内置页面模板图标均为合法图标键", () => {
    for (const tpl of builtinPageTemplates) {
      expect(isTemplateIconName(tpl.icon)).toBe(true);
    }
  });

  it("内置页面模板标题/描述/正文均为中英双语", () => {
    for (const tpl of builtinPageTemplates) {
      expect(tpl.title.zh.length).toBeGreaterThan(0);
      expect(tpl.title.en.length).toBeGreaterThan(0);
      expect(tpl.description.zh.length).toBeGreaterThan(0);
      expect(tpl.description.en.length).toBeGreaterThan(0);
      expect(tpl.markdown.zh.length).toBeGreaterThan(0);
      expect(tpl.markdown.en.length).toBeGreaterThan(0);
    }
  });
});
