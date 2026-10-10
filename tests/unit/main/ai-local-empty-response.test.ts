// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TASK_TYPE } from "@/shared/enums";

const generateMock = vi.fn();
const generateStreamMock = vi.fn();

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/model-gateway/local-gateway", () => ({
  localGateway: {
    generate: (...args: unknown[]) => generateMock(...args),
    generateStream: (...args: unknown[]) => generateStreamMock(...args),
  },
}));
vi.mock("@/main/core/model-gateway/router", () => ({
  modelRouter: { route: vi.fn(async () => "local") },
}));
vi.mock("@/main/core/model-gateway/llm-gateway", () => ({ LLMGateway: class {} }));
vi.mock("@/main/core/services/ai/model.service", () => ({
  modelService: { getConfig: vi.fn(() => ({})) },
}));
vi.mock("@/main/core/services/system/config.service", () => ({
  configService: { getConfig: vi.fn(() => ({})) },
}));
vi.mock("@/main/core/services/ai/model-meta.service", () => ({
  modelMetaService: { getProviderModels: vi.fn(() => ({})) },
}));

import { aiService } from "@/main/core/services/ai/ai.service";

const request = {
  messages: [{ role: "user" as const, content: "概括这段内容" }],
  taskType: TASK_TYPE.SUMMARY,
  background: true,
};

async function drainStream(): Promise<string> {
  let text = "";
  for await (const chunk of aiService.chatCompletionStream(request)) {
    text += chunk.content;
  }
  return text;
}

describe("本地模型空产出", () => {
  beforeEach(() => {
    generateMock.mockReset();
    generateStreamMock.mockReset();
  });

  it("非流式：空串按失败抛出，不返回一个 content 为空的响应", async () => {
    generateMock.mockResolvedValue("");

    await expect(aiService.chatCompletion(request)).rejects.toThrow();
  });

  it("非流式：只有空白的返回同样按失败抛出", async () => {
    generateMock.mockResolvedValue("  \n\t ");

    await expect(aiService.chatCompletion(request)).rejects.toThrow();
  });

  it("非流式：有内容时原样返回（不做静默裁剪）", async () => {
    generateMock.mockResolvedValue(" 本周完成了重构 ");

    const response = await aiService.chatCompletion(request);

    expect(response.content).toBe(" 本周完成了重构 ");
  });

  it("流式：全程没有 token 产出时抛出，而不是安静地结束", async () => {
    generateStreamMock.mockResolvedValue("");

    await expect(drainStream()).rejects.toThrow();
  });

  it("流式：只有空白的产出也算空", async () => {
    generateStreamMock.mockImplementation(async (_prompt, _options, onToken) => {
      onToken("  ");
      return "  ";
    });

    await expect(drainStream()).rejects.toThrow();
  });

  it("流式：正常产出逐段下发并以下一个 stop 结束", async () => {
    generateStreamMock.mockImplementation(async (_prompt, _options, onToken) => {
      onToken("本周");
      onToken("完成了重构");
      return "本周完成了重构";
    });

    const chunks: Array<{ content: string; finishReason: string | null }> = [];
    for await (const chunk of aiService.chatCompletionStream(request)) {
      chunks.push({ content: chunk.content, finishReason: chunk.finishReason as string | null });
    }

    expect(chunks.map((c) => c.content).join("")).toBe("本周完成了重构");
    expect(chunks[chunks.length - 1].finishReason).toBe("stop");
  });
});
