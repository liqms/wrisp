// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  // JournalEntryDao 桩
  entryCreateMock,
  entryFindByIdMock,
  entryUpdateMock,
  entryListActiveMock,
  entryListAllMock,
  entrySoftDeleteMock,
  entryReplaceAssocMock,
  entryFindTagIdsMock,
  entryFindProjectIdsMock,
  entryListActiveDatesMock,
  entryListLegacyDatesMock,
  entryAssembleViewsMock,
  entryQueryOneMock,
  entryExecuteMock,
  entryTransactionMock,
  entryHasActiveEntriesMock,
  // FileIndexDao 桩
  fileIndexFindByPathMock,
  fileIndexCreateMock,
  fileIndexUpdateMock,
  // ChunkDao 桩
  chunkQueryMock,
  chunkRebuildFtsMock,
  chunkRemoveFileLevelMock,
  // 其它服务桩
  fileExistsMock,
  fileReadMock,
  fileWriteMock,
  fileInfoMock,
  renderJournalDayMock,
  parseJournalDayFileMock,
  createTagsMock,
  upsertByNameMock,
  projectFindByNameLikeMock,
  scheduleJournalDayMock,
  scheduleMock,
  dropVectorsMock,
  replaceEntryChunksMock,
} = vi.hoisted(() => ({
  entryCreateMock: vi.fn(() => "entry-id"),
  entryFindByIdMock: vi.fn(() => null),
  entryUpdateMock: vi.fn(() => 1),
  entryListActiveMock: vi.fn(() => []),
  entryListAllMock: vi.fn(() => []),
  entrySoftDeleteMock: vi.fn(() => 1),
  entryReplaceAssocMock: vi.fn(),
  entryFindTagIdsMock: vi.fn(() => []),
  entryFindProjectIdsMock: vi.fn(() => []),
  entryListActiveDatesMock: vi.fn(() => []),
  entryListLegacyDatesMock: vi.fn(() => []),
  entryAssembleViewsMock: vi.fn(() => []),
  entryQueryOneMock: vi.fn(() => null),
  entryExecuteMock: vi.fn(() => ({ changes: 0 })),
  entryTransactionMock: vi.fn((fn: () => unknown) => fn()),
  entryHasActiveEntriesMock: vi.fn(() => false),
  fileIndexFindByPathMock: vi.fn(() => null),
  fileIndexCreateMock: vi.fn(() => "file-index-id"),
  fileIndexUpdateMock: vi.fn(() => 1),
  chunkQueryMock: vi.fn(() => []),
  chunkRebuildFtsMock: vi.fn(),
  chunkRemoveFileLevelMock: vi.fn(() => [] as string[]),
  fileExistsMock: vi.fn(() => false),
  fileReadMock: vi.fn(() => ""),
  fileWriteMock: vi.fn(),
  fileInfoMock: vi.fn(() => ({ size: 10, modifiedAt: "2026-10-08T00:00:00.000Z", hash: "h" })),
  renderJournalDayMock: vi.fn(() => "<!-- wrisp:journal {\"format\":1} -->\n"),
  parseJournalDayFileMock: vi.fn(() => []),
  createTagsMock: vi.fn(() => []),
  upsertByNameMock: vi.fn(() => []),
  projectFindByNameLikeMock: vi.fn(() => []),
  scheduleJournalDayMock: vi.fn(),
  scheduleMock: vi.fn(),
  dropVectorsMock: vi.fn(async () => {}),
  replaceEntryChunksMock: vi.fn(() => ({
    reused: 0,
    inserted: 0,
    removedIds: [] as string[],
    total: 0,
  })),
}));

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/utils", () => ({
  NodeCryptoUtil: { generateUUID: vi.fn(() => "uuid"), sha256: vi.fn(() => "hash") },
}));
vi.mock("@/main/core/services/base/file.service", () => ({
  fileService: {
    exists: fileExistsMock,
    readFile: fileReadMock,
    writeFile: fileWriteMock,
    getFileInfo: fileInfoMock,
    listFiles: vi.fn(() => []),
    remove: vi.fn(),
  },
}));
vi.mock("@/main/core/db", () => ({
  JournalEntryDao: class {
    create = entryCreateMock;
    findById = entryFindByIdMock;
    update = entryUpdateMock;
    listActiveByDate = entryListActiveMock;
    listAllByDate = entryListAllMock;
    softDelete = entrySoftDeleteMock;
    replaceAssociations = entryReplaceAssocMock;
    findTagIdsByNames = entryFindTagIdsMock;
    findProjectIdsByNames = entryFindProjectIdsMock;
    listActiveDates = entryListActiveDatesMock;
    listLegacyDates = entryListLegacyDatesMock;
    assembleViews = entryAssembleViewsMock;
    queryOne = entryQueryOneMock;
    execute = entryExecuteMock;
    transaction = entryTransactionMock;
    hasActiveEntries = entryHasActiveEntriesMock;
  },
  FileIndexDao: class {
    findByFilePath = fileIndexFindByPathMock;
    create = fileIndexCreateMock;
    update = fileIndexUpdateMock;
  },
  ChunkDao: class {
    query = chunkQueryMock;
    rebuildFts = chunkRebuildFtsMock;
    removeFileLevelJournalChunks = chunkRemoveFileLevelMock;
  },
  ProjectDao: class {
    findByNameLike = projectFindByNameLikeMock;
  },
  // tag / character 服务在本用例整体被 mock，不会真正构造；保留桩以防模块图变化
  TagDao: class {},
  TaggedItemDao: class {},
  CharacterDao: class {},
}));
vi.mock("@/main/core/services/content/chunk-index.service", () => ({
  chunkIndexService: { schedule: scheduleMock, scheduleJournalDay: scheduleJournalDayMock },
}));
vi.mock("@/main/core/services/content/chunk.service", () => ({
  chunkService: {
    dropVectorsByIds: dropVectorsMock,
    replaceEntryChunks: replaceEntryChunksMock,
  },
}));
vi.mock("@/main/core/services/content/inline-token-sync.service", () => ({
  inlineTokenSyncService: {},
}));
vi.mock("@/main/core/services/content/journal/journal-render", async () => {
  const actual = await vi.importActual<
    typeof import("@/main/core/services/content/journal/journal-render")
  >("@/main/core/services/content/journal/journal-render");
  return {
    isEntryOwnedJournalMarkdown: actual.isEntryOwnedJournalMarkdown,
    renderJournalDay: renderJournalDayMock,
    parseJournalDayFile: parseJournalDayFileMock,
  };
});
vi.mock("@/main/core/services/project/tag.service", () => ({
  tagService: { createTags: createTagsMock },
}));
vi.mock("@/main/core/services/content/character.service", () => ({
  characterService: { upsertByName: upsertByNameMock },
}));

