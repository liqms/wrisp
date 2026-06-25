import { OpenAIAdapter } from "./openai.adapter";
import { Model } from "../types";

export class DeepSeekAdapter extends OpenAIAdapter {
  /** 初始化 DeepSeek 适配器，默认使用 DeepSeek API 地址 */
  constructor(providerId: string, providerName: string, baseUrl: string, apiKey: string, models: Model[]) {
    const url = baseUrl || "https://api.deepseek.com";
    super(providerId, providerName, url, apiKey, models);
  }
}