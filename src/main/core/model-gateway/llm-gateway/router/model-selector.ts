import { BaseAdapter } from "../adapters/base.adapter";
import { ProviderManager } from "../providers/provider-manager";
import { LLMRequest, DefaultModel } from "../types";

export class ModelSelector {
  private providerManager: ProviderManager;
  private providerPriority: string[];
  private defaultModels: DefaultModel[];

  /** 初始化模型选择器 */
  constructor(providerManager: ProviderManager, providerPriority: string[], defaultModels: DefaultModel[]) {
    this.providerManager = providerManager;
    this.providerPriority = providerPriority;
    this.defaultModels = defaultModels;
  }

  /** 根据请求选择合适的 Provider 适配器 */
  select(request: LLMRequest): BaseAdapter | null {
    if (request.model) {
      const adapter = this.providerManager.getAdapterByModel(request.model);
      if (adapter) return adapter;
    }

    if (request.outputType) {
      const defaultModel = this.defaultModels.find(dm => dm.outputType === request.outputType);
      if (defaultModel) {
        const adapter = this.providerManager.getAdapterByProvider(defaultModel.providerId);
        if (adapter) {
          request.model = defaultModel.modelId;
          return adapter;
        }
      }
    }

    for (const providerId of this.providerPriority) {
      const adapter = this.providerManager.getAdapterByProvider(providerId);
      if (adapter) return adapter;
    }

    return this.providerManager.getDefaultAdapter();
  }

  /** 获取当前 Provider 的下一个可用 Provider（用于故障转移） */
  getNextProvider(currentProviderId: string): BaseAdapter | null {
    const currentIndex = this.providerPriority.indexOf(currentProviderId);
    const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;

    for (let i = startIndex; i < this.providerPriority.length; i++) {
      const adapter = this.providerManager.getAdapterByProvider(this.providerPriority[i]);
      if (adapter) return adapter;
    }

    return null;
  }

  /** 更新默认模型列表 */
  updateDefaultModels(defaultModels: DefaultModel[]): void {
    this.defaultModels = defaultModels;
  }

  /** 更新 Provider 优先级顺序 */
  updateProviderPriority(providerPriority: string[]): void {
    this.providerPriority = providerPriority;
  }

  /** 获取指定 Provider 的默认模型 ID */
  getDefaultModelForProvider(providerId: string): string | undefined {
    const defaultModel = this.defaultModels.find(dm => dm.providerId === providerId);
    return defaultModel?.modelId;
  }
}