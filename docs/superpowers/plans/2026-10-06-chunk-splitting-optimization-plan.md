# 语义块切分 — 可执行优化方案

> 创建时间：2026-10-06
> 配套阅读：[`2026-10-06-chunk-splitting-followups.md`](./2026-10-06-chunk-splitting-followups.md)（问题清单）。本文是它的**执行方案**：每个迭代给出改动文件、代码骨架、验收标准、风险与回滚。
> 排序原则：先修写路径根因（一次编辑重排全库），再补观测（否则后面每条都在盲调），最后才是算法与 L4。
> 规模记号：S ≈ 半天内，M ≈ 1–2 天，L ≈ 3 天以上。

---

## 迭代总览

| # | 主题 | 规模 | 前置 | 主要收益 |
| --- | --- | --- | --- | --- |
| 0 | ✅ 环境与基线（2026-10-06 完成） | S | — | 让集成测试重新可用，否则后续改动无回归网 |
| 1 | ✅ **写路径 upsert 化 + FTS 批量重建**（根因，2026-10-06 完成） | M | 迭代 0 | 小改动不再全量重排块；摘要/向量/语义链接不再被无谓作废 |
| 2 | `chunk_layer` + 相似度落库 + 真实模型联调 | S | 迭代 1 | L3 从「拍阈值」变成「可测量」 |
| 3 | L3 算法与覆盖（预筛 / 断点上限 / 重叠策略 / 分窗） | M | 迭代 2 的数据 | 精修质量与覆盖率 |
| 4 | 存量重建与 backfill 入口 | M | 迭代 1 | 改阈值真正生效 |
| 5 | 围栏词法 + 块字段 schema 共享化 | M | — | 消除主/渲染双实现漂移；打通块类型策略分派 |
| 6 | 成本护栏（并发、限流、中断、模型换代） | M | 迭代 1 | 批量导入不打满本地模型 |
| 7 | 检索评测集与去重（其中 7.3 去重 / 7.5 相关性排序 / 7.6 孤儿向量 / 7.7 入参 limit ✅ 已完成） | M | 迭代 2 | 切分改动的验收口径 |
| 8 | L4 延迟分块 | L | 迭代 2 + 真实收益确认 | 长文档边界质量 |

---

## 迭代 0 — 环境与基线（先做，S）

**问题**：`tests/integration/main/**` 9 个文件全部因 `better-sqlite3` ABI 不匹配失败（现装二进制编译于 NODE_MODULE_VERSION 145 = Electron 41.1.1，Node v24.15.0 需 137）。`replaceByFile` / DAO / 迁移链路都在这些测试里，不修就没有回归网。

**注意：`pnpm rebuild` 修不了这个问题**——它执行 `electron-rebuild -f -w better-sqlite3 -w node-llama-cpp`，产出的正是测试拒绝的 ABI 145。仓库里已有的 `pnpm rebuild:node`（`cd node_modules/better-sqlite3 && prebuild-install`）才是对的杠杆：它拉取 Node 运行时的预编译产物。代价是这段时间内 `pnpm dev` / `pnpm start` 会崩，改完必须切回。

**执行**（已验证，2026-10-06）

```bash
# 1) 备份 Electron 二进制，避免回头重新编译（编译要几分钟且依赖网络）
cp node_modules/better-sqlite3/build/Release/better_sqlite3.node \
   node_modules/better-sqlite3/build/Release/electron-abi145.bak.node

# 2) 装 Node ABI 的预编译产物（只需网络一次）
pnpm rebuild:node

# 3) 跑测试
npx vitest run

# 4) 跑完立刻还原，直接覆盖即可（瞬时，无需 electron-rebuild）
cp node_modules/better-sqlite3/build/Release/electron-abi145.bak.node \
   node_modules/better-sqlite3/build/Release/better_sqlite3.node
```

还原前先确认没有 Electron 进程在跑（`tasklist | grep -i electron`），否则覆盖会失败。

**验收**（实测）：全量 `npx vitest run` 失败数从 47 降到 2 —— 117 个文件里 116 通过，647 个用例 645 通过；仅剩 `tests/unit/renderer/admonition-view.test.ts` 两个渲染层用例，与切分无关。

**顺带修掉的真实缺陷**：ABI 恢复后暴露出 8 处 `SELECT EXISTS(...) as exists` —— `exists` 是 SQLite 保留字，不能直接做列别名（`sqlite 3.53.2` 实测 `near "exists": syntax error`），这些 `existsXxx()` 方法一旦被调用就抛错。已统一改为 `AS exists_flag`：`base.dao.ts:527`（影响所有 DAO 的 `exists(id)`）、`taggedItem.dao.ts`、`conceptChunk.dao.ts`、`reflectionChunk.dao.ts`、`semanticLink.dao.ts`、`projectChunk.dao.ts`、`topicChunk.dao.ts`、`topicConcept.dao.ts`。集成测试之前全红，所以这批用例从未被执行过。

**基线记录**（后续每次迭代都要对比）：跑一次真实长文档切分，记下块数、各层占比、`file:chunk` 耗时。

