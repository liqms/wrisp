# 语义块切分 — 未实现部分与迭代待办

> 创建时间：2026-10-06
> 关联实现：`src/main/core/services/content/splitting/`、`chunk-splitter.ts`、`chunk-index.service.ts`
> 关联阈值：`src/main/constants/chunk.constants.ts`
> 用途：四层切分策略（L1 结构 / L2 长度 / L3 语义 / L4 延迟）落地后，**本轮未做或只做了一半**的内容清单，供后续规划迭代。
> 每条都标注了当前状态、缺什么、建议入口，避免下次重新考古。
> **配套执行方案**：[`2026-10-06-chunk-splitting-optimization-plan.md`](./2026-10-06-chunk-splitting-optimization-plan.md)（迭代 0~8 的文件级改动、代码骨架、验收与节奏）。本文给"缺什么"，那份给"怎么做"。

---

## 0. 本轮已完成范围（作为对照基线）

| 层 | 状态 | 实现位置 |
| --- | --- | --- |
| L1 结构感知 | ✅ 完成 | `splitting/structure.ts`（ATX 标题 / 独立时间戳行 / `:::` 围栏原子块 / 代码围栏内不识别） |
| L2 长度约束 | ✅ 完成 | `splitting/length.ts`（500 字符单上限、句子装箱、15% 句子重叠、同行不可分块） |
| L3 语义边界 | ✅ 主干完成 | `splitting/semantic.ts` + 独立任务 `file:chunk-refine`（三层降级：模型不可用 / hash 过期 / 单块失败都保留 L2） |
| L4 延迟分块 | ❌ 仅有接口 | 见 §1 |
| 自定义块语义化 | ⚠️ 一半 | 见 §6 |

行区间不变量（贯穿全层）：块正文一律由 `spanText(block, startLine, endLine)` 还原，
保证 `content` 与 `start_line/end_line` 永不漂移；同一行内部任何层级都不切开。

---

## 1. L4 延迟分块（Late Chunking）— 完全未实现

**当前状态**：只留了注入点和常量，没有任何逻辑。

- `splitting/types.ts` 里的 `SentenceEmbedder = (texts: string[]) => Promise<number[][]>` 就是它的 seam。
- `chunk.constants.ts` 里的 `CHUNK_LATE_CHUNKING_MAX_TOKENS = 8192` 是占位常量，**当前没有任何代码读它**。

**还缺什么**

1. **token 级向量来源**：`@xenova/transformers` + `Xenova/bge-m3` 的 worker 现在只做 mean-pooling + L2 normalize 后返回句向量，**没有暴露 `last_hidden_state`**。需要先给 worker 增加「返回 token 级向量」的输出模式（这是唯一的硬阻塞）。
2. **整篇一次编码**：现有 `embedInBatches` 是按句分批，L4 需要反过来——一次编码整块/整篇，再按边界取片段。
3. **边界池化**：给定句子边界，对边界区间内的 token 向量做 mean-pooling 得到块向量。
4. **触发条件判定**：需求里的三个触发条件（长文档 / 边界模糊 / 检索质量不达标）目前完全没有判定入口——尤其"检索质量不达标"需要先把检索反馈接回来（见 §3.3）。
5. **参考实现**：BGE-M3 原生不做 late chunking，需自行实现，参考 FreeChunker。

**建议入口**：新增 `splitting/late-chunking.ts`，先在本地 gateway worker 加 token 输出模式；不要塞进 `semantic.ts`（两者成本模型完全不同）。

---

## 2. L3 语义边界 — 主干之外的缺口

### 2.1 精修覆盖范围不全

- **长度合规但话题跳跃的块进不了 L3**。`applyLengthConstraint` 只在块**超预算**时才登记 `RefineTarget`；一个 300 字符却横跨两个话题的块，永远停在 L1。
  → 待办：给 L1 粗块加一个「语义混杂度」预筛（例如同一次编码顺手算相邻相似度最小值），低成本地把这类块也登记为精修目标。
- **`:::` 围栏块永不精修**（设计选择：卡片是原子语义单元）。但一个包含几十个字段行的长围栏仍会作为单块存在，检索权重被稀释。
  → 待办：给超长围栏一个「按字段分组」的逃逸路径，而不是无条件原子。
- **没有反馈闭环**：精修只跑一次，切得好不好、要不要再切细，没有任何机制回头调整。

