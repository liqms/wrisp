// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";
vi.mock("@/main/utils/logger", () => ({ Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() } }));

const mockSync = vi.hoisted(() => ({
  getStatus: vi.fn(() => ({ syncing: false, lastSyncAt: null, lastSyncSuccess: false, lastError: null })),
  checkAndSync: vi.fn(async () => ({ success: true, changedTypes: [], added: [], updated: [] })),
}));
vi.mock("@/main/core/services/resource-sync.service", () => ({ resourceSyncService: mockSync }));

import { getSyncStatus, syncNow } from "@/main/core/apis/resource.api";

describe("Resource API", () => {
  beforeEach(() => vi.clearAllMocks());
  it("getSyncStatus 返回状态", async () => {
    mockSync.getStatus.mockReturnValueOnce({ syncing: false, lastSyncAt: "2026-08-31T10:00:00Z", lastSyncSuccess: true, lastError: null });
    const r = await getSyncStatus();
    expect(r.success).toBe(true);
    expect(r.data?.lastSyncSuccess).toBe(true);
  });
  it("syncNow 返回同步结果", async () => {
    mockSync.checkAndSync.mockResolvedValueOnce({ success: true, changedTypes: ["slash"], added: ["slash/a.json"], updated: [] });
    const r = await syncNow();
    expect(r.success).toBe(true);
    expect(r.data?.changedTypes).toContain("slash");
  });
});
