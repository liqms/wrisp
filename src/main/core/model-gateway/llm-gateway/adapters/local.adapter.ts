import { OpenAIAdapter } from "./openai.adapter";
import { Model } from "../types";

export class LocalAdapter extends OpenAIAdapter {
  /** 初始化本地 Ollama 适配器，默认使用 localhost:11434 */
  constructor(providerId: string, providerName: string, baseUrl: string, apiKey: string, models: Model[]) {
    const url = baseUrl || "http://localhost:11434/v1";
    super(providerId, providerName, url, apiKey || "ollama", models);
  }
}