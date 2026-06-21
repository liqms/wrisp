import { FailoverConfig } from "./types";

export const DEFAULT_FAILOVER_CONFIG: FailoverConfig = {
  maxRetries: 2,
  retryDelayMs: 1000,
  circuitBreakerThreshold: 3,
  cooldownMs: 30000,
};