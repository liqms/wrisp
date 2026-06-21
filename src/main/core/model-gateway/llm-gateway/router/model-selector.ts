import { BaseAdapter } from "../adapters/base.adapter";
import { ProviderManager } from "../providers/provider-manager";
import { LLMRequest, DefaultModel } from "../types";

export class ModelSelector {
  private providerManager: ProviderManager;
  private providerPriority: string[];
  private defaultModels: DefaultModel[];

  constructor(providerManager: ProviderManager, providerPriority: string[], defaultModels: DefaultModel[]) {
    this.providerManager = providerManager;
    this.providerPriority = providerPriority;
    this.defaultModels = defaultModels;
  }

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

  getNextProvider(currentProviderId: string): BaseAdapter | null {
    const currentIndex = this.providerPriority.indexOf(currentProviderId);
    const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;

    for (let i = startIndex; i < this.providerPriority.length; i++) {
      const adapter = this.providerManager.getAdapterByProvider(this.providerPriority[i]);
      if (adapter) return adapter;
    }

    return null;
  }

  updateDefaultModels(defaultModels: DefaultModel[]): void {
    this.defaultModels = defaultModels;
  }

  updateProviderPriority(providerPriority: string[]): void {
    this.providerPriority = providerPriority;
  }

  getDefaultModelForProvider(providerId: string): string | undefined {
    const defaultModel = this.defaultModels.find(dm => dm.providerId === providerId);
    return defaultModel?.modelId;
  }
}