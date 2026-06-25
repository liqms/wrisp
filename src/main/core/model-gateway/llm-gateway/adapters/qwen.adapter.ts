import { OpenAIAdapter } from "./openai.adapter";
import { Model } from "../types";

export class QwenAdapter extends OpenAIAdapter {
  /** 初始化通义千问适配器，默认使用阿里云 DashScope API 地址 */
  constructor(providerId: string, providerName: string, baseUrl: string, apiKey: string, models: Model[]) {
    const url = baseUrl || "https://dashscope.aliyuncs.com/compatible-mode/v1";
    super(providerId, providerName, url, apiKey, models);
  }
}