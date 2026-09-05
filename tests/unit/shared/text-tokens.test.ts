import { describe, it, expect } from "vitest";
import {
  extractInlineTokens,
  extractTagNames,
  extractCharacterNames,
} from "@/shared/utils/text-tokens";

describe("extractInlineTokens", () => {
  it("解析 [[双链]]：返回 wiki token，value 为括号内内容", () => {
    const tokens = extractInlineTokens("今天写了[[项目计划]]");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toEqual({
      type: "wiki",
      start: 4,
      end: 12,
      symbolLength: 2,
      value: "项目计划",
    });
  });

  it("解析 #标签：位于行首或空白后，value 不含 #", () => {
    const tokens = extractInlineTokens("#科幻 这是正文 #灵感");
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toEqual({
      type: "tag",
      start: 0,
      end: 3,
      symbolLength: 1,
      value: "科幻",
    });
    expect(tokens[1].value).toBe("灵感");
  });

  it("解析 @人物：位于行首或空白后，value 不含 @", () => {
    const tokens = extractInlineTokens("和@张三 聊了聊");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toEqual({
      type: "mention",
      start: 1,
      end: 4,
      symbolLength: 1,
      value: "张三",
    });
  });

  it("混合 token 按位置排序", () => {
    const tokens = extractInlineTokens("#标签 和@张三 讨论了[[计划]]");
    expect(tokens.map((t) => t.type)).toEqual(["tag", "mention", "wiki"]);
  });

  it("行中非空白后的 @ 不解析（避开邮箱）", () => {
    expect(extractInlineTokens("mail a@b.com")).toHaveLength(0);
  });

  it("纯数字开头的 # 不解析为标签（避开序号）", () => {
    expect(
      extractInlineTokens("#1 完成事项 #2 待办").filter(
        (t) => t.type === "tag",
      ),
    ).toHaveLength(0);
  });

  it("markdown 标题 # 空格形式不解析为标签", () => {
    expect(
      extractInlineTokens("# 标题").filter((t) => t.type === "tag"),
    ).toHaveLength(0);
  });

  it("未闭合的 [[ 不解析", () => {
    expect(extractInlineTokens("[[未闭合")).toHaveLength(0);
  });

  it("空字符串返回空数组", () => {
    expect(extractInlineTokens("")).toEqual([]);
  });
});

describe("extractTagNames / extractCharacterNames", () => {
  const md = "#科幻 和@张三 聊了 #科幻 又见@李四";

  it("extractTagNames 去重并保序", () => {
    expect(extractTagNames(md)).toEqual(["科幻"]);
  });

  it("extractCharacterNames 去重并保序", () => {
    expect(extractCharacterNames(md)).toEqual(["张三", "李四"]);
  });
});
