import { describe, it, expect } from "vitest";
import { LOCALE } from "@/shared/enums/config.enums";
import { buildTemplateGroup } from "@/renderer/components/editor/slash/commands/templates";
import { mergeTemplates } from "@/renderer/components/editor/slash/commands/template-merge";
import { getCommandGroups } from "@/renderer/components/editor/slash/commands/registry";
import type {
  TemplateItem,
  TemplateResourceFile,
} from "@/shared/types/template.types";

const t = (key: string) => key;

const BUILTINS: TemplateResourceFile[] = [
  {
    id: "todo",
    version: "1.0.0",
    title: { zh: "待办清单", en: "Todo List" },
    description: { zh: "插入待办清单", en: "Insert a todo list" },
    icon: "check_circle",
    markdown: { zh: "## 待办", en: "## Todo" },
    profession: ["general"],
    tags: [{ zh: "清单", en: "list" }],
    enabled: true,
  },
];

describe("buildTemplateGroup", () => {
  it("空数组返回 null", () => {
    expect(buildTemplateGroup(t, [])).toBeNull();
  });

  it("非空返回命令组", () => {
    const items: TemplateItem[] = mergeTemplates(BUILTINS, null, LOCALE.ZH);
    const group = buildTemplateGroup(t, items);
    expect(group).not.toBeNull();
    expect(group!.id).toBe("template");
    expect(group!.items.length).toBeGreaterThan(0);
    for (const item of group!.items) {
      expect(typeof item.action).toBe("function");
    }
  });
});

describe("getCommandGroups", () => {
  it("包含模板组", () => {
    const items = mergeTemplates(BUILTINS, null, LOCALE.ZH);
    const groups = getCommandGroups(t, items);
    expect(groups.map((g) => g.id)).toContain("template");
  });
});
