import { describe, it, expect } from "vitest";
import { filterMarketplace } from "@/renderer/components/marketplace/marketplace-filter";
import { RESOURCE_TYPE } from "@/shared/enums/resource.enums";
import type { MarketplaceItem } from "@/shared/types/template.types";

const base = (over: Partial<MarketplaceItem>): MarketplaceItem => ({
  id: "t",
  type: RESOURCE_TYPE.SLASH,
  version: "1.0.0",
  title: { zh: "文章大纲", en: "Article Outline" },
  description: {
    zh: "插入文章大纲框架",
    en: "Insert article outline skeleton",
  },
  icon: "edit",
  tags: [
    { zh: "写作", en: "writing" },
    { zh: "大纲", en: "outline" },
  ],
  preview: { zh: "", en: "" },
  profession: ["writer"],
  installed: false,
  installedVersion: "",
  updateAvailable: false,
  ...over,
});

const list = [
  base({
    id: "a",
    title: { zh: "文章大纲", en: "Article Outline" },
    tags: [{ zh: "写作", en: "writing" }],
  }),
  base({
    id: "b",
    title: { zh: "待办清单", en: "Todo List" },
    tags: [{ zh: "计划", en: "planning" }],
  }),
];

describe("filterMarketplace", () => {
  it("关键词匹配当前语言标题/描述（中文）", () => {
    expect(
      filterMarketplace(list, { keyword: "大纲", tag: "", locale: "zhCN" }).map(
        (t) => t.id,
      ),
    ).toEqual(["a"]);
  });
  it("关键词匹配英文标题（英文环境）", () => {
    expect(
      filterMarketplace(list, {
        keyword: "outline",
        tag: "",
        locale: "enUS",
      }).map((t) => t.id),
    ).toEqual(["a"]);
  });
  it("标签筛选（按当前语言标签）", () => {
    expect(
      filterMarketplace(list, { keyword: "", tag: "写作", locale: "zhCN" }).map(
        (t) => t.id,
      ),
    ).toEqual(["a"]);
    expect(
      filterMarketplace(list, {
        keyword: "",
        tag: "planning",
        locale: "enUS",
      }).map((t) => t.id),
    ).toEqual(["b"]);
  });
  it("关键词 + 标签组合", () => {
    expect(
      filterMarketplace(list, { keyword: "清单", tag: "写作", locale: "zhCN" }),
    ).toHaveLength(0);
  });
  it("空条件返回全量", () => {
    expect(
      filterMarketplace(list, { keyword: "", tag: "", locale: "zhCN" }),
    ).toHaveLength(2);
  });
});