---

## 迭代 1 — 写路径根因：全删全建 → 按 content_hash 对齐的 upsert（M，本方案最高价值）

> **✅ 2026-10-06 已落地**。下文 1.1/1.2 描述的是改动前的状态与设计；与方案的四点出入记在 1.5。

### 1.1 问题（比清单 §3.1 更严重，是同一根因）

`ChunkDao.replaceByFile()`（`src/main/core/db/chunk.dao.ts:214`）当前做三件事：删掉该文件全部块的 `semantic_links` / `temporal_events` → `DELETE` 全部行 → 逐行 `create()` 重建。

由此产生的连锁浪费：

1. **改一个字，全部块换新 id**：`ai_summary` 全丢（`create` 载荷不含它）→ `chunk-summary` 重新烧一遍 LLM；向量与 `project_chunks` / `concept_chunks` / `topic_chunks` 归属一起级联清空。
2. **`dropFileVectors(fileId)` 删全文件向量**（`chunk.service.ts:188`）：即使 99% 块正文一字未变，也要重新嵌入。
3. **L3 精修把上述代价付第二遍**：`processRefine` 替换边界时再来一次全删全建。
4. **FTS 被逐行全量重建**：`BaseDao.create()` 末尾无条件调 `refreshFts()`（`base.dao.ts:197` → `769` → `757`；不传 data 时守卫直接放行），而 `rebuildFts()` 执行的是 `INSERT INTO xxx_fts VALUES('rebuild')`——**全表重建**。`replaceByFile` 循环 N 次 create 就是 N 次全表重建，末尾还额外显式 `rebuildFts()` 一次 → **N+1 次全量重建**，而 `semantic_chunks_fts` 是全库共享的（trigram 分词）。500 块的文件切一次，等于把全库全文索引重建 501 遍。`update()`（`base.dao.ts:338`）同样带 FTS 列时会命中守卫 → 复用 id 的差异更新路径也必须纳入同一次延迟重建，否则迭代 1 的 upsert 化会把开销从 N+1 变成 2N。这一条单独就足以拖垮保存链路。

### 1.2 方案

把「替换」改成「按 `content_hash` 对齐的差异更新」，正文未变的块**复用原 id**，从而保住它的摘要、向量、作品归属与语义链接。

**A. DAO 层新增 `syncByFile`（替代 `replaceByFile`）**

```ts
// src/main/core/db/chunk.dao.ts
syncByFile(fileId: ChunkId, chunks: ChunkCreate[]): {
  reused: number; inserted: number; removedIds: ChunkId[];
} {
  return this.transaction(() => {
    const existing = this.query(
      `SELECT id, content_hash FROM ${this.tableName} WHERE file_id = ?`,
      [fileId],
    ) as Array<{ id: string; content_hash: string | null }>;

    // content_hash 可重复（重叠块 / 相同引用句），用多重集按出现顺序配对
    const pool = new Map<string, string[]>();
    for (const row of existing) {
      if (!row.content_hash) continue;
      const queue = pool.get(row.content_hash);
      if (queue) queue.push(row.id);
      else pool.set(row.content_hash, [row.id]);
    }

    const reusedIds = new Set<string>();
    let reused = 0;
    for (const chunk of chunks) {
      const queue = chunk.content_hash ? pool.get(chunk.content_hash) : undefined;
      const reuseId = queue?.shift();
      if (reuseId) {
        reusedIds.add(reuseId);
        reused += 1;
        this.update(reuseId, {
          file_path: chunk.file_path,
          start_line: chunk.start_line,
          end_line: chunk.end_line,
          section_title: chunk.section_title,
          content: chunk.content,
          word_count: chunk.word_count,
          status: "active",
        });   // 不动 ai_summary / last_vectorized_at：正文同源，派生物继续有效
      } else {
        this.create(chunk);
      }
    }

    const removedIds = existing.map((r) => r.id).filter((id) => !reusedIds.has(id));
    this.removeChunksWithRelations(removedIds);   // 只清理真正消失的块
    return { reused, inserted: chunks.length - reused, removedIds };
  });
}
```

要点：

- 复用行的 `content_hash` 必然与新块一致，所以旧摘要对应的就是同一正文，不需要额外失效逻辑。
- 多重集配对而非 `Map` 一次命中：两块正文相同（重叠区、重复引用句）时必须按出现顺序配对，否则 id 错配会让语义链接指向错的行。
- `removeChunksWithRelations(removedIds)` 是新私有方法：把 `replaceByFile` 里现有的两条 `DELETE FROM semantic_links / temporal_events` 抽出来，改用 `id IN (...)` 占位符绑定（外键未声明 CASCADE，必须显式清，见 `chunk.dao.ts:205` 注释），范围从「整文件」缩到「消失的块」。`removedIds` 为空时直接跳过，不发 SQL。

**B. 服务层按 removedIds 删向量**

