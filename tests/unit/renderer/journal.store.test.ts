import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useJournalStore } from "@/renderer/store/journal.store";
import { ErrorCode } from "@/shared/enums";
import type {
  ErrorResponse,
  JournalDayView,
  JournalEntryView,
  SuccessResponse,
} from "@/shared/types";

const api = {
  appendEntry: vi.fn(), updateEntry: vi.fn(), deleteEntry: vi.fn(),
  listEntries: vi.fn(), listRecentDays: vi.fn(), importDayFile: vi.fn(),
};
Object.defineProperty(window, "electronAPI", {
  configurable: true,
  value: { ...(window as unknown as { electronAPI: unknown }).electronAPI ?? {}, journal: api },
});

const ok = <T>(data: T): SuccessResponse<T> => ({
  success: true,
  data,
  code: ErrorCode.SUCCESS,
  timestamp: Date.now(),
});
const fail = (code: ErrorCode): ErrorResponse => ({
  success: false,
  code,
  timestamp: 0,
});
const DAY: JournalDayView = { date: "2026-10-09", has_legacy_file: false, entries: [] };
const ENTRY = (id: string, date = "d1"): JournalEntryView => ({
  id,
  date,
  occurred_at: "",
  source: "desktop",
  type: "text",
  content: "",
  chunked_at: null,
  created_at: "",
  updated_at: "",
  deleted_at: null,
  tags: [],
  projects: [],
});

