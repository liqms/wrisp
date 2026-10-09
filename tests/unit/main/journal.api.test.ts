// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/main/utils/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}));

const mockJournalService = vi.hoisted(() => ({
  appendEntry: vi.fn(() => "entry-id"),
  updateEntry: vi.fn(() => true),
  deleteEntry: vi.fn(() => true),
  listEntries: vi.fn(() => []),
  listRecentDays: vi.fn(() => []),
  importDayFile: vi.fn(() => ({ imported: 0, updated: 0, skipped: 0 })),
  resetEntries: vi.fn(() => 0),
}));

vi.mock("@/main/core/services/content/journal.service", () => ({
  journalService: mockJournalService,
}));

import {
  updateEntry,
  deleteEntry,
  listEntries,
  listRecentDays,
  importDayFile,
} from "@/main/core/apis/journal.api";
import { Logger } from "@/main/utils/logger";
import { ErrorCode } from "@/shared/enums";

describe("journal.api 的 boolean 契约（FI-1，spec §6.1：ApiResponse<boolean> = 是否真的改了行）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJournalService.updateEntry.mockReturnValue(true);
    mockJournalService.deleteEntry.mockReturnValue(true);
  });

  it("updateEntry：service 返回 false（并发删除致 0 行）⇒ success:true + data:false，不得压平成错误", async () => {
    mockJournalService.updateEntry.mockReturnValue(false);

    const res = await updateEntry({ id: "e1", content: "改后正文" });

    expect(res.success).toBe(true);
    expect(res.code).toBe(ErrorCode.SUCCESS);
    expect(res.data).toBe(false);
  });

  it("deleteEntry：service 返回 false（已软删/不存在）⇒ success:true + data:false", async () => {
    mockJournalService.deleteEntry.mockReturnValue(false);

    const res = await deleteEntry("e1");

    expect(res.success).toBe(true);
    expect(res.code).toBe(ErrorCode.SUCCESS);
    expect(res.data).toBe(false);
  });

  it("updateEntry：确实改行 ⇒ success:true + data:true 透传", async () => {
    const res = await updateEntry({ id: "e1", content: "改后正文" });

    expect(res.success).toBe(true);
    expect(res.data).toBe(true);
  });

  it("updateEntry：真实失败（抛错）仍报 JOURNAL_UPDATE_FAILED，错误码语义不变", async () => {
    mockJournalService.updateEntry.mockImplementation(() => {
      throw new Error("db locked");
    });

    const res = await updateEntry({ id: "e1", content: "改后正文" });

    expect(res.success).toBe(false);
    expect(res.code).toBe(ErrorCode.JOURNAL_UPDATE_FAILED);
  });

  it("deleteEntry：真实失败（抛错）仍报 JOURNAL_DELETE_FAILED，错误码语义不变", async () => {
    mockJournalService.deleteEntry.mockImplementation(() => {
      throw new Error("db locked");
    });

    const res = await deleteEntry("e1");

    expect(res.success).toBe(false);
    expect(res.code).toBe(ErrorCode.JOURNAL_DELETE_FAILED);
  });
});

describe("journal.api 的 date 边界校验（FI-2：date 会拼进 journal/{date}.md 路径）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJournalService.listEntries.mockReturnValue([]);
    mockJournalService.listRecentDays.mockReturnValue([]);
    mockJournalService.importDayFile.mockReturnValue({
      imported: 0,
      updated: 0,
      skipped: 0,
    });
  });

  it("listEntries：工作区内的越目录 date（../pages/mypage）被拒绝且不打到 service", async () => {
    const res = await listEntries("../pages/mypage");

    expect(res.success).toBe(false);
    expect(res.code).toBe(ErrorCode.COMMON_INVALID_PARAMETER);
    expect(mockJournalService.listEntries).not.toHaveBeenCalled();
    // R-3：非法参数拒绝必须留 warn 痕迹（否则 renderer 侧无人读 errorCode 时完全静默）
    expect(Logger.warn).toHaveBeenCalled();
  });

  it("listEntries：合法 yyyy-MM-dd 正常透传", async () => {
    const res = await listEntries("2026-10-08");

    expect(res.success).toBe(true);
    expect(mockJournalService.listEntries).toHaveBeenCalledWith("2026-10-08");
  });

  it("importDayFile：非法 date 被拒绝且不打到 service（防渲染产物覆盖工作区内其它文件）", async () => {
    const res = await importDayFile("../pages/mypage");

    expect(res.success).toBe(false);
    expect(res.code).toBe(ErrorCode.COMMON_INVALID_PARAMETER);
    expect(mockJournalService.importDayFile).not.toHaveBeenCalled();
    expect(Logger.warn).toHaveBeenCalled();
  });

  it("importDayFile：合法 date 正常透传（含 overwrite 参数）", async () => {
    const res = await importDayFile("2026-10-08", true);

    expect(res.success).toBe(true);
    expect(mockJournalService.importDayFile).toHaveBeenCalledWith("2026-10-08", true);
  });

  it("listRecentDays：非法 beforeDate 被拒绝且不打到 service", async () => {
    const res = await listRecentDays(5, "2026/10/08");

    expect(res.success).toBe(false);
    expect(res.code).toBe(ErrorCode.COMMON_INVALID_PARAMETER);
    expect(mockJournalService.listRecentDays).not.toHaveBeenCalled();
    expect(Logger.warn).toHaveBeenCalled();
  });

  it("listRecentDays：合法 beforeDate 正常透传", async () => {
    const res = await listRecentDays(5, "2026-10-08");

    expect(res.success).toBe(true);
    expect(mockJournalService.listRecentDays).toHaveBeenCalledWith(5, "2026-10-08");
  });

  it("listRecentDays：days 超出防御性阈值被拒绝（无界取数）且留 warn 痕迹", async () => {
    const res = await listRecentDays(999_999);

    expect(res.success).toBe(false);
    expect(res.code).toBe(ErrorCode.COMMON_INVALID_PARAMETER);
    expect(mockJournalService.listRecentDays).not.toHaveBeenCalled();
    expect(Logger.warn).toHaveBeenCalled();
  });

  // R-3：store 用整个已加载窗口做写后全量刷新（journal.store.ts 的 days.value.length || DAY_WINDOW_SIZE），
  // 翻页越多窗口越大——旧 366 上界会把这些合法刷新悄悄打回 stale。阈值只挡荒谬输入。
  it("listRecentDays：翻页增长后的合法大窗口（数千天级）正常透传，不被上界误拒", async () => {
    const res = await listRecentDays(2000);

    expect(res.success).toBe(true);
    expect(mockJournalService.listRecentDays).toHaveBeenCalledWith(2000, undefined);
  });

  it("listRecentDays：days 非正整数被拒绝", async () => {
    const res = await listRecentDays(0);

    expect(res.success).toBe(false);
    expect(res.code).toBe(ErrorCode.COMMON_INVALID_PARAMETER);
  });

  it("listRecentDays：days 缺省正常透传（service 侧默认值生效）", async () => {
    const res = await listRecentDays(undefined, undefined);

    expect(res.success).toBe(true);
    expect(mockJournalService.listRecentDays).toHaveBeenCalledWith(undefined, undefined);
  });
});
