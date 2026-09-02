// @vitest-environment node
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof global.fetch;
const sleepMock = vi.spyOn(global, "setTimeout");

import { resourceHttpClient } from "@/main/core/services/resource-http.client";

describe("ResourceHttpClient", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    sleepMock.mockReset();
    sleepMock.mockImplementation((cb: () => void) => { cb(); return 0 as unknown as NodeJS.Timeout; });
  });
  afterEach(() => sleepMock.mockRestore());

  it("成功返回 text", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => "hello" } as Response);
    const r = await resourceHttpClient.fetchText("https://example.com/a.json");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe("hello");
  });
  it("HTTP 404 失败", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, text: async () => "" } as Response);
    const r = await resourceHttpClient.fetchText("https://example.com/x.json");
    expect(r.ok).toBe(false);
  });
  it("网络错误重试 3 次", async () => {
    fetchMock.mockRejectedValue(new Error("network error"));
    const r = await resourceHttpClient.fetchText("https://example.com/a.json");
    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("首次失败重试成功", async () => {
    fetchMock.mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "ok" } as Response);
    const r = await resourceHttpClient.fetchText("https://example.com/a.json");
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
