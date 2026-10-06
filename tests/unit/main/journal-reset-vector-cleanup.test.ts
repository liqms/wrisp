// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  existsMock,
  listFilesMock,
  getFileInfoMock,
  chunkQueryMock,
  rebuildFtsMock,
  fileIndexExecuteMock,
  fileIndexCreateMock,
  dropVectorsMock,
  scheduleMock,
} = vi.hoisted(() => ({
  existsMock: vi.fn(() => true),
  listFilesMock: vi.fn(() => ["journal/2026-10-05.md", "journal/2026-10-06.md"]),
  getFileInfoMock: vi.fn(() => ({ hash: "h", size: 1 })),
  chunkQueryMock: vi.fn((_sql: string) => [{ id: "j1" }, { id: "j2" }]),
  rebuildFtsMock: vi.fn(),
  fileIndexExecuteMock: vi.fn(),
  fileIndexCreateMock: vi.fn(() => "new-id"),
  dropVectorsMock: vi.fn(async () => {}),
  scheduleMock: vi.fn(),
}));

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/utils", () => ({
  NodeCryptoUtil: { sha256: vi.fn(() => "hash"), generateUUID: vi.fn(() => "uuid") },
}));
vi.mock("@/main/core/services/base/file.service", () => ({
  fileService: {
    exists: existsMock,
    listFiles: listFilesMock,
    getFileInfo: getFileInfoMock,
  },
}));
vi.mock("@/main/core/db", () => ({
  ChunkDao: class {
    query = chunkQueryMock;
    rebuildFts = rebuildFtsMock;
  },
  FileIndexDao: class {
    execute = fileIndexExecuteMock;
    create = fileIndexCreateMock;
    transaction = (fn: () => unknown) => fn();
  },
}));
vi.mock("@/main/core/services/content/chunk.service", () => ({
  chunkService: { dropVectorsByIds: dropVectorsMock },
}));
vi.mock("@/main/core/services/content/chunk-index.service", () => ({
  chunkIndexService: { schedule: scheduleMock },
}));
vi.mock("@/main/core/services/content/inline-token-sync.service", () => ({
  inlineTokenSyncService: {},
}));

import { journalService } from "@/main/core/services/content/journal.service";

describe("Journal 重置时的向量清理", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsMock.mockReturnValue(true);
    listFilesMock.mockReturnValue(["journal/2026-10-05.md", "journal/2026-10-06.md"]);
    chunkQueryMock.mockReturnValue([{ id: "j1" }, { id: "j2" }]);
    fileIndexExecuteMock.mockReturnValue(0);
    fileIndexCreateMock.mockReturnValue("new-id");
    dropVectorsMock.mockResolvedValue(undefined);
  });

  it("被删除的日志块 id 交给向量层清理", async () => {
    const count = await journalService.resetJournalTable();

    expect(count).toBe(2);
    // 只取日志子集，页面块（chunk_type = 'page'）不在清理范围
    expect(chunkQueryMock.mock.calls[0][0]).toContain("chunk_type = 'journal'");
    expect(dropVectorsMock).toHaveBeenCalledWith(["j1", "j2"]);
  });

  it("向量清理发生在事务提交之后", async () => {
    await journalService.resetJournalTable();

    const lastSqlCall = Math.max(
      ...fileIndexExecuteMock.mock.invocationCallOrder,
      ...fileIndexCreateMock.mock.invocationCallOrder,
    );
    expect(dropVectorsMock.mock.invocationCallOrder[0]).toBeGreaterThan(lastSqlCall);
  });

  it("事务失败时不删向量（块还在库里）", async () => {
    fileIndexExecuteMock.mockImplementation((sql: string) => {
      if (sql.includes("DELETE FROM file_index")) {
        throw new Error("外键约束失败");
      }
      return 0;
    });

    await expect(journalService.resetJournalTable()).rejects.toThrow("外键约束失败");
    expect(dropVectorsMock).not.toHaveBeenCalled();
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("没有历史日志块时不触碰向量库", async () => {
    chunkQueryMock.mockReturnValue([]);

    await journalService.resetJournalTable();

    expect(dropVectorsMock).toHaveBeenCalledWith([]);
  });
});
