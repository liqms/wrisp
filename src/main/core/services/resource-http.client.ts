import { RESOURCE_CONFIG } from "@/main/constants/resource.constants";
import { Logger } from "@/main/utils/logger";

export type FetchResult = { ok: true; text: string } | { ok: false; error: string };

class ResourceHttpClient {
  private static instance: ResourceHttpClient | null = null;
  private constructor() {}
  public static getInstance(): ResourceHttpClient {
    if (!ResourceHttpClient.instance) ResourceHttpClient.instance = new ResourceHttpClient();
    return ResourceHttpClient.instance;
  }
  private sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

  async fetchText(url: string): Promise<FetchResult> {
    const maxAttempts = RESOURCE_CONFIG.maxRetries + 1;
    let lastError = "";
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), RESOURCE_CONFIG.requestTimeout);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) {
          lastError = `HTTP ${res.status} ${res.statusText}`;
          Logger.warn("Resource fetch non-2xx", { url, status: res.status, attempt });
        } else {
          return { ok: true, text: await res.text() };
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        Logger.warn("Resource fetch error", { url, error: lastError, attempt });
      }
      if (attempt < maxAttempts) await this.sleep(RESOURCE_CONFIG.retryDelayMs);
    }
    return { ok: false, error: lastError };
  }
}

export const resourceHttpClient = ResourceHttpClient.getInstance();
