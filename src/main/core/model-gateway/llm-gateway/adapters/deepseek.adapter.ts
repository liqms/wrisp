import { OpenAIAdapter } from "./openai.adapter";
import { Model } from "../types";

export class DeepSeekAdapter extends OpenAIAdapter {
  constructor(providerId: string, providerName: string, baseUrl: string, apiKey: string, models: Model[]) {
    const url = baseUrl || "https://api.deepseek.com";
    super(providerId, providerName, url, apiKey, models);
  }
}