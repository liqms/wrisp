import { OpenAIAdapter } from "./openai.adapter";
import { Model } from "../types";

export class VolcengineAdapter extends OpenAIAdapter {
  /** 初始化火山引擎适配器，默认使用火山方舟 API 地址 */
  constructor(
    providerId: string,
    providerName: string,
    baseUrl: string,
    apiKey: string,
    models: Model[],
  ) {
    const url = baseUrl || "https://ark.cn-beijing.volces.com/api/v3";
    super(providerId, providerName, url, apiKey, models);
  }
}
