# 按作品素材检索 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让创作智能体能**按作品隔离**地检索语义块、概念、主题，作为写作素材提供给技能调用。

**Architecture:** 在块向量表补充 `project_id` 标量列并支持 LanceDB `where` 过滤；`chunkService.search` 增加 `projectId` 参数；新增 `materialSearchService` 作为唯一检索入口（强制 `projectId`）；把入口注册成 `search_materials` 工具供技能（L2）调用。概念/主题因表结构无 `project_id`，统一经 `project_chunks` 关联过滤。

**Tech Stack:** TypeScript（strict）、Electron main 进程、LanceDB（`@lancedb/lancedb`）、better-sqlite3、Vitest。

**Spec:** `docs/superpowers/specs/2026-09-10-creation-agent-design.md`

## Global Constraints

- Node.js 24+，包管理用 pnpm。
- TypeScript 严格模式：`noUnusedLocals` 与 `noUnusedParameters` 为**严格**，build 会因未使用变量失败。
- 测试用 Vitest，`globals: true`、`environment: happy-dom`；测试文件放在 `tests/unit/**` 或 `tests/integration/**`。
- 仅使用 v2 表；`semantic_chunks` 不得新增 `content_type` / `source` / `language` / `metadata` / `parent_chunk_id` / `split_index` / `is_memo` 字段。
- 枚举遵循 `as const` 对象 + `type X = (typeof X)[keyof typeof X]` 模式。
- **检索必须按作品隔离：`projectId` 必填，任何情况下不得跨作品召回。**
- 所有 IPC 走四层模式（preload module → preload type → core API → ipcMain handler）。

---

### Task 1: 移除未使用的 `search_blocks` 工具

**Files:**
- Delete: `src/main/core/skills/tools/search-blocks.tool.ts`
- Modify: `src/main/core/skills/tool.registry.ts:3,120-122`
- Test: `tests/unit/main/tool-registry.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `toolRegistry.getToolNames(): string[]` 不再包含 `"search_blocks"`（为空数组，直到 Task 8 注册新工具）

- [ ] **Step 1: 写失败测试**

```ts
// tests/unit/main/tool-registry.test.ts
import { describe, it, expect } from "vitest";
import { toolRegistry } from "@/main/core/skills/tool.registry";