### 2.2 低谷检测算法偏简单

当前只用「相邻句子余弦相似度 + ±1 窗口局部最小值 + 全局阈值」。缺：

1. **累积差异 / 滑窗差异**（cumulative divergence）：单点相邻相似度对长段话题漂移不敏感。
2. **Top-K 断点 + 递归二分**（SD / Semantic Division 的做法）：现在是一次性线性扫，切点数量不可控，一个块可能被切成 8 块也可能 0 块。
3. **动态阈值**：`thresholdForChunkType` 只有 journal / 非 journal 两档（0.75 / 0.55），未按文档实际相似度分布归一。
4. **阈值未经实测校准**：0.7–0.8 / 0.5–0.6 是需求里给的先验区间，**没有用真实语料标定过**。校准所需数据现在采集不到（见 §2.5）。

### 2.3 重叠区在 L3 后丢失

L2 装箱带 15% 句子重叠（`overlapCarry`），但 `semanticSplit` 按低谷分组后**块之间零重叠**——语义切分反而丢掉了上下文冗余。
→ 待办：决策清楚「语义切分要不要重叠」；要则在分组后补 carry，不要则把这个差异写进注释与文档，别让下一个人以为是 bug。

### 2.4 句子数上限是硬放弃

`CHUNK_MAX_REFINE_SENTENCES = 512`：超过就直接返回 `null` 保留 L2，长段落永远精修不到。
→ 待办：改成分窗精修（带窗口重叠的滑窗），或在报告里明确「超长块不精修」及其占比。

### 2.5 切分层级信息没有落库（阻塞所有分析）

`SplitChunk.layer`（`structure` / `length` / `semantic`）**只存在于内存**，写库时丢弃。
后果：无法回答「多少比例的块来自哪一层」「精修命中率多少」「降级发生频率」——而这些正是 §2.2 阈值校准必需的数据。
`semantic_chunks` 现有列足够（不能加 `metadata` / `split_index` / `parent_chunk_id` 等被禁的列名，见 AGENTS.md pitfall #14），加一个 `chunk_layer` 列是干净做法。
→ 待办：加 `chunk_layer` 列 + 迁移；同时落相邻相似度（`similarity_score`）供校准。

---

## 3. 与下游链路的集成缺口

### 3.1 精修/重切后，摘要与向量全部作废 —— 已解决（2026-10-06，迭代 1）

`ChunkDao.replaceByFile` 已被 `syncByFile` 取代：按 `content_hash` 配对复用原 id，正文未变的块只更新行区间，
`ai_summary` / `last_vectorized_at` / `project_chunks` / `concept_chunks` / `topic_chunks` / `semantic_links` 全部原地保留；
关联清理与向量清理的范围从「整文件」缩到「正文真正消失的块」（`dropVectorsByIds(removedIds)`）。
FTS 由 `BaseDao.withFtsDeferred` 收敛成一次同步重建 1 次（原来 N+1 次全库重建）。
验证：`tests/integration/main/chunk-sync-upsert.test.ts`（10 例）。

仍未处理的：

1. 精修完成后按文件维度**增量重跑**语义链接/主题检测，而不是等全量 DAG（`smartTaskScheduler.start()` 仍是用户手动触发）。
2. `temporal_events` 的清理目前会让 Journal 时间线静默丢失，需要确认这是否是期望行为。
3. ~~**孤儿向量另一条来源**：`journal.service.ts:282` 的重建路径用裸 SQL 清空全部 journal 块，只重建了 FTS，没有清理 LanceDB~~ —— **2026-10-06 已修**：`resetJournalTable` 在事务内记下被删的 journal 块 id，提交后交给 `chunkService.dropVectorsByIds`（事务失败则不删向量）。方法签名因此改为 `Promise<number>`，`journal.api.ts` 的调用点加 `await`。验证：`tests/unit/main/journal-reset-vector-cleanup.test.ts`。

### 3.2 保存后不会自动摘要/向量化

`file:chunk` 写库后，块处于 `ai_summary IS NULL`、`last_vectorized_at IS NULL` 状态；`chunk-vectorize` 的选取条件要求 `ai_summary IS NOT NULL`。
所以「保存 → 可向量检索」之间**依赖用户手动跑智能任务流水线**。
→ 待办：要么给切分完成加一个轻量自动摘要触发（按文件增量），要么在文档与 UI 上把这个手动步骤讲清楚。
> 迭代 1 之后这条更值钱：复用 id 让未变块保留了摘要，增量摘要的候选集已经显著变小。

