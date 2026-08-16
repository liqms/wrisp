import { describe, it, expect } from "vitest";
import { LOCALE } from "@/shared/enums/config.enums";
import { builtinTemplates } from "@/renderer/components/editor/slash/commands/templates";
import { mergeTemplates } from "@/renderer/components/editor/slash/commands/template-merge";
import type { SlashTemplateFile } from "@/shared/types/template.types";

const FILE: SlashTemplateFile = {
  customTemplates: [
    {
      id: "custom_1",
      title: "我的模板",
      description: "自定义模板",
      icon: "📄",
      markdown: "# 自定义",
      profession: "pm",
      enabled: true,
    },
  ],
  disabledTemplateIds: ["todo"],
};

describe("mergeTemplates", () => {
  it("空文件返回全部内置模板且为内置标记", () => {
    const items = mergeTemplates(builtinTemplates, null, LOCALE.ZH);
    expect(items.length).toBe(builtinTemplates.length);
    expect(items.every((item) => item.builtIn)).toBe(true);
    expect(items.every((item) => item.enabled)).toBe(true);
  });

  it("按语言解析内置模板的标题/正文", () => {
    const zh = mergeTemplates(builtinTemplates, null, LOCALE.ZH).find(
      (i) => i.id === "todo",
    )!;
    const en = mergeTemplates(builtinTemplates, null, LOCALE.EN).find(
      (i) => i.id === "todo",
    )!;
    expect(zh.title).toBe("待办清单");
    expect(zh.markdown).toContain("待办清单");
    expect(en.title).toBe("Todo List");
    expect(en.markdown).toContain("Todo List");
  });

  it("禁用列表中的内置模板 enabled=false", () => {
    const items = mergeTemplates(builtinTemplates, FILE, LOCALE.ZH);
    const todo = items.find((i) => i.id === "todo")!;
    expect(todo.enabled).toBe(false);
  });

  it("自定义模板排在前面且 builtIn=false", () => {
    const items = mergeTemplates(builtinTemplates, FILE, LOCALE.ZH);
    expect(items[0].id).toBe("custom_1");
    expect(items[0].builtIn).toBe(false);
    expect(items[0].enabled).toBe(true);
  });

  it("自定义模板不随语言切换改变内容", () => {
    const zh = mergeTemplates(builtinTemplates, FILE, LOCALE.ZH)[0];
    const en = mergeTemplates(builtinTemplates, FILE, LOCALE.EN)[0];
    expect(zh.title).toBe(en.title);
    expect(zh.markdown).toBe(en.markdown);
  });
});
