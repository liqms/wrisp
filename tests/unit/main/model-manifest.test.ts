import { describe, it, expect } from "vitest";
import {
  BUILTIN_MODELS,
  getModelManifest,
} from "@/main/core/model-gateway/local-gateway/model-registry";

describe("getModelManifest", () => {
  it("覆盖注册表里的每个模型，包含本地 LLM", () => {
    const manifest = getModelManifest();

    expect(manifest.map((m) => m.modelId)).toEqual(
      BUILTIN_MODELS.map((m) => m.modelId),
    );
    expect(manifest.some((m) => m.family === "llm")).toBe(true);
  });

  it("文件清单取自默认变体，体积与默认变体声明一致", () => {
    const manifest = getModelManifest();

    for (const entry of manifest) {
      const spec = BUILTIN_MODELS.find((m) => m.modelId === entry.modelId)!;
      const variant = spec.variants.find(
        (v) => v.variantId === spec.defaultVariant,
      )!;

      expect(entry.family).toBe(spec.family);
      expect(entry.sizeGB).toBe(variant.sizeGB);
      expect(entry.files).toEqual(
        variant.requiredFiles.map((f) => ({
          remotePath: f.remotePath,
          localPath: f.localPath,
        })),
      );
    }
  });

  it("LLM 条目暴露完整的 GGUF remotePath，可被渲染端精确匹配", () => {
    const llm = getModelManifest().find((m) => m.family === "llm")!;

    expect(llm.files).toHaveLength(1);
    expect(llm.files[0].remotePath).toMatch(/\.gguf$/);
    expect(llm.files[0].localPath).toBe(
      llm.files[0].remotePath.split("/").pop(),
    );
  });
});
