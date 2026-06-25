import OpenAI from "openai";
import { BaseAdapter } from "./base.adapter";
import { LLMRequest, LLMResponse, LLMStreamChunk, Model } from "../types";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_TIMEOUT_MS = 60000;

export class OpenAIAdapter extends BaseAdapter {
  private client: OpenAI;

  /** 初始化 OpenAI 兼容适配器，创建 OpenAI SDK 客户端 */
  constructor(providerId: string, providerName: string, baseUrl: string, apiKey: string, models: Model[]) {
    const url = baseUrl || DEFAULT_OPENAI_BASE_URL;
    super(providerId, providerName, url, apiKey, models);
    this.client = new OpenAI({
      apiKey: apiKey || "empty",
      baseURL: url,
      maxRetries: 0,
      timeout: DEFAULT_TIMEOUT_MS,
    });
  }

  /** 调用 OpenAI 兼容 API 执行非流式聊天补全 */
  async chatCompletion(request: LLMRequest): Promise<LLMResponse> {
    const data = await this.client.chat.completions.create({
      model: request.model || this.models[0]?.id || "",
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      stop: request.stop,
      stream: false,
      ...(request.tools ? { tools: request.tools as OpenAI.Chat.Completions.ChatCompletionTool[] } : {}),
    });

    const choice = data.choices[0];
    const message = choice.message;

    return {
      id: data.id,
      model: data.model,
      providerId: this.providerId,
      content: message.content || "",
      finishReason: choice.finish_reason || "stop",
      toolCalls: message.tool_calls
        ?.filter(tc => tc.type === 'function')
        .map(tc => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }

  /** 调用 OpenAI 兼容 API 执行流式聊天补全 */
  async *chatCompletionStream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: request.model || this.models[0]?.id || "",
      messages: request.messages.map(m => ({ role: m.role, content: m.content })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      stop: request.stop,
      stream: true,
    });

    for await (const chunk of stream) {
      yield {
        content: chunk.choices[0]?.delta?.content || "",
        finishReason: chunk.choices[0]?.finish_reason || null,
        usage: chunk.usage
          ? {
            promptTokens: chunk.usage.prompt_tokens || 0,
            completionTokens: chunk.usage.completion_tokens || 0,
            totalTokens: chunk.usage.total_tokens || 0,
          }
          : null,
      };
    }
  }

  /** 测试与 OpenAI API 的连接是否正常 */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  /** 从远程 API 获取可用模型列表 */
  async listModels(): Promise<Model[]> {
    try {
      const data = await this.client.models.list();
      return data.data.map(m => ({
        id: m.id,
        name: m.id,
        outputType: "text",
        contextLength: 0,
        maxTokens: 0,
        isInputText: true,
        isInputPic: false,
        isInputAudio: false,
        isInputVideo: false,
      }));
    } catch {
      return this.models;
    }
  }
}