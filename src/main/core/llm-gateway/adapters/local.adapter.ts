import { OpenAIAdapter } from "./openai.adapter";
import { Model } from "../types";

export class LocalAdapter extends OpenAIAdapter {
  constructor(providerId: string, providerName: string, baseUrl: string, apiKey: string, models: Model[]) {
    const url = baseUrl || "http://localhost:11434/v1";
    super(providerId, providerName, url, apiKey || "ollama", models);
  }
}