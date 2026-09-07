import { describe, it, expect } from "vitest";
import {
  resourceIdFromPath,
  resourcePathFromId,
} from "@/shared/utils/resource";

describe("resourceIdFromPath", () => {
  it("解析 slash 路径", () => {
    expect(resourceIdFromPath("slash/article.json", "slash")).toBe("article");
  });
  it("解析 page 路径", () => {
    expect(resourceIdFromPath("page/page-prd.json", "page")).toBe("page-prd");
  });
  it("解析 skill 路径（去 .skill.json）", () => {
    expect(resourceIdFromPath("skills/polish.skill.json", "skill")).toBe(
      "polish",
    );
  });
});

describe("resourcePathFromId", () => {
  it("模板反推路径", () => {
    expect(resourcePathFromId("slash", "todo")).toBe("slash/todo.json");
    expect(resourcePathFromId("page", "page-prd")).toBe("page/page-prd.json");
  });
  it("技能反推路径", () => {
    expect(resourcePathFromId("skill", "polish")).toBe(
      "skills/polish.skill.json",
    );
  });
});