### 3.3 检索侧没有吃到切分改进 —— 去重已解决（2026-10-06，迭代 7.3）

`chunk.service.searchByVector` 在 rerank **之前**按 `(file_id, 行区间交集)` 去重（`dropSpanOverlaps`），
L2 的 15% 句子重叠不再让同一段文字在结果里出现两次；跨文件的同区间各自保留。
验证：`tests/unit/main/chunk-search-overlap-dedup.test.ts`（5 例）。

仍缺：切分粒度对召回长度分布的影响分析。
→ 待办：建一个最小评测集（20~30 条真实查询 + 期望块），跑 L1/L2/L3 三档对比，作为 §2.2 阈值校准的验收口径。

**这条链路上另发现的两个既有缺陷（均已于 2026-10-06 修复）**：

- ~~结果列表末尾按 `created_at DESC` 重排，**把 rerank 的相关性顺序覆盖了**~~ —— **2026-10-06 已修**：`searchByVector` 不再走 `blocksToRecordList`，直接按 rerank 顺序 `map(blockToChunkInfo)`。全文检索（KEYWORD 类型）与降级路径仍按时间倒序，那是关键词检索的既有语义，没有改。验证：`tests/unit/main/chunk-search-overlap-dedup.test.ts` 的「语义检索结果的排序」。
- ~~`searchByVector` 忽略入参 `limit`，硬编码 `RERANK_TOP_K = 10`；调用方传 20/50 都只回 10 条~~ —— **2026-10-06 已修**：返回条数改由 `limit` 决定（`topK = clamp(limit, 1, 50)`），ANN 召回按 `topK × 4` 放大（50~200）以保证去重后仍凑得满；重排输入固定截在 50 条，**limit 变大只加深召回、不放大推理开销**。上限 50 是因为超过重排规模就无从排序。`limit ≤ 10` 时行为与原先完全一致（召回仍是 50，重排仍是去重后的全部候选）。验证：`tests/unit/main/chunk-search-overlap-dedup.test.ts` 的「语义检索遵守入参 limit」（5 例）。

---

## 4. Token 口径：L2 已移除，真实 tokenizer 仍待接

**2026-10-06 决定**：L2 的触发与预算**只看 500 字符**，不再叠加 Token 估算。
`CHUNK_MAX_COARSE_TOKENS` 常量与 `estimateTokens()` 启发式（CJK ≈ 1 Token/字 + 拉丁词 ×1.3）已一并删除——它的唯一用途就是那条被去掉的上限，留着只会让「预算口径」和「触发口径」重新分叉。

**仍然存在的缺口**：

1. **块没有 Token 硬上界**。500 个拉丁字符约 100–150 Token，500 个中文字符约 500–700 Token，都远在 BGE-M3 的 8192 窗口内；但如果以后把 `CHUNK_MAX_COARSE_CHARS` 调大，或遇到超长不可切行（无终止符、无空格的一整行），块就可能超出模型窗口，`@xenova/transformers` 会静默截断而不报错——向量只覆盖前半段正文，检索命中会莫名变差且没有日志线索。
   → 待办：在 `embedBatch` 前加一次「按真实 tokenizer 检查是否超窗口」的守卫，超了记 `Logger.warn`（带 `chunk_id`），而不是悄悄截断。
2. **L4 依赖真 tokenizer**。延迟分块要把句子边界映射成 token 下标（见 §1），启发式估算给不出精确偏移，必须用 BGE-M3 自带 tokenizer。
   → 待办：给 local-gateway worker 加一个 `countTokens` / `tokenize` 消息通道，作为 L4 的前置基建。
3. **若将来想用 Token 而非字符做预算**：直接用真实 tokenizer 计数，不要恢复被删的启发式——它对中英混排的误差足以让装箱结果不稳定。

---

## 5. 围栏（`:::`）解析仍是双实现

主进程 `splitting/fence.ts` 与渲染层 `blocks/engine/{md-codec,marked-bridge}.ts` 各有一套正则，**且已经不一致**：