```ts
// src/main/core/services/content/chunk.service.ts
public async dropVectorsByIds(chunkIds: Id[]): Promise<void> {
  if (chunkIds.length === 0) return;
  try {
    await vectorService.deleteBlockEmbeddings(chunkIds);
  } catch (error) {
    Logger.warn("清理语义块向量失败（不影响切分）", { count: chunkIds.length, error: String(error) });
  }
}
```

`chunk-index.service.ts` 的 `processFile`(:168) / `processRefine`(:257) 里，把「先 `dropFileVectors(fileId)` 再 `replaceFileChunks`」的顺序**反转**为：先替换拿到 `removedIds`，再 `dropVectorsByIds(removedIds)`——保留行的向量继续有效，只有消失的块才删向量。

`dropFileVectors` 留给文件删除路径兜底，主链路不再调用。

**C. FTS 批量：一次写入一次重建**

`BaseDao` 增加作用域开关，让批量写入期间跳过逐行 `refreshFts`：

```ts
// src/main/core/db/base.dao.ts
private ftsDeferredDepth = 0;

/** 批量写入期间抑制逐行 FTS 重建，最外层结束时统一重建一次 */
protected withFtsDeferred<T>(fn: () => T): T {
  this.ftsDeferredDepth += 1;
  try {
    return fn();
  } finally {
    this.ftsDeferredDepth -= 1;
    if (this.ftsDeferredDepth === 0) this.rebuildFts();
  }
}

protected refreshFts(data?: object): void {
  if (this.ftsDeferredDepth > 0) return;   // 由最外层统一重建
  // ……原有逻辑不变
}
```

`syncByFile` 整体包进 `withFtsDeferred(...)`，N+1 次全表重建收敛为 1 次。
计数器做成**深度**而不是布尔，是为了让嵌套批量（全库重建时按文件循环）只在外层收尾一次。

### 1.3 验收（实测）

- `tests/integration/main/chunk-sync-upsert.test.ts`（10 例，全绿）覆盖：
  - 改一段正文 → 其余块 `id` 不变，`ai_summary` 与 `last_vectorized_at` 原地保留；
  - 正文相同的两块（重叠区 / 重复引用句）→ id 按出现顺序配对，行区间不错配；
  - 删除一段 → `removedIds` 恰为该块，`semantic_links` / `temporal_events` 只清该块相关行；
  - 边界移动 → `start_line/end_line` 跟随，正文不重写；
  - 软删除块不被复活、空 `fileId` 不写库；
  - **真实 FTS 一致性**：延迟重建收尾后 `searchFts` 能命中新正文、也不再命中已删正文（防"忘记重建"）；
  - `vi.spyOn(dao, "rebuildFts")` 计数：500 块同步 1 次、200 块改一个字 reused 199 / inserted 1 且仍 1 次、嵌套作用域只在最外层重建 1 次。
  - > 原方案里的 `tests/unit/main/chunk-fts-batch.test.ts` **没有单独建文件**：计数用例同样需要真实库（`rebuildFts` 要真的执行 SQL），与 upsert 用例共用一套内存库夹具更省，合并进同一文件。
- `tests/unit/main/chunk-index-refine.test.ts` 改按新顺序断言：向量清理发生在写库**之后**，且入参是 `removedIds`；新增「没有块消失时不触碰向量库」。
- 全量 `npx vitest run`：119 文件 / 663 例，仅剩迭代 0 记录的两个既有渲染层用例失败；`npx vue-tsc --noEmit -p tsconfig.app.json` 干净；`eslint` 无告警。
- 手工验证（待用户跑一次真实库）：Journal 改一个字后 `SELECT COUNT(ai_summary) FROM semantic_chunks WHERE file_id=?` 不变。

### 1.4 风险与回滚

| 风险 | 缓解 |
| --- | --- |
| 复用 id 时 update 失败一半，行区间与正文不一致 | 全部在单一 `transaction()` 内，失败整体回滚 |
| 多重集配对让「A 块复用 B 块 id」 | 配对键只有 `content_hash`，正文相同即语义同一，链接指向哪个 id 都对 |
| FTS 延迟重建期间读到旧索引 | `withFtsDeferred` 同步执行、收尾必重建；中间不暴露读接口 |
| 需要回退 | 服务层只有 `chunk-index.service` 两处调用，切回旧写法是一行改动。注意：`replaceByFile` 从未进过 git（它和本次改动都还在工作区），删除后唯一留存是本文 §1.1/§1.2 的形态描述，照着重写约 20 行 |

### 1.5 与方案的出入（落地时确认）

1. `replaceByFile` **直接删除**，没有保留 `@deprecated` 版本：全仓只有 `chunk.service` 一个调用方，留两份实现只会让下一次改动只改到旧的那份。
2. `dropFileVectors` **同样删除**而不是"留给文件删除路径兜底"——删除后它没有任何调用方。兜底职责移到迭代 4 的 backfill / 清理链路（`journal.service.ts:282` 的裸 SQL 清空路径本来就没清向量，见清单 §3.1.3）。
3. `syncByFile` 的配对集合加了 `AND status = 'active'`：否则复用会把用户软删除的块"复活"成 active。
4. `removeChunksWithRelations` 除了清关联还要删主表行，按 `CHUNK_DELETE_BATCH_SIZE = 500` 分批绑占位符（`semantic_links` 那条 SQL 每个 id 绑两次，单文件上千块时会顶到 SQLite 参数上限）。
5. `withFtsDeferred` 的收尾重建带 `ftsIndexedFields.length > 0` 守卫：无 FTS 索引的表调用它会执行不存在的 `<table>_fts`。

