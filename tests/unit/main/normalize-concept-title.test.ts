// @vitest-environment node
import { describe, it, expect } from "vitest";
import { normalizeConceptTitle } from "@/shared/utils";

describe("normalizeConceptTitle", () => {
  it("全半角与大小写差异归一到同一键", () => {
    expect(normalizeConceptTitle("ＲＡＧ")).toBe(normalizeConceptTitle("rag"));
    expect(normalizeConceptTitle("Vector Store")).toBe("vector store");
  });

  it("折叠内部空白并剥离首尾标点（含中文全角）", () => {
    expect(normalizeConceptTitle("  检索   增强  ")).toBe("检索 增强");
    expect(normalizeConceptTitle("「向量数据库」。")).toBe("向量数据库");
  });

  it("按码点截断到 24，不切断代理对", () => {
    const long = "概".repeat(40);
    expect(Array.from(normalizeConceptTitle(long))).toHaveLength(24);

    // 扩充 B 区汉字是代理对：按 .length 截断会得到半个码元，按码点截断不会
    expect(normalizeConceptTitle("𠀋".repeat(30))).toBe("𠀋".repeat(24));
  });

  it("纯标点标题归一为空串，交由调用方跳过", () => {
    expect(normalizeConceptTitle("——（）")).toBe("");
  });

  it("上下位概念不被合并（键不同）", () => {
    expect(normalizeConceptTitle("向量检索")).not.toBe(normalizeConceptTitle("全文检索"));
  });
});