| 维度 | 主进程 `splitting/fence.ts` | 渲染层 |
| --- | --- | --- |
| 闭合行 | `/^\s*:::+[ \t]*$/`（**允许缩进**） | `/^:::+[ \t]*$/`（`md-codec.ts:13`，**不允许缩进**） |
| 开启行 | `/^\s*:::\s*([a-zA-Z][\w-]*)[ \t]*$/`（**任意名字**都当围栏） | `^:::${def.mdName}[ \t]*$`（`marked-bridge.ts:29`，**只认注册表里已知的块类型**） |
| 缩进容忍 | 开启/闭合都允许前导空白 | 均不允许 |

后果有两个方向，都会让切分正文与编辑器看到的块对不上：

1. 缩进写在列表项里的 `:::metric` —— 主进程当围栏块，渲染层不认，正文被切进相邻文本块。
2. 渲染层尚未注册的块类型 —— 主进程当围栏原子块，渲染层当普通段落。

`FIELD_LINE_RE` 两侧一致（`/^([a-zA-Z][\w-]*)[ \t]*:[ \t]*(.*)$/`），只有围栏开闭行 diverged。

→ 待办：把围栏词法（开/闭/字段行）收敛到 `src/shared/` 作为唯一定义源，两侧都从这里导入；
并决定「未知块类型」的策略（主进程降级为普通文本，还是照旧当围栏）——建议与渲染层对齐成「只认已注册类型」，
否则新增块类型时主进程会静默地把未验证的语法当原子块。补一条主↔渲染一致性测试。

---

## 6. 自定义块语义化 — 需求三项只落了一项

需求原文给了三种待遇，本轮只按确认过的「原子块 + 字段拼装单向量」实现：

| 块类型 | 需求期望 | 现状 | 缺口 |
| --- | --- | --- | --- |
| 指标卡片 `:::metric` | **字段级向量化**（指标名、数值分别向量化） | 字段拼成一条文本、单向量 | 一个块对应多条向量的模型没有（LanceDB 表按 `block_id` 一一对应），需要支持 `(block_id, field)` 粒度 |
| 任务清单 | **纯结构化、靠数据库过滤、不向量化** | ❌ 与文本块走完全相同的摘要 + 向量化路径 | 缺块类型黑名单：`chunk-summary` / `chunk-vectorize` 应跳过结构化块，检索侧改走 SQL 过滤 |
| 新增块类型 | 只需定义字段 schema | ⚠️ 主进程是类型无关的 `key: value` 通用解析 | schema 只存在于渲染层 `blocks/registry.ts`，主进程拿不到，无法按 schema 取字段/校验/分派向量化策略 |

→ 待办：把块字段 schema 提到 `src/shared/`，让主进程按 schema 驱动「向量化策略」（字段级 / 单向量 / 不向量化）而不是靠通用拼装。这一条同时解决 §5。

**注意**：任务清单跳过向量化会影响 `buildEmbeddingText` 与 `chunk-vectorize` 的选取条件，改动前确认检索侧对结构化块的过滤路径已经就位，否则这类块会直接查不到。

---

## 7. 存量数据没有重切入口（backfill）

新切分只在 `chunkIndexService.schedule()`（文件保存）时生效。

- 已经躺在 `semantic_chunks` 里的历史块**不会按新策略重切**。
- 调整 `chunk.constants.ts` 里任何阈值后，**没有重算入口**。
- 没有「给全库补跑一次 L3 精修」的批量任务。

→ 待办：加一个按文件/按作品的重建入口（API + IPC 四层 + CLI 或设置页按钮），并复用现有静默窗口/去重/hash 校验；批量精修要能暂停续传（走 `taskQueue` 而不是另起循环）。

---

## 8. 任务队列与成本护栏

1. **超长块不分窗**：见 §2.4。
2. **精修与切分共用 3 个 worker**、无独立优先级——一次大量保存后，精修会和切分抢 worker。
3. **无全局限流**：多文件同时精修时，句子向量推理没有跨文件的并发上限，容易把本地模型打满。
4. **跑起来的精修无法取消**：`enqueue` 只取消同 `groupId` 的 pending/running 任务记录，对已经在推理中的那一轮没有中断手段。
5. **无模型换代处理**：换嵌入模型后旧向量与向量表维度/语义空间不一致，切分链路完全不感知。
   → 待办：给精修独立并发档位 + 全局推理令牌；提供「取消当前精修」的中断信号。

---

## 9. Journal 时间戳识别规则偏窄

