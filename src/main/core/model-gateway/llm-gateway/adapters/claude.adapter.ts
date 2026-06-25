import Anthropic from "@anthropic-ai/sdk";
import { BaseAdapter } from "./base.adapter";
import { LLMRequest, LLMResponse, LLMStreamChunk, Model } from "../types";

const DEFAULT_CLAUDE_BASE_URL = "https://api.anthropic.com/v1";

export class ClaudeAdapter extends BaseAdapter {
  private client: Anthropic;

  /** 初始化 Claude 适配器，创建 Anthropic SDK 客户端 */
  constructor (providerId: string, providerName: string, baseUrl: string, apiKey: string, models: Model[]) {
    const url = baseUrl || DEFAULT_CLAUDE_BASE_URL;
    super(providerId, providerName, url, apiKey, models);
    this.client = new Anthropic({
      apiKey: apiKey || "empty",
      baseURL: url,
      maxRetries: 0,
    });
  }

  /** 调用 Anthropic API 执行非流式聊天补全 */
  async chatCompletion(request: LLMRequest): Promise<LLMResponse> {
    const systemMessages = request.messages.filter(m => m.role === "system");
    const nonSystemMessages = request.messages.filter(m => m.role !== "system");

    const data = await this.client.messages.create({
      model: request.model || this.models[0]?.id || "",
      max_tokens: request.maxTokens || 4096,
      messages: nonSystemMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      system: systemMessages.length > 0 ? systemMessages.map(m => m.content).join("\n") : undefined,
      temperature: request.temperature,
      top_p: request.topP,
      stop_sequences: request.stop,
    });

    const textContent = data.content.find(c => c.type === "text");
    return {
      id: data.id,
      model: data.model,
      providerId: this.providerId,
      content: textContent?.type === "text" ? textContent.text : "",
      finishReason: data.stop_reason || "stop",
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
    };
  }

  /** 调用 Anthropic API 执行流式聊天补全 */
  async *chatCompletionStream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const systemMessages = request.messages.filter(m => m.role === "system");
    const nonSystemMessages = request.messages.filter(m => m.role !== "system");

    const stream = await this.client.messages.create({
      model: request.model || this.models[0]?.id || "",
      max_tokens: request.maxTokens || 4096,
      messages: nonSystemMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      system: systemMessages.length > 0 ? systemMessages.map(m => m.content).join("\n") : undefined,
      temperature: request.temperature,
      top_p: request.topP,
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield {
          content: event.delta.text,
          finishReason: null,
          usage: null,
        };
      }
      if (event.type === "message_start" && event.message.usage) {
        yield {
          content: "",
          finishReason: null,
          usage: {
            promptTokens: event.message.usage.input_tokens,
            completionTokens: event.message.usage.output_tokens,
            totalTokens: event.message.usage.input_tokens + event.message.usage.output_tokens,
          },
        };
      }
      if (event.type === "message_delta") {
        yield {
          content: "",
          finishReason: event.delta.stop_reason || null,
          usage: {
            promptTokens: 0,
            completionTokens: event.usage.output_tokens || 0,
            totalTokens: event.usage.output_tokens || 0,
          },
        };
      }
    }
  }

  /** 测试与 Anthropic API 的连接是否正常 */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.models.list({ limit: 1 });
      return true;
    } catch {
      return false;
    }
  }

  /** 从 Anthropic API 获取可用模型列表 */
  async listModels(): Promise<Model[]> {
    try {
      const data = await this.client.models.list();
      return data.data.map(m => ({
        id: m.id,
        name: m.display_name || m.id,
        outputType: "text",
        contextLength: m.max_input_tokens || 0,
        maxTokens: m.max_tokens || 0,
        isInputText: true,
        isInputPic: m.capabilities?.image_input.supported || false,
        isInputAudio: false,
        isInputVideo: false,
        structuredOutputs: m.capabilities?.structured_outputs.supported || false,
      }));
    } catch {
      return this.models;
    }
  }
}