describe("toolRegistry", () => {
  it("不再注册已废弃的 search_blocks 工具", () => {
    expect(toolRegistry.getToolNames()).not.toContain("search_blocks");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/tool-registry.test.ts`
Expected: FAIL —— `search_blocks` 仍被注册

- [ ] **Step 3: 删除工具文件并移除注册**

删除 `src/main/core/skills/tools/search-blocks.tool.ts`。

修改 `src/main/core/skills/tool.registry.ts`：删除顶部 import 行

```ts
import { searchBlocksTool } from "./tools/search-blocks.tool";
```

并把 `registerBuiltInTools` 改为空实现（保留方法，Task 8 会往里加工具）：

```ts
  private registerBuiltInTools(): void {
    // 工具在后续任务中注册
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/tool-registry.test.ts`
Expected: PASS

- [ ] **Step 5: 类型检查**

Run: `pnpm typecheck`
Expected: 通过（若报 `search-blocks.tool.ts` 相关未使用引用，说明还有遗留引用，需一并清理）

- [ ] **Step 6: 提交**

```bash
git add src/main/core/skills/tool.registry.ts tests/unit/main/tool-registry.test.ts
git rm src/main/core/skills/tools/search-blocks.tool.ts
git commit -m "refactor: 移除未使用的 search_blocks 工具"
```

---

### Task 2: `BlockEmbedding` 类型补充 `project_id`

**Files:**
- Modify: `src/main/types/db/vector.types.ts:12-18,44-52`
- Modify: `src/main/core/vector/lancedb.ts:67-71`
- Modify: `src/main/core/db/vector.dao.ts:34-60`
- Test: `tests/unit/main/block-embedding-project-id.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `BlockEmbedding` 新增 `project_id?: Id | null`
  - `BlockEmbeddingCreate` 新增 `project_id?: Id | null`
  - `BlockEmbeddingUpdate` 新增 `project_id?: Id | null`

- [ ] **Step 1: 写失败测试**

```ts
// tests/unit/main/block-embedding-project-id.test.ts
import { describe, it, expect } from "vitest";
import type {
  BlockEmbedding,
  BlockEmbeddingCreate,
} from "@/main/types/db/vector.types";

describe("BlockEmbedding 类型", () => {
  it("允许携带 project_id", () => {
    const data: BlockEmbeddingCreate = {
      block_id: "b1",
      project_id: "p1",
      embedding: [0, 1],
    };
    const row: BlockEmbedding = { ...data };
    expect(row.project_id).toBe("p1");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/block-embedding-project-id.test.ts`
Expected: FAIL —— 类型编译报错：`project_id` 不存在于 `BlockEmbeddingCreate`

- [ ] **Step 3: 修改类型**

`src/main/types/db/vector.types.ts`：

```ts
export interface BlockEmbedding {
  [key: string]: unknown;
  block_id: Id;
  project_id?: Id | null;
  embedding: EmbeddingVector;
  _distance?: number;
}

export interface BlockEmbeddingCreate {
  block_id: Id;
  project_id?: Id | null;
  embedding: EmbeddingVector;
}

export interface BlockEmbeddingUpdate {
  project_id?: Id | null;
  embedding: EmbeddingVector;
}
```

`src/main/core/vector/lancedb.ts`：

```ts
export interface BlockEmbedding {
  [key: string]: unknown;
  block_id: Id;
  project_id?: Id | null;
  embedding: number[];
}
```

`src/main/core/db/vector.dao.ts` 的 `BlockVectorDao.update`，保留既有 `project_id`：

```ts
  async update(blockId: string, data: BlockEmbeddingUpdate): Promise<void> {
    try {
      const table = await this.getTable("block_embeddings");
      const existing = (await table
        .query()
        .where(`block_id = '${blockId}'`)
        .limit(1)
        .toArray()) as BlockEmbedding[];
      const projectId = data.project_id ?? existing[0]?.project_id ?? null;
      await table.delete(`block_id = '${blockId}'`);
      await table.add([
        { block_id: blockId, project_id: projectId, ...data } as BlockEmbedding,
      ]);
      Logger.debug("[BlockVectorDao] 更新向量记录", { block_id: blockId });
    } catch (error) {
      Logger.error("[BlockVectorDao] 更新 Block 向量失败", {
        error: String(error),
        blockId,
        data,
      });
      throw error;
    }
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/block-embedding-project-id.test.ts`
Expected: PASS

- [ ] **Step 5: 类型检查**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: 提交**

```bash
git add src/main/types/db/vector.types.ts src/main/core/vector/lancedb.ts src/main/core/db/vector.dao.ts tests/unit/main/block-embedding-project-id.test.ts
git commit -m "feat: BlockEmbedding 类型支持 project_id"
```

---

### Task 3: 块向量表补充 `project_id` 列与存量迁移

**Files:**
- Create: `src/main/core/vector/project-filter.ts`
- Modify: `src/main/core/vector/lancedb.ts`（`initVectorTables`：表 schema 加列 + 存量迁移；并从 project-filter 引入 `buildProjectFilter`）
- Test: `tests/unit/main/vector-project-filter.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `BlockEmbedding.project_id`
- Produces: `block_embeddings` 表含可空 `project_id` 列；导出 `buildProjectFilter(projectId: string): string`

- [ ] **Step 1: 写失败测试**

```ts
// tests/unit/main/vector-project-filter.test.ts
import { describe, it, expect } from "vitest";
import { buildProjectFilter } from "@/main/core/vector/project-filter";

describe("buildProjectFilter", () => {
  it("生成合法的 LanceDB 过滤表达式", () => {
    expect(buildProjectFilter("p_1")).toBe("project_id = 'p_1'");
  });

  it("对空 projectId 抛错（防跨作品泄漏）", () => {
    expect(() => buildProjectFilter("")).toThrow("PROJECT_ID_REQUIRED");
    expect(() => buildProjectFilter("   ")).toThrow("PROJECT_ID_REQUIRED");
  });

  it("对非法字符抛错（防 SQL 注入）", () => {
    expect(() => buildProjectFilter("p1' OR '1'='1")).toThrow(
      "INVALID_PROJECT_ID",
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/vector-project-filter.test.ts`
Expected: FAIL —— `buildProjectFilter` 未定义

- [ ] **Step 3: 实现过滤表达式与建表/迁移**

新建 `src/main/core/vector/project-filter.ts`（纯函数模块，**不引入 electron / 原生依赖**，保证可单测）：

```ts
// src/main/core/vector/project-filter.ts
/** 构造 LanceDB 的 project 过滤表达式；非法输入直接抛错，避免跨作品泄漏 */
export function buildProjectFilter(projectId: string): string {
  if (!projectId || projectId.trim() === "") {
    throw new Error("PROJECT_ID_REQUIRED");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(projectId)) {
    throw new Error(`INVALID_PROJECT_ID: ${projectId}`);
  }
  return `project_id = '${projectId}'`;
}
```

修改 `initVectorTables` 中 Block 向量表的分支：

```ts
  const schema = new Schema([
    new Field("block_id", new Utf8(), false),
    new Field("project_id", new Utf8(), true),
    new Field(
      "embedding",
      new FixedSizeList(1536, new Field("item", new Float32(), false)),
      false,
    ),
  ]);
```

并在 `if (!(await tableExists(db, "block_embeddings")))` 的 `else` 分支中加迁移：

```ts
  } else {
    console.log("[LanceDB] Block 向量表已存在");
    const blockTable = await db.openTable("block_embeddings");
    const fields = await blockTable.schema();
    const hasProjectId = fields.fields.some((f) => f.name === "project_id");
    if (!hasProjectId) {
      console.log("[LanceDB] 为 Block 向量表补充 project_id 列...");
      await blockTable.addColumns(new Field("project_id", new Utf8(), true));
      console.log("[LanceDB] project_id 列补充完成（存量行为 null）");
    }
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/vector-project-filter.test.ts`
Expected: PASS（3 个用例全绿）

- [ ] **Step 5: 类型检查**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: 提交**

```bash
git add src/main/core/vector/lancedb.ts tests/unit/main/vector-project-filter.test.ts
git commit -m "feat: 块向量表补充 project_id 列与过滤表达式"
```

---

### Task 4: 向量写入路径带上 `project_id`

**背景**：块向量的真实写入点是 `src/main/core/smart-tasks/executors/chunk-vectorize.executor.ts:42`（`vectorService.createBlockEmbeddings(vectors)`）。`semantic_chunks` 表没有 `project_id`，作品归属记录在 `project_chunks` 关联表，因此需反查。

**Files:**
- Create: `src/main/core/vector/vector-payload.ts`
- Modify: `src/main/core/smart-tasks/executors/chunk-vectorize.executor.ts:38-42`
- Test: `tests/unit/main/vector-payload.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `BlockEmbeddingCreate.project_id`
- Produces: `buildBlockEmbeddings(batch: Array<{ id: string }>, vectors: number[][], projectIdOf: (blockId: string) => string | null): BlockEmbeddingCreate[]`

- [ ] **Step 1: 写失败测试**

```ts
// tests/unit/main/vector-payload.test.ts
import { describe, it, expect } from "vitest";
import { buildBlockEmbeddings } from "@/main/core/vector/vector-payload";

describe("buildBlockEmbeddings", () => {
  it("为每条向量带上对应作品的 project_id", () => {
    const batch = [{ id: "c1" }, { id: "c2" }];
    const vectors = [
      [0, 1],
      [1, 0],
    ];
    const result = buildBlockEmbeddings(batch, vectors, (id) =>
      id === "c1" ? "p1" : null,
    );
    expect(result).toEqual([
      { block_id: "c1", project_id: "p1", embedding: [0, 1] },
      { block_id: "c2", project_id: null, embedding: [1, 0] },
    ]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/vector-payload.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现纯函数并改写入路径**

```ts
// src/main/core/vector/vector-payload.ts
import type { BlockEmbeddingCreate } from "@/main/types/db/vector.types";

/**
 * 组装块向量写入载荷。
 * projectIdOf 用于解析每个块的作品归属（semantic_chunks 无 project_id，需外部提供）。
 */
export function buildBlockEmbeddings(
  batch: Array<{ id: string }>,
  vectors: number[][],
  projectIdOf: (blockId: string) => string | null,
): BlockEmbeddingCreate[] {
  return batch.map((block, idx) => ({
    block_id: block.id,
    project_id: projectIdOf(block.id),
    embedding: vectors[idx],
  }));
}
```

修改 `src/main/core/smart-tasks/executors/chunk-vectorize.executor.ts`：

```ts
import { ProjectChunkDao } from "@/main/core/db";
import { buildBlockEmbeddings } from "@/main/core/vector/vector-payload";

  private projectChunkDao = new ProjectChunkDao();

  private resolveProjectId(blockId: string): string | null {
    const links = this.projectChunkDao.findBy("chunk_id", blockId);
    return links[0]?.project_id ?? null;
  }
```

把构造 `vectors` 的那段替换为：

```ts
        const vectorList = results.map((r) => r.vector);
        const vectors = buildBlockEmbeddings(
          batch,
          vectorList,
          (blockId) => this.resolveProjectId(blockId),
        );

        await vectorService.createBlockEmbeddings(vectors);
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/vector-payload.test.ts`
Expected: PASS

- [ ] **Step 5: 类型检查**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: 提交**

```bash
git add src/main/core/vector/vector-payload.ts src/main/core/smart-tasks/executors/chunk-vectorize.executor.ts tests/unit/main/vector-payload.test.ts
git commit -m "feat: 块向量写入携带 project_id"
```

---

### Task 5: `searchBlockEmbeddings` 支持按作品过滤

**Files:**
- Create: `src/main/core/vector/block-search.ts`
- Modify: `src/main/core/vector/lancedb.ts`（改为从 block-search 再导出，保持对外 API 不变）
- Modify: `src/main/core/db/vector.dao.ts`（Block 检索方法）
- Modify: `src/main/core/services/vector.service.ts:168-180`
- Test: `tests/unit/main/search-block-embeddings-filter.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `buildProjectFilter`
- Produces:
  - `searchBlockEmbeddings(table, queryVector, topK?, projectId?): Promise<BlockEmbedding[]>`
  - `vectorService.searchBlockEmbeddings({ vector, topK, projectId })` 使用 `projectId` 过滤

- [ ] **Step 1: 写失败测试**

```ts
// tests/unit/main/search-block-embeddings-filter.test.ts
import { describe, it, expect, vi } from "vitest";
import { searchBlockEmbeddings } from "@/main/core/vector/block-search";

describe("searchBlockEmbeddings 按作品过滤", () => {
  it("传入 projectId 时调用 where 表达式", async () => {
    const where = vi.fn(() => ({ limit: () => ({ toArray: async () => [] }) }));
    const table = { search: vi.fn(() => ({ where })) };
    await searchBlockEmbeddings(table as never, [0, 1], 10, "p1");
    expect(where).toHaveBeenCalledWith("project_id = 'p1'");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/search-block-embeddings-filter.test.ts`
Expected: FAIL —— `where` 未被调用

- [ ] **Step 3: 实现过滤**

新建 `src/main/core/vector/block-search.ts`（仅 type-only 引入 `Table` 与 `BlockEmbedding`，**不引入原生依赖**）：

```ts
// src/main/core/vector/block-search.ts
import type { Table } from "@lancedb/lancedb";
import { buildProjectFilter } from "./project-filter";
import type { BlockEmbedding } from "./lancedb";

export async function searchBlockEmbeddings(
  table: Table,
  queryVector: number[],
  topK: number = 10,
  projectId?: string,
): Promise<BlockEmbedding[]> {
  const search = table.search(queryVector);
  const filtered = projectId
    ? search.where(buildProjectFilter(projectId))
    : search;
  const results = await filtered.limit(topK).toArray();
  return results as BlockEmbedding[];
}
```

并在 `src/main/core/vector/lancedb.ts` 中原位置改为再导出，保持既有调用方不变：

```ts
export { searchBlockEmbeddings } from "./block-search";
```

`src/main/core/db/vector.dao.ts` 的 Block 检索方法与 `src/main/core/services/vector.service.ts` 的 `searchBlockEmbeddings` 同步透传 `projectId`（入参已由 `VectorSearchParams.projectId` 预留）。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/search-block-embeddings-filter.test.ts`
Expected: PASS

- [ ] **Step 5: 类型检查**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: 提交**

```bash
git add src/main/core/vector/lancedb.ts src/main/core/db/vector.dao.ts src/main/core/services/vector.service.ts tests/unit/main/search-block-embeddings-filter.test.ts
git commit -m "feat: 块向量检索支持按作品过滤"
```

---

### Task 6: `chunkService.search` 增加 `projectId` 参数

**Files:**
- Modify: `src/main/core/services/chunk.service.ts:260-315`
- Test: `tests/unit/main/chunk-search-project-scope.test.ts`

**Interfaces:**
- Consumes: Task 5 的 `vectorService.searchBlockEmbeddings({ ..., projectId })`
- Produces: `chunkService.search(keyword: string, limit?: number, searchType?: SearchType, projectId?: Id): Promise<ChunkItem[]>`

- [ ] **Step 1: 写失败测试**

```ts
// tests/unit/main/chunk-search-project-scope.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/main/core/services/vector.service", () => ({
  vectorService: {
    searchBlockEmbeddings: vi.fn(async () => []),
  },
}));

import { vectorService } from "@/main/core/services/vector.service";
import { chunkService } from "@/main/core/services/chunk.service";
import { SEARCH_TYPE } from "@/shared/enums";

describe("chunkService.search 作品隔离", () => {
  it("把 projectId 透传给向量检索", async () => {
    await chunkService.search("关键词", 5, SEARCH_TYPE.SEMANTIC, "p1");
    expect(vectorService.searchBlockEmbeddings).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1" }),
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/chunk-search-project-scope.test.ts`
Expected: FAIL —— 第 4 个参数未被接受/透传

- [ ] **Step 3: 扩展签名与透传**

`src/main/core/services/chunk.service.ts`：

```ts
  public async search(
    keyword: string,
    limit: number = 50,
    searchType?: SearchType,
    projectId?: Id,
  ): Promise<ChunkItem[]> {
```

并在 `SEARCH_TYPE.SEMANTIC` 分支把 `projectId` 传给 `this.searchByVector(keyword, limit, projectId)`；`searchByVector` 内部调用 `vectorService.searchBlockEmbeddings({ vector, topK: ANN_TOP_K, projectId })`。

**兜底**：向量结果为空且 `projectId` 存在时，用 `projectChunkDao` 关联结果做二次过滤，保证历史向量（`project_id` 为 null）不会漏检。

```ts
  private async filterByProject(
    chunks: ChunkItem[],
    projectId: Id,
  ): Promise<ChunkItem[]> {
    const allowedIds = new Set(this.getProjectChunkIds(projectId));
    return chunks.filter((c) => allowedIds.has(c.id));
  }
```

同时新增公有方法（**本任务引入，Task 7 直接复用，不得重复实现**）：

```ts
  /** 获取作品关联的全部语义块 id（供素材检索按作品过滤） */
  public getProjectChunkIds(projectId: Id): string[] {
    return this.projectChunkDao
      .findBy("project_id", projectId)
      .map((row) => row.chunk_id);
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/chunk-search-project-scope.test.ts`
Expected: PASS

- [ ] **Step 5: 类型检查**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: 提交**

```bash
git add src/main/core/services/chunk.service.ts tests/unit/main/chunk-search-project-scope.test.ts
git commit -m "feat: 语义块检索支持按作品隔离"
```

---

### Task 7: 新增 `materialSearchService` 统一入口

**Files:**
- Create: `src/main/core/services/material-search.service.ts`
- Modify: `src/main/core/db/conceptChunk.dao.ts`（新增 `findByChunkIds`）
- Modify: `src/main/core/db/topicChunk.dao.ts`（新增 `findByChunkIds`）
- Modify: `src/main/types/db/index.ts`（若需导出相关类型）
- Test: `tests/unit/main/material-search.service.test.ts`

**Interfaces:**
- Consumes: Task 6 的 `chunkService.search(keyword, limit, searchType, projectId)`
- Produces:
  - `type MaterialKind = "chunk" | "concept" | "topic"`
  - `interface MaterialSearchParams { projectId: string; query: string; kinds?: MaterialKind[]; limit?: number }`
  - `interface MaterialSearchItem { kind: MaterialKind; id: string; title?: string; content: string; score?: number }`
  - `materialSearchService.search(params: MaterialSearchParams): Promise<MaterialSearchItem[]>`

- [ ] **Step 1: 写失败测试**

```ts
// tests/unit/main/material-search.service.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/main/core/services/chunk.service", () => ({
  chunkService: {
    search: vi.fn(async () => [
      { id: "c1", content: "本作品的设定 A", temporal_score: 1, word_count: 4, status: "active", created_at: "", updated_at: "" },
    ]),
  },
}));

import { materialSearchService } from "@/main/core/services/material-search.service";

describe("materialSearchService", () => {
  it("缺少 projectId 时抛错", async () => {
    await expect(
      materialSearchService.search({ projectId: "", query: "设定" }),
    ).rejects.toThrow("PROJECT_ID_REQUIRED");
  });

  it("按作品检索语义块", async () => {
    const items = await materialSearchService.search({
      projectId: "p1",
      query: "设定",
      kinds: ["chunk"],
      limit: 5,
    });
    expect(items).toEqual([
      { kind: "chunk", id: "c1", content: "本作品的设定 A" },
    ]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/material-search.service.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现服务**

```ts
// src/main/core/services/material-search.service.ts
import { chunkService } from "@/main/core/services/chunk.service";
import { conceptChunkDao } from "@/main/core/db/conceptChunk.dao";
import { topicChunkDao } from "@/main/core/db/topicChunk.dao";
import { conceptDao } from "@/main/core/db/concept.dao";
import { topicDao } from "@/main/core/db/topic.dao";
import { SEARCH_TYPE } from "@/shared/enums";
import { Logger } from "@/main/utils/logger";

export type MaterialKind = "chunk" | "concept" | "topic";

export interface MaterialSearchParams {
  projectId: string;
  query: string;
  kinds?: MaterialKind[];
  limit?: number;
}

export interface MaterialSearchItem {
  kind: MaterialKind;
  id: string;
  title?: string;
  content: string;
  score?: number;
}

const DEFAULT_KINDS: MaterialKind[] = ["chunk"];
const MAX_LIMIT = 20;

class MaterialSearchService {
  private static instance: MaterialSearchService | null = null;

  public static getInstance(): MaterialSearchService {
    if (!MaterialSearchService.instance) {
      MaterialSearchService.instance = new MaterialSearchService();
    }
    return MaterialSearchService.instance;
  }

  public async search(params: MaterialSearchParams): Promise<MaterialSearchItem[]> {
    const { projectId, query } = params;
    if (!projectId || projectId.trim() === "") {
      throw new Error("PROJECT_ID_REQUIRED");
    }
    const kinds = params.kinds?.length ? params.kinds : DEFAULT_KINDS;
    const limit = Math.min(Math.max(params.limit ?? 5, 1), MAX_LIMIT);

    const result: MaterialSearchItem[] = [];

    if (kinds.includes("chunk")) {
      const chunks = await chunkService.search(
        query,
        limit,
        SEARCH_TYPE.SEMANTIC,
        projectId,
      );
      result.push(
        ...chunks.map((c) => ({
          kind: "chunk" as const,
          id: c.id,
          content: c.content,
        })),
      );
    }

    // 概念/主题：经 project_chunks 关联过滤，保证不跨作品
    if (kinds.includes("concept") || kinds.includes("topic")) {
      const allowedChunkIds =
        await this.resolveProjectChunkIds(projectId);
      if (kinds.includes("concept")) {
        result.push(...this.collectConcepts(allowedChunkIds, limit));
      }
      if (kinds.includes("topic")) {
        result.push(...this.collectTopics(allowedChunkIds, limit));
      }
    }

    return result.slice(0, limit);
  }

  private async resolveProjectChunkIds(projectId: string): Promise<Set<string>> {
    try {
      const rows = await chunkService.getProjectChunkIds(projectId);
      return new Set(rows);
    } catch (error) {
      Logger.error("[MaterialSearchService] 获取作品语义块失败", {
        error: String(error),
        projectId,
      });
      return new Set();
    }
  }

  private collectConcepts(allowed: Set<string>, limit: number): MaterialSearchItem[] {
    const links = conceptChunkDao.findByChunkIds([...allowed]);
    const ids = new Set(
      links.map((l) => l.concept_id),
    );
    return conceptDao
      .findByIds([...ids])
      .slice(0, limit)
      .map((c) => ({
        kind: "concept" as const,
        id: c.id,
        title: c.title,
        content: c.evolving_summary ?? "",
      }));
  }

  private collectTopics(allowed: Set<string>, limit: number): MaterialSearchItem[] {
    const links = topicChunkDao.findByChunkIds([...allowed]);
    const ids = new Set(
      links.map((l) => l.topic_id),
    );
    return topicDao
      .findByIds([...ids])
      .slice(0, limit)
      .map((t) => ({
        kind: "topic" as const,
        id: t.id,
        title: t.title,
        content: t.summary ?? "",
      }));
  }
}

export const materialSearchService = MaterialSearchService.getInstance();
```

`getProjectChunkIds` 已在 Task 6 引入，本任务**直接调用**（`chunkService.getProjectChunkIds(projectId)`），不要重复实现。

在 `src/main/core/db/conceptChunk.dao.ts` 增加（`TopicChunkDao` 同理，把 `concept_id` 换成 `topic_id`）：

```ts
  /**
   * 按语义块 id 批量查询关联（供"按作品过滤概念"使用）
   * @param chunkIds 语义块 id 列表
   */
  findByChunkIds(chunkIds: Id[]): ConceptChunk[] {
    if (chunkIds.length === 0) return [];
    const placeholders = chunkIds.map(() => "?").join(",");
    const sql = `SELECT * FROM ${this.tableName} WHERE chunk_id IN (${placeholders}) ORDER BY relevance_score DESC`;
    return this.query(sql, chunkIds);
  }
```

```ts
  // topicChunk.dao.ts
  findByChunkIds(chunkIds: Id[]): TopicChunk[] {
    if (chunkIds.length === 0) return [];
    const placeholders = chunkIds.map(() => "?").join(",");
    const sql = `SELECT * FROM ${this.tableName} WHERE chunk_id IN (${placeholders}) ORDER BY relevance_score DESC`;
    return this.query(sql, chunkIds);
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/material-search.service.test.ts`
Expected: PASS（2 个用例）

- [ ] **Step 5: 类型检查**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: 提交**

```bash
git add src/main/core/services/material-search.service.ts src/main/core/services/chunk.service.ts tests/unit/main/material-search.service.test.ts
git commit -m "feat: 新增按作品隔离的素材检索服务"
```

---

### Task 8: 注册 `search_materials` 工具

**Files:**
- Create: `src/main/core/skills/tools/search-materials.tool.ts`
- Modify: `src/main/core/skills/tool.registry.ts`（`registerBuiltInTools`）
- Test: `tests/unit/main/search-materials.tool.test.ts`

**Interfaces:**
- Consumes: Task 7 的 `materialSearchService.search(params)`
- Produces: 工具名 `"search_materials"`，权限 `read`，参数 `{ projectId: string(必填), query: string(必填), kinds: string[], limit: integer }`，返回 JSON 字符串 `{ results: MaterialSearchItem[] }` 或 `{ error: string, results: [] }`

- [ ] **Step 1: 写失败测试**

```ts
// tests/unit/main/search-materials.tool.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/main/core/services/material-search.service", () => ({
  materialSearchService: {
    search: vi.fn(async () => [
      { kind: "chunk", id: "c1", content: "素材A" },
    ]),
  },
}));

import { searchMaterialsTool } from "@/main/core/skills/tools/search-materials.tool";
import { materialSearchService } from "@/main/core/services/material-search.service";

describe("search_materials 工具", () => {
  it("缺少 projectId 时返回错误而不抛异常", async () => {
    const raw = await searchMaterialsTool.execute({ query: "设定" });
    expect(JSON.parse(raw).error).toContain("projectId");
  });

  it("按作品检索并返回结果", async () => {
    const raw = await searchMaterialsTool.execute({
      projectId: "p1",
      query: "设定",
      kinds: ["chunk"],
      limit: 3,
    });
    expect(materialSearchService.search).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", query: "设定" }),
    );
    expect(JSON.parse(raw).results[0].id).toBe("c1");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/search-materials.tool.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现工具并注册**

```ts
// src/main/core/skills/tools/search-materials.tool.ts
import { materialSearchService } from "@/main/core/services/material-search.service";
import { Logger } from "@/main/utils/logger";
import type { RegisteredTool } from "@/shared/types/skill.types";

/**
 * search_materials 工具 — 按作品检索创作素材（语义块 / 概念 / 主题）
 * 权限级别：read
 * 约束：projectId 必填，检索严格按作品隔离。
 */
export const searchMaterialsTool: RegisteredTool = {
  name: "search_materials",
  description:
    "按作品检索创作素材：语义块、概念、主题。必须提供 projectId，检索限定在该作品内。",
  parameters: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "作品 id（必填，用于隔离）" },
      query: { type: "string", description: "搜索关键词或语义查询" },
      kinds: {
        type: "array",
        description: "检索类型，可选 chunk/concept/topic",
        items: { type: "string", enum: ["chunk", "concept", "topic"] },
        default: ["chunk"],
      },
      limit: { type: "integer", description: "返回条数上限", default: 5 },
    },
    required: ["projectId", "query"],
  },
  permission: "read",

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const projectId = String(args.projectId ?? "");
      const query = String(args.query ?? "");
      if (!projectId.trim()) {
        return JSON.stringify({
          error: "缺少必填参数 projectId（检索必须按作品隔离）",
          results: [],
        });
      }
      if (!query.trim()) {
        return JSON.stringify({ error: "查询参数 query 不能为空", results: [] });
      }
      const kinds = Array.isArray(args.kinds)
        ? (args.kinds as string[]).filter((k) =>
            ["chunk", "concept", "topic"].includes(k),
          ) as ("chunk" | "concept" | "topic")[]
        : undefined;
      const limit = Math.min(Number(args.limit) || 5, 20);

      const results = await materialSearchService.search({
        projectId,
        query,
        kinds,
        limit,
      });
      Logger.info("[search_materials] 检索完成", {
        projectId,
        query: query.substring(0, 50),
        resultCount: results.length,
      });
      return JSON.stringify({ results });
    } catch (error) {
      Logger.error("[search_materials] 执行失败", { error: String(error) });
      return JSON.stringify({ error: String(error), results: [] });
    }
  },
};
```

`src/main/core/skills/tool.registry.ts`：

```ts
import { searchMaterialsTool } from "./tools/search-materials.tool";

  private registerBuiltInTools(): void {
    this.register(searchMaterialsTool);
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/search-materials.tool.test.ts`
Expected: PASS

- [ ] **Step 5: 全量校验**

Run: `pnpm test && pnpm typecheck`
Expected: 全部通过

- [ ] **Step 6: 提交**

```bash
git add src/main/core/skills/tools/search-materials.tool.ts src/main/core/skills/tool.registry.ts tests/unit/main/search-materials.tool.test.ts
git commit -m "feat: 注册按作品检索素材的 search_materials 工具"
```

---

## 后续计划（本计划不含）

按 spec §9 交付顺序，后续各自独立成计划：

| 计划 | 覆盖 spec 条目 |
|---|---|
| 技能作品作用域与工具注册表 | I8、I9 |
| 创作会话与确认门 | I6、I7、§6.1、§6.4 |
| 模板页面级技能 | I5、§6.5 |
| P1 作品采集向导 + P2 作品技能派生 | §5.1、§6.2 |
| P4 页面大纲与分步创作 | §5.2、§6.6 |
| P3 偏好与风格记忆 | §6.3 |
| P5 审核与委托 | §6.1 |

**已识别但延后的项**：spec §7 的 **I4（search IPC 接线）** 本计划未包含——渲染层真正消费素材是在"页面大纲 + 素材过目"环节（方案 C 的大纲阶段），届时随该计划一并接入，避免现在接一条无消费方的通道。

## 开放风险

- **存量向量无 `project_id`**：Task 3 的迁移把存量行置为 `null`；Task 6 的 `filterByProject` 兜底保证不漏检。彻底回填需要一个后台重嵌入任务，建议在"素材检索"上线后再补。
- **概念/主题关联查询规模**：Task 7 的 `findByChunkIds` 以 `chunk_id IN (...)` 批量查询，需确认 `concept_chunks` / `topic_chunks` 在 `chunk_id` 上有索引；若没有，上线前补一条索引迁移。
- **作品语义块数量**：`allowed` 集合来自 `project_chunks`，若单作品关联块数很大，`IN (...)` 的占位符会很多，需要分批（如每 500 个一批）查询。