`TIMESTAMP_RE` 只匹配**独立成行**的时间戳（可选日期前缀、可被 `**` 包裹）。实际日志里常见的写法没被识别为边界：

- 列表项内：`- 09:30 站会`
- 标题内：`### 09:30 站会`（走标题规则，OK，但时间戳信息没进 `sectionTitle` 之外的结构化字段）
- 时间区间：`09:30 - 10:00 需求评审`
- 只有日期没有时刻的独立行：`2026-10-06`

→ 待办：扩展时间戳识别，并考虑把解析出的时间存成结构化列（当前 `temporal_events` 是另一条链路在填，与切分的 L1 时间戳边界没有打通——值得确认这两处是否该合并）。

---

## 10. 测试与验证缺口

本轮新增 28 例（structure 4 / length 5 / semantic 6 / chunk-index-refine 9 / embedding-text 4）全是构造输入 + 假 embedder。缺：

1. **真实语料 golden 快照**：长日志、长 Wiki 页、混排代码/表格/公式的文档，断言行区间与块数，防止策略调参时静默回归。
2. **L3 端到端联调**：全部用注入的假向量，**从未跑过真实 BGE-M3**。至少要做一次本地模型联调，确认真实相似度落在什么区间（这直接决定 §2.2 的阈值能不能用）。
3. **切分质量指标**：块长度分布、跨话题率、同一段落被切成的块数方差。
4. **性能基准**：1000 行文档的 L1+L2 耗时（目标毫秒级）、一个块 500 句的 L3 推理耗时。

**已补（2026-10-06，迭代 1 / 7.3）**：写路径与检索路径各有一份真实数据库/真实依赖的测试——
`tests/integration/main/chunk-sync-upsert.test.ts`（10 例，内存 SQLite + 真实 FTS5 trigram 索引，含"延迟重建后索引确实一致"的反证用例）、
`tests/unit/main/chunk-search-overlap-dedup.test.ts`（5 例）。上表四条仍然缺。

> ~~注：`tests/integration/main/**` 有 9 个文件因 `better-sqlite3` ABI 不匹配失败~~ —— **2026-10-06 已修**（执行方案迭代 0）。
> 修法**不是** `pnpm rebuild`（那会编出测试拒绝的 Electron ABI 145），而是 `pnpm rebuild:node` + 前后各备份/还原一次 `.node`。
> ABI 恢复后顺带暴露并修掉了 8 处 `SELECT EXISTS(...) as exists` 的 SQLite 保留字语法错误（这些 `existsXxx()` 一旦被调用必抛，此前从未被测试覆盖）。

---

## 11. 优先级建议

| 优先级 | 条目 | 理由 |
| --- | --- | --- |
| ~~P0~~ | ✅ 执行方案迭代 1：写路径 upsert 化 + FTS 批量重建（2026-10-06 完成） | 复核后确认的根因，同时消解本表下面两条（§3.1 摘要复用、§2.5 之外的向量抖动）；且 FTS 是 N+1 次全表重建，保存链路直接被拖垮 |
| ~~P0~~ | ✅ §3.1 摘要按 `content_hash` 迁移（2026-10-06 完成，形态改为"复用块 id"） | 每次保存/精修都在重复烧 LLM 成本，纯浪费（已被迭代 1 吸收） |
| ~~P1~~ | ✅ §3.3 重叠块检索去重（2026-10-06 完成，迭代 7.3） | 用户当下就能感知的重复召回 |
| **P0** | §10.2 真实 BGE-M3 联调 | L3 现在完全没在真实模型上验证过，阈值是拍的 |
| P1 | §2.5 `chunk_layer` 落库 | 阻塞一切效果分析与校准 |
| P1 | §7 存量重切入口 | 阈值迭代没有回算手段，改参数等于没改 |
| P1 | §5 + §6 围栏词法与 schema 共享化 | 双实现已经不一致，越晚越贵 |
| P2 | §2.2 / §2.3 低谷算法与重叠策略 | 需要 §2.5 的数据才好做 |
| P2 | §8 成本护栏 | 单文件规模下问题不显，批量导入后会暴露 |
| P3 | §1 L4 延迟分块 | 依赖 worker token 输出改造，成本最高、收益未验证 |
| P3 | §4 真实 tokenizer 接入 | L2 已改用纯字符口径，不再需要它做预算；剩下的是窗口溢出守卫与 L4 前置 |