---

## 迭代 2 — 观测先行：`chunk_layer` 落库 + 真实模型联调（S）

清单 §2.5 / §10.2 是其他所有调参的前置，所以排在算法改动之前。

### 2.1 迁移加两列

`semantic_chunks` 现有列见 `src/main/schemas/init.sql:28`（`content_hash`、`ai_summary`、`last_vectorized_at` 都在）。新增：

```sql
-- src/main/schemas/migrations/0.4.2_add_chunk_split_layer.sql
ALTER TABLE semantic_chunks ADD COLUMN chunk_layer TEXT DEFAULT 'structure';
ALTER TABLE semantic_chunks ADD COLUMN refine_score REAL;
CREATE INDEX IF NOT EXISTS idx_semantic_chunks_chunk_layer
    ON semantic_chunks(chunk_layer);
-- 自登记 migrations_db：照 0.4.1 的范式（INSERT OR IGNORE，id 用 ...000006，
-- executed_at 用 strftime('%Y-%m-%dT%H:%M:%fZ','now') 保证 getCurrentVersion 排序正确）
```

- 列名已核对 AGENTS.md pitfall #14 的禁用清单（`content_type` / `source` / `language` / `metadata` / `parent_chunk_id` / `split_index` / `is_memo`），`chunk_layer` 与 `refine_score` 不在其中。
- `init.sql` 建表语句同步加这两列（新库直接带），迁移只服务存量库；`migrations_db` 基线的表清单字符串一并更新。
- `Chunk` / `ChunkCreate` / `ChunkUpdate`（`src/main/types/db/chunk.types.ts:49`）加 `chunk_layer?: ChunkLayer`、`refine_score?: number | null`。
- `SplitChunk.layer` → `chunk_layer`；`semanticSplit` 把块内最低相邻相似度写入 `refine_score`——这是阈值校准唯一需要的数据。

### 2.2 真实模型联调（一次性，但必须做）

加一个 dev-only 命令（不接 UI），对真实 Journal 与几篇长页面跑 `embedBatch`，按 `chunk_type` 分桶打印相邻相似度的 P10/P50/P90。

**验收**：产出一张体裁 × 相似度分位数表，据此决定是否替换 `CHUNK_SEMANTIC_THRESHOLD_LOG`(0.75) / `_NARRATIVE`(0.55)——当前两个值是先验值，从未实测。若分布显示两类无法用两个全局阈值分开，把「需要按块内相似度分布归一」记为迭代 3.5 的输入。

**注意**：真模型只在手动命令下跑，别进 `vitest run` 默认路径；单元测试继续用注入的假 embedder。

### 2.3 验收

- 保存含超长段的 Journal 后，`SELECT chunk_layer, COUNT(*) FROM semantic_chunks GROUP BY chunk_layer` 三种层级齐全且比例合理；
- `layer='semantic'` 的行 `refine_score` 非空；
- 分位数表产出并附在本文末尾。

---

## 迭代 3 — L3 算法与覆盖（M，依赖迭代 2 的真实分布）

按数据决定做哪几条，顺序如下。

**3.1 覆盖：长度合规但话题跳跃的块也参与精修**（清单 §2.1）
`applyLengthConstraint` 现在只在超预算时登记 `RefineTarget`。改为：L1 粗块若句子数 ≥ 3 且相邻相似度最小值低于阈值，也登记为**低优先级**精修目标（`RefineTarget` 加 `priority`），队列按优先级取。成本可控——只在本来就要推理的文件上顺带做。

**3.2 切点数量可控：Top-K 断点 + 间隔下限**（清单 §2.2）
`semanticSplit`（`splitting/semantic.ts:94`）现在是线性扫 + ±1 局部最小值，一个块可能被切 0 次或 8 次。改为：

```
候选 = sims 中 < threshold 的位置
排序 = 相似度升序
选取 = 贪心，与已选切点至少间隔 CHUNK_MIN_GAP_SENTENCES（新常量，取 2）
上限 = 每块最多 CHUNK_MAX_CUTS_PER_BLOCK（新常量，取 4）
```

验收：同一块精修前后块数差 ≤ `CHUNK_MAX_CUTS_PER_BLOCK`，且不出现单句碎片（配合 `mergeTinyChunks`）。

**3.3 重叠策略明确化**（清单 §2.3）
L2 装箱带 15% 句子重叠，L3 分组后**零重叠**。二选一，别留隐性差异：
- 推荐保留重叠：分组后对每组首部做等价 `overlapCarry`，且必须仍走行区间不变量（同一行内部不切）；
- 或明确「语义块不重叠」是设计决定，写进 `chunk-splitter.ts` 的层级表注释——现在测试已断言无重叠，但没有任何文档说明这是有意的。

