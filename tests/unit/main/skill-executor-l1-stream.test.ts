// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// 需要在此定义流式 chunk 数据（闭包内，供 mock 工厂引用）
const streamChunks = [
  { content: "Hello", finishReason: null, usage: null },
  { content: " World", finishReason: null, usage: null },
  { content: "", finishReason: "stop", usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7 } },
];

vi.mock("@/main/core/services/ai.service", () => ({
  aiService: {
    chatCompletionStream: vi.fn(async function* () {
      for (const c of streamChunks) yield c;
    }),
    chatCompletion: vi.fn().mockResolvedValue({ content: "ok", model: "mock", usage: { totalTokens: 1 } }),
  },
}));

vi.mock("@/main/core/skills/skill.manager", () => ({
  skillManager: {
    getSkillDefinition: vi.fn().mockReturnValue({
      id: "test-skill",
      name: { zh: "测试", en: "Test" },
      description: { zh: "", en: "" },
      promptTemplate: { zh: "Say hello to {{name}}", en: "Say hello to {{name}}" },
      enabled: true,
      tools: [],
    }),
  },
}));

vi.mock("@/main/core/skills/tool.registry", () => ({
  toolRegistry: {
    getToolsForLLM: vi.fn().mockReturnValue([]),
  },
}));

vi.mock("@/main/core/services/config.service", () => ({
  configService: {
    getValue: vi.fn().mockReturnValue("zhCN"),
  },
}));

vi.mock("@/main/utils/logger", () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { skillExecutor } from "@/main/core/skills/skill.executor";
import { aiService } from "@/main/core/services/ai.service";
import { skillManager } from "@/main/core/skills/skill.manager";

describe("SkillExecutor L1 Stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("流式输出多个 delta chunk 并最终 done", async () => {
    const deltas: string[] = [];
    let finalChunk: { delta: string; done: boolean; error?: string } | null = null;
    for await (const chunk of skillExecutor.executeL1Stream("test-skill", { name: "Alice" })) {
      if (chunk.delta && !chunk.done) deltas.push(chunk.delta);
      if (chunk.done) finalChunk = chunk;
    }
    // 中间增量 chunk
    expect(deltas).toEqual(["Hello", " World"]);
    // 结束 chunk（delta = postProcess 后的完整内容）
    expect(finalChunk?.done).toBe(true);
    expect(aiService.chatCompletionStream).toHaveBeenCalled();
  });

  it("skill 不存在时立即返回 done+error", async () => {
    vi.mocked(skillManager.getSkillDefinition).mockReturnValue(null as never);
    const chunks: Array<{ delta: string; done: boolean; error?: string }> = [];
    for await (const chunk of skillExecutor.executeL1Stream("missing-skill", {})) {
      chunks.push(chunk);
    }
    expect(chunks[0].done).toBe(true);
    expect(chunks[0].error).toContain("SKILL_NOT_FOUND");
  });

  it("L2 skill（含 tools）不支持流式", async () => {
    vi.mocked(skillManager.getSkillDefinition).mockReturnValue({
      id: "l2-skill",
      name: { zh: "", en: "" },
      description: { zh: "", en: "" },
      promptTemplate: { zh: "", en: "" },
      enabled: true,
      tools: [
        {
          type: "function",
          function: { name: "search", description: "", parameters: { type: "object", properties: {} } },
        },
      ],
    } as never);
    const chunks: Array<{ delta: string; done: boolean; error?: string }> = [];
    for await (const chunk of skillExecutor.executeL1Stream("l2-skill", {})) {
      chunks.push(chunk);
    }
    expect(chunks[0].done).toBe(true);
    expect(chunks[0].error).toBe("L2_SKILL_NOT_SUPPORTED_STREAM");
  });
});
