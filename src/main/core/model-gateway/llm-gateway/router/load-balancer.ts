import { LLMRequest } from "../types";
import { BaseAdapter } from "../adapters/base.adapter";
import { ProviderManager } from "../providers/provider-manager";

export class LoadBalancer {
  private providerManager: ProviderManager;
  private roundRobinCounters: Map<string, number> = new Map();

  constructor(providerManager: ProviderManager) {
    this.providerManager = providerManager;
  }

  select(request: LLMRequest, candidates: BaseAdapter[]): BaseAdapter | null {
    if (candidates.length === 0) {
      return this.providerManager.getDefaultAdapter();
    }

    if (candidates.length === 1) {
      return candidates[0];
    }

    const key = request.model || "default";
    const counter = this.roundRobinCounters.get(key) || 0;

    const healthyCandidates = candidates.filter(a => {
      const info = this.providerManager.getAdapterInfo(a.getProviderId());
      return info?.isHealthy !== false;
    });

    if (healthyCandidates.length === 0) return null;

    const index = counter % healthyCandidates.length;
    this.roundRobinCounters.set(key, counter + 1);

    return healthyCandidates[index];
  }
}