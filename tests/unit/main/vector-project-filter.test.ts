import { describe, it, expect } from "vitest";
import { buildProjectFilter } from "@/main/core/vector/project-filter";

describe("buildProjectFilter", () => {
  it("生成合法的 LanceDB 过滤表达式", () => {
    expect(buildProjectFilter("p_1")).toBe("project_id = 'p_1'");
  });

  it("对空 projectId 抛错（防跨作品泄漏）", () => {
    expect(() => buildProjectFilter("")).toThrow("PROJECT_ID_REQUIRED");
    expect(() => buildProjectFilter("   ")).toThrow("PROJECT_ID_REQUIRED");
  });

  it("对非法字符抛错（防 SQL 注入）", () => {
    expect(() => buildProjectFilter("p1' OR '1'='1")).toThrow(
      "INVALID_PROJECT_ID",
    );
  });
});
