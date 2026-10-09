// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  readFileMock,
  findByIdMock,
  updateSyncStatusMock,
  enqueueMock,
  replaceFileChunksMock,
  dropVectorsByIdsMock,
} = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  findByIdMock: vi.fn(),
  updateSyncStatusMock: vi.fn(),
  enqueueMock: vi.fn(),
  replaceFileChunksMock: vi.fn(),
  dropVectorsByIdsMock: vi.fn(),
}));

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/db", () => ({
  FileIndexDao: class {
    findById = findByIdMock;
    updateSyncStatus = updateSyncStatusMock;
  },
  JournalEntryDao: class {},
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
    readFileMock.mockReturnValue(ENTRY_OWNED_MD);
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
