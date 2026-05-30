import { OpenAIAdapter } from "./openai.adapter";
import { Model } from "../types";

export class VolcengineAdapter extends OpenAIAdapter {
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
