// @vitest-environment node
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * 回归锚点：QwenChatWrapper 默认 thoughts:"auto" 会在回复起始强制打开 <think>，
 * 而 session.prompt() 的返回值不含思考段 —— 思考吃满 maxTokens 后主回复为空串，
 * 概念抽取据此抛「输出中未找到 JSON 数组」。故会话必须显式拿到关闭思考的 wrapper。
 */
const h = vi.hoisted(() => {
  const sessionOptions: Array<Record<string, unknown>> = [];
  const resolveArgs: unknown[][] = [];
  const fakeWrapper = { tag: "no-thinking-wrapper" };
  const sequence = {
    clearHistory: vi.fn(async () => undefined),
    dispose: vi.fn(async () => undefined),
  };
  const context = {
    getSequence: () => sequence,
    dispose: vi.fn(async () => undefined),
  };
  const model = {
    createContext: vi.fn(async () => context),
    dispose: vi.fn(async () => undefined),
  };
  const llama = {
    loadModel: vi.fn(async () => model),
    dispose: vi.fn(async () => undefined),
  };
  return { sessionOptions, resolveArgs, fakeWrapper, model, llama };
});

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("node-llama-cpp", () => ({
  getLlama: vi.fn(async () => h.llama),
  resolveChatWrapper: vi.fn((...args: unknown[]) => {
    h.resolveArgs.push(args);
    return h.fakeWrapper;
  }),
  GeneralChatWrapper: class {},
  LlamaChatSession: class {
    constructor(options: Record<string, unknown>) {
      h.sessionOptions.push(options);
    }
    async prompt(): Promise<string> {
      return "[]";
    }
    dispose(): void {}
  },
}));

import { resolveChatWrapper } from "node-llama-cpp";
import * as llmHandler from "@/main/core/model-gateway/local-gateway/worker/llm-handler";

const MODEL_FILE = join(process.cwd(), "package.json");

async function loadHandler(): Promise<void> {
  await llmHandler.load({ modelPath: MODEL_FILE, gpu: "cpu" });
}

afterEach(async () => {
  await llmHandler.unload();
  h.sessionOptions.length = 0;
  h.resolveArgs.length = 0;
  vi.mocked(resolveChatWrapper).mockClear();
});

describe("本地 LLM 会话的思考段", () => {
  it("以关闭思考的 chat wrapper 创建会话", async () => {
    await loadHandler();
    await llmHandler.generate("ping");

    expect(h.sessionOptions).toHaveLength(1);
    expect(h.sessionOptions[0].chatWrapper).toBe(h.fakeWrapper);
  });

  it("wrapper 由已加载的模型解析而来，并显式关闭 qwen 思考", async () => {
    await loadHandler();
    await llmHandler.generate("ping");

    expect(resolveChatWrapper).toHaveBeenCalledTimes(1);
    const [modelArg, optionsArg] = h.resolveArgs[0];
    expect(modelArg).toBe(h.model);
    expect(
      (optionsArg as { customWrapperSettings: Record<string, unknown> })
        .customWrapperSettings,
    ).toEqual({ qwen: { thoughts: "discourage" }, jinjaTemplate: { reasoning: false } });
  });

  it("卸载后清空 wrapper，下次加载重新解析", async () => {
    await loadHandler();
    await llmHandler.generate("ping");
    await llmHandler.unload();

    await loadHandler();
    await llmHandler.generate("ping");

    expect(resolveChatWrapper).toHaveBeenCalledTimes(2);
    expect(h.sessionOptions[1].chatWrapper).toBe(h.fakeWrapper);
  });
});
