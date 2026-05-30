import { LLMRequest, LLMResponse, LLMStreamChunk, Model } from "../types";

export abstract class BaseAdapter {
  protected providerId: string;
  protected providerName: string;
  protected baseUrl: string;
  protected apiKey: string;
  protected models: Model[];

  constructor(providerId: string, providerName: string, baseUrl: string, apiKey: string, models: Model[]) {
    this.providerId = providerId;
    this.providerName = providerName;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.models = models;
  }

  getProviderId(): string { return this.providerId; }
  getModels(): Model[] { return this.models; }

  abstract listModels(): Promise<Model[]>;
  abstract chatCompletion(request: LLMRequest): Promise<LLMResponse>;
  abstract chatCompletionStream(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
  abstract testConnection(): Promise<boolean>;
}