**3.4 超长块分窗，取代硬放弃**（清单 §2.4）
`CHUNK_MAX_REFINE_SENTENCES = 512` 现在是直接 `return null`，长段落永远精修不到。改为按 400 句窗口、窗口间留 8 句重叠分批精修，拼接时对齐边界。

**3.5 动态阈值（可选，数据支持再做）**
`thresholdForChunkType` 只有 journal / 非 journal 两档。若迭代 2 显示同一体裁内部差异大，改为对块内相似度做归一（取相对低谷），绝对阈值退化为兜底。

**共同验收**：`tests/unit/main/chunk-splitter-semantic.test.ts` 扩充切点上限、间隔下限、分窗边界一致三项；每次改动跑迭代 7 的评测集（若已就位）。

---

## 迭代 4 — 存量重建与 backfill 入口（M）

清单 §7：改阈值现在等于没改，历史块不会按新策略重切。

**4.1 新增任务类型 `file:chunk-rebuild`**

```ts
// chunk-index.service.ts
export const TASK_TYPE_FILE_CHUNK_REBUILD = "file:chunk-rebuild";

/** 全库 / 按作品重建：复用任务队列，天然获得暂停续传 */
public async scheduleRebuild(scope: { projectId?: string | null; batchSize?: number }): Promise<number>
```

按 `file_index` 逐个入队（`groupId = file-chunk-rebuild:${fileId}`，沿用现有互斥），payload 带 `fileHash` 复用过期判定。必须**分批**（如每批 200 个文件），否则一次入队几万任务把 `tasks` 表打满。

**4.2 精修批量补跑**：`scheduleRefineAll()` 只挑 `chunk_layer = 'length'` 的文件（迭代 2 的列正好用上）；`modelRouter.isLocalAvailable()` 为假时整批直接返回、不入队。

**4.3 暴露入口**：走 IPC 四层（`preload/modules/<domain>.ts` → `preload/types/` → `core/apis/` → `ipcMain/`，并在 `main/index.ts` 注册）。渲染层进度提示必须走 `useFrontendNotification()`，**不要**直接用 Naive UI `useMessage()`；确认弹窗用 `useDialog()`。设置页加「重建语义块」按钮 + 二次确认（这是全库写操作，不可逆地重排 chunk id）。

**验收**：改 `CHUNK_MAX_COARSE_CHARS` 后触发重建，块数随之变化；重建中途退出应用，重启后由 `taskQueue.resetRunningTasks()` + 未完成任务确认续传流程接着跑完。

---

## 迭代 5 — 围栏词法与块 schema 共享化（M，同时解决清单 §5 + §6）

### 5.1 新建共享定义源

```
src/shared/blocks/fence.ts      // FENCE_OPEN_RE / FENCE_CLOSE_RE / FIELD_LINE_RE + parseFence + serializeFence
src/shared/blocks/schemas.ts    // 块类型 → 字段 schema + 向量化策略
```

主进程 `splitting/fence.ts` 与渲染层 `blocks/engine/md-codec.ts`、`marked-bridge.ts` 全部改为从这里导入，删掉各自的正则副本。
当前已确认的漂移（必须一并决定并统一到一种行为）：

| 维度 | 主进程 `splitting/fence.ts:2` | 渲染层 |
| --- | --- | --- |
| 闭合行缩进 | `/^\s*:::+[ \t]*$/` 允许缩进 | `/^:::+[ \t]*$/`（`md-codec.ts:13`）不允许 |
| 开启行 | `/^\s*:::\s*([a-zA-Z][\w-]*)[ \t]*$/` 任意块名 | `^:::${def.mdName}[ \t]*$`（`marked-bridge.ts:29`）只认已注册类型 |
| 字段行 | `/^([a-zA-Z][\w-]*)[ \t]*:[ \t]*(.*)$/` | 与主进程一致 ✓ |

建议统一到**渲染层语义**（只认已注册类型、不允许缩进）——编辑器是用户实际看到的形状；主进程遇到未注册块名时降级为普通文本而不是原子块。
注意主进程当前对未闭合围栏已有降级路径（`findFenceClose` 返回 -1），这条保持不变。

### 5.2 向量化策略进 schema

```ts
export type FenceEmbedStrategy = "fields-single" | "fields-multi" | "none";

export interface FenceBlockSchema {
  type: string;                        // metric / checklist / ...
  fields: Array<{ key: string; indexed: boolean }>;
  embedStrategy: FenceEmbedStrategy;   // 指标卡 → fields-single；任务清单 → none
}
```

`buildEmbeddingText`（`splitting/embedding-text.ts:17`）从「类型无关拼装」改为按 `schema.embedStrategy` 分派。`fields-multi`（字段级多条向量）只留枚举不实现——它依赖迭代 8.3 的向量表改造。

### 5.3 让「不向量化」真正生效（本条最大的坑）

