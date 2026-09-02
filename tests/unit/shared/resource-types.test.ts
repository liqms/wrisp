import { describe, it, expect } from "vitest";
import {
  RESOURCE_TYPE,
  RESOURCE_TYPES,
  isResourceType,
  type ResourceType,
} from "@/shared/enums/resource.enums";

describe("ResourceType 枚举", () => {
  it("包含 slash/page/skill 三种类型", () => {
    expect(RESOURCE_TYPE.SLASH).toBe("slash");
    expect(RESOURCE_TYPE.PAGE).toBe("page");
    expect(RESOURCE_TYPE.SKILL).toBe("skill");
  });

  it("RESOURCE_TYPES 数组包含全部三种类型", () => {
    expect(RESOURCE_TYPES).toHaveLength(3);
    expect(RESOURCE_TYPES).toContain("slash");
    expect(RESOURCE_TYPES).toContain("page");
    expect(RESOURCE_TYPES).toContain("skill");
  });

  it("isResourceType 合法值返回 true", () => {
    expect(isResourceType("slash")).toBe(true);
    expect(isResourceType("page")).toBe(true);
    expect(isResourceType("skill")).toBe(true);
  });

  it("isResourceType 非法值返回 false", () => {
    expect(isResourceType("unknown")).toBe(false);
    expect(isResourceType("")).toBe(false);
    expect(isResourceType(null)).toBe(false);
    expect(isResourceType(123)).toBe(false);
  });

  it("ResourceType 类型可赋值（编译期检查）", () => {
    const t: ResourceType = RESOURCE_TYPE.SLASH;
    expect(t).toBe("slash");
  });
});
