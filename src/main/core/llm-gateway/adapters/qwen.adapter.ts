import { OpenAIAdapter } from "./openai.adapter";
import { Model } from "../types";

export class QwenAdapter extends OpenAIAdapter {
  constructor(providerId: string, providerName: string, baseUrl: string, apiKey: string, models: Model[]) {
    const url = baseUrl || "https://dashscope.aliyuncs.com/compatible-mode/v1";
    super(providerId, providerName, url, apiKey, models);
  }
}