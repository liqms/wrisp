import OpenAI from "openai";
import { BaseAdapter } from "./base.adapter";
import { LLMRequest, LLMResponse, LLMStreamChunk, Model } from "../types";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_TIMEOUT_MS = 60000;

export class OpenAIAdapter extends BaseAdapter {
  private client: OpenAI;

  constructor (providerId: string, providerName: string, baseUrl: string, apiKey: string, models: Model[]) {
    const url = baseUrl || DEFAULT_OPENAI_BASE_URL;
    super(providerId, providerName, url, apiKey, models);
    this.client = new OpenAI({
      apiKey: apiKey || "empty",
      baseURL: url,
      maxRetries: 0,
      timeout: DEFAULT_TIMEOUT_MS,
    });
  }

  async chatCompletion(request: LLMRequest): Promise<LLMResponse> {
    const data = await this.client.chat.completions.create({
      model: request.model || this.models[0]?.id || "",
      messages: request.messages.map(m => ({ role: m.role, content: m.content })),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      stop: request.stop,
      stream: false,
    });

    return {
      id: data.id,
      model: data.model,
      providerId: this.providerId,
      content: data.choices[0].message.content || "",
      finishReason: data.choices[0].finish_reason || "stop",
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }

  async *chatCompletionStream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: request.model || this.models[0]?.id || "",
      messages: request.messages.map(m => ({ role: m.role, content: m.content })),
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

  async testConnection(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

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