`chunk-vectorize` 的选取是 `WHERE last_vectorized_at IS NULL AND ai_summary IS NOT NULL`（`chunk-vectorize.executor.ts:76`），`chunk-summary` 是 `WHERE ai_summary IS NULL OR ai_summary = ''`（`chunk-summary.executor.ts:72`）——**两条 SQL 都不认识块类型**。所以「任务清单不向量化」必须在**两处同时**加过滤，否则卡片仍然被摘要 + 嵌入一遍。

配套决策：

- 给 `strategy === "none"` 的块**直接写入哨兵 `last_vectorized_at`**（而不是留在 NULL），否则每轮智能整理都会白扫一遍这些行。
- 同步在检索侧补结构化过滤路径（`chunk.service.ts:350` 的 `runSearch` 关键词分支与 `:390` 的 `searchByVector`），否则这类块从检索结果里彻底消失，用户能直接感知为「卡片搜不到了」。这是**改动的验收项，不是后续优化**。

**验收**：缩进的 `:::metric` 在主/渲染两侧被一致处理；新增一个块类型只改 `shared/blocks/schemas.ts` 一处即生效；`tests/unit/main/chunk-embedding-text.test.ts` 扩到按策略分派；`strategy=none` 的块不出现在 `chunk-summary` / `chunk-vectorize` 的选取结果里，但能通过结构化过滤被搜到。

---

## 迭代 6 — 成本护栏（M）

对应清单 §8，批量导入前必须就位。

1. **精修独立并发档**：`TaskExecutor` 现在只有全局 `startWorkers(3)`，所有任务类型抢同一池。改动最小的做法是在 handler 层加信号量限制 `file:chunk-refine` 的并发，而不是给 `TaskExecutor` 开分池 API。
2. **全局推理令牌**：`embedBatch` 外层加一个 `ModelGate`（同一时刻最多 N 个推理），让 `file:chunk-refine` 与智能任务的 `chunk-vectorize` 共用——这两条链路目前互不知情，同时跑会双倍占用本地模型与内存（3–4GB 级）。
3. **可中断**：`taskQueue.cancel(id)` 目前只改数据库状态，正在 `await embedBatch` 的 handler 不会停（见 `task-executor.ts` 的执行循环）。给 `processRefine` 传一个 `AbortSignal`，在句子批次之间检查；与已有的 `stopWorkers()` 等待 `activeWorkers === 0` 配合，才能真正优雅退出。
4. **模型换代感知**：向量行加 `model_id`，切分/精修时若与当前注册模型不符就把文件标为待重嵌入，而不是静默混用两个向量空间；`EMBEDDING_DIMENSION`（`src/main/core/vector/lancedb.ts`）变化时同理。

**验收**：模拟「全库重建 + 用户同时启动智能整理」，观察内存峰值与推理排队不重叠；应用退出时正在跑的精修能在一个批次内停下并被 `resetRunningTasks()` 正确恢复。

---

## 迭代 7 — 检索评测集与去重（M）

清单 §3.3 / §10。这是**唯一能证明 L3 有用的手段**，建议在算法继续加码前先建起来。

1. **语料**：取真实 Journal 与 2–3 个作品页面共 20–30 篇，覆盖长日志、混排代码/表格、叙事长文。存 `tests/fixtures/chunking/*.md` + 每篇人工边界标注 `.json`。
2. **指标**：
   - 边界质量：与人工标注的 P/R/F1（±1 句容差）；
   - 检索质量：同一查询集在 `L1+L2` / `L1+L2+L3` 两档下的 Recall@5 / nDCG@10（向量检索走 `embedBatch` + LanceDB 临时表）。
3. **重叠去重（✅ 2026-10-06 已落地）**：`chunk.service.searchByVector` 现在在 rerank **之前**用 `dropSpanOverlaps` 按 `(file_id, 行区间交集)` 去重，同一文件里共享任何一行的候选只保留 ANN 顺序最靠前的一个——L2 的 15% 重叠块不再占掉 `RERANK_TOP_K=10` 的名额，也少一半重排输入。跨文件的同区间各自保留。
   > 落地时顺带发现的两个既有缺陷，同日全部处理：结果列表末尾按 `created_at DESC` 重排会**覆盖 rerank 的相关性顺序**——已改为按 rerank 顺序返回（见本迭代第 5 条）；`searchByVector` 忽略入参 `limit`（硬编码只回 10 条）——已改为按 `limit` 返回（见本迭代第 7 条）。
   > 验证：`tests/unit/main/chunk-search-overlap-dedup.test.ts`（5 例去重 + 1 例排序 + 5 例 limit，共 11 例）。
4. **落库快照测试**：每篇 fixture 只断言块数与各层占比，不断言具体文本，避免调参时全量变红。

**迭代 7 之后同日补的三处修复（2026-10-06）**

