import { LLMRequest, LLMResponse, LLMStreamChunk, FailoverConfig } from "../types";
import { BaseAdapter } from "../adapters/base.adapter";
import { ProviderManager } from "../providers/provider-manager";
import { ModelSelector } from "./model-selector";
import { Logger } from "@/main/utils/logger";

interface CircuitState {
  failureCount: number;
  lastFailureTime: number;
  isOpen: boolean;
}

export class FailoverHandler {
  private config: FailoverConfig;
  private providerManager: ProviderManager;
  private modelSelector: ModelSelector;
  private circuits: Map<string, CircuitState> = new Map();

  constructor(config: FailoverConfig, providerManager: ProviderManager, modelSelector: ModelSelector) {
    this.config = config;
    this.providerManager = providerManager;
    this.modelSelector = modelSelector;
  }

  async execute(request: LLMRequest): Promise<LLMResponse> {
    let currentAdapter = this.modelSelector.select(request);

    while (currentAdapter) {
      const providerId = currentAdapter.getProviderId();

      if (this.isCircuitOpen(providerId)) {
        Logger.warn(`Provider [${providerId}] 已熔断，尝试降级`);
        currentAdapter = this.modelSelector.getNextProvider(providerId);
        if (currentAdapter) {
          request.model = this.modelSelector.getDefaultModelForProvider(currentAdapter.getProviderId());
        }
        continue;
      }

      try {
        const result = await this.retryWithBackoff(currentAdapter, request);
        this.onSuccess(providerId);
        return result;
      } catch (error) {
        Logger.warn(`Provider [${providerId}] 调用失败: ${String(error)}`);
        this.onFailure(providerId);

        currentAdapter = this.modelSelector.getNextProvider(providerId);
        if (currentAdapter) {
          request.model = this.modelSelector.getDefaultModelForProvider(currentAdapter.getProviderId());
        }
      }
    }

    throw new Error("NO_AVAILABLE_PROVIDER: 所有 AI Provider 均不可用");
  }

  async executeStream(
    request: LLMRequest,
    streamFn: (adapter: BaseAdapter, request: LLMRequest) => Promise<LLMStreamChunk[]>,
  ): Promise<{ providerId: string; chunks: LLMStreamChunk[] }> {
    let currentAdapter = this.modelSelector.select(request);

    while (currentAdapter) {
      const providerId = currentAdapter.getProviderId();

      if (this.isCircuitOpen(providerId)) {
        Logger.warn(`Provider [${providerId}] 已熔断，尝试降级`);
        currentAdapter = this.modelSelector.getNextProvider(providerId);
        if (currentAdapter) {
          request.model = this.modelSelector.getDefaultModelForProvider(currentAdapter.getProviderId());
        }
        continue;
      }

      try {
        const chunks = await streamFn(currentAdapter, request);
        this.onSuccess(providerId);
        return { providerId, chunks };
      } catch (error) {
        Logger.warn(`Provider [${providerId}] 流式调用失败: ${String(error)}`);
        this.onFailure(providerId);

        currentAdapter = this.modelSelector.getNextProvider(providerId);
        if (currentAdapter) {
          request.model = this.modelSelector.getDefaultModelForProvider(currentAdapter.getProviderId());
        }
      }
    }

    throw new Error("NO_AVAILABLE_PROVIDER: 所有 AI Provider 均不可用");
  }

  private async retryWithBackoff(adapter: BaseAdapter, request: LLMRequest): Promise<LLMResponse> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await adapter.chatCompletion(request);
      } catch (error) {
        lastError = error;
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          Logger.debug(`Provider [${adapter.getProviderId()}] 重试 ${attempt + 1}/${this.config.maxRetries}, 等待 ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private isCircuitOpen(providerId: string): boolean {
    const circuit = this.circuits.get(providerId);
    if (!circuit || !circuit.isOpen) return false;

    const cooldownElapsed = Date.now() - circuit.lastFailureTime;
    if (cooldownElapsed >= this.config.cooldownMs) {
      circuit.isOpen = false;
      circuit.failureCount = 0;
      return false;
    }

    return true;
  }

  private onSuccess(providerId: string): void {
    const circuit = this.circuits.get(providerId);
    if (circuit) {
      circuit.failureCount = 0;
      circuit.isOpen = false;
    }
    this.providerManager.setHealth(providerId, true);
  }

  private onFailure(providerId: string): void {
    let circuit = this.circuits.get(providerId);
    if (!circuit) {
      circuit = { failureCount: 0, lastFailureTime: 0, isOpen: false };
      this.circuits.set(providerId, circuit);
    }

    circuit.failureCount++;
    circuit.lastFailureTime = Date.now();

    if (circuit.failureCount >= this.config.circuitBreakerThreshold) {
      circuit.isOpen = true;
      this.providerManager.setHealth(providerId, false);
      Logger.warn(`Provider [${providerId}] 熔断触发，冷却 ${this.config.cooldownMs}ms`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}