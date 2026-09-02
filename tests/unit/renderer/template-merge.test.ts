import { describe, it, expect } from "vitest";
import { LOCALE } from "@/shared/enums/config.enums";
import { mergeTemplates } from "@/renderer/components/editor/slash/commands/template-merge";
import type {
  TemplateFile,
  TemplateResourceFile,
} from "@/shared/types/template.types";

const BUILTINS: TemplateResourceFile[] = [
  {
    id: "todo",
    version: "1.0.0",
    title: { zh: "待办清单", en: "Todo List" },
    description: { zh: "插入待办清单", en: "Insert a todo list" },
    icon: "check_circle",
    markdown: { zh: "## 待办清单", en: "## Todo List" },
    profession: ["general"],
    tags: [{ zh: "清单", en: "list" }],
    enabled: true,
  },
];

/** 旧格式资源文件：tags 为 string 数组（双语改造前的历史数据） */
const LEGACY_BUILTINS = [
  { ...BUILTINS[0], tags: ["list", "todo"] as unknown },
] as TemplateResourceFile[];

const FILE: TemplateFile = {
  customTemplates: [
    {
      id: "custom_1",
      title: "我的模板",
      description: "自定义",
      icon: "description",
      markdown: "# 自定义",
      profession: "pm",
      enabled: true,
    },
  ],
  disabledTemplateIds: ["todo"],
};

describe("mergeTemplates", () => {
  it("空文件返回全部内置且为内置标记", () => {
    const items = mergeTemplates(BUILTINS, null, LOCALE.ZH);
    expect(items.length).toBe(BUILTINS.length);
    expect(items.every((item) => item.builtIn)).toBe(true);
    expect(items.every((item) => item.enabled)).toBe(true);
  });

  it("按语言解析标题/正文", () => {
    const zh = mergeTemplates(BUILTINS, null, LOCALE.ZH).find(
      (i) => i.id === "todo",
    )!;
    const en = mergeTemplates(BUILTINS, null, LOCALE.EN).find(
      (i) => i.id === "todo",
    )!;
    expect(zh.title).toBe("待办清单");
    expect(zh.markdown).toContain("待办清单");
    expect(zh.tags).toEqual(["清单"]);
    expect(en.title).toBe("Todo List");
    expect(en.markdown).toContain("Todo List");
    expect(en.tags).toEqual(["list"]);
  });

  it("旧格式 tags（string 数组）直接透传不丢值", () => {
    const zh = mergeTemplates(LEGACY_BUILTINS, null, LOCALE.ZH).find(
      (i) => i.id === "todo",
    )!;
    expect(zh.tags).toEqual(["list", "todo"]);
  });

  it("禁用列表中的模板 enabled=false", () => {
    const todo = mergeTemplates(BUILTINS, FILE, LOCALE.ZH).find(
      (i) => i.id === "todo",
    )!;
    expect(todo.enabled).toBe(false);
  });

  it("自定义模板排前且 builtIn=false", () => {
    const items = mergeTemplates(BUILTINS, FILE, LOCALE.ZH);
    expect(items[0].id).toBe("custom_1");
    expect(items[0].builtIn).toBe(false);
  });

  it("自定义模板不随语言切换改变", () => {
    const zh = mergeTemplates(BUILTINS, FILE, LOCALE.ZH)[0];
    const en = mergeTemplates(BUILTINS, FILE, LOCALE.EN)[0];
    expect(zh.title).toBe(en.title);
  });
});
