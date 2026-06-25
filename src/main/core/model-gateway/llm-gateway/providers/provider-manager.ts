import { AIProvider } from "@/shared/types/model.types";
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

  /** 初始化 ProviderManager */
  constructor(providers: AIProvider[], providerPriority: string[]) {
    this.initFromConfig(providers, providerPriority);
  }

  /** 从配置初始化 Provider 适配器列表 */
  private initFromConfig(providers: AIProvider[], providerPriority: string[]): void {
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
      if (!this.adapters.has(pid)) {
        Logger.warn(`LLM Gateway: 优先级 Provider [${pid}] 未注册`);
      }
    }
  }

  /** 根据 Provider ID 创建对应的适配器实例 */
  private createAdapter(provider: AIProvider): BaseAdapter | null {
    try {
      const pid = provider.id.toLowerCase();
      if (pid === "deepseek") {
        return new DeepSeekAdapter(provider.id, provider.name, provider.baseUrl, provider.apiKey || '', provider.models);
      }
      if (pid === "qwen" || pid.includes("qwen") || pid.includes("tongyi")) {
        return new QwenAdapter(provider.id, provider.name, provider.baseUrl, provider.apiKey || '', provider.models);
      }
      if (pid === "claude" || pid.includes("anthropic")) {
        return new ClaudeAdapter(provider.id, provider.name, provider.baseUrl, provider.apiKey || '', provider.models);
      }
      if (pid === "local" || pid === "ollama" || pid.includes("ollama")) {
        return new LocalAdapter(provider.id, provider.name, provider.baseUrl, provider.apiKey || '', provider.models);
      }
      if (pid === "volcengine" || pid.includes("volc") || pid.includes("doubao")) {
        return new VolcengineAdapter(provider.id, provider.name, provider.baseUrl, provider.apiKey || '', provider.models);
      }
      return new OpenAIAdapter(provider.id, provider.name, provider.baseUrl, provider.apiKey || '', provider.models);
    } catch (error) {
      Logger.error(`创建 Provider [${provider.id}] 适配器失败`, { error: String(error) });
      return null;
    }
  }

  /** 根据模型名称查找对应的适配器 */
  getAdapterByModel(modelName: string): BaseAdapter | null {
    for (const info of this.adapters.values()) {
      if (!info.isHealthy) continue;
      if (info.models.some(m => m.id === modelName)) {
        return info.adapter;
      }
    }
    return null;
  }

  /** 根据 Provider ID 获取适配器 */
  getAdapterByProvider(providerId: string): BaseAdapter | null {
    const info = this.adapters.get(providerId);
    return info?.isHealthy ? info.adapter : null;
  }

  /** 获取 Provider 的详细信息 */
  getAdapterInfo(providerId: string): AdapterInfo | undefined {
    return this.adapters.get(providerId);
  }

  /** 获取所有已注册的适配器 */
  getAllAdapters(): AdapterInfo[] {
    return Array.from(this.adapters.values());
  }

  /** 获取所有健康的适配器 */
  getHealthyAdapters(): AdapterInfo[] {
    return Array.from(this.adapters.values()).filter(a => a.isHealthy);
  }

  /** 获取第一个健康的适配器作为默认 */
  getDefaultAdapter(): BaseAdapter | null {
    const healthy = this.getHealthyAdapters();
    return healthy.length > 0 ? healthy[0].adapter : null;
  }

  /** 设置 Provider 的健康状态 */
  setHealth(providerId: string, healthy: boolean): void {
    const info = this.adapters.get(providerId);
    if (info) {
      info.isHealthy = healthy;
    }
  }

  /** 动态添加一个新的 AI Provider */
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

  /** 移除指定的 AI Provider */
  removeProvider(providerId: string): void {
    this.adapters.delete(providerId);
  }

  /** 更新指定的 AI Provider（先删后增） */
  updateProvider(provider: AIProvider): void {
    this.removeProvider(provider.id);
    if (provider.enabled) {
      this.addProvider(provider);
    }
  }

  /** 完全刷新所有 Provider 配置 */
  refreshAll(providers: AIProvider[], providerPriority: string[]): void {
    this.adapters.clear();
    this.initFromConfig(providers, providerPriority);
  }
}