describe("journal.store 条目动作", () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks(); });

  it("loadRecentDays 填充 days 并按响应排序保留", async () => {
    api.listRecentDays.mockResolvedValue(ok([DAY]));
    const store = useJournalStore();
    await store.loadRecentDays(5);
    expect(store.days).toEqual([DAY]);
  });

  it("appendEntry 成功后刷新列表；失败返回 null 并记录 errorCode", async () => {
    api.appendEntry.mockResolvedValue(ok("e1"));
    api.listRecentDays.mockResolvedValue(ok([{ ...DAY, entries: [] }]));
    const store = useJournalStore();
    const id = await store.appendEntry({ content: "x" });
    expect(id).toBe("e1");
    expect(api.listRecentDays).toHaveBeenCalled();
    api.appendEntry.mockResolvedValue({ success: false, data: null, code: "ERROR.JOURNAL.CREATE_FAILED", timestamp: 0 });
    expect(await store.appendEntry({ content: "x" })).toBeNull();
    expect(store.errorCode).not.toBeNull();
  });

  it("loadMoreDays 用 beforeDate 翻页并把新日期追加、同日期合并去重", async () => {
    const store = useJournalStore();
    store.days = [{ date: "2026-10-09", has_legacy_file: false, entries: [] }];
    api.listRecentDays.mockResolvedValue(ok([
      { date: "2026-10-09", has_legacy_file: false, entries: [] },
      { date: "2026-10-08", has_legacy_file: true, entries: [] },
    ]));
    const added = await store.loadMoreDays();
    expect(api.listRecentDays).toHaveBeenCalledWith(expect.any(Number), "2026-10-09");
    expect(store.days.map((d) => d.date)).toEqual(["2026-10-09", "2026-10-08"]);
    expect(added).toBe(true);
  });

  it("requestDeleteEntry 成功后本地移除", async () => {
    const store = useJournalStore();
    store.days = [{ date: "d1", has_legacy_file: false, entries: [
      { id: "e1", date: "d1", occurred_at: "", source: "desktop", type: "text", content: "", chunked_at: null, created_at: "", updated_at: "", deleted_at: null, tags: [], projects: [] },
    ] }];
    api.deleteEntry.mockResolvedValue(ok(true));
    const done = await store.requestDeleteEntry("e1");
    expect(done).toBe(true);
    expect(store.days[0].entries).toHaveLength(0);
  });

  it("loadMoreDays 翻页只置 loadingMoreDays，不动 daysLoading", async () => {
    const store = useJournalStore();
    store.days = [DAY];
    let observed: { daysLoading: boolean; loadingMoreDays: boolean } | null = null;
    api.listRecentDays.mockImplementation(() => {
      observed = {
        daysLoading: store.daysLoading,
        loadingMoreDays: store.loadingMoreDays,
      };
      return Promise.resolve(ok([DAY]));
    });
    await store.loadMoreDays();
    expect(observed).toEqual({ daysLoading: false, loadingMoreDays: true });
    expect(store.daysLoading).toBe(false);
    expect(store.loadingMoreDays).toBe(false);
  });

  it("loadMoreDays 页面没有新日期时置 hasMoreDays=false 并返回 false", async () => {
    const store = useJournalStore();
    store.days = [DAY];
    api.listRecentDays.mockResolvedValue(ok([DAY]));
    expect(await store.loadMoreDays()).toBe(false);
    expect(store.hasMoreDays).toBe(false);
    expect(store.days).toHaveLength(1);
  });

  it("loadRecentDays 重置时间线与翻页状态", async () => {
    const store = useJournalStore();
    store.days = [DAY];
    api.listRecentDays.mockResolvedValue(ok([{ ...DAY, has_legacy_file: true }]));
    await store.loadRecentDays();
    expect(store.days).toEqual([{ ...DAY, has_legacy_file: true }]);
    expect(store.hasMoreDays).toBe(true);
    expect(store.daysLoading).toBe(false);
    expect(api.listRecentDays).toHaveBeenCalledWith(expect.any(Number), undefined);
  });

  it("loadRecentDays 失败记录 errorCode 并保持时间线为空", async () => {
    const store = useJournalStore();
    api.listRecentDays.mockResolvedValue(fail(ErrorCode.JOURNAL_GET_FAILED));
    await store.loadRecentDays(3);
    expect(store.days).toEqual([]);
    expect(store.errorCode).toBe(ErrorCode.JOURNAL_GET_FAILED);
    expect(store.hasError).toBe(true);
  });

  it("updateEntry 成功后刷新，失败返回 false 并记录 errorCode", async () => {
    api.listRecentDays.mockResolvedValue(ok([DAY]));
    const store = useJournalStore();
    api.updateEntry.mockResolvedValue(ok(true));
    expect(await store.updateEntry({ id: "e1", content: "y" })).toBe(true);
    expect(api.listRecentDays).toHaveBeenCalled();
    api.updateEntry.mockResolvedValue(fail(ErrorCode.JOURNAL_UPDATE_FAILED));
    expect(await store.updateEntry({ id: "e1", content: "z" })).toBe(false);
    expect(store.errorCode).toBe(ErrorCode.JOURNAL_UPDATE_FAILED);
  });

  it("deleteEntryLocal 仅本地移除，不触碰 channel", () => {
    const store = useJournalStore();
    store.days = [{ date: "d1", has_legacy_file: false, entries: [ENTRY("e1"), ENTRY("e2")] }];
    store.deleteEntryLocal("e1");
    expect(store.days[0].entries.map((e) => e.id)).toEqual(["e2"]);
    expect(api.deleteEntry).not.toHaveBeenCalled();
  });

  it("requestDeleteEntry 失败时保留本地条目并记录 errorCode", async () => {
    const store = useJournalStore();
    store.days = [{ date: "d1", has_legacy_file: false, entries: [ENTRY("e1")] }];
    api.deleteEntry.mockResolvedValue(fail(ErrorCode.JOURNAL_DELETE_FAILED));
    expect(await store.requestDeleteEntry("e1")).toBe(false);
    expect(store.days[0].entries).toHaveLength(1);
    expect(store.errorCode).toBe(ErrorCode.JOURNAL_DELETE_FAILED);
  });

  it("requestImportDayFile 成功返回统计并刷新时间线", async () => {
    const imported = { imported: 3, updated: 1, skipped: 0 };
    api.importDayFile.mockResolvedValue(ok(imported));
    api.listRecentDays.mockResolvedValue(ok([DAY]));
    const store = useJournalStore();
    expect(await store.requestImportDayFile("2026-10-09", true)).toEqual(imported);
    expect(api.importDayFile).toHaveBeenCalledWith("2026-10-09", true);
    expect(api.listRecentDays).toHaveBeenCalled();
  });

  it("requestImportDayFile 异常返回 null 并回退到 COMMON_ACTION_ERROR", async () => {
    api.importDayFile.mockRejectedValue(new Error("boom"));
    const store = useJournalStore();
    expect(await store.requestImportDayFile("2026-10-09")).toBeNull();
    expect(store.errorCode).toBe(ErrorCode.COMMON_ACTION_ERROR);
  });

  it("clearDays 清空时间线并恢复可翻页标记", () => {
    const store = useJournalStore();
    store.days = [DAY];
    store.hasMoreDays = false;
    store.clearDays();
    expect(store.days).toEqual([]);
    expect(store.hasMoreDays).toBe(true);
  });
});
