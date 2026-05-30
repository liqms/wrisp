import { BaseAdapter } from "../adapters/base.adapter";
import { ProviderManager } from "../providers/provider-manager";
import { LLMRequest } from "../types";

export class ModelSelector {
  private providerManager: ProviderManager;
  private providerPriority: string[];

  constructor(providerManager: ProviderManager, providerPriority: string[]) {
    this.providerManager = providerManager;
    this.providerPriority = providerPriority;
  }

  select(request: LLMRequest): BaseAdapter | null {
    if (request.model) {
      const adapter = this.providerManager.getAdapterByModel(request.model);
      if (adapter) return adapter;
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
}