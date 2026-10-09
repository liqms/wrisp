// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  readFileMock,
  findByIdMock,
  findByFilePathMock,
  updateSyncStatusMock,
  enqueueMock,
  replaceFileChunksMock,
  replaceEntryChunksMock,
  dropVectorsByIdsMock,
  listDirtyByDateMock,
  recordChunkedMock,
} = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  findByIdMock: vi.fn(),
  findByFilePathMock: vi.fn(),
  updateSyncStatusMock: vi.fn(),
  enqueueMock: vi.fn(),
  replaceFileChunksMock: vi.fn(),
  replaceEntryChunksMock: vi.fn(),
  dropVectorsByIdsMock: vi.fn(),
  listDirtyByDateMock: vi.fn(),
  recordChunkedMock: vi.fn(),
}));

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/db", () => ({
  FileIndexDao: class {
    findById = findByIdMock;
    findByFilePath = findByFilePathMock;
    updateSyncStatus = updateSyncStatusMock;
  },
  JournalEntryDao: class {
    listDirtyByDate = listDirtyByDateMock;
    recordChunked = recordChunkedMock;
  },
}));
vi.mock("@/main/core/task-queue", () => ({
  taskQueue: {
    enqueue: enqueueMock,
    getTasksByGroup: vi.fn(async () => []),
    cancel: vi.fn(),
  },
}));
vi.mock("@/main/core/services/base/file.service", () => ({
  fileService: { readFile: (path: string) => readFileMock(path) },
}));
vi.mock("@/main/core/model-gateway/router", () => ({
  modelRouter: { isLocalAvailable: vi.fn(async () => false) },
}));
vi.mock("@/main/core/model-gateway/local-gateway", () => ({
  embedBatch: vi.fn(async () => []),
}));
vi.mock("@/main/core/services/content/chunk.service", () => ({
  chunkService: {
    replaceFileChunks: replaceFileChunksMock,
    replaceEntryChunks: replaceEntryChunksMock,
    dropVectorsByIds: dropVectorsByIdsMock,
    associateFileChunksWithProject: vi.fn(),
  },
}));
vi.mock("@/main/core/services/content/wiki-events", () => ({
  notifyWikiUpdated: vi.fn(),
}));

import { chunkIndexService } from "@/main/core/services/content/chunk-index.service";

/** 守卫命中时不应真的起计时器，只需断言转交了按日切块 */
const scheduleJournalDayMock = vi
  .spyOn(chunkIndexService, "scheduleJournalDay")
  .mockImplementation(() => {});

const INDEX = { id: "f1", file_path: "journal/2026-10-08.md", file_hash: "h1" };

/** 条目化日文件（journal-render 产物）：首行带 wrisp:journal 标记 */
const ENTRY_OWNED_MD = [
  '<!-- wrisp:journal {"format":1,"date":"2026-10-08"} -->',
  "# 2026-10-08",
  "",
  "**09:32**",
  '<!-- wrisp:entry {"id":"a1","at":"2026-10-08T01:32:00.000Z","src":"desktop","type":"text","u":"2026-10-08T01:32:00.000Z"} -->',
  "今天研究了 LanceDB 的索引。",
].join("\n");

/** 旧版整篇日志：无文件级标记，仍走文件切块 */
const LEGACY_MD = "09:30\n随手记的一段正文，没有条目注释，长度足够成块。";

describe("条目化日志文件的切块守卫", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findByIdMock.mockReturnValue(INDEX);
    findByFilePathMock.mockReturnValue(INDEX);
    readFileMock.mockReturnValue(ENTRY_OWNED_MD);
    listDirtyByDateMock.mockReturnValue([]);
    replaceEntryChunksMock.mockReturnValue({
      reused: 0,
      inserted: 1,
      removedIds: [],
      total: 1,
    });
    replaceFileChunksMock.mockReturnValue({
      reused: 0,
      inserted: 1,
      removedIds: [],
      total: 1,
    });
    dropVectorsByIdsMock.mockResolvedValue(undefined);
  });

  it("条目接管的日文件不做文件级切块，改调度按日切块并标记 synced", async () => {
    await chunkIndexService.processFile("f1", "h1", "journal", null);

    expect(replaceFileChunksMock).not.toHaveBeenCalled();
    expect(dropVectorsByIdsMock).not.toHaveBeenCalled();
    expect(updateSyncStatusMock).toHaveBeenCalledWith("f1", "synced");
    expect(scheduleJournalDayMock).toHaveBeenCalledWith("2026-10-08");
  });

  it("旧版整篇日志（无标记）仍照常走文件级切块", async () => {
    readFileMock.mockReturnValue(LEGACY_MD);

    await chunkIndexService.processFile("f1", "h1", "journal", null);

    expect(replaceFileChunksMock).toHaveBeenCalled();
    expect(scheduleJournalDayMock).not.toHaveBeenCalled();
  });

  it("作品页面不受守卫影响", async () => {
    readFileMock.mockReturnValue(ENTRY_OWNED_MD);

    await chunkIndexService.processFile("f1", "h1", "page", "p1");

    expect(replaceFileChunksMock).toHaveBeenCalled();
    expect(scheduleJournalDayMock).not.toHaveBeenCalled();
  });
});

/**
 * 按日切块的失败收敛（T10-4）：与 processFile 同一约定——标记 failed 后抛出，
 * 交由任务队列按 max_retries 重试。「条目接管日由渲染路径写 synced」说的是文件级切块
 * 对该文件无事可做；此处的 failed 只描述这一次按日切块尝试，下一次条目写入（重渲染写
 * synced）或队列重试都会覆盖它，两个约定不冲突。
 */
describe("processJournalDay 的失败收敛", () => {
  // 上一个 describe 的 beforeEach 不覆盖这里：mock 的历史与实现都必须重置，
  // 否则上一条用例设的「抛错实现」会泄漏下来（mockImplementation 不受 clearAllMocks 影响）
  beforeEach(() => {
    vi.clearAllMocks();
    findByFilePathMock.mockReturnValue(INDEX);
    dropVectorsByIdsMock.mockResolvedValue(undefined);
    replaceEntryChunksMock.mockReturnValue({
      reused: 0,
      inserted: 1,
      removedIds: [],
      total: 1,
    });
  });

  it("单条切块抛错 → 标记当日 file_index failed 并抛出（不再静默吞掉）", async () => {
    listDirtyByDateMock.mockReturnValue([
      { id: "e1", content: "一段足以独立成块的日志正文，用来验证切块落库失败时的状态收敛。" },
    ]);
    replaceEntryChunksMock.mockImplementation(() => {
      throw new Error("条目块落库失败");
    });

    await expect(chunkIndexService.processJournalDay("2026-10-08")).rejects.toThrow(
      "条目块落库失败",
    );

    expect(updateSyncStatusMock).toHaveBeenCalledWith("f1", "failed");
    expect(recordChunkedMock).not.toHaveBeenCalled();
  });

  it("全部条目切块成功 → 标记 synced 并逐条回写水位线", async () => {
    listDirtyByDateMock.mockReturnValue([
      { id: "e1", content: "第一条正文，长度足够成一个语义块。" },
      { id: "e2", content: "第二条正文，同样足够成一个语义块。" },
    ]);

    await chunkIndexService.processJournalDay("2026-10-08");

    expect(recordChunkedMock).toHaveBeenCalledTimes(2);
    expect(updateSyncStatusMock).toHaveBeenCalledWith("f1", "synced");
  });
});
