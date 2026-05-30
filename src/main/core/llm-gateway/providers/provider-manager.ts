import { AIProvider } from "@/shared/types/config.types";
import { BaseAdapter } from "../adapters/base.adapter";
import { OpenAIAdapter } from "../adapters/openai.adapter";
import { DeepSeekAdapter } from "../adapters/deepseek.adapter";
import { QwenAdapter } from "../adapters/qwen.adapter";
import { ClaudeAdapter } from "../adapters/claude.adapter";
import { LocalAdapter } from "../adapters/local.adapter";
import { VolcengineAdapter } from "../adapters/volcengine.adapter";
import { AdapterInfo } from "../types";
import { Logger } from "@/main/utils/logger";

export class ProviderManager {
  private adapters: Map<string, AdapterInfo> = new Map();

  constructor(providers: AIProvider[], providerPriority: string[]) {
    this.initFromConfig(providers, providerPriority);
  }

  private initFromConfig(providers: AIProvider[], providerPriority: string[]): void {
    const prioritySet = new Set(providerPriority);

    for (const provider of providers) {
      if (!provider.enabled) continue;
      const adapter = this.createAdapter(provider);
      if (adapter) {
        this.adapters.set(provider.id, {
          providerId: provider.id,
          adapter,
          provider,
          models: provider.models,
          isHealthy: true,
        });
        Logger.info(`LLM Gateway: 注册 Provider [${provider.name}]`, { providerId: provider.id });
      }
    }

    for (const pid of providerPriority) {
      if (!this.adapters.has(pid) && !prioritySet.has(pid)) {
      }
    }
  }

  private createAdapter(provider: AIProvider): BaseAdapter | null {
    try {
      const pid = provider.id.toLowerCase();
      if (pid === "deepseek") {
        return new DeepSeekAdapter(provider.id, provider.name, provider.baseUrl, provider.apiKey, provider.models);
      }
      if (pid === "qwen" || pid.includes("qwen") || pid.includes("tongyi")) {
        return new QwenAdapter(provider.id, provider.name, provider.baseUrl, provider.apiKey, provider.models);
      }
      if (pid === "claude" || pid.includes("anthropic")) {
        return new ClaudeAdapter(provider.id, provider.name, provider.baseUrl, provider.apiKey, provider.models);
      }
      if (pid === "local" || pid === "ollama" || pid.includes("ollama")) {
        return new LocalAdapter(provider.id, provider.name, provider.baseUrl, provider.apiKey, provider.models);
      }
      if (pid === "volcengine" || pid.includes("volc") || pid.includes("doubao")) {
        return new VolcengineAdapter(provider.id, provider.name, provider.baseUrl, provider.apiKey, provider.models);
      }
      return new OpenAIAdapter(provider.id, provider.name, provider.baseUrl, provider.apiKey, provider.models);
    } catch (error) {
      Logger.error(`创建 Provider [${provider.id}] 适配器失败`, { error: String(error) });
      return null;
    }
  }

  getAdapterByModel(modelName: string): BaseAdapter | null {
    for (const info of this.adapters.values()) {
      if (!info.isHealthy) continue;
      if (info.models.some(m => m.id === modelName)) {
        return info.adapter;
      }
    }
    return null;
  }

  getAdapterByProvider(providerId: string): BaseAdapter | null {
    const info = this.adapters.get(providerId);
    return info?.isHealthy ? info.adapter : null;
  }

  getAdapterInfo(providerId: string): AdapterInfo | undefined {
    return this.adapters.get(providerId);
  }

  getAllAdapters(): AdapterInfo[] {
    return Array.from(this.adapters.values());
  }

  getHealthyAdapters(): AdapterInfo[] {
    return Array.from(this.adapters.values()).filter(a => a.isHealthy);
  }

  getDefaultAdapter(): BaseAdapter | null {
    const healthy = this.getHealthyAdapters();
    return healthy.length > 0 ? healthy[0].adapter : null;
  }

  setHealth(providerId: string, healthy: boolean): void {
    const info = this.adapters.get(providerId);
    if (info) {
      info.isHealthy = healthy;
    }
  }

  addProvider(provider: AIProvider): void {
    const adapter = this.createAdapter(provider);
    if (adapter) {
      this.adapters.set(provider.id, {
        providerId: provider.id,
        adapter,
        provider,
        models: provider.models,
        isHealthy: true,
      });
    }
  }

  removeProvider(providerId: string): void {
    this.adapters.delete(providerId);
  }

  updateProvider(provider: AIProvider): void {
    this.removeProvider(provider.id);
    if (provider.enabled) {
      this.addProvider(provider);
    }
  }

  refreshAll(providers: AIProvider[], providerPriority: string[]): void {
    this.adapters.clear();
    this.initFromConfig(providers, providerPriority);
  }
}