5. ✅ **语义检索按 rerank 相关性顺序返回**（`chunk.service.ts:485`）：原先末尾调 `blocksToRecordList(..., created_at DESC)`，把重排好的相关性顺序抹掉——语义检索返回的是「最相关的一批」但顺序按时间。现在向量路径直接 `topKBlocks.map(blockToChunkInfo)` 保留 rerank 顺序；关键词检索（`SEARCH_TYPE.KEYWORD`）与模型不可用/异常降级路径**仍按时间倒序**，那是关键词检索的既有语义，没有动。
6. ✅ **Journal 重置不再泄漏孤儿向量**（`journal.service.ts` 的 `resetJournalTable`）：该路径用裸 SQL 清空 `chunk_type='journal'` 的块并重建 FTS，但从不碰 LanceDB，被删块的向量行永久残留。现在事务内先记下这批 id，**提交之后**再交给 `chunkService.dropVectorsByIds`（回滚时块还在库里，不能跟着删）；因此方法签名变为 `Promise<number>`，`journal.api.ts` 调用点加 `await`。
   > 验证：`tests/unit/main/journal-reset-vector-cleanup.test.ts`（4 例：只取 journal 子集、清理在提交之后、事务失败不删、空集不触碰向量库）。
7. ✅ **`searchByVector` 接上入参 `limit`**（`chunk.service.ts:408`）：原先硬编码 `RERANK_TOP_K = 10`，调用方传 20（全局搜索默认）或 50 都只回 10 条，`limit` 仅在 FTS 路径生效。现在 `topK = clamp(limit, 1, RERANK_INPUT_MAX=50)`，ANN 召回随之放大到 `topK × 4`（下限 50、上限 200）以保证重叠去重后仍凑得满，而**送进重排的候选固定截在 50 条**——limit 变大只加深召回，不放大本地 rerank 的推理开销。上限 50 是刻意取舍：超出重排规模的候选没有被排过序，返回它们等于返回随机顺序。`limit ≤ 10` 时召回与重排输入均与改动前一致。
   > 验证：`tests/unit/main/chunk-search-overlap-dedup.test.ts` 的「语义检索遵守入参 limit」（5 例：按 limit 返回、召回随 limit 加深而重排规模不变、超规模截断、条数封顶 50、非正值退化为 1 条）。
   > 实测（5、6、7 三条一并验证）：全量 `npx vitest run` 120 文件 / 673 例，仅剩迭代 0 记录的两个既有渲染层用例失败；`npx vue-tsc --noEmit -p tsconfig.app.json` 干净；`npx tsc --noEmit -p tsconfig.vitest.json` 在这四个新增/改动的 spec 上无报错；改动文件 `eslint` 无告警。下游 `search.service.vectorSearch` 与渲染层都不再重排，rerank 顺序可一路透传到全局搜索列表；`material-search.service` 的 `limit`（默认 5、上限 20）落在同一口径内，行为不变。

**验收**：一条命令跑出对比表；之后任何阈值/算法改动都必须附这份表的 diff。

---

## 迭代 8 — L4 延迟分块（L，最后做，且允许永远不做）

清单 §1。**先确认收益再动手**：若迭代 7 显示 L3 已到人工标注 F1 的天花板，不做的理由就充分了。

### 8.1 硬阻塞（唯一真正的前置）

`worker/embedding-handler.ts:46` 的 `embedBatch` 只返回池化后的句向量（`Array.from(output.data)`，维度取 `dims` 最后一维）。L4 需要 token 级 `last_hidden_state`。改造：

- worker 新增 `embedTokenLevel(texts)`：`pooling: "none"` + `normalize: false`，返回 `[batch, seq, dim]` 与 attention_mask；
- `local-gateway/manager.ts:455` 一带加对应透传，worker 消息协议（`worker/index.ts` 的 `handlers` / `responseTypeMap` / `allowedTypes`）同步加新类型；
- **输出体积是主要风险**：BGE-M3 1024 维 × 8192 token ≈ 33MB Float32 / 文档。必须**在 worker 内直接池化**（把边界下标传进 worker，只回传块向量），绝不让 token 张量跨 `parentPort`。

### 8.2 主体实现

新建 `splitting/late-chunking.ts`，**不要塞进 `semantic.ts`**（两者成本模型完全不同）：

```
输入：整篇文本（≤ CHUNK_LATE_CHUNKING_MAX_TOKENS）+ L1/L2 给出的候选边界（token 下标）
一次编码 → 每个候选边界取其前若干 token 的窗口 mean-pooling → 边界向量
边界质量 = 相邻边界向量的语义距离 + 与整篇质心的偏离（FreeChunker 口径）
选择：贪心 Top-K，复用迭代 3.2 的间隔与上限约束
```

`SentenceEmbedder` 这个 seam 保持不动——它的 `texts → vectors` 形状正好能换成「边界片段 → 边界向量」，注入 `refineDocument` 即可复用整条三层降级链路。

### 8.3 顺带解决字段级多条向量

LanceDB 现在是「一个 `block_id` 一行」（`lancedb.ts:196` schema、`:308` 与 `:321` 的 `delete(block_id = ...)` 再 `add`）。指标卡片若要走字段级多条向量，需要把删改语义改成按 `(block_id, field_key)`，并让检索结果按 `block_id` 归并。这是独立的中等改动，**别和 L4 绑在一起做**。

