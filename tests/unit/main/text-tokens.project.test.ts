// @vitest-environment node
import { describe, it, expect } from "vitest";
import { extractProjectNames } from "@/shared/utils/text-tokens";

describe("extractProjectNames（&作品记号）", () => {
  it("提取裸记号名（单 token）", () => {
    expect(extractProjectNames("续写 &长夜行 第三章")).toEqual(["长夜行"]);
  });
  it("方括号形式支持带空格名称", () => {
    expect(extractProjectNames("关联 &[星际回声 计划] 与 &[星潮]")).toEqual(["星际回声 计划", "星潮"]);
  });
  it("行中无前置空白的 & 不提取（URL 等）", () => {
    expect(extractProjectNames("see a&b 链接 &A")).toEqual(["A"]);
  });
  it("去重且保持出现顺序", () => {
    expect(extractProjectNames("&甲 与 &乙 与 &甲")).toEqual(["甲", "乙"]);
  });
});
