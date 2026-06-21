import { CostRecord, CostSummary } from "../types";
import { GatewayLogger } from "./logger";

export class CostTracker {
  private records: CostRecord[] = [];
  private totalPromptTokens: number = 0;
  private totalCompletionTokens: number = 0;
  private totalTokens: number = 0;

  record(providerId: string, model: string, promptTokens: number, completionTokens: number): void {
    const record: CostRecord = {
      timestamp: Date.now(),
      providerId,
      model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };

    this.records.push(record);
    this.totalPromptTokens += promptTokens;
    this.totalCompletionTokens += completionTokens;
    this.totalTokens += record.totalTokens;

    GatewayLogger.debug("Token 用量记录", {
      provider: providerId,
      model,
      promptTokens,
      completionTokens,
    });
  }

  getSummary(): CostSummary {
    return {
      totalPromptTokens: this.totalPromptTokens,
      totalCompletionTokens: this.totalCompletionTokens,
      totalTokens: this.totalTokens,
      records: [...this.records],
    };
  }

  getRecentRecords(count: number = 20): CostRecord[] {
    return this.records.slice(-count);
  }

  reset(): void {
    this.records = [];
    this.totalPromptTokens = 0;
    this.totalCompletionTokens = 0;
    this.totalTokens = 0;
  }
}