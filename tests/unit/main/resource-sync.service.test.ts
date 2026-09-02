// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/main/utils/logger", () => ({ Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() } }));
const mockGetWorkspace = vi.hoisted(() => vi.fn(() => "/tmp/wrisp-test-ws"));
vi.mock("@/main/core/services/config.service", () => ({ configService: { getValue: mockGetWorkspace } }));
const mockFetchText = vi.hoisted(() => vi.fn());
vi.mock("@/main/core/services/resource-http.client", () => ({ resourceHttpClient: { fetchText: mockFetchText } }));
const mockParse = vi.hoisted(() => vi.fn());
const mockCompare = vi.hoisted(() => vi.fn());
const mockHash = vi.hoisted(() => vi.fn(() => "fake-hash"));
vi.mock("@/main/core/services/resource-manifest", () => ({ parseManifest: mockParse, compareManifests: mockCompare, computeFileHash: mockHash }));
vi.mock("electron", () => ({ app: { getPath: vi.fn() }, BrowserWindow: { getAllWindows: vi.fn(() => []) } }));
const mockFs = vi.hoisted(() => ({ existsSync: vi.fn(() => false), mkdirSync: vi.fn(), readFileSync: vi.fn(), writeFileSync: vi.fn(), unlinkSync: vi.fn() }));
vi.mock("fs", () => ({
  __esModule: true,
  default: mockFs,
  existsSync: mockFs.existsSync,
  mkdirSync: mockFs.mkdirSync,
  readFileSync: mockFs.readFileSync,
  writeFileSync: mockFs.writeFileSync,
  unlinkSync: mockFs.unlinkSync,
}));

import { resourceSyncService } from "@/main/core/services/resource-sync.service";
import type { RemoteManifest } from "@/shared/types/resource.types";

describe("ResourceSyncService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkspace.mockReturnValue("/tmp/wrisp-test-ws");
    mockFs.existsSync.mockReturnValue(false);
  });

  it("初始状态 syncing=false", () => {
    expect(resourceSyncService.getStatus().syncing).toBe(false);
  });
  it("manifest 拉取失败返回失败", async () => {
    mockFetchText.mockResolvedValueOnce({ ok: false, error: "net" });
    const r = await resourceSyncService.checkAndSync();
    expect(r.success).toBe(false);
  });
  it("manifest 解析失败返回失败", async () => {
    mockFetchText.mockResolvedValueOnce({ ok: true, text: "bad" });
    mockParse.mockReturnValueOnce(null);
    const r = await resourceSyncService.checkAndSync();
    expect(r.success).toBe(false);
  });
  it("全量下载成功", async () => {
    const remote: RemoteManifest = {
      version: "1.0.0", updatedAt: "2026-08-31T10:00:00Z",
      files: [
        { type: "slash", path: "slash/a.json", version: "1.0.0", sha256: "h1" },
        { type: "page", path: "page/b.json", version: "1.0.0", sha256: "h2" },
      ],
    };
    mockFetchText.mockResolvedValueOnce({ ok: true, text: "manifest" })
      .mockResolvedValueOnce({ ok: true, text: "a" })
      .mockResolvedValueOnce({ ok: true, text: "b" });
    mockParse.mockReturnValueOnce(remote);
    mockCompare.mockReturnValueOnce({ toAdd: remote.files, toUpdate: [], toRemove: [] });
    mockHash.mockReturnValueOnce("h1").mockReturnValueOnce("h2");
    mockFs.existsSync.mockReturnValue(false);
    const r = await resourceSyncService.checkAndSync();
    expect(r.success).toBe(true);
    expect(r.added).toHaveLength(2);
    expect(r.changedTypes).toContain("slash");
  });
  it("部分下载失败跳过", async () => {
    const remote: RemoteManifest = {
      version: "1.0.0", updatedAt: "",
      files: [
        { type: "slash", path: "slash/a.json", version: "1.0.0", sha256: "h1" },
        { type: "slash", path: "slash/b.json", version: "1.0.0", sha256: "h2" },
      ],
    };
    mockFetchText.mockResolvedValueOnce({ ok: true, text: "manifest" })
      .mockResolvedValueOnce({ ok: true, text: "a" })
      .mockResolvedValueOnce({ ok: false, error: "404" });
    mockParse.mockReturnValueOnce(remote);
    mockCompare.mockReturnValueOnce({ toAdd: remote.files, toUpdate: [], toRemove: [] });
    mockHash.mockReturnValue("h1");
    const r = await resourceSyncService.checkAndSync();
    expect(r.success).toBe(true);
    expect(r.added).toEqual(["slash/a.json"]);
  });
  it("无变更 changedTypes 空", async () => {
    mockFetchText.mockResolvedValueOnce({ ok: true, text: "manifest" });
    mockParse.mockReturnValueOnce({ version: "1.0.0", updatedAt: "", files: [] });
    mockCompare.mockReturnValueOnce({ toAdd: [], toUpdate: [], toRemove: [] });
    const r = await resourceSyncService.checkAndSync();
    expect(r.changedTypes).toHaveLength(0);
  });
});