import { journalService } from "@/main/core/services/content/journal.service";
import { Logger } from "@/main/utils/logger";

/** 与实现独立的本地日期推导（用于断言 date 由本地时区派生） */
function localDateOf(instant: Date): string {
  const y = instant.getFullYear();
  const m = String(instant.getMonth() + 1).padStart(2, "0");
  const d = String(instant.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fakeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "e1",
    date: "2026-10-08",
    occurred_at: "2026-10-08T01:32:00.000Z",
    source: "desktop",
    type: "text",
    content: "晨记",
    attachments: null,
    metadata: null,
    chunked_at: null,
    created_at: "2026-10-08T01:32:00.000Z",
    updated_at: "2026-10-08T01:32:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function fakeParsed(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    occurred_at: "2026-10-08T09:00:00.000Z",
    source: "import",
    type: "text",
    updated_at: null,
    content: "旧版整篇第一段",
    attachments: null,
    metadata: null,
    has_meta: false,
    ...overrides,
  };
}

describe("journal.service 条目编排", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entryCreateMock.mockReturnValue("entry-id");
    entryFindByIdMock.mockReturnValue(null);
    entryUpdateMock.mockReturnValue(1);
    entryListActiveMock.mockReturnValue([]);
    entryListAllMock.mockReturnValue([]);
    entrySoftDeleteMock.mockReturnValue(1);
    entryFindTagIdsMock.mockReturnValue([]);
    entryFindProjectIdsMock.mockReturnValue([]);
    entryListActiveDatesMock.mockReturnValue([]);
    entryListLegacyDatesMock.mockReturnValue([]);
    entryAssembleViewsMock.mockReturnValue([]);
    entryQueryOneMock.mockReturnValue(null);
    entryExecuteMock.mockReturnValue({ changes: 0 });
    entryTransactionMock.mockImplementation((fn: () => unknown) => fn());
    entryHasActiveEntriesMock.mockReturnValue(false);
    fileIndexFindByPathMock.mockReturnValue(null);
    fileExistsMock.mockReturnValue(false);
    fileReadMock.mockReturnValue("");
    fileInfoMock.mockReturnValue({
      size: 10,
      modifiedAt: "2026-10-08T00:00:00.000Z",
      hash: "h",
    });
    renderJournalDayMock.mockReturnValue("<!-- wrisp:journal {\"format\":1} -->\n");
    parseJournalDayFileMock.mockReturnValue([]);
    createTagsMock.mockReturnValue([]);
    upsertByNameMock.mockReturnValue([]);
    projectFindByNameLikeMock.mockReturnValue([]);
    dropVectorsMock.mockResolvedValue(undefined);
    chunkRemoveFileLevelMock.mockReturnValue([]);
    replaceEntryChunksMock.mockReturnValue({
      reused: 0,
      inserted: 0,
      removedIds: [] as string[],
      total: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("appendEntry：缺省 occurredAt 用当前时刻；date 由本地时区派生；create→关联→渲染→调度切块按序发生", () => {
    vi.useFakeTimers();
    const now = new Date("2026-10-08T10:00:00");
    vi.setSystemTime(now);

    const id = journalService.appendEntry({ content: " 晨记 #思考 &作品A " });

    expect(typeof id).toBe("string");
    const created = entryCreateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(created.occurred_at).toBe(now.toISOString());
    expect(created.date).toBe(localDateOf(now));
    // 写入即 trim（保证文件与库内容逐字节一致）
    expect(created.content).toBe("晨记 #思考 &作品A");

    const orderOf = (mock: ReturnType<typeof vi.fn>) => mock.mock.invocationCallOrder[0];
    expect(orderOf(entryCreateMock)).toBeLessThan(orderOf(entryReplaceAssocMock));
    expect(orderOf(entryReplaceAssocMock)).toBeLessThan(orderOf(renderJournalDayMock));
    expect(orderOf(renderJournalDayMock)).toBeLessThan(orderOf(scheduleJournalDayMock));
    expect(scheduleJournalDayMock).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(fileWriteMock).toHaveBeenCalled();
  });

  it("appendEntry 空内容抛错（trim 后为空）", () => {
    expect(() => journalService.appendEntry({ content: "   " })).toThrow();
    expect(entryCreateMock).not.toHaveBeenCalled();
  });

  it("appendEntry：naive occurredAt 归一为带时区的 UTC ISO 后再派生 date", () => {
    const id = journalService.appendEntry({
      content: "夜记",
      occurredAt: "2026-10-08T23:30:00",
    });

    expect(id).toBe("entry-id");
    const created = entryCreateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(created.occurred_at).toMatch(/(Z|[+-]\d{2}:\d{2})$/);
    expect(new Date(String(created.occurred_at)).getTime()).toBe(
      new Date("2026-10-08T23:30:00").getTime(),
    );
    expect(created.date).toBe(localDateOf(new Date("2026-10-08T23:30:00")));
  });

  it("syncEntryAssociations：标签先建后解析，作品先精确后模糊，人物按 contact 归属", () => {
    const created = new Set<string>();
    createTagsMock.mockImplementation((items: Array<{ name: string }>) => {
      items.forEach((item) => created.add(item.name));
      return items.map((item) => `tag-${item.name}`);
    });
    // 标签解析走真实 DAO 语义：只有已建过的标签才解析得到 id
    entryFindTagIdsMock.mockImplementation((names: string[]) =>
      names.filter((name) => created.has(name)).map((name) => ({ name, id: `tag-${name}` })),
    );
    entryFindProjectIdsMock.mockImplementation((names: string[]) =>
      names.filter((name) => name === "精确作品").map((name) => ({ name, id: "project-exact" })),
    );
    projectFindByNameLikeMock.mockImplementation((name: string) =>
      name === "模糊作品" ? [{ id: "project-like" }] : [],
    );

    journalService.appendEntry({
      content: "会议纪要 #既有 #思考 &精确作品 &模糊作品 @张三",
    });

    expect(createTagsMock).toHaveBeenCalled();
    expect(upsertByNameMock).toHaveBeenCalledWith(["张三"], { type: "contact" });
    const [, tagIds, projectIds] = entryReplaceAssocMock.mock.calls[0] as [
      string,
      string[],
      string[],
      string,
    ];
    expect(tagIds).toContain("tag-思考");
    expect(tagIds).toContain("tag-既有");
    expect(projectIds).toEqual(expect.arrayContaining(["project-exact", "project-like"]));
    // 精确命中的名字不再走模糊查询
    expect(projectFindByNameLikeMock).not.toHaveBeenCalledWith("精确作品");
  });

  it("裸 &作品， 保留尾标点（本期只 trim ASCII 空白，标点归属用 &[…] 形式）", () => {
    journalService.appendEntry({ content: "读 &作品A，" });

    expect(projectFindByNameLikeMock).toHaveBeenCalledWith("作品A，");
    const [, , projectIds] = entryReplaceAssocMock.mock.calls[0] as [
      string,
      string[],
      string[],
      string,
    ];
    expect(projectIds).toEqual([]);
  });

  it("updateEntry：不存在 id 返回 false", () => {
    entryFindByIdMock.mockReturnValue(null);

    expect(journalService.updateEntry({ id: "missing", content: "改" })).toBe(false);
    expect(entryUpdateMock).not.toHaveBeenCalled();
  });

  it("updateEntry：update 影响 0 行（读到后被并发删除）返回 false 且不重渲染不调度", () => {
    entryFindByIdMock.mockReturnValue(fakeRow());
    entryUpdateMock.mockReturnValue(0);

    expect(journalService.updateEntry({ id: "e1", content: "改" })).toBe(false);

    expect(entryReplaceAssocMock).not.toHaveBeenCalled();
    expect(renderJournalDayMock).not.toHaveBeenCalled();
    expect(scheduleJournalDayMock).not.toHaveBeenCalled();
  });

  it("updateEntry：成功时 trim 内容、重新关联、重渲染并调度", () => {
    entryFindByIdMock.mockReturnValue(fakeRow());
    entryListActiveMock.mockReturnValue([fakeRow({ content: "新内容" })]);

    expect(journalService.updateEntry({ id: "e1", content: "  新内容  " })).toBe(true);

    const [, updates] = entryUpdateMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(updates.content).toBe("新内容");
    expect(entryReplaceAssocMock).toHaveBeenCalled();
    expect(renderJournalDayMock).toHaveBeenCalled();
    expect(scheduleJournalDayMock).toHaveBeenCalledWith("2026-10-08");
  });

  it("updateEntry：occurred_at 跨日时旧日与新日各自重渲染 + 调度", () => {
    entryFindByIdMock.mockReturnValue(fakeRow({ date: "2026-10-08" }));
    entryListActiveMock.mockReturnValue([fakeRow()]);

    expect(
      journalService.updateEntry({ id: "e1", occurredAt: "2026-10-09T12:00:00.000Z" }),
    ).toBe(true);

    const moved = entryUpdateMock.mock.calls[0][1] as Record<string, unknown>;
    expect(moved.date).toBe("2026-10-09");
    expect(moved.occurred_at).toBe("2026-10-09T12:00:00.000Z");
    expect(scheduleJournalDayMock).toHaveBeenCalledWith("2026-10-08");
    expect(scheduleJournalDayMock).toHaveBeenCalledWith("2026-10-09");
    const writtenPaths = fileWriteMock.mock.calls.map((call) => call[0]);
    expect(writtenPaths).toContain("journal/2026-10-08.md");
    expect(writtenPaths).toContain("journal/2026-10-09.md");
  });

  it("deleteEntry：软删除 + 清关联 + 条目维度清块清向量 + 重渲染 + 调度", () => {
    entryFindByIdMock.mockReturnValue(fakeRow());
    entryListActiveMock.mockReturnValue([]);
    fileIndexFindByPathMock.mockReturnValue({ id: "fi-1", file_path: "journal/2026-10-08.md" });
    replaceEntryChunksMock.mockReturnValue({
      reused: 0,
      inserted: 0,
      removedIds: ["c1", "c2"],
      total: 0,
    });

    expect(journalService.deleteEntry("e1")).toBe(true);

    expect(entrySoftDeleteMock).toHaveBeenCalledWith("e1", expect.any(String));
    expect(entryReplaceAssocMock).toHaveBeenCalledWith("e1", [], [], expect.any(String));
    // 空切分结果 = 该条目的块全删；removedIds 即刻交给向量层——
    // 删除的条目进不了 listDirtyByDate（deleted_at IS NULL），不能指望切块任务收敛
    expect(replaceEntryChunksMock).toHaveBeenCalledWith(
      "e1",
      "fi-1",
      "journal/2026-10-08.md",
      [],
    );
    expect(dropVectorsMock).toHaveBeenCalledWith(["c1", "c2"]);
    expect(renderJournalDayMock).toHaveBeenCalled();
    expect(scheduleJournalDayMock).toHaveBeenCalledWith("2026-10-08");
  });

  it("deleteEntry：当日无 file_index 行时跳过清块，软删/清关联/渲染/调度照常", () => {
    entryFindByIdMock.mockReturnValue(fakeRow());
    entryListActiveMock.mockReturnValue([]);
    fileIndexFindByPathMock.mockReturnValue(null);

    expect(journalService.deleteEntry("e1")).toBe(true);

    expect(entrySoftDeleteMock).toHaveBeenCalledWith("e1", expect.any(String));
    expect(entryReplaceAssocMock).toHaveBeenCalledWith("e1", [], [], expect.any(String));
    expect(replaceEntryChunksMock).not.toHaveBeenCalled();
    expect(dropVectorsMock).not.toHaveBeenCalled();
    expect(renderJournalDayMock).toHaveBeenCalled();
    expect(scheduleJournalDayMock).toHaveBeenCalledWith("2026-10-08");
  });

  it("deleteEntry：不存在或已被删除时返回 false 且不渲染", () => {
    entryFindByIdMock.mockReturnValue(null);
    expect(journalService.deleteEntry("missing")).toBe(false);

    entryFindByIdMock.mockReturnValue(fakeRow());
    entrySoftDeleteMock.mockReturnValue(0);
    expect(journalService.deleteEntry("e1")).toBe(false);
    expect(entryReplaceAssocMock).not.toHaveBeenCalled();
  });

  it("渲染保护（5.1）：当日无条目且 .md 非空 → 不写文件；条目非空 → 写", () => {
    fileExistsMock.mockReturnValue(true);
    fileReadMock.mockReturnValue("旧整篇日志");
    entryListActiveMock.mockReturnValue([]);

    journalService["ensureDayFile"]("2026-10-08");

    expect(fileWriteMock).not.toHaveBeenCalled();
    expect(renderJournalDayMock).not.toHaveBeenCalled();

    entryListActiveMock.mockReturnValue([fakeRow()]);

    journalService["ensureDayFile"]("2026-10-08");

    expect(fileWriteMock).toHaveBeenCalled();
    // 渲染入参已把 JSON 文本列反序列化成渲染器形状
    const [date, rows] = renderJournalDayMock.mock.calls[0] as [string, Array<Record<string, unknown>>];
    expect(date).toBe("2026-10-08");
    expect(rows[0].attachments).toBeNull();
  });

  it("渲染保护不适用于条目接管文件：最后条目删除后重写为空日渲染（isEntryOwnedJournalMarkdown 走真实实现）", () => {
    entryFindByIdMock.mockReturnValue(fakeRow());
    entryListActiveMock.mockReturnValue([]); // 软删后当日零条目
    fileExistsMock.mockReturnValue(true);
    // 文件是本管线自己的渲染产物（首行带 wrisp:journal 标记），内含将被删空的那条正文
    fileReadMock.mockReturnValue(
      [
        '<!-- wrisp:journal {"format":1,"date":"2026-10-08"} -->',
        "# 2026-10-08",
        "",
        "**09:32**",
        '<!-- wrisp:entry {"id":"e1","at":"2026-10-08T01:32:00.000Z","src":"desktop","type":"text"} -->',
        "已删条目正文",
      ].join("\n"),
    );

    expect(journalService.deleteEntry("e1")).toBe(true);

    // 空日渲染被写回文件：已删内容不再滞留
    const written = fileWriteMock.mock.calls.find((call) => call[0] === "journal/2026-10-08.md");
    expect(written).toBeDefined();
    const renderedRows = renderJournalDayMock.mock.calls[0][1] as unknown[];
    expect(renderedRows).toEqual([]);
    expect(written?.[1]).toBe(renderJournalDayMock.mock.results[0]?.value);
  });

  it("ensureDayFile：file_index 行不存在则 create（hash/size/date/名），存在则 update hash 并置 synced", () => {
    entryListActiveMock.mockReturnValue([fakeRow()]);
    fileIndexFindByPathMock.mockReturnValue(null);

    journalService["ensureDayFile"]("2026-10-08");

    const created = fileIndexCreateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(created).toMatchObject({
      file_path: "journal/2026-10-08.md",
      file_hash: "h",
      file_size: 10,
      date: "2026-10-08",
      name: "2026-10-08.md",
      sync_status: "synced",
    });

    fileIndexFindByPathMock.mockReturnValue({ id: "fi-1", file_path: "journal/2026-10-08.md" });

    journalService["ensureDayFile"]("2026-10-08");

    expect(fileIndexUpdateMock).toHaveBeenCalledWith("fi-1", expect.objectContaining({
      file_hash: "h",
      sync_status: "synced",
    }));
  });

  it("importDayFile：当日已有活跃条目且 overwrite=false → 全部 skipped，不写库", () => {
    fileExistsMock.mockReturnValue(true);
    parseJournalDayFileMock.mockReturnValue([fakeParsed(), fakeParsed({ id: "p2" })]);
    entryListAllMock.mockReturnValue([fakeRow({ id: "p1" })]);

    const result = journalService.importDayFile("2026-10-08");

    expect(result).toEqual({ imported: 0, updated: 0, skipped: 2 });
    expect(entryCreateMock).not.toHaveBeenCalled();
    expect(entryUpdateMock).not.toHaveBeenCalled();
    expect(scheduleJournalDayMock).not.toHaveBeenCalled();
  });

  it("importDayFile：overwrite 下无 id 插入、u 较新才更新、tombstone 跳过、内容变化按确定性 id 收敛", () => {
    fileExistsMock.mockReturnValue(true);
    parseJournalDayFileMock.mockReturnValue([
      fakeParsed({ id: "new-1" }),
      // 文件里的 u 比库里新 → 更新
      fakeParsed({ id: "same-1", has_meta: true, updated_at: "2026-10-08T09:00:00.000Z" }),
      // 文件里的 u 比库里旧 → 保留库内（last-write-wins）
      fakeParsed({ id: "older-1", has_meta: true, updated_at: "2026-10-07T05:00:00.000Z" }),
      fakeParsed({ id: "tomb-1" }),
      fakeParsed({ id: "edited-1", content: "手工改过的正文" }),
    ]);
    entryListAllMock.mockReturnValue([
      fakeRow({ id: "same-1", updated_at: "2026-10-08T08:00:00.000Z" }),
      fakeRow({ id: "older-1", updated_at: "2026-10-08T08:00:00.000Z" }),
      fakeRow({ id: "tomb-1", deleted_at: "2026-10-08T09:00:00.000Z" }),
      fakeRow({ id: "edited-1", content: "原文", updated_at: "2026-10-08T08:00:00.000Z" }),
    ]);
    entryListActiveMock.mockReturnValue([fakeRow({ id: "same-1" })]);

    const result = journalService.importDayFile("2026-10-08", true);

    expect(result).toEqual({ imported: 1, updated: 2, skipped: 2 });
    const inserted = entryCreateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.id).toBe("new-1");
    expect(inserted.date).toBe("2026-10-08");
    // NOT NULL 列：解析缺 u 时必须补 updated_at；occurred_at 恒为带时区 UTC ISO
    expect(inserted.updated_at).toEqual(expect.any(String));
    expect(inserted.occurred_at).toMatch(/(Z|[+-]\d{2}:\d{2})$/);
    // tombstone 不复活、不计入导入
    expect(entryCreateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "tomb-1" }),
    );
    expect(entryUpdateMock).toHaveBeenCalledWith(
      "same-1",
      expect.objectContaining({ content: "旧版整篇第一段", occurred_at: "2026-10-08T09:00:00.000Z" }),
    );
    expect(entryUpdateMock).toHaveBeenCalledWith("edited-1", { content: "手工改过的正文" });
    expect(entryUpdateMock).not.toHaveBeenCalledWith("older-1", expect.anything());
    expect(entryUpdateMock).not.toHaveBeenCalledWith("tomb-1", expect.anything());
  });

  it("importDayFile 成功后走与 append 相同的后置管线（关联重建 + 渲染接管 + 调度）", () => {
    fileExistsMock.mockReturnValue(true);
    parseJournalDayFileMock.mockReturnValue([fakeParsed({ id: "new-1", content: "晨读 #思考" })]);
    entryListAllMock.mockReturnValue([]);
    entryListActiveMock.mockReturnValue([fakeRow({ id: "new-1" })]);

    journalService.importDayFile("2026-10-08");

    expect(createTagsMock).toHaveBeenCalledWith([{ name: "思考" }]);
    expect(entryReplaceAssocMock).toHaveBeenCalledWith("new-1", [], [], expect.any(String));
    expect(renderJournalDayMock).toHaveBeenCalled();
    expect(fileWriteMock).toHaveBeenCalled();
    expect(scheduleJournalDayMock).toHaveBeenCalledWith("2026-10-08");
  });

  it("importDayFile 全部跳过时不接管渲染也不调度", () => {
    fileExistsMock.mockReturnValue(true);
    parseJournalDayFileMock.mockReturnValue([fakeParsed({ id: "same-1" })]);
    entryListAllMock.mockReturnValue([
      fakeRow({ id: "same-1", content: "旧版整篇第一段", updated_at: "2026-10-08T08:00:00.000Z" }),
    ]);

    const result = journalService.importDayFile("2026-10-08");

    expect(result).toEqual({ imported: 0, updated: 0, skipped: 1 });
    expect(renderJournalDayMock).not.toHaveBeenCalled();
    expect(scheduleJournalDayMock).not.toHaveBeenCalled();
  });

  it("importDayFile：文件不存在返回全零结果", () => {
    fileExistsMock.mockReturnValue(false);

    expect(journalService.importDayFile("2026-10-08")).toEqual({
      imported: 0,
      updated: 0,
      skipped: 0,
    });
    expect(parseJournalDayFileMock).not.toHaveBeenCalled();
  });

  it("importDayFile：手工伪造的 src/type 降级为 import/text，合法值原样保留", () => {
    fileExistsMock.mockReturnValue(true);
    entryListAllMock.mockReturnValue([]);
    parseJournalDayFileMock.mockReturnValue([
      fakeParsed({ id: "bad-1", source: "evil\"; DROP", type: "weird" }),
      fakeParsed({ id: "good-1", source: "mobile", type: "voice" }),
    ]);

    const result = journalService.importDayFile("2026-10-08");

    expect(result).toEqual({ imported: 2, updated: 0, skipped: 0 });
    const [bad, good] = entryCreateMock.mock.calls.map((call) => call[0] as Record<string, unknown>);
    expect(bad.id).toBe("bad-1");
    expect(bad.source).toBe("import");
    expect(bad.type).toBe("text");
    expect(good.id).toBe("good-1");
    expect(good.source).toBe("mobile");
    expect(good.type).toBe("voice");
  });

  it("importDayFile：upsert 全部落在事务内，中途抛错整天回滚且不执行后置渲染/调度", () => {
    fileExistsMock.mockReturnValue(true);
    entryListAllMock.mockReturnValue([]);
    parseJournalDayFileMock.mockReturnValue([
      fakeParsed({ id: "ok-1" }),
      fakeParsed({ id: "bad-2", occurred_at: "这不是一个时间" }), // normalizeOccurredAt 中途抛错
      fakeParsed({ id: "ok-3" }),
    ]);

    // 事务桩记录事务态：create 只允许在事务内发生（真 DAO 里 better-sqlite3 会在抛错时回滚整个事务）
    let inTransaction = false;
    const writesInsideTx: boolean[] = [];
    entryTransactionMock.mockImplementation((fn: () => unknown) => {
      inTransaction = true;
      try {
        return fn();
      } finally {
        inTransaction = false;
      }
    });
    entryCreateMock.mockImplementation((row: Record<string, unknown>) => {
      writesInsideTx.push(inTransaction);
      return String(row.id);
    });

    expect(() => journalService.importDayFile("2026-10-08")).toThrow();

    // 仅第一条写发生、且发生在事务内：中途抛错终止后续 upsert，真 DAO 的事务
    // （better-sqlite3 db.transaction）会在抛错时把已写入的条目一并回滚
    expect(entryTransactionMock).toHaveBeenCalledTimes(1);
    expect(writesInsideTx).toEqual([true]);
    expect(entryCreateMock).toHaveBeenCalledTimes(1);
    expect(inTransaction).toBe(false);
    // 后置管线未执行：不渲染、不调度，重试导入仍幂等
    expect(renderJournalDayMock).not.toHaveBeenCalled();
    expect(fileWriteMock).not.toHaveBeenCalled();
    expect(scheduleJournalDayMock).not.toHaveBeenCalled();
  });

  it("listEntries：走 assembleViews 的 JOIN 结果", () => {
    entryAssembleViewsMock.mockReturnValue([
      { date: "2026-10-08", has_legacy_file: false, entries: [{ id: "e1" }] },
    ]);

    expect(journalService.listEntries("2026-10-08")).toEqual([{ id: "e1" }]);
    expect(entryAssembleViewsMock).toHaveBeenCalledWith(["2026-10-08"]);
  });

  it("listRecentDays：今天始终在结果里（空条目）；has_legacy_file 来自 DAO；结果按日期 DESC", () => {
    entryListActiveDatesMock.mockReturnValue(["2026-10-07", "2026-10-05"]);
    entryListLegacyDatesMock.mockReturnValue(["2026-10-04"]);
    entryAssembleViewsMock.mockImplementation((dates: string[]) =>
      dates.map((date) => ({
        date,
        has_legacy_file: date === "2026-10-04",
        entries: [],
      })),
    );
    const today = new Date();

    const days = journalService.listRecentDays(3);

    const dates = days.map((d) => d.date);
    expect(dates).toContain(localDateOf(today));
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
    expect(dates.length).toBeLessThanOrEqual(4);
    expect(days.find((d) => d.date === "2026-10-04")?.has_legacy_file).toBe(true);
    expect(entryListActiveDatesMock).toHaveBeenCalledWith(4, undefined);
  });

  it("listRecentDays：beforeDate 翻页时透传游标，且不把今天塞进历史页", () => {
    entryListActiveDatesMock.mockReturnValue(["2026-10-05", "2026-10-03"]);
    entryAssembleViewsMock.mockImplementation((dates: string[]) =>
      dates.map((date) => ({ date, has_legacy_file: false, entries: [] })),
    );

    const days = journalService.listRecentDays(2, "2026-10-06");

    expect(entryListActiveDatesMock).toHaveBeenCalledWith(3, "2026-10-06");
    expect(entryAssembleViewsMock).toHaveBeenCalledWith(["2026-10-05", "2026-10-03"]);
    const dates = days.map((d) => d.date);
    expect(dates).toHaveLength(2);
    expect(dates.every((d) => d < "2026-10-06")).toBe(true);
  });

  it("resetEntries：清条目 + 关联 + journal 块，重建 FTS，返回清除条目数", () => {
    entryQueryOneMock.mockReturnValue({ n: 7 });
    chunkQueryMock.mockReturnValue([{ id: "c1" }, { id: "c2" }]);

    const cleared = journalService.resetEntries();

    expect(cleared).toBe(7);
    const sqls = entryExecuteMock.mock.calls.map((call) => String(call[0]));
    expect(sqls.some((sql) => /DELETE FROM journal_entries/.test(sql))).toBe(true);
    expect(sqls.some((sql) => /DELETE FROM tagged_items WHERE entity_type/.test(sql))).toBe(true);
    expect(sqls.some((sql) => /DELETE FROM journal_entry_projects/.test(sql))).toBe(true);
    expect(sqls.some((sql) => /DELETE FROM semantic_chunks/.test(sql))).toBe(true);
    expect(chunkRebuildFtsMock).toHaveBeenCalled();
    expect(dropVectorsMock).toHaveBeenCalledWith(["c1", "c2"]);
  });

  it("resetEntries：0 条也照常返回 0 不清向量", () => {
    entryQueryOneMock.mockReturnValue({ n: 0 });
    chunkQueryMock.mockReturnValue([]);

    expect(journalService.resetEntries()).toBe(0);
    expect(dropVectorsMock).toHaveBeenCalledWith([]);
  });

  // ───── 接管即导入（T10-3：首次追加不得静默覆盖未导入的旧版整篇 .md） ─────

  /** 旧版整篇日志：无 wrisp:journal 文件标记（isEntryOwnedJournalMarkdown 走真实实现） */
  const LEGACY_MD = "09:30\n旧版整篇的一段正文，没有任何条目注释。";
  /** 本管线自己的渲染产物：首行带 wrisp:journal 标记 */
  const ENTRY_OWNED_MD =
    '<!-- wrisp:journal {"format":1,"date":"2026-10-08"} -->\n# 2026-10-08\n\n**09:32**\n正文\n';

  it("appendEntry：当日零条目且磁盘留着旧版整篇 .md → 先按 §5.3 导入再接管（旧正文不丢）", () => {
    fileExistsMock.mockReturnValue(true);
    fileReadMock.mockReturnValue(LEGACY_MD);
    parseJournalDayFileMock.mockReturnValue([
      fakeParsed({ id: "legacy-1", content: "旧版整篇的一段正文，没有任何条目注释。" }),
    ]);
    // 模拟有状态的真源：接管导入落库后，当日条目查询要能读回它
    // （否则 ensureDayFile 看到的是零条目 + 旧整篇文件，命中渲染保护，观察不到接管）
    const rows: Array<Record<string, unknown>> = [];
    entryCreateMock.mockImplementation((row: unknown) => {
      rows.push(row as Record<string, unknown>);
      return String((row as { id?: string }).id ?? "(append)");
    });
    entryListActiveMock.mockImplementation(() => rows as never);

    journalService.appendEntry({
      content: "新条目",
      occurredAt: "2026-10-08T12:00:00.000Z",
    });

    expect(parseJournalDayFileMock).toHaveBeenCalledTimes(1);
    // 导入出的旧条目先落库、本次追加的条目后落库：顺序反了就意味着先覆盖文件再补数据
    const createdIds = entryCreateMock.mock.calls.map(
      (call) => (call[0] as { id?: string }).id ?? "(append)",
    );
    expect(createdIds).toEqual(["legacy-1", "(append)"]);
    // 接管后走正常后置管线：重渲染（条目接管产物覆写文件）+ 按日切块
    expect(renderJournalDayMock).toHaveBeenCalled();
    // 最终产物里旧正文与新条目都在——接管没有吞掉任何一份内容
    const renderedRows = renderJournalDayMock.mock.calls.at(-1)![1] as Array<{
      content: string;
    }>;
    expect(renderedRows.map((row) => row.content)).toEqual([
      "旧版整篇的一段正文，没有任何条目注释。",
      "新条目",
    ]);
    expect(scheduleJournalDayMock).toHaveBeenCalledWith("2026-10-08");
  });

  it("appendEntry：当日已有活跃条目 → 不重复导入（接管只发生一次）", () => {
    fileExistsMock.mockReturnValue(true);
    fileReadMock.mockReturnValue(LEGACY_MD);
    entryHasActiveEntriesMock.mockReturnValue(true);

    journalService.appendEntry({ content: "新条目", occurredAt: "2026-10-08T12:00:00.000Z" });

    expect(parseJournalDayFileMock).not.toHaveBeenCalled();
  });

  it("appendEntry：文件已是条目接管产物 → 不导入（渲染保护与接管判定同一口径）", () => {
    fileExistsMock.mockReturnValue(true);
    fileReadMock.mockReturnValue(ENTRY_OWNED_MD);

    journalService.appendEntry({ content: "新条目", occurredAt: "2026-10-08T12:00:00.000Z" });

    expect(parseJournalDayFileMock).not.toHaveBeenCalled();
  });

  it("appendEntry 触发的接管只清该日文件下 entry_id IS NULL 的旧版块，并把 id 交给向量层", () => {
    fileExistsMock.mockReturnValue(true);
    fileReadMock.mockReturnValue(LEGACY_MD);
    parseJournalDayFileMock.mockReturnValue([fakeParsed({ id: "legacy-1" })]);
    fileIndexFindByPathMock.mockReturnValue({ id: "fi-1", file_path: "journal/2026-10-08.md" });
    chunkRemoveFileLevelMock.mockReturnValue(["legacy-c1", "legacy-c2"]);

    journalService.appendEntry({ content: "新条目", occurredAt: "2026-10-08T12:00:00.000Z" });

    // 绝不能用 syncByFile(fileId, [])：条目块同样带 file_id，会被一起销毁
    expect(chunkRemoveFileLevelMock).toHaveBeenCalledWith("fi-1");
    expect(dropVectorsMock).toHaveBeenCalledWith(["legacy-c1", "legacy-c2"]);
  });

  it("importDayFile（显式导入）也在接管时清旧版文件级块", () => {
    fileExistsMock.mockReturnValue(true);
    fileReadMock.mockReturnValue(LEGACY_MD);
    parseJournalDayFileMock.mockReturnValue([fakeParsed({ id: "legacy-1" })]);
    fileIndexFindByPathMock.mockReturnValue({ id: "fi-1", file_path: "journal/2026-10-08.md" });
    chunkRemoveFileLevelMock.mockReturnValue(["legacy-c1"]);

    const result = journalService.importDayFile("2026-10-08");

    expect(result.imported).toBe(1);
    expect(chunkRemoveFileLevelMock).toHaveBeenCalledWith("fi-1");
    expect(dropVectorsMock).toHaveBeenCalledWith(["legacy-c1"]);
  });

  it("导入已接管的日文件不做旧块清理（本次没有发生接管）", () => {
    fileExistsMock.mockReturnValue(true);
    fileReadMock.mockReturnValue(ENTRY_OWNED_MD);
    parseJournalDayFileMock.mockReturnValue([fakeParsed({ id: "legacy-1" })]);
    fileIndexFindByPathMock.mockReturnValue({ id: "fi-1" });

    journalService.importDayFile("2026-10-08");

    expect(chunkRemoveFileLevelMock).not.toHaveBeenCalled();
  });

  // ───── deleteEntry 原子性（T10-5） ─────

  it("deleteEntry：软删除 + 清关联 + 回收条目块全部落在同一个事务内", () => {
    entryFindByIdMock.mockReturnValue(fakeRow());
    fileIndexFindByPathMock.mockReturnValue({ id: "fi-1", file_path: "journal/2026-10-08.md" });
    replaceEntryChunksMock.mockReturnValue({
      reused: 0,
      inserted: 0,
      removedIds: ["c1"],
      total: 0,
    });
    // 事务桩记录事务态：三步写库必须都发生在事务内，否则块回收失败时 tombstone 已单独提交
    let inTransaction = false;
    const insideTx: boolean[] = [];
    entryTransactionMock.mockImplementation((fn: () => unknown) => {
      inTransaction = true;
      try {
        return fn();
      } finally {
        inTransaction = false;
      }
    });
    entrySoftDeleteMock.mockImplementation(() => {
      insideTx.push(inTransaction);
      return 1;
    });
    entryReplaceAssocMock.mockImplementation(() => {
      insideTx.push(inTransaction);
    });
    replaceEntryChunksMock.mockImplementation(() => {
      insideTx.push(inTransaction);
      return { reused: 0, inserted: 0, removedIds: ["c1"], total: 0 };
    });

    expect(journalService.deleteEntry("e1")).toBe(true);
    expect(insideTx).toEqual([true, true, true]);
  });

  it("deleteEntry：块回收抛错 → 整体失败且不渲染不调度（tombstone 随事务回滚，重试可用）", () => {
    entryFindByIdMock.mockReturnValue(fakeRow());
    fileIndexFindByPathMock.mockReturnValue({ id: "fi-1", file_path: "journal/2026-10-08.md" });
    replaceEntryChunksMock.mockImplementation(() => {
      throw new Error("块回收失败");
    });

    expect(() => journalService.deleteEntry("e1")).toThrow("块回收失败");
    // 删除未成立：不得把「条目还在库里」的当日重渲染成缺了这条的产物
    expect(renderJournalDayMock).not.toHaveBeenCalled();
    expect(scheduleJournalDayMock).not.toHaveBeenCalled();
    expect(dropVectorsMock).not.toHaveBeenCalled();
  });

  // ───── appendEntry 载荷钳制（T10-6） ─────

  it("appendEntry：payload 的非法 source/type（IPC 运行时不可信）钳制到 desktop/text", () => {
    journalService.appendEntry({
      content: "钳制",
      occurredAt: "2026-10-08T12:00:00.000Z",
      source: "evil; DROP",
      type: "note",
    } as unknown as Parameters<typeof journalService.appendEntry>[0]);

    const created = entryCreateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(created.source).toBe("desktop");
    expect(created.type).toBe("text");
  });

  it("appendEntry：合法 source/type 原样落库", () => {
    journalService.appendEntry({
      content: "语音",
      occurredAt: "2026-10-08T12:00:00.000Z",
      source: "mobile",
      type: "voice",
    });

    const created = entryCreateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(created.source).toBe("mobile");
    expect(created.type).toBe("voice");
  });

  // FI-3：条目已提交是 DB 真值——渲染产物写失败不得把成功改写成抛错（用户重试追加会写出重复条目）
  it("appendEntry：ensureDayFile 写文件抛错仍返回条目 id，记 warn 且不吞掉按日切块调度", () => {
    fileWriteMock.mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    const id = journalService.appendEntry({ content: "晨记" });

    expect(id).toBe("entry-id");
    expect(Logger.warn).toHaveBeenCalled();
    expect(scheduleJournalDayMock).toHaveBeenCalledWith(localDateOf(new Date()));
  });

  it("updateEntry：日文件渲染抛错仍返回 true（改行已提交），调度不因此丢失", () => {
    entryFindByIdMock.mockReturnValue(fakeRow());
    fileWriteMock.mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    expect(journalService.updateEntry({ id: "e1", content: "改后正文" })).toBe(true);
    expect(scheduleJournalDayMock).toHaveBeenCalledWith("2026-10-08");
  });
});
