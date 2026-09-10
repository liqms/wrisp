import { describe, it, expect } from "vitest";
import { buildPageWriteInputs } from "@/main/core/services/page-write-context";

describe("buildPageWriteInputs", () => {
  it("把作品信息、页面概述与模板骨架装配为技能输入", () => {
    const inputs = buildPageWriteInputs({
      brief: { name: "长夜", type: "novel", audience: "青年读者", tone: "克制" },
      style: { tone: "冷峻", pov: "第一人称" },
      pageTitle: "第一章",
      overview: "主角初到边城",
      templateSkeleton: "# 第一章",
    });

    expect(inputs.audience).toBe("青年读者");
    expect(inputs.overview).toBe("主角初到边城");
    expect(inputs.workName).toBe("长夜");
  });

  it("作品风格优先于简报中的同名字段（更具体的赢）", () => {
    const inputs = buildPageWriteInputs({
      brief: { name: "x", type: "novel", tone: "温和" },
      style: { tone: "冷峻", pov: "第三人称" },
      pageTitle: "t",
      overview: "o",
    });

    expect(inputs.tone).toBe("冷峻");
    expect(inputs.pov).toBe("第三人称");
  });

  it("缺失字段不注入空串（避免给模型喂噪音）", () => {
    const inputs = buildPageWriteInputs({
      brief: { name: "x", type: "novel" },
      pageTitle: "t",
      overview: "o",
    });

    expect("audience" in inputs).toBe(false);
    expect("tone" in inputs).toBe(false);
    expect("templateSkeleton" in inputs).toBe(false);
  });
});