---

## 明确建议不做 / 延后

| 项 | 理由 |
| --- | --- |
| 把 L2/L3 阈值做成用户可配 | 与本轮已确认决策冲突（常量集中在 `chunk.constants.ts`、非用户可配）；且阈值未校准前，给用户的是「不知道往哪拧」的旋钮 |
| L3 改成递归二分全量重切 | 成本随深度爆炸，而覆盖问题（§3.1）用低优先级预筛就能解决 |
| 给 `semantic_chunks` 加 `metadata` / `split_index` / `parent_chunk_id` 等列 | AGENTS.md pitfall #14 明确禁止 |
| 给 L2 重新加回 Token 口径 | 2026-10-06 已决定 L2 只看 500 字符，`CHUNK_MAX_COARSE_TOKENS` 与 `estimateTokens()` 已删除；真 tokenizer 只在「窗口溢出守卫」（清单 §4.1）和 L4（迭代 8）里才需要 |
| 精修与切分共用同一个 `groupId` | 现状分两组（`file-chunk:${id}` / `file-chunk-refine:${id}`）是对的：精修不该被新的切分请求取消掉已落库的 L2 结果 |
| 为 L4 提前改向量表结构 | 迭代 8.3 与 L4 无必然关系，各自独立决策 |

---

## 落地节奏建议

| 批次 | 内容 | 理由 |
| --- | --- | --- |
| 第一批（一周内，直接改善体验） | 迭代 0 → 迭代 1 → 迭代 7.3 | 迭代 1 修的是「改一个字全库重烧」的根因；7.3 修的是用户现在就能感觉到的重复召回 |
| 第二批（观测与调参） | 迭代 2 → 迭代 7 全量 → 迭代 3 | 先有数据再调算法，否则每步都是猜 |
| 第三批（规模化） | 迭代 4 → 迭代 5 → 迭代 6 | 存量生效 + 块类型可扩展 + 批量导入安全 |
| 最后 | 迭代 8 | 以迭代 7 的评测结论作为放行条件 |

---

## 附：迭代 1 + 7.3 的落点索引（2026-10-06 已落地，行号为当前工作区）

| 位置 | 落地后 | 说明 |
| --- | --- | --- |
| `src/main/core/db/chunk.dao.ts:223` | `syncByFile(fileId, chunks): ChunkSyncResult` | 按 `content_hash` 多重集配对复用 id；只配对 `status='active'` 行；`replaceByFile` 已删除 |
| `src/main/core/db/chunk.dao.ts:288` | `removeChunksWithRelations(chunkIds)`（private） | 按批（500/批）清 `semantic_links` / `temporal_events` 再 `deleteByIds` |
| `src/main/core/db/base.dao.ts:728` + `:804` + `:774` | `ftsDeferredDepth` / `withFtsDeferred` / `refreshFts` 短路 | 批量写期间跳过逐行重建，最外层收尾一次 |
| `src/main/core/services/content/chunk.service.ts:151` | `replaceFileChunks` 返回 `ChunkSyncResult` | `{ reused, inserted, removedIds, total }` |
| `src/main/core/services/content/chunk.service.ts:194` | `dropVectorsByIds(chunkIds)` | 替代 `dropFileVectors`（已删除）；空数组直接返回 |
| `src/main/core/services/content/chunk-index.service.ts:168` / `:259` | 先同步、后按 `removedIds` 删向量 | `processFile` / `processRefine` 两处顺序反转 |
| `src/main/core/services/content/chunk.service.ts:468` + `:509` | `dropSpanOverlaps`（迭代 7.3） | rerank 前按 `(file_id, 行区间交集)` 去重 |
| `src/main/core/services/content/chunk.service.ts:485` | 向量路径按 rerank 顺序返回 | 不再走 `blocksToRecordList`（它末尾按 `created_at DESC` 重排） |
| `src/main/core/services/content/chunk.service.ts:24`~`:30` + `:408` + `:470` | `RERANK_INPUT_MAX` / `ANN_CANDIDATE_*` + `topK`/`annTopK` + 重排输入截断（迭代 7.7） | `limit` 决定返回条数与召回深度，重排规模恒定 50 |
| `src/main/core/services/content/journal.service.ts:270` + `:308` | `resetJournalTable` 改 async，提交后 `dropVectorsByIds(staleChunkIds)` | 修掉 Journal 重置泄漏孤儿向量；`journal.api.ts:127` 相应加 `await` |
| `src/main/types/db/chunk.types.ts` | `ChunkUpdate` 补 `file_id / file_path / start_line / end_line / section_title / chunk_type / content_hash`；新增 `ChunkSyncResult` | 复用 id 时需要能只更新行区间 |
| `src/main/types/db/chunk.types.ts:49`（待办） | `ChunkCreate` 仍无 layer / score | 迭代 2 加 `chunk_layer`、`refine_score` |
| `src/main/schemas/init.sql:28`（待办） | `semantic_chunks` DDL 未变 | 迭代 2 同步加两列；另建 `0.4.2_*.sql` 迁移并自登记 |
