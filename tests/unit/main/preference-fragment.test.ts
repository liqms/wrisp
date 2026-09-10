import { describe, it, expect } from "vitest";
import { buildPreferenceFragment } from "@/main/core/services/preference-fragment";

describe("buildPreferenceFragment", () => {
  it("无偏好时返回空串（不注入噪音）", () => {
    expect(buildPreferenceFragment(undefined)).toBe("");
    expect(buildPreferenceFragment({ reviewStrictness: "normal" })).toBe("");
  });

  it("把已填写的偏好组织为可读片段", () => {
    const fragment = buildPreferenceFragment({
      tone: "克制",
      pov: "第一人称",
      pacing: "缓",
      reviewStrictness: "normal",
    });
    expect(fragment).toContain("基调：克制");
    expect(fragment).toContain("视角：第一人称");
    expect(fragment).toContain("节奏：缓");
  });

  it("禁忌与用词偏好以列表形式出现", () => {
    const fragment = buildPreferenceFragment({
      taboos: ["暴力", "说教"],
      vocabulary: ["克制", "留白"],
      reviewStrictness: "normal",
    });
    expect(fragment).toContain("禁忌：暴力、说教");
    expect(fragment).toContain("用词偏好：克制、留白");
  });

  it("reviewStrictness 属审核设定，不进入生成片段", () => {
    const fragment = buildPreferenceFragment({
      tone: "克制",
      reviewStrictness: "strict",
    });
    expect(fragment).not.toContain("strict");
  });
});
