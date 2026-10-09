// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// 条目化改造（spec §6 / Task 10）后，设置页「重建索引」channel `journal:resetJournalTable`
// 仍保留名字，实现已切到条目维度的 `journalService.resetEntries()`：
// 事务内清 journal_entries 及其关联（semantic_links / temporal_events / tagged_items /
// journal_entry_projects），并连带清掉 chunk_type='journal' 的语义块 + 重建 FTS；
// 块 id 在事务提交之后交给向量层异步清（回滚时块还在，向量绝不能跟着删）。
// 本用例只守护两条既有用例（journal.service.entries.test.ts 的 resetEntries）未覆盖的行为：
//   1) 向量清理发生在事务体之后（时序）；
//   2) 事务内抛错 → 向量一行都不删（块还在库里）。
const {
  entryTransactionMock,
  entryExecuteMock,
  entryQueryOneMock,
  chunkQueryMock,
  chunkRebuildFtsMock,
  dropVectorsMock,
  scheduleMock,
  scheduleJournalDayMock,
} = vi.hoisted(() => ({
  entryTransactionMock: vi.fn((fn: () => unknown) => fn()),
  entryExecuteMock: vi.fn(() => ({ changes: 0 })),
  entryQueryOneMock: vi.fn(() => ({ n: 0 })),
  chunkQueryMock: vi.fn(() => [] as Array<{ id: string }>),
  chunkRebuildFtsMock: vi.fn(),
  dropVectorsMock: vi.fn(async () => {}),
  scheduleMock: vi.fn(),
  scheduleJournalDayMock: vi.fn(),
}));

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/utils", () => ({
  NodeCryptoUtil: { sha256: vi.fn(() => "hash"), generateUUID: vi.fn(() => "uuid") },
}));
vi.mock("@/main/core/services/base/file.service", () => ({
  fileService: {
    exists: vi.fn(() => false),
    readFile: vi.fn(() => ""),
    writeFile: vi.fn(),
    getFileInfo: vi.fn(() => ({ size: 0, modifiedAt: "", hash: "" })),
  },
}));
vi.mock("@/main/core/db", () => ({
  JournalEntryDao: class {
    transaction = entryTransactionMock;
    execute = entryExecuteMock;
    queryOne = entryQueryOneMock;
  },
  ChunkDao: class {
    query = chunkQueryMock;
    rebuildFts = chunkRebuildFtsMock;
    removeFileLevelJournalChunks = vi.fn(() => [] as string[]);
  },
  FileIndexDao: class {
    findByFilePath = vi.fn(() => null);
  },
  ProjectDao: class {
    findByNameLike = vi.fn(() => []);
  },
  // tag / character 服务在本用例整体被 mock，不会真正构造；保留桩以防模块图变化
  TagDao: class {},
  TaggedItemDao: class {},
  CharacterDao: class {},
}));
vi.mock("@/main/core/services/content/chunk.service", () => ({
  chunkService: { dropVectorsByIds: dropVectorsMock },
}));
vi.mock("@/main/core/services/content/chunk-index.service", () => ({
  chunkIndexService: { schedule: scheduleMock, scheduleJournalDay: scheduleJournalDayMock },
}));
vi.mock("@/main/core/services/content/journal/journal-render", () => ({
  renderJournalDay: vi.fn(() => ""),
  parseJournalDayFile: vi.fn(() => []),
  isEntryOwnedJournalMarkdown: vi.fn(() => false),
}));
vi.mock("@/main/core/services/project/tag.service", () => ({
  tagService: { createTags: vi.fn(() => []) },
}));
vi.mock("@/main/core/services/content/character.service", () => ({
  characterService: { upsertByName: vi.fn(() => []) },
}));

import { journalService } from "@/main/core/services/content/journal.service";

describe("resetEntries 的向量清理时序", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entryTransactionMock.mockImplementation((fn: () => unknown) => fn());
    entryExecuteMock.mockReturnValue({ changes: 0 });
    entryQueryOneMock.mockReturnValue({ n: 3 });
    chunkQueryMock.mockReturnValue([{ id: "j1" }, { id: "j2" }]);
    dropVectorsMock.mockResolvedValue(undefined);
  });

  it("只清日志子集：块查询按 chunk_type='journal' 过滤（页面块不在清理范围）", () => {
    const cleared = journalService.resetEntries();

    expect(cleared).toBe(3);
    expect(chunkQueryMock.mock.calls[0][0]).toContain("chunk_type = 'journal'");
    const sqls = entryExecuteMock.mock.calls.map((call) => String(call[0]));
    expect(sqls.some((sql) => /DELETE FROM semantic_chunks WHERE chunk_type = 'journal'/.test(sql))).toBe(true);
    expect(sqls.some((sql) => /DELETE FROM journal_entries/.test(sql))).toBe(true);
  });

  it("向量清理发生在事务体之后（块 id 先记录，提交后才交给向量层）", () => {
    journalService.resetEntries();

    const lastWriteOrder = Math.max(
      ...entryExecuteMock.mock.invocationCallOrder,
      ...chunkQueryMock.mock.invocationCallOrder,
      ...chunkRebuildFtsMock.mock.invocationCallOrder,
    );
    expect(dropVectorsMock).toHaveBeenCalledWith(["j1", "j2"]);
    expect(dropVectorsMock.mock.invocationCallOrder[0]).toBeGreaterThan(lastWriteOrder);
    // 重置是纯清库动作，不应触发任何重新调度切块
    expect(scheduleMock).not.toHaveBeenCalled();
    expect(scheduleJournalDayMock).not.toHaveBeenCalled();
  });

  it("事务内抛错 → 整体 reject 且一面向量都不删（块仍在库里）", () => {
    entryExecuteMock.mockImplementation((sql: string) => {
      if (sql.includes("DELETE FROM journal_entries")) {
        throw new Error("FOREIGN KEY constraint failed");
      }
      return { changes: 0 };
    });

    expect(() => journalService.resetEntries()).toThrow("FOREIGN KEY constraint failed");
    expect(dropVectorsMock).not.toHaveBeenCalled();
  });

  it("无历史日志块时以空数组调用向量层（不触碰，也不抛）", () => {
    chunkQueryMock.mockReturnValue([]);
    entryQueryOneMock.mockReturnValue({ n: 0 });

    expect(journalService.resetEntries()).toBe(0);
    expect(dropVectorsMock).toHaveBeenCalledWith([]);
  });
});
