# Wrisp 智能整理质量与资源治理 — 设计文档

| 字段       | 值                                                                        |
| ---------- | ------------------------------------------------------------------------- |
| 日期       | 2026-10-06                                                                |
| 状态       | 设计待评审                                                                |
| 范围       | 概念抽取质量、概念演化摘要、语义连接 CPU 占用、增量与失败自愈、进度与状态呈现 |
| 相关子系统 | smart-tasks（executors / scheduler / task-dag / step / progress）、local-gateway（rerank / embedding / hardware）、vector（LanceDB）、db（concept / chunk / 迁移）、renderer（wiki / store / 设置页） |
| 前置设计   | [`2026-10-05-local-ai-parallel-and-routing-design.md`](./2026-10-05-local-ai-parallel-and-routing-design.md)（Step 0 独立 worker、路由云端优先、执行器有界并发、跨 family 求和门控 — **已实现**） |
| 代码基线   | 2026-10-06 复核：本地推理栈已迁至 `@huggingface/transformers@4.3.0`（替换 `@xenova/transformers@2.17.2`，精确锁版本），`onnxruntime-node@1.30` 成为直接依赖并解决打包（`asarUnpack` + `afterPack` 平台剪枝）；新增 LLM-only GPU 开关 `enableGpuAcceleration`（默认 false）与 `device.resolver.ts` 闸门。**本设计的 §3.6 已按此基线重写** |

---

## 1. 背景与目标

### 1.1 用户反馈

1. 提取的概念不准确；概念的演化摘要没有按时间线递进。
2. 执行语义连接任务时 CPU 占用很大、电脑温度上升。

### 1.2 根因（已核对代码）

| 症状                       | 代码根因                                                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 概念不准                   | 输入是二次压缩文本：`concept-extract.executor.ts:36` 用 `ai_summary`，而短块的 `ai_summary` 就是原文（`chunk-summary.executor.ts:57-59`）；prompt 仅一行自由文本（`concept-extract.executor.ts:80`）；概念对齐只做 `findByTitle` 精确等值（`concept.dao.ts:60-63`），全仓无概念向量；本地采样 temperature 0.7 且请求侧参数被丢弃（`ai.service.ts:172`） |
| 同名概念重复累积           | `concepts.title` 无 UNIQUE（`init.sql:129-137`）+ 并发下 read-then-insert（`concept-extract.executor.ts:41-47`）+ `BaseDao.create` 是纯 INSERT（`base.dao.ts:186`） |
| 演化摘要不按时间线         | **该功能不存在**：`evolving_summary` 全仓唯一写入点是 `concept-extract.executor.ts:43` 的 `null`；`timeline` 列（`init.sql:132`）无人写；UI 已有渲染分支（`ConceptCardList.vue:70-71`）故永远为空 |
| 主题层连带无效             | 聚类是按概念名首字母分组的占位实现（`topic-detection.executor.ts:71-79`，注释自称「模拟聚类」），标题是三个概念名拼接（`:35`），每轮全量新建不去重（`:41`） |
| 语义连接 CPU 爆            | ONNX Runtime 会话**未传线程数**，默认吃满全部逻辑核心。v4 建会话路径唯一消费点是 `node_modules/@huggingface/transformers/src/backends/onnx.js:285` `InferenceSession.create(buffer, { logSeverityLevel, ...session_options })`，而本仓两处 pipeline 调用只传 `{ dtype }`（`embedding-handler.ts:25-29`、`rerank-handler.ts:28-32`）→ `session_options` 为空；并发 3 × 每 query 20 docs 交叉编码（`semantic-link.executor.ts:18,20,76`）；层内 reranker 组与 llm 组内存达标即真并行（`scheduler.ts:172-193`）；无核数/负载门控（`hardware.ts:34-37` GPU 检测恒 null，`device.resolver.ts` 只做 LLM 的显存闸门，不读核心数） |
| CPU 争抢**变严重**的新增因素 | `DEFAULT_LLM_CONFIG.gpu` 已从 `"auto"` 改为 **`"cpu"`**（`local-gateway/types.ts:126-136`），`enableGpuAcceleration` 默认 false（`model.constants.ts:12`）→ 默认配置下本地 LLM 也走 CPU；且 `activeModel.createContext({ contextSize })`（`llm-handler.ts:251`）**未传 `threads`**，node-llama-cpp 同样默认吃满核心。即默认形态下 reranker(ONNX 全核) + LLM(llama.cpp 全核) 同时跑 |
| 失败条目永久不再处理       | 选取条件叠加 `updated_at > watermark`（`concept-extract.executor.ts:91-98`、`semantic-link.executor.ts:129-134`、`chunk-vectorize.executor.ts:74-78`），单条失败仅 `Logger.error`，下一轮水位推进到全表 `max(updated_at)`（`scheduler.ts:104-106,241`） |
| 结果只在整轮结束后可见     | `notifyWikiUpdated()` 全仓唯一一次调用在层循环之外（`scheduler.ts:264`）；percent 按阶段数等权（`step.manager.ts:175-182`）→ 长时间显示 0% |

### 1.3 目标

| 编号 | 目标                                                                       |
| ---- | -------------------------------------------------------------------------- |
| G1   | 概念抽取从「不可用」提升到「可信赖」：输入信息量、结构化输出、跨块一致性   |
| G2   | 消除同义/同名概念重复：归一化 + 唯一约束 + 向量两级对齐 + upsert           |
| G3   | **实现**概念演化摘要与时间线，且必须按时间递进（新增第 7 个智能任务）      |
| G4   | 语义连接 CPU 占用显著下降，且分两步：先软调参止血，再硬限 ONNX 线程根治    |
| G5   | 失败条目可在下一轮自愈，不再被水位线永久跳过                               |
| G6   | 进度按实际条目加权、结果增量可见、状态不再误报                             |

### 1.4 非目标

- 不扩展 GPU 范围：迁移 PR 已把 GPU 落在 **LLM-only**（`device.resolver.ts:7-8` 明确 embedding/rerank 固定 CPU，理由是 GPU EP 能否吃 fp16 权重尚未测量）。本设计沿用该边界，只做线程预算与并发形态的治理（见 O6）。
- 不改四层切分算法（见 `docs/superpowers/plans/2026-10-06-chunk-splitting-*.md`）。
- 不重建 task-queue（`file:chunk` 链路）与 scheduler 的备份/清理任务。
- 不引入多任务并行（仍保持全局单轮互斥，`scheduler.ts:93-95`）。
- 不做概念/主题的人工编辑 UI（去重只在后台自动发生）。

---

## 2. 决策（本轮澄清结论）

| 编号 | 决策点           | 结论                                                                     |
| ---- | ---------------- | ------------------------------------------------------------------------ |
| D1   | CPU 治理强度     | **两者都做，分两步**：迭代 1 软调参 → 迭代 7 硬限 ONNX/llama 线程（v4 基线下二者都是公开参数，风险由「高」降为「低」） |
| D2   | 概念抽取输入     | **原文窗口 + 摘要作导语**（窗口默认 1200 字符）                          |
| D3   | 概念向量对齐     | **做，两级阈值**：≥0.88 自动合并、0.75–0.88 交 LLM 判定、<0.75 新建      |
| D4   | 历史脏数据       | **重建并去重合并**，同时清空抽取标记使下一轮全量重抽                      |
| D5   | 硬限线程的实现路径 | **直传 `pipeline(..., { session_options: { intraOpNumThreads } })`**（v4 公开且类型化的参数，实测生效），详见 §3.6.2；不再需要 monkey-patch |
| D6   | 演化摘要触发条件 | 只对「新增关联 ≥ 阈值 且 晚于上次演化」的概念重算，避免每轮全量重生成     |
| D7   | 结构化输出方式   | prompt 约束 + 容错 JSON 解析（本地 node-llama-cpp 不支持 response_format）|
| D8   | 解析失败的处理   | 整块判失败、**不写标记列**，交由 G5 的下一轮自愈重试（不做逗号切分降级）  |

---

## 3. 设计

### 3.1 概念抽取重设计（迭代 2，G1）

#### 3.1.1 输入构造

新增 `src/main/core/smart-tasks/executors/concept-input.ts`：

```ts
/** 组装概念抽取输入：摘要作导语 + 原文窗口。受本地 4096 context 约束，总 prompt ≤ 2000 字符。 */
export function buildConceptInput(block: Chunk, windowChars: number): string;
```

- 导语：`block.ai_summary`，仅当它存在且与 `content` 不同（短块摘要=原文，避免重复一遍）。
- 窗口：`block.content.slice(0, windowChars)`，`windowChars` 默认 1200（配置项 `smartTask.conceptInputWindowChars`）。
- 拼装：`[摘要] ${summary}\n[正文节选] ${windowed}`；无摘要时只输出 `[正文节选]`。

**预算约束**（本地 qwen3.5-4b `contextSize: 4096`，`local-gateway/types.ts:111-117`）：system + 候选概念列表（≤8 条）+ 输入 ≤ 2000 字符；输出 `maxTokens ≤ 800`。超预算时优先裁剪候选列表，再裁剪窗口。

#### 3.1.2 Prompt 与结构化输出

新增 `src/main/constants/concept.constants.ts` 存放 prompt 模板、停用词表、抽象度过滤表。

```
system:
你是严格的知识库概念抽取器。只输出 JSON 数组，不要任何解释文字、不要代码栅栏。
每个概念对象形如 {"title":"...","aliases":["..."],"evidence":"不超过30字的原文片段","confidence":0.0}
约束：
1) 最多 5 个概念；每个 title 为 2–6 字的名词短语；
2) 只抽取本文实际讨论的对象/方法/现象，不抽取主题词以外的泛化词（如「问题」「方法」「内容」「东西」）；
3) 若「已有概念」中存在语义等价项，必须复用其写法，不得另造同义词；
4) 无法确定时宁可不输出；confidence 表示把握度。
user:
已有概念（优先复用）：${candidates.join('、') || '（无）'}
文本：
${buildConceptInput(...)}
```

解析：新增 `parseConceptJson(content): ParsedConcept[]` — 去 ```json 栅栏 → 截取首个 `[` 到最后一个 `]` → `JSON.parse` → 逐项校验（title 非空、归一化后长度 2–24、confidence ≥ 0.5）。任一项非法 → 抛错 → 本块按 D8 记失败。

**采样参数**：链路下游**已经支持**透传 —— `gateway.ts:120 generate(prompt, options?: LlmGenerateOptions)` → `manager.ts:577-582` → `llm-handler.ts:328-329`（`options?.temperature ?? 0.7` / `maxTokens ?? 1024`）。**唯一缺口在调用方**：`ai.service.ts:172` 仍是裸 `localGateway.generate(prompt)`，把 `request.temperature` / `maxTokens` 全丢了（流式同理，`ai.service.ts:211`）。补成 `localGateway.generate(prompt, { temperature: request.temperature, maxTokens: request.maxTokens })`，概念抽取传 `temperature: 0.2`。**注意**：这一行改动同时影响所有走本地的 LLM 调用，此前它们一律吃 0.7 默认值 —— 属预期修正，但验收需显式回归用户交互链路（润色/改写仍传各自 request 的值，缺省回退 0.7）。

#### 3.1.3 一轮内聚合 + 落库

现状是逐块「查—建—关联」，并发 2 下必然竞态。改为两阶段：

1. **抽取阶段**（并发，与现状同）：每块 → `ParsedConcept[]` → 写入执行级内存 `Map<title_key, AggregatedConcept>`（`title_key` 见 §3.2.1），累计 `mentions`、`chunk_id → relevance` 证据、取最高 confidence。
2. **对齐落库阶段**（串行，块级抽取全部结束后）：对每个 `title_key` 走 §3.3 的对齐流程 → upsert。

好处：消除并发 read-then-insert 竞态；同一轮内跨块重复天然合并；`concept_chunks.relevance_score`（`init.sql:140-149`，现恒 0）在此处首次获得真实值（按提及次数 × confidence 归一）。

内存 Map 作用域 = 单次 `run(context)`，不跨轮；单轮概念数量级远小于块数，无内存风险。

#### 3.1.4 候选概念注入

为让模型「复用而非新造」，抽取前取候选列表注入 prompt：

- 首轮（`concept_embeddings` 为空）：按 `updated_at DESC` 取 top 50 个概念标题，均匀分给各块（同一轮共用一份，避免每块多一次查询）。
- 后续轮：用 §3.3 的向量召回得到**与该块最相关**的 top 8 已有概念（每轮对每个块多一次 ANN 查询 —— 是 CPU/IO 成本，纳入 §3.6 门控考虑；若代价过高则退化为「每块取 §3.3 阶段 2 命中的候选」，把复用判定整体交给向量对齐而不进 prompt。此取舍列入待评审 O1）。

### 3.2 归一化、唯一约束与 upsert（迭代 2，G2）

#### 3.2.1 `title_key`

```ts
/** 概念标题归一化键：NFKC → 小写(ASCII) → 折叠空白 → 去首尾标点（含中文全角）→ 截断 24 字符 */
export function normalizeConceptTitle(title: string): string;
```

不落 FTS，只作幂等键。`concepts` 新增列 `title_key TEXT`、`aliases TEXT DEFAULT '[]'`、`mention_count INTEGER DEFAULT 0`、`last_evolved_at TEXT`（`timeline`、`relevance`、`evolving_summary` 复用既有列）。

#### 3.2.2 迁移与去重（D4）

SQLite 的 `ALTER TABLE ADD COLUMN` 无 `IF NOT EXISTS`，且唯一索引在存在重复时创建会失败；迁移主循环**不在事务内**（`database.migration.ts:490-493`）。因此遵循既有先例：表重建/去重走 TS 幂等方法，纯加列走 SQL 迁移。

| 步骤 | 落点                                                                                     | 内容                                                                                                             |
| ---- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 0    | `main/index.ts:91-99` 前                                                                 | 备份（`core/services/base/backup.ts`）——迁移半途失败无回滚（`database.migration.ts:515-521`）                    |
| 1    | `database.migration.ts` 新增 `dedupeConcepts()`（仿 `dropPagesContainerColumn()` `:262-297` 用 `db.transaction`） | 按 `normalizeConceptTitle(title)` 分组；每组保留 `created_at` 最早者为 canonical；先把从属概念的 `concept_chunks` 用 `INSERT OR IGNORE` 迁到 canonical 并累加 `mention_count`，**再**删从属行 |
| 2    | 同上                                                                                     | 末尾 `conceptDao.rebuildFts()`（`base.dao.ts:760`）——external-content FTS 靠 rowid 回查（`init.sql:60-66`），重建表后必须 rebuild |
| 3    | `schemas/migrations/0.5.0_concept_dedup_and_evolution.sql`                               | `ALTER TABLE concepts ADD COLUMN ...` ×4 + `CREATE UNIQUE INDEX IF NOT EXISTS idx_concepts_title_key ON concepts(title_key)`；文件内**必须自登记** `INSERT OR IGNORE INTO migrations_db`（范式 `0.4.0:63-75`，id 尾号顺延为 6） |
| 4    | `schemas/init.sql:129-137`                                                               | 同步新列与唯一索引，保证全新库一致                                                                                |
| 5    | `database.migration.ts` 新增 `clearConceptStageMarks()` → `UPDATE semantic_chunks SET last_concept_extracted_at = NULL` | 配合 D4「下一轮全量重抽」                                                                                          |
| 6    | `concept.dao.ts` 新增 `upsertByTitleKey()`：`INSERT ... ON CONFLICT(title_key) DO UPDATE SET aliases=..., mention_count=mention_count+excluded...` | `BaseDao.create` 无 upsert 能力（`base.dao.ts:164-198`），DAO 层自带                                |
| 7    | `concept.types.ts` + `concept.dao.ts:15 FTS_INDEXED_FIELDS`（`evolving_summary` 已在索引内，无需新增）+ `searchFts` `:33` 的 LIKE 回退分支 | 若希望新列参与搜索命中才需动，本设计只让 `evolving_summary` 命中（已覆盖）                                          |

**连带影响（必须写进 UI 文案）**：删除从属概念会经 `topic_concepts` 的 `ON DELETE CASCADE`（`init.sql:175-184`）清掉相关主题关联；主题在迭代 5 重聚类后重建，故迁移后首轮整理前主题视图可能偏薄。

**实现补记（迭代 2 落地后）**：

- 步骤 3 的顺序成立，靠的是一个 SQLite 语义：唯一索引判定重复时 **NULL 互不相等**。加列后 `title_key` 全为 NULL，所以「先建 UNIQUE 索引、后由 TS 回填」不会因历史重复标题失败；反过来（先去重再建索引）会在 dedupe 半途失败时留下无索引的库。因此 UNIQUE 索引留在 SQL 文件里，dedupe 紧随其后。
- 数据步骤（dedupe + 清标记）由 `applyConceptDedupMigration(versionBeforeMigration)` 做**版本门控**：只有本次启动真的跨越了 0.5.0 才执行。dedupe 本身还带「分组无变化则不回写」的短路，避免每次启动把 `concepts.updated_at` 全刷一遍并触发无谓的 FTS 全表重建。
- 步骤 5 的清标记：迭代 2 时写的是 `last_smart_processed_at`，迭代 6 已改为清 `last_concept_extracted_at`（`clearConceptStageMarks()`）。全量重抽真正生效的条件是 0.5.1 的两条新列建好——新列初值全为 NULL，老库每一块都会被判为待处理，正好是 D4 想要的「去重后重抽一遍」。
- `normalizeConceptTitle` 落在 `src/shared/utils/conceptTitle.ts`（纯字符串函数，主进程/渲染层/迁移三处都要用，且不能带 electron 依赖）。
- 别名一律保留**首次出现的原始写法**，只把归一化键用于去重判定；解析层不做「别名等于标题」的剔除，由执行器聚合阶段负责。

### 3.3 概念向量与两级对齐（迭代 3，G2/D3）

#### 3.3.1 新增 LanceDB `concept_embeddings`

| 改动点 | 位置                                                                                   |
| ------ | -------------------------------------------------------------------------------------- |
| 表名联合类型 | `src/main/types/db/vector.types.ts:7` `VectorTableName` 加 `"concept_embeddings"` |
| schema   | `lancedb.ts:194-221` 现有按表硬编码的 `buildSchema`，新增分支：`concept_id Utf8(false)`、`title_key Utf8(false)`、`embedding FixedSizeList(1024, Float32)`。**无 project_id**（概念是全局维度，`concepts` 表亦无作品列） |
| 建表     | `lancedb.ts:162-185 ensureEmbeddingTable()` 扩到第三张表                                |
| 索引     | **不建 IVF-PQ 索引**：现有配置 `numPartitions: 1024`（`lancedb.ts:88-93`）是为块级规模定的，概念数通常只有几百，分区数远超行数会导致索引无效/训练失败。概念表首版走暴力检索（`lancedb.ts:356-360` 的 search 不带 `createIndex` 即可） |
| DAO / service | `vector.dao.ts` 仿块级一套（add/delete/findByConceptId/search），`vector.service.ts:78-282` 同层加概念 API。写入一律 **delete-before-add**（`add` 是纯追加，`lancedb.ts:287`；现成范式 `lancedb.ts:303-312`） |

#### 3.3.2 对齐流程（在 §3.1.3 阶段 2 内执行）

```
embedText = `${title} | ${aliases.join('、')} | ${第一条 evidence}`   // 只用标题会让短文本向量质量很差
cands = searchConceptEmbeddings(embed(embedText), topK = 5)
best = max cosine
if best ≥ 0.88            → 合并到该概念（upsert，别名并集）
else if 0.75 ≤ best < 0.88 → LLM 同义判定（一次请求批量喂新词 + 至多 3 个候选，返回 index 或 null）
else                       → 新建概念 + 写其向量
```

阈值入配置：`smartTask.conceptMergeAutoThreshold = 0.88`、`conceptMergeReviewThreshold = 0.75`。LLM 判定复用 `TASK_TYPE.CONCEPT_NAMING`（不新增 taskType，避免动 `router.ts:21-31` 规则表）。

对齐结果无论合并还是新建，都需保证 canonical 概念有一条向量行；合并时把新 evidence 追加进 `aliases`，**不**重写既有向量（向量只在概念首建与演化摘要更新时重算，控制 embedding 成本）。

**成本与模型驻留的相互作用**（v4 基线下新发现的约束）：每个新概念一次 embed，而 §3.6.2 限线程后单次推理成本上升；embedding 模型冷加载实测约 3.5s，且现状是层结束即释放 family（`scheduler.ts:210-222`）+ 空闲 5 分钟自动卸载（`model-manager.ts:38`）。迭代 9 的分片会把「一轮一次加载」变成「每片可能一次」→ 落地迭代 9 时必须让 embedding 常驻到本轮结束（把释放点从层边界移到轮边界），否则限线程省下的 CPU 会被反复冷加载吃掉。

### 3.4 概念演化摘要与时间线（迭代 4，G3 — 新增第 7 个任务）

新任务 `concept-evolution`，`dependencies = ["concept-extract"]`；同时把 `topic-detection` 的依赖改为 `["concept-evolution"]`（让聚类可用上演化摘要）。

新增 executor `src/main/core/smart-tasks/executors/concept-evolution.executor.ts`。

**触发筛选（D6，避免每轮全量重生成 —— 对照 `topic-summary.executor.ts:14,23` 现在每轮全量重跑的浪费）**：

```sql
SELECT c.* FROM concepts c
WHERE (
  SELECT COUNT(*) FROM concept_chunks cc JOIN semantic_chunks s ON s.id = cc.chunk_id
  WHERE cc.concept_id = c.id
    AND (c.last_evolved_at IS NULL OR s.updated_at > c.last_evolved_at)
) >= 2
```

即「本轮至少 2 条新增/变更证据」才重算。

**时间线递进的实现要点**（这是用户痛点 1 的正解，不能只靠 prompt 措辞）：

1. 证据按 `semantic_chunks.created_at ASC` 排序，取最近 N 条（默认 12，`smartTask.evidenceBatchSize`），每条为 `${日期} · ${section_title} · ${(ai_summary || content.slice(0,120))}`。
2. 输入 = **旧 `evolving_summary`**（作为既有理解）+ 新证据（标注日期）+ 全量时间跨度（首条/末条日期）。
3. Prompt 明确要求分阶段输出，禁止把最新证据当作唯一结论：

```
system: 你维护一个概念的认知演化史。按时间先后分阶段总结，只输出 JSON：
{"summary":"不超过240字的演化叙述，必须体现『早期→中期→近期』的差异","stages":[{"period":"YYYY-MM","insight":"该阶段的理解","chunk_ids":["..."]}]}
规则：新证据与旧叙述冲突时，保留冲突并说明「早期认为…，后期修正为…」；不得丢弃旧阶段。
user: 概念：${title}\n旧叙述：${evolving_summary || '（尚无）'}\n证据（按时间升序）：\n${lines}
```

4. 写回 `evolving_summary` + `timeline`（`[{period, insight, chunk_ids}]`，上限 12 条，超出按周期合并）+ `last_evolved_at`。
5. 解析失败按 D8：不写 `last_evolved_at`，下轮自愈重算。

**改动清单（新任务全量）**：executor 文件；`scheduler.ts:22-27` import + `:56-61` `registerExecutor`；`task-dag.ts:16-32` 节点 + `:35-42 TASK_EXECUTION_ORDER` + `:48-55 TASK_MODEL_FAMILY`（= `llm`）+ `:61-65 TASK_LLM_TASK_TYPE`（= `summary`，复用既有 taskType 以免改 `router.ts` 规则表；若评审要求独立开关则新增 `TASK_TYPE.CONCEPT_EVOLUTION` 并同步 `router.ts:21-31`、`ModelSettings.vue:112-122 LLM_TASK_DEFS`、`model.types.ts:44-48`）；`zhCN.ts`/`enUS.ts` 的 `SMART_TASK.TASK_*`；`SmartTaskProgressPanel.vue:53-60 TASK_LABEL_KEYS`。preload/IPC **无需新增通道**（`smart-task.ts:6-17` 已是通用 start/cancel/pause/resume/status）。
**UI**：`ConceptCardList.vue:70-71` 之下新增 timeline 阶段列表渲染（已有 `evolving_summary` 分支，无需新增数据通道，`wiki.service.ts:175` 已在返回 `evolvingSummary`）。

### 3.5 主题聚类与幂等（迭代 5）

替换 `topic-detection.executor.ts:71-79` 的首字母占位实现：

- 用 §3.3 的 `concept_embeddings` 做 union-find 聚类（成对 cosine ≥ `topicClusterThreshold` 默认 0.72，簇大小 2–20）；无向量的概念回退按 `evolving_summary` 现取现算。
- 每簇一次 LLM 命名 + 摘要（`TASK_TYPE.TOPIC_SUMMARY`），输入用概念的 `evolving_summary` 而非仅标题。
- **幂等**：`topics` 加 `title_key` + UNIQUE；新簇与已有主题按成员集合 Jaccard ≥ 0.5 匹配 → 命中则更新（`summary`/成员增删），否则新建；成员全部消失的主题置 `status='deleted'`（`init.sql:152-160` 已有 status CHECK）。彻底止住「每轮 `topicDao.create` 线性膨胀」（`topic-detection.executor.ts:41`）。
- `topic-summary` 加与 §3.4 相同的增量条件（`topics.updated_at` vs 成员最近变化），不再每轮全量重生成。

### 3.6 语义连接 CPU 治理（G4）

#### 3.6.1 步骤一：软调参（迭代 1，零新依赖）

| 改动 | 位置                                   | 值                                        |
| ---- | -------------------------------------- | ----------------------------------------- |
| ANN 候选数 | `semantic-link.executor.ts:20`         | `ANN_TOP_K` 20 → **8**                    |
| 保留链接数 | `semantic-link.executor.ts:21`         | `RERANK_TOP_K` 5 → **4**（8 候选留余量）   |
| 并发   | `semantic-link.executor.ts:18`         | `SEMANTIC_LINK_CONCURRENCY` 3 → **1**，并改为读配置 `smartTask.semanticLinkConcurrency` |
| N+1 查询 | `semantic-link.executor.ts:71-73`      | 20 次 `findById` → 一次 `findByIds`（`base.dao.ts:282` 现成）；同步把每块一次的 `projectChunkDao.findBy`（`:55`）改为按 shard 预取一次 |
| reranker/embedding 降精度 | `model-registry.ts` variant 表 + `DTYPE_SUFFIX`（`:185-191`）| v4 下是 **dtype 维度**而非 `quantized` 开关（后者已在 v3 移除）。**已核实**：两个仓库的 `onnx/` 目录都提供 `model_quantized.onnx`（= q8，571MB）与 `model_fp16.onnx`（1.136GB）等八种权重，见 §9 附录的实测清单。做法：registry 加 `{ variantId: 'q8', requiredFiles: ['onnx/model_quantized.onnx'] }` 并把 `defaultVariant` 指向它；`getTransformersArtifacts`（`:214-228`）按文件名反解出 `dtype: "q8"`，库再按 `model${suffix}.onnx` 拼名（`q8 → _quantized`）。**三条硬约束**：① 绝不能再传 `model_file_name`（与 dtype 同时给会拼成 `model_fp16_fp16.onnx` → 404，`embedding-handler.ts:31` 注释已记）；② 切换 variant 后 `checkModelFiles` 判定不完整 → 需重新下载约 571MB（不是原估的 1GB）；③ `parseTransformersDtype`（`:199-207`）对未知/双后缀返回 null 是护栏，不可绕。**补充事实**：仓库里 `model_int8.onnx` / `model_quantized.onnx` / `model_uint8.onnx` 三者尺寸几乎相同（570.7/570.7/571.0 MB），所以**不能靠猜文件名选量化方案**，必须按 v4 的 suffix mapping 选 dtype 键；`model.onnx`(fp32) 带一个 2.27GB 的 `model.onnx_data` 外部权重，若哪天真用 fp32 需另处理 externalData（`session.js:107`）。另外 registry 现记 reranker `sizeGB: 1.8`，实测 fp16 为 **1.136GB** —— 顺手校正。质量门槛见 AC4 |
| LLM 也限线程 | `llm-handler.ts:114 / 120 / 125 getLlama(...)`、`:251 createContext({ contextSize })` | **已核实**（node-llama-cpp 3.22.1）：两级杠杆。① 实例级 `getLlama({ maxThreads })`（`dist/bindings/getLlama.d.ts:105`）——文档明确「不用 GPU 时默认 = `max(cpuMathCores, 4)`，用 GPU 时默认不限」，`0` 表示不限；三个调用点现在都没传。② 上下文级 `createContext({ threads })`（`dist/evaluator/LlamaContext/types.d.ts:69-88`）：`threads?: number \| { ideal?: number; min?: number }`，**没有 `nThreads`/`nBatch`**（那是旧版或 llama.cpp 原生术语），且 number 形态只是 *hint*——其它评估在跑时实际线程会更低，要保底得用 `{ ideal, min }`；并行序列控制另有 `batching?: BatchingOptions`（`:94`）。**本设计取 ①**：`concurrency = 2` 两个 context 共享同一 llama 实例与 ThreadsSplitter，实例级上限才是散热的权威闸门；GPU 形态下默认不限，正好符合「上卡后不必压核」。线程数与 §3.6.2 共用同一个预算函数 |
| CPU-bound 组不再同时并行 | `scheduler.ts:172-181` | 新增常量 `CPU_BOUND_MODEL_FAMILIES: ModelFamily[] = ["reranker", "llm"]` —— **注意 `llm` 是否算 CPU-bound 取决于 GPU 闸门实际结果**：`enableGpuAcceleration` 默认 false 时 LLM 就是 CPU-bound；该开关**非热切换**（仅 `loadLlmModel` 时经 `applyLlmDevicePolicy()` 生效，`manager.ts:440-457/498-502`），所以判据要取「本轮实际下发的 `gpuLayers`」而非配置值。`canRunParallel` 追加条件「层内实际 CPU-bound family ≤1」。与前置设计 G1 的关系：求和内存门控保留，本条只压 CPU 争抢；步骤二限线程落地后可由配置 `smartTask.allowCpuBoundParallel` 放开 |
| 后台任务不再抢交互槽位 | `ai.service.ts:35,53` | 优先级判定从「有无 taskType」改为「是否用户交互」；智能整理的 3 个 LLM 任务（`task-dag.ts:61-65`）走 `"low"`（当前判定使它们全被标成 high，`llm-concurrency-controller.ts:71-73` 的抢占因此反过来伤交互体验） |

#### 3.6.2 步骤二：硬限 ONNX 线程（迭代 7，根治）

**本节结论因 v4 迁移而改变。** 原方案基于 `@xenova/transformers@2.17.2`：它建会话只传 `executionProviders`，限线程唯一办法是 monkey-patch `InferenceSession.create`（依赖库内部实现，风险高）。迁移到 `@huggingface/transformers@4.3.0` 后，**`session_options` 是 `pipeline()` / `from_pretrained()` 的公开顶层参数**，类型就是 `onnxruntime-common` 的 `InferenceSession.SessionOptions`，于是这一节降级为常规改动。

已安装的 4.3.0 源码证据：

| 事实 | 位置 |
| ---- | ---- |
| `session_options`（snake_case）被透传 | `src/pipelines.js:114→175`、`src/models/modeling_utils.js:287→301`、`src/models/auto/modeling_auto.js:92→106`、`src/utils/hub.js:55`、类型 `types/utils/hub.d.ts:180` |
| 展开为会话选项后再填充其它字段 | `src/models/session.js:77` `{...options.session_options}`，随后 `executionProviders`(:80)、`freeDimensionOverrides`(:85)、`externalData`(:107)、`preferredOutputLocation`(:122，仅 webgpu) |
| 唯一消费点 | `src/backends/onnx.js:285` `InferenceSession.create(buffer, { logSeverityLevel, ...session_options })` |
| 字段名 | `onnxruntime-common/dist/esm/inference-session.d.ts` — `intraOpNumThreads:49`、`interOpNumThreads:55`、`graphOptimizationLevel:72`、`executionMode` |
| **必须在建会话前传**，事后不可改 | v4 的 `PreTrainedModel` 无 `this.session`，只有 `this.sessions`（`modeling_utils.js:228`）；会话对象 keys 仅 `['handler','config']`，**无 `options` 属性** → 原设想的路径不存在 |
| 拼错参数名**不会报错** | JS 层无字段白名单，未知字段由原生 binding 静默忽略 → 必须靠 AC5 的实测探针兜住 |
| 无环境变量通路 | 全库不读 `OMP_NUM_THREADS` 等，线程只能经 `session_options` 控制 |

**实测数据**（本机 18 逻辑核，本地 fp16 bge-m3）：传 `session_options: { intraOpNumThreads: 2 }` 加载成功；进程线程数 空载 13 → 受限会话推理期 18 → 不限会话 29；单次推理耗时 不限 ~190–230ms vs 受限 ~290–670ms。即**限线程会线性拉长单次推理（实测 1.5–3 倍）**，所以线程预算绝不能固定成 2，且「慢多少」必须进验收（AC4/AC5）。

改动落点（各一行，两处）：`embedding-handler.ts:25-29`、`rerank-handler.ts:28-32`，在现有 `{ dtype }` 上加 `session_options`。

**线程预算**：新增纯函数，放 `device.resolver.ts` 同侧以沿用「无 IO、可单测」的既有风格（参照 `llm-gpu-policy.test.ts` 的 9 个用例写法）：

```ts
/** 计算 ONNX 会话的 intraOpNumThreads：configured 优先；否则按逻辑核数与同批 CPU-bound 会话数分摊 */
export function resolveThreadBudget(options: {
  logicalCores: number;
  configured: number | null;
  coResidentSessions: number;   // embedding 与 reranker 各一份会话，分处两个 worker 线程
}): number;                     // 默认公式 clamp(floor(logicalCores / coResidentSessions), 1, 6)，公式待评审 O3
```

注入时机 = 模型 load 时，与 GPU 开关一致的**非热切换**语义；改配置需重载模型才生效，设置页要写明。LLM 侧走实例级 `getLlama({ maxThreads })`（见 §3.6.1，同一预算函数）；`graphOptimizationLevel` 保持默认，以免引入图优化级别的行为差异。

护栏（原「版本锁 + 补丁失效回退」四条已无必要，只留可观测性）：

1. `@huggingface/transformers` 保持精确版本 `4.3.0`，不在本次改动里放开为 caret。
2. worker load 成功后 `Logger.info` 打出实际生效的 `intraOpNumThreads` 与其来源（配置值 / 公式值），使「静默失效」可观测。
3. ~~显式声明 `onnxruntime-node`、打包剪枝~~ —— 迁移 PR **已完成**（`dependencies` + `pnpm-workspace.yaml allowBuilds` + `asarUnpack: node_modules/onnxruntime-node/**` + `afterPack` 平台剪枝），本设计不再涉及依赖与打包改动。

**已作废的方案**：原 R1（绕开 transformers 自建会话并自写 mean-pooling / CLS 打分）与原 R3（升级 v3 换取 `model.session.options`）均不再需要 —— A 路径已是公开稳定 API，而 B（事后设 options）在 v4 根本不成立。

#### 3.6.3 契约：rerank 分数不可作绝对阈值

worker 侧 reranker 读的是 softmax 后的最大概率，**分数只在同一批内有序**，跨批不可比、不可设绝对阈值。当前 `semantic-link.executor.ts:91` 把这个分数原样写进 `semantic_links.similarity`，属于埋雷：任何消费方（含本设计 §3.5 的主题聚类，以及 chunk-splitting 计划里「按 rerank 相关性排序」）一旦对它做 `>= 0.x` 判定都是错的。约束：

- 本设计所有阈值判定只用 **embedding cosine**（§3.3 两级阈值、§3.5 聚类），不使用 rerank 分数。
- `RERANK_TOP_K` 的截断是「取批内前 N」，与分数绝对值无关 → 安全。
- 落地时在 `semantic-link.executor.ts` 写 `similarity` 处加一行注释声明该列语义为「批内相对序」，避免后来者误用。

### 3.7 增量标记与失败自愈（迭代 6，G5）

- `semantic_chunks` 新增 `last_concept_extracted_at TEXT`、`last_linked_at TEXT`（`0.5.1_chunk_stage_marks.sql` + `init.sql:28-48` 同步 + `chunk.types.ts:74-98 ChunkUpdate`）。
- 各任务的选取条件从「`updated_at > watermark`」改为**按各自标记列**：`WHERE last_xxx_at IS NULL OR updated_at > last_xxx_at`（`concept-extract.executor.ts:91-99`、`semantic-link.executor.ts:129-139`；`chunk-vectorize` 已有 `last_vectorized_at`，只需把叠加的 `updated_at > ?` 去掉）。
- **停止复用 `last_smart_processed_at` 承载三种语义**：它现在被 summary / concept / semantic-link 三种任务写同一列（`chunk-summary.executor.ts:37`、`concept-extract.executor.ts:61`、`semantic-link.executor.ts:104`），互相覆盖；`wiki.service.ts:135` 的读取语义随之改变 → 保留该列作「最后被任一智能任务触碰」的时间戳，UI 判空逻辑改读 `ai_summary IS NULL`。
- 单条 LLM 失败：不再 `Logger.error` 后照样 `processed++`（`chunk-vectorize.executor.ts:60-64` 甚至把失败批次计入完成量），改为区分 `processedCount` / `failedCount`，**失败条目不写标记列** → 下一轮自动重试。
- `processed_until` 降级为观测字段，不再作选取依据；且仅在 `status === 'succeeded'` 时写入（现状取消也会写 `max(updated_at)`，`scheduler.ts:242,256`，会跳过未处理条目）。
- `concepts` / `topics` 的稳定身份由 §3.2/§3.5 的 UNIQUE + upsert 保证；LanceDB 概念向量按 §3.3.1 一律先删后加（块向量当前的纯追加会留重复行、占 topK 名额）。

**实现补记（迭代 6 落地后）**：

- **设计里没写、但落地必须补的一环**：标记列不能走 `BaseDao.update()` 写。`update()` 无条件覆盖 `updated_at`，而增量选取比的正是 `updated_at > last_xxx_at` —— 用 `update()` 写标记等于亲手把该块顶回下一轮的待处理集，全库永不收敛（测试里表现为同毫秒的随机通过/失败）。补的方法是 `ChunkDao.recordStage(id, columns, temporalScore?)` 与 `recordStageBatch(ids, columns)`：裸 UPDATE，列名只取自 `ChunkStageColumn` 字面量联合类型（不是调用方字符串，无注入面），不碰 `updated_at`。先例是同文件里早就存在的 `recomputeTemporalScores()`，它的注释已经在警告同一件事。
- 连带修了 `syncByFile` 的**复用路径**：它原先对「只变了行号边界」的块也调 `update()`，于是文件里改一个字符就会把整文件的 `updated_at` 顶新，触发全文件重摘要 + 重抽 + 重向量化 + 重嵌入。改为只写边界列的裸 UPDATE，这类块不再进入下一轮。
- 四条选取 SQL 统一加 `status = 'active'`：软删除墓碑（`is_deleted`/`status='deleted'`）此前照样会被摘要与向量化阶段选中并花钱。
- `chunk-summary` 的选取条件从标记列换成 `ai_summary IS NULL OR ai_summary = ''`，与 `wiki.service.getPendingCount()` 同口径 —— 这样「待处理数量」和「本轮真的会处理多少」是同一个谓词，不再需要标记列参与判断。该阶段成功才写标记，失败什么都不写。
- `chunk-vectorize` 的失败批次原先被计入完成量（设计点名的 bug），现在记 `failedCount` 且不写标记；但**返回值仍是 `success: true`**：DAG 里 `success: false` 会阻断下游整层，部分失败不该有这种杀伤力，靠标记列缺写在下一轮自愈。
- `TaskResult` 新增可选 `failedCount`（未上报的阶段是 `undefined`，渲染层不要当 0 用）；`TaskContext.processedUntil` 作为死代码删除（选取已不依赖它，留着会诱导下一个任务又去读水位）。`processed_until` 现在只在 `status === 'succeeded'` 时写，值改为 `MAX(semantic_chunks.updated_at)` 直查。
- 重跑幂等补了两处：`concepts.mention_count` 改为从 `concept_chunks` 行数派生（`conceptDao.syncMentionCount(id)`，抽取阶段每次关联后同步），`upsertByTitleKey` 的 `ON CONFLICT` 不再累加它 —— 否则迭代 6 把「全量重抽」变成真实事件后，每重抽一轮计数翻倍；LanceDB `BlockVectorDao.createBatch` 改为先按 `block_id` 删再 add，否则重复向量占 topK 名额。
- 0.5.1 迁移文件**自登记** `migrations_db`：`buildMigrationsFromFiles` 只执行 SQL、不写记录，不自登记会让每次启动重复跑 `ADD COLUMN`（SQLite 无 `IF NOT EXISTS`，第二次直接报错）。
- 尚未处理的两项，留作后续：① `chunk-summary` 每写一次 `ai_summary` 都经 `BaseDao.refreshFts()` 触发 **全表** FTS `'rebuild'`，一轮下来是 O(N²) 的 CPU —— 与 G4 直接相关，但 `withFtsDeferred` 是 `protected` 且只支持同步回调，包不住含 LLM 等待的异步阶段，改它要在「搜索索引新鲜度」上做取舍，不宜塞进本迭代。② `BaseDao.findById` 标注返回 `T | null`，实际 `stmt.get()` 返回 `undefined`。

**实现补记（空值修复，2026-10-07）**：

- **上一节那条「`chunk-summary` 改用 `ai_summary IS NULL` 选取、不需要标记列」的决定已被推翻。** 加上「无正文可摘要的块直接跳过」之后，产物列不再是可靠的进度判据：被跳过的块永远不会有 `ai_summary`，每一轮都会被重新选出来空跑一遍，正是本节要消灭的那种不收敛。恢复专用列 `last_summary_generated_at`，补列走 `ensureChunkSummaryStageColumn()`（PRAGMA 守卫的幂等 ALTER，**不**新增裸 `ADD COLUMN` 的 `.sql` 文件——`init.sql` 已含该列的新库会在第二次启动撞 duplicate column）；补列时把**已有摘要**的块回填为自身 `updated_at`，老库升级不会重烧整库。写入顺序是硬约束：`update({ ai_summary })` 刷新 `updated_at`，必须排在 `recordStage()` 之前，否则水位线顶到标记之后，该块下一轮被自己重新选中。
- 跳过判据 = `countProseWords(content) < CHUNK_SUMMARY_MIN_PROSE_WORDS`（12）。`countProseWords` 剥掉 ``` 代码围栏、`:::` 围栏（mermaid / 提示块等）、行内代码、图片、HTML 标签与 Markdown 标记后按 `countWords` 口径计数；**表格不排除**——单元格文字是有信息量的正文；未闭合的 `:::` 按正文处理，与渲染层和 L1 粗块的降级一致。跳过的块不调模型、不写摘要，只写标记，计入 `processedCount` 并在 `TaskResult.summary.skippedCount` 单列。`wiki.service.getPendingCount()` 同步换成同一谓词，否则「待整理数」会把非正文块永久算成欠账。
- **下游门槛必须跟着换成标记列**：`chunk-vectorize` 与 `semantic-link` 的选取原先写 `ai_summary IS NOT NULL`，那是在拿产物列当「上游跑完了」的代理。跳过的块从此永远没有 `ai_summary`，若不同改，代码块 / 围栏块会整批掉出向量库和关联图——搜索直接搜不到它们。两处改为 `last_summary_generated_at IS NOT NULL`；嵌入文本本就取自 `content`（`splitting/embedding-text.ts`），关联也有 `ai_summary || content` 兜底，所以只是门槛换判据，下游逻辑不动。
- 空产出改为在源头失败：思考型模型把预算全花在 `<think>` 段时，`session.prompt()` 的返回值是空串（思考段不计入返回值），此前被当成功返回——摘要写进空值，概念任务抛一条语义不明的 `ConceptParseError`。现在 `ai.service` 的非流式与流式两条路径都对空/全白产出抛 `本地模型未返回内容`，调用方按本节失败语义处理（不写标记，下一轮重试）；`chunk-summary` 在落库前再 trim 判一次，空串绝不进 `ai_summary`。已存的 41 条空摘要无需修复：选取条件本就把空串视为欠账。
- 根因链上半段（思考段从哪来）：Qwen3.5 的 `thoughts: "auto"` 默认在回复起始强制开 `<think>`，已在 `llm-handler` 建会话处用 `resolveChatWrapper(model, { customWrapperSettings: { qwen: { thoughts: "discourage" }, jinjaTemplate: { reasoning: false } } })` 关闭。同一 prompt 从 94s/空输出变为 39s/完整 JSON，摘要从 62s/空变为 14.4s/有内容——无效推理减半，G4 顺带受益。
- worker 侧 `generate-stream` 的最终结果原先回传 `{ text }`，而 manager 是 `dispatch<string>`，类型声明与实际值不符；改为裸字符串，与非流式分支一致。

### 3.8 进度加权与增量可见（迭代 8，G6）

| 改动 | 位置 | 内容 |
| ---- | ---- | ---- |
| 加权进度 | `step.manager.ts:175-182 computeOverallPercent` | `Σ processedCount / Σ dataAmount`；未开始步骤的 `dataAmount` 用上一轮 `task_execution_log.tasks_summary` 记的历史值预估，首轮无历史时回退按阶段数 |
| 双口径统一 | `progress.manager.ts:56-84 getProgress` | 现在 `overallPercent` 与 `totalWeight/completedWeight` 并存但前者按阶段数（`:72-74`）；统一到加权口径，`smart-task:progress`（`:116`）通道要么接上渲染层要么删掉（当前零消费者） |
| 增量刷新 | `scheduler.ts:264` | `notifyWikiUpdated()` 从「整轮一次」改为「层结束即推一次」（移到 `:231` 之后），使概念/摘要在中途即可见 |
| 状态复位 | `wiki.store.ts:240-247` | `invoke` 返回 `ApiResponse.error` 不抛异常（`smart-task.api.ts:20-23`），当前 `organizing` 卡死且无提示：改为先判 `response.success` 再置位，并订阅 snapshot 兜底复位 |
| 完成/失败文案 | `smart-task.store.ts:39-53`、`AppHeader.vue:21` | 只有真正 `completed` 才显示「整理完成」，`failed`/`cancelled` 独立文案（i18n 补 key）；失败时给「查看明细」入口 |
| 明细常驻 | `AppHeader.vue:75-77` | 进度明细从手动 Modal 改为 header 下拉悬浮；补一行「当前阶段」摘要（读 snapshot 中 `state === 'running'` 的 task 步骤） |
| 暂停可达 | `useWiki.ts:174-190` | `pauseOrganize/resumeOrganize` 主进程与 store 均已实现（`scheduler.ts:293-304`），渲染层零调用方 → 补按钮 |
| 失败重试入口 | `smart-task.ts:11` / `scheduler.ts:307-309` | `getHistory` 已暴露到 preload 但渲染层零调用 → 展示最近一轮失败明细（§3.7 的 `failedCount`）并提供「重试失败条目」（因标记列改造后天然成立，即「直接再跑一轮」） |

**实现补记（迭代 8 落地后）**：

- **加权数学的落点与表格不同**：表格写的是改 `computeOverallPercent`，实际把 `Σ done / Σ total` 抽成公开的 `stepManager.getWeightedProgress()`，`computeOverallPercent()` 只负责换算与回退。理由是 `progressManager.getProgress()` 也要同一份 `done/total`；让两处各自 `filter(kind === 'task')` 重算，正是「双口径」复发的形状。
- **终态步骤的权重必须换成本轮实际尝试数**（`processedCount + failedCount`），不能保留预估：本轮无活可干的步骤（预估 1200、实际增量选取到 0 条）若继续占权重，进度条会永远停在 100% 之前。这条是设计里没有、跑一轮才暴露的。
- 预估只在步骤**未开始前**生效：`updateTaskProgress()` 会用任务上报的真实 total 覆盖 `dataAmount`。因此当真实 total 大于预估时百分比可能小幅回落；单调不减只对「终态替换预估」这条路径成立（已加测试固定）。
- **预估解析抽成纯函数** `smart-tasks/estimate.ts:parseEstimatedAmounts(tasksSummary)`，`scheduler.readEstimatedAmounts()` 只负责取 `taskExecutionDao.findLatest()?.tasks_summary` 转交。理由：scheduler 在 vitest 里实例化不了（local-gateway / DAO / electron 全链路），私有方法等于不可测。脏数据一律降级为「无历史预估」：整轮异常时 `tasks_summary` 存的是 `{ error }` 对象（非数组）、坏 JSON、负数 / `NaN` / 字符串计数、缺 `name` 的条目都被忽略。
- `task_execution_log.started_at` / `finished_at` 是 `TimeUtil.getLocalDateString()` 的**日期串**（精度到天），`findLatest()` 与 `findLatestSucceeded()` 的排序补了 `rowid DESC` 兜底 —— 否则同一天跑多轮时「上一轮」取到哪一轮不确定，预估会随机跳。
- **双口径统一走的是「删」不是「接」**：`smart-task:progress` 通道与 `pushProgress()` 直接删除（渲染层零消费者，preload 只暴露 `onSnapshot`），`progress.manager.ts` 不再 import electron / Logger，只剩转发与汇总，节流统一由 `stepManager.push()` 的 200ms 负责。
- **状态复位的做法比表格更彻底**：`wiki.store` 不再自己存 `organizing`，改为 `computed(() => smartTaskStore.isRunning)`（`paused` 也算进行中）、`organizePaused` 同理 —— 本地置位与主进程快照是两份状态，必然跑偏。`startOrganize()` 判 `response.success` 并返回 `boolean`（`ApiResponse.error` 不抛异常），`useWiki` 在 false / throw 时提示 `TIPS.WIKI.ORGANIZE_START_FAILED`。
- **失败重试入口与设计有偏差**：没有新增 `getHistory` 的渲染层消费面。失败条数直接来自 snapshot 里各步骤的 `failedCount`（store 汇总成 `failedCount`），配 `SMART_TASK.FAILED_RETRY_HINT`（「本轮 N 条未处理成功，已留待下一轮自动重试」），重试动作就是「再跑一轮」—— §3.7 让失败条目不写标记，天然被下一轮重选，专门的「重试失败条目」按钮是冗余入口。`getHistory` 仍是零调用方。
- 明细常驻：Modal → `n-popover`（trigger 是 header 上的状态文案，内容是 `SmartTaskProgressPanel`）；「当前阶段」一行取 `kind === 'task' && state === 'running'` 的步骤 `ref` 映射文案 key，结束后换成失败条目提示。
- i18n 新增（zh/en 对称）：`SMART_TASK.PAUSED / FAILED / CANCELLED / CURRENT_STAGE / FAILED_RETRY_HINT / FAILED_COUNT`、`TIPS.WIKI.ORGANIZE_START_FAILED`。
- 测试：`tests/unit/main/smart-task-progress-weighting.test.ts`（加权推进、大小任务权重悬殊、终态换实际值、失败计数、回退按步骤数、非任务步骤不参与、预估解析脏数据）与 `tests/unit/renderer/smart-task.store.test.ts`（状态派生、wiki.store 跟随快照、启动失败返回 false）。
- 未处理：`progressManager.getProgress()` 的 `taskName: "准备中"` 是主进程硬编码中文，未走 i18n（本轮口径统一没碰它的文案）。

### 3.9 分片流水线（迭代 9，G6）

彻底改流式（单块就绪即进入下一步）需重写 DAG 执行器为数据流，成本与本意不成比例。折中为 **shard-scoped 分层执行**：

- shard 定义：按 `file_id` 分组，`smartTask.shardSize = 8` 个文件一片；`scheduler.runGroup` 调用改为 `runGroup(group, ctx, scope)`，`scope = { fileIds }` 时各 executor 的 SQL 追加 `AND file_id IN (...)`。
- 只有需要全库候选集的任务保持 `scope = 'global'`：`semantic-link`（跨块召回）、`topic-detection`、`topic-summary`。
- 收益：`chunk-summary` / `chunk-vectorize` / `concept-extract` / `concept-evolution` 每完成一个 shard 即入库并触发一次 `notifyWikiUpdated()` → 用户不再等全库；代价：同一 shard 内的语义链接要等 global 阶段，需在 UI 文案中说明「关联与主题在全部整理完成后生成」。

### 3.10 配置面

`AppConfig` 新增 `smartTask` 块（现无同类块，`config.constants.ts:11-57`）：

```ts
smartTask: {
  semanticLinkConcurrency: 1, annTopK: 8, rerankTopK: 4,
  onnxIntraOpThreads: null,            // null = 按核数与同批会话数分摊（§3.6.2）
  llmContextThreads: null,             // null = 同上；仅 CPU 形态下有意义
  conceptInputWindowChars: 1200,
  conceptMergeAutoThreshold: 0.88, conceptMergeReviewThreshold: 0.75,
  topicClusterThreshold: 0.72, evidenceBatchSize: 12,
  shardSize: 8, allowCpuBoundParallel: false,
}
```

改动点：`config.constants.ts` 默认值 → `src/shared/types/config.types.ts:57-75` 类型 → `config.migration.ts:14` `addMigration` 补默认 → `config.service` 读写 → 设置 UI（新建 `components/settings/smart-task/SmartTaskSettings.vue`，挂在设置弹窗；无现成整理设置页）→ `zhCN.ts` + `enUS.ts` 对称 + `i18n/types.ts`。

**沿用本仓新近的既有做法**（`enableGpuAcceleration` 就是这样落的，`model.constants.ts:12` + `model.types.ts:44-48`）：可选键 + 缺省即默认值，**不 bump `version`、不加迁移条目**。两点必须注意：① `smartTask` 是**嵌套对象**，`enableGpuAcceleration` 是标量 —— 老库的配置里整个 `smartTask` 键都不存在，需先确认 `config.service` 是否对嵌套块做默认值深合并；若不合并，则在 getter 侧兜底（读值时 `?? DEFAULT_APP_CONFIG.smartTask.x`），别指望迁移脚本。② 线程/并发类参数与 GPU 开关一样是**加载期生效、非热切换**（`manager.ts:440-457`），设置页文案要写「重载模型后生效」，并复用现成的 `model:getGpuCapability` 三层通道范式（`model.api.ts:142-152` + `model.ipc.ts:68` + `preload/modules/model.ts:13`）来展示当前实际生效值。

**实现补记（§3.10 落地后）**：

- 按 `enableGpuAcceleration` 的做法落地：`smartTask` 为**可选键**、不 bump `version`、不加迁移条目；`config.service` 加载时 `ObjectUtil.deepMerge(defaultConfig, storeData)` 会把整块补齐，因此 `setValue("smartTask.<key>", v)` 的「键必须已存在」前提成立，getter 侧仍兜一层默认值。
- **默认值常量搬到了 shared**：`src/main/constants/smart-task.constants.ts` → `src/shared/constants/smart-task.constants.ts`（`src/main/constants/index.ts` 的再导出删除）。原因是设置页要用同一份默认值做兜底与「恢复默认」基准，让渲染层去 import `@/main/constants/**` 是反向依赖；该文件只含数据 + 一个 shared 类型，两个进程共用无副作用。
- 生效值展示新增一条三层通道 `model:getThreadBudget`（`model.api.ts` → `model.ipc.ts` → `preload/modules/model.ts` + `preload/types/model.ts`），返回 `ThreadBudgetInfo { logicalCores, onnx, llm, onnxConfigured, llmConfigured }`。计算落在 `localAiManager.getThreadBudget()`，与加载时**共用同一个 `resolveThreadBudget`**，避免「设置页显示 4 线程、Worker 实际按全核跑」；它绕开 `resolveThreads()`，否则每打开一次设置页就往日志刷一条预算记录。失败复用 `MODEL_GET_CONFIG_FAILED`（纯计算，实际不会失败），不新增 ErrorCode 与其 i18n 文案。
- 设置页 `components/settings/smart-task/SmartTaskSettings.vue` 作为**顶级菜单项**挂在 `SettingsView`（`componentMap` + `breadcrumbMap` + `SETTINGS.SMART_TASK.TITLE`，图标 `SparklesOutline`）；`NInputNumber` 此前未在 `plugins/naive-ui.ts` 注册，一并补上。
- **只暴露当前真正被消费的旋钮**：`semanticLinkConcurrency`、`annTopK`、`rerankTopK`、`onnxIntraOpThreads`、`llmMaxThreads`、`allowCpuBoundParallel`、`conceptInputWindowChars`。`conceptMergeAutoThreshold` / `conceptMergeReviewThreshold`（迭代 3）、`topicClusterThreshold` / `evidenceBatchSize`（迭代 4/5）、`shardSize`（迭代 9）**暂不进 UI** —— 还没有代码读它们，放上去就是骗用户的死旋钮，随各自迭代再补。
- `rerankTopK ≤ annTopK` 是执行器的硬约束，UI 侧两处守住：候选数调小时连带压低保留数，保留数的 `:max` 直接绑 `annTopK`。
- 线程类字段用「自动」开关 + 数字框表达 `null`（`null` = 按核数分摊），不依赖 `NInputNumber` 清空行为；改完线程值立即重读一次 `getThreadBudget()`，页面下方文案写「线程与并发的改动在模型重载后生效」。
- 配置写入路径：`useConfig.updateSmartTaskValue(key, value)` → `setValue("smartTask.<key>")` → `config.api.setValue` 里的 `syncSmartTaskConfig()` 同步给执行器快照与 `localAiManager.setThreadBudget()`。渲染层不直接碰执行器。
- 测试：`tests/unit/renderer/smart-task-settings.test.ts`（生效线程文案、缺 `smartTask` 块时按默认值渲染、三个分组、开关按 `smartTask.<key>` 路径写配置、取不到预算时降级不崩）。

---

## 4. 落地顺序与依赖

| 迭代 | 内容                                                            | 依赖        | 风险 |
| ---- | --------------------------------------------------------------- | ----------- | ---- |
| 1    | §3.6.1 软调参 + N+1 + 优先级 + CPU-bound 串行（**不含 dtype 量化**，那条要过 A/B） | —           | 低   |
| 2    | §3.1 抽取重设计 + §3.2 归一化/UNIQUE/upsert + 去重迁移           | —           | 中（迁移） |
| 3    | §3.3 概念向量与两级对齐                                         | 迭代 2      | 中   |
| 4    | §3.4 `concept-evolution` 新任务 + UI 时间线                      | 迭代 2/3    | 中   |
| 5    | §3.5 真实聚类 + 主题幂等                                        | 迭代 3/4    | 中   |
| 6    | §3.7 标记列与失败自愈                                           | 迭代 2      | 中（迁移） |
| 7    | §3.6.2 `session_options` 硬限线程（ONNX + llama context）        | 迭代 1      | 低（v4 公开参数）；唯一次生代价是推理变慢 |
| 8    | §3.8 进度加权 / 增量刷新 / 状态呈现 / 暂停 / 重试                | —           | 低   |
| 9    | §3.9 分片流水线                                                 | 迭代 8      | 高（触面广） |

推荐：**1 + 7 一起做（CPU 止血）→ 2 → 6 →（并行 8）→ 3 → 4 → 5 → 1b（dtype 量化，须过 AC4 A/B）→ 9**。

基线变化带来的顺序调整：v4 之下硬限线程只是两处 pipeline 各加一个 `session_options`，**风险从「高」降到「低」**，没有理由再排在最后 —— 它与迭代 1 的软调参是同一个痛点的两半，应同一批改完一起测（否则无法归因 CPU 下降来自哪一半）。dtype 量化反而要往后放，因为它要重新下载权重并过排序质量门槛。迭代 1+2 覆盖用户两个痛点的主因。

---

## 5. 验收标准

| 编号 | 验收项 |
| ---- | ------ |
| AC1  | 固定 200 块语料跑完，`SELECT COUNT(*)` vs `COUNT(DISTINCT title_key)` 无同名重复；人工抽查 30 块，同义重复概念对 ≤ 2 例 |
| AC2  | 抽取 prompt 输入包含正文节选（日志断言 `[正文节选]` 命中）；本地路径 `temperature` 实为 0.2（`ai.service.ts:172` 透传生效） |
| AC3  | 有 ≥2 条跨 ≥2 周证据的概念中，≥80% 的 `evolving_summary` 非 null 且 `timeline` 长度 ≥2；抽样的叙述文本出现阶段性表达 |
| AC4  | semantic-link 阶段峰值 `cpuUsage`（`resource-snapshot.ts:42-61`）≤ 改造前基线的 60%，**且**同数据量总耗时 ≤ 基线的 150%（限线程必然变慢，两个数要一起看，否则等于把发热换成等待）。量化 dtype 需过 A/B：同 20 组 query/docs 下与 fp16 的 **top-4 重合率 ≥85%**（用序不用分，见 §3.6.3），不达标则保留 fp16、只走限线程 |
| AC5  | 迭代 7 后：load 日志显示实际生效的 `intraOpNumThreads` = 配置值；**参数名拼错不会报错**（v4 无字段白名单），故必须有一条实测断言 —— 进程线程数在受限会话推理期显著低于不限会话（本机参照值：空载 13 / 受限 18 / 不限 29） |
| AC6  | 注入 3 条人为失败的条目，在**无新内容变更**的下一轮仍被选中并重试；取消那一轮不推进 `processed_until` |
| AC7  | `overallPercent` 单调不减且在首层处理中就 > 0；每层结束触发一次 `wiki:updated` |
| AC8  | 重复触发被拒时按钮复位并给出提示；`failed` 不再显示「整理完成」；暂停/恢复在 UI 可用 |
| AC9  | `pnpm typecheck` / `pnpm lint` / `pnpm build` / `pnpm test` 全绿 |

---

## 6. 测试计划

**新增单测**（`tests/unit/main/`，沿用 `// @vitest-environment node` + 逐文件 `vi.mock`，无共享 mock 工厂）：

`normalizeConceptTitle`（NFKC/全半角/标点/长度截断）、`parseConceptJson`（栅栏/前后缀杂质/非法项整体判失败）、`concept-extract` 一轮内聚合去重与 `upsertByTitleKey` 调用次数、两级阈值合并分支（≥0.88 / 0.75–0.88 走 LLM / <0.75 新建，含 LLM 判定返回 null）、`concept-evolution` 增量筛选 SQL 与「证据按 created_at 升序」断言、`topic-detection` union-find 与 Jaccard 幂等（同输入两轮不新增主题）、`resolveOnnxThreadBudget` 纯函数用例（**沿用 `llm-gpu-policy.test.ts` 的写法**：configured 优先、分摊、下限 1、上限 6、核数极小时的退化）、`mapWithConcurrency` 在 `semanticLinkConcurrency = 1` 下的序列性。

**集成测试**（`tests/integration/main/`，走真实 better-sqlite3）：`dedupeConcepts()` 迁移（含 `INSERT OR IGNORE` 关联迁移 + CASCADE 连带 + FTS rebuild 后 `searchFts` 仍可命中）；标记列改造后 `updated_at` 水位不被误刷。

**必须同步更新的既有断言**：`smart-task-dag-parallel.test.ts`（层数从 5 变 6，层 2 仍为 `semantic-link + concept-extract`）、`scheduler-local-families.test.ts:45`「映射表仅覆盖 3 个 LLM 任务」→ 4、`semantic-link-concurrency.test.ts`（默认并发 3 → 1）、`concept-extract-concurrency.test.ts`（新增聚合阶段，落库调用次数改变）、`model-router.test.ts`（若新增 `TASK_TYPE.CONCEPT_EVOLUTION`）；以及**本仓迁移 PR 新增的 `transformers-dtype.test.ts`** —— 它用 `it.each` 对 embedding/rerank 的 pipeline options 做 `toEqual({ dtype: 'fp16' })` **精确**断言（正是为了防止 `model_file_name`/`quantized` 回归），本设计加 `session_options` 会让它失败：改为 `toMatchObject` 并把 `session_options` 一并断言，**不要**直接放宽成不校验。

---

## 7. 风险与回滚

| 风险 | 说明 | 缓解 |
| ---- | ---- | ---- |
| 概念去重迁移不可逆 | 合并即删行；迁移主循环无事务（`database.migration.ts:490-493`） | 迭代 0 先备份；`dedupeConcepts()` 内用 `db.transaction`（仿 `:262-297`）；先在副本库演练 |
| 全量重抽成本 | D4 清空标记 → 下一轮 = 全库重跑抽取（块数 × 单块推理） | UI 明示预估（块数）；建议本轮临时开启云端（`enableCloudAi`）；本地可分批（迭代 9 的 shard 天然提供分批能力） |
| 限线程把发热换成等待 | 实测 2 线程下单次推理从 ~190–230ms 涨到 ~290–670ms（1.5–3×） | 线程预算按核数分摊而非固定值（§3.6.2）；AC4 同时约束 CPU 与总耗时；量化 dtype 与限线程分两步上，先测哪个够用 |
| q8 排序质量回退 | 交叉编码器量化对排序的影响不可假设无害 | AC4 的 top-4 重合率 ≥85% 门槛（只比序不比分），不达标保留 fp16 |
| `session_options` 静默无效 | v4 JS 层无字段白名单，参数名拼错不报错、直接被原生层忽略 | load 日志打出实际生效值 + AC5 的线程数实测断言；保持精确版本锁 `4.3.0` |
| 概念向量表索引配置不适配 | 复用块级 `numPartitions: 1024`（`lancedb.ts:88-93`）在数百行规模上无效 | 概念表首版不建索引，走暴力检索（§3.3.1） |
| 演化摘要幻觉/丢阶段 | 小模型可能只复述最新证据 | prompt 强制保留旧阶段 + 冲突显式表述；`timeline` 落 chunk_id 便于回溯核对 |
| 迁移期主题视图变薄 | 概念去重 CASCADE 清 `topic_concepts` | UI 文案提示「主题将在下一轮整理后重建」 |
| 触面广（迭代 9） | 分片改造贯穿 scheduler + 全部 executor SQL | 排在最后；前置迭代已解决主因，可独立评审后再做 |

## 8. 待评审开放项

| 编号 | 问题 |
| ---- | ---- |
| O1   | 候选概念是否注入每块 prompt（§3.1.4）：质量收益 vs 每块多一次 ANN 召回的成本 |
| O2   | `concept-evolution` 的 taskType 复用 `summary` 还是新增 `concept_evolution`（后者需动路由表与设置页） |
| O3   | 线程预算默认公式（`clamp(floor(逻辑核 / 同批 CPU-bound 会话数), 1, 6)`）是否合适；是否给 embedding / reranker 分别可配。实测「2 线程慢 1.5–3×」说明上限 6、下限分摊都可能不够精细，需要一轮真实语料上的耗时-温度曲线来定 |
| O4   | `last_smart_processed_at` 是否最终删除（本设计保留为观测列，改 `wiki.service.ts:135` 判空口径） |
| O5   | **已核实（2026-10-06，见 §3.6.1 末行）**：node-llama-cpp 3.22.1 没有 `threads.nThreads`；取实例级 `getLlama({ maxThreads })`，per-context `threads` 只是 hint。遗留的只有「`maxThreads` 与 ONNX `intraOpNumThreads` 是否共用一个预算值」——本设计共用，待 O3 的耗时-温度曲线一并定 |
| O6   | embedding / rerank 是否可能上 GPU：迁移 PR **刻意排除**（`device.resolver.ts:7-8`，理由是指定 GPU EP 能否吃 fp16 权重尚未测量）。本设计一律按 CPU-only 处理；若将来测量通过，§3.6 的线程门控要重新审视 |
| O7   | GPU 开关非热切换（只在 `loadLlmModel` 生效，`manager.ts:440-457/498-502`）：整理运行中途用户改开关时，是否要强制重载模型以让 CPU-bound 判据（§3.6.1 末行）跟上 |

---

## 9. 附录：关键常量与落点索引

| 名称 | 现值 → 目标 | 位置 |
| ---- | ----------- | ---- |
| `ANN_TOP_K` / `RERANK_TOP_K` | 20 / 5 → 8 / 4 | `semantic-link.executor.ts:20-21` |
| `SEMANTIC_LINK_CONCURRENCY` | 3 → 1（转配置） | `semantic-link.executor.ts:18` |
| `DEFAULT_LLM_CONFIG` | contextSize 4096 / maxTokens 1024 / temperature 0.7 / **gpu `"cpu"`（原 `"auto"`）** / concurrency 2 | `local-gateway/types.ts:125-136` |
| 抽取路径的 temperature | 0.7（被丢弃）→ 请求级 0.2，缺口仅在调用方一处 | `ai.service.ts:172`（流式 `:211`）；下游 `gateway.ts:120` → `manager.ts:577-582` → `llm-handler.ts:328-329` 已就绪 |
| `enableGpuAcceleration` | 默认 false，仅管 LLM；非热切换 | `model.constants.ts:12`、`device.resolver.ts:85`、`manager.ts:440-457` |
| ONNX 会话线程 | **未设**（v4 默认吃满逻辑核）→ `session_options.intraOpNumThreads` | 落点 `embedding-handler.ts:25-29`、`rerank-handler.ts:28-32`；生效路径 `transformers/src/models/session.js:77` → `src/backends/onnx.js:285` |
| LLM 线程 | **未设** → 实例级 `getLlama({ maxThreads })`（已核实，O5） | 落点 `llm-handler.ts:114/120/125`；语义 `node-llama-cpp/dist/bindings/getLlama.d.ts:96-105`（CPU 默认 `max(cpuMathCores,4)`，GPU 默认不限，`0`\=不限）；per-context `threads?: number \| {ideal,min}` 只是 hint（`dist/evaluator/LlamaContext/types.d.ts:69-88`），**仓库里没有 `nThreads`/`nBatch`** |
| 推理库版本 | `@huggingface/transformers` **4.3.0（精确锁）**，`onnxruntime-node` 1.30 为直接依赖且已解决打包，`node-llama-cpp` **3.22.1** | `package.json`、`pnpm-workspace.yaml allowBuilds`、`afterPack.js`、`package.json > asarUnpack` |
| `LLMConcurrencyController.maxConcurrent` | 5（硬编码，本轮不改值，只改优先级判定） | `ai.service.ts:15` |
| `CHUNK_SUMMARY_MIN_PROSE_WORDS` | 新增 12（剥 Markdown 后的正文字数下限，低于即跳过摘要） | `chunk.constants.ts`、`splitting/text.ts countProseWords` |
| `semantic_chunks.last_summary_generated_at` | 新增阶段标记列；补列即回填「已有摘要」块为自身 `updated_at` | `init.sql`、`database.migration.ts ensureChunkSummaryStageColumn()`、`chunk.dao.ts ChunkStageColumn` |
| `EMBEDDING_DIMENSION` | 1024（概念表沿用，维度不变 → 不触发删表重建） | `model-registry.ts:235` |
| dtype 反解护栏 | 未知/双后缀 → `null`（不可绕过） | `model-registry.ts:199-207 parseTransformersDtype`、`DTYPE_SUFFIX :185-191` |
| `PUSH_THROTTLE_MS` | 200（不变） | `step.manager.ts:41` |
| 迁移登记 id 尾号 | 6（`0.5.0_concept_dedup_and_evolution.sql`）、7（`0.5.1_chunk_stage_marks.sql`） | `schemas/migrations/`，范式 `0.4.0:63-75` |

### 9.1 已核实的远端量化文件清单（2026-10-06）

数据源：`curl -s "https://hf-mirror.com/api/models/<repo>/tree/main/onnx"`（本机访问 `huggingface.co` 返回空，必须用 `ZH_REMOTE_HOST`，见 `model.constants.ts:18`）。

| dtype → 文件名 | `Xenova/bge-m3`（embedding） | `onnx-community/bge-reranker-v2-m3-ONNX`（rerank） |
| -------------- | --------------------------- | ------------------------------------------------- |
| fp32 → `model.onnx` | ✅ 另有 `model.onnx_data` 2.27 GB（externalData，`session.js:107` 会加载） | ✅ 同样带 2.27 GB `model.onnx_data` |
| fp16 → `model_fp16.onnx` | ✅ 1.134 GB | ✅ 1.136 GB（当前已下载形态；registry 里 `sizeGB: 1.8` 是错的，应改为 1.136） |
| q8 → `model_quantized.onnx` | ✅ 569.7 MB | ✅ 570.7 MB |
| int8 → `model_int8.onnx` | ✅ 570.7 MB | ✅ 570.7 MB |
| uint8 → `model_uint8.onnx` | ✅ 571.0 MB | ✅ 571.0 MB |
| q4 / q4f16 / bnb4 | ✅ | ✅ |
| 其他 | `sentence_transformers.onnx`（多输出图，本项目不用） | — |

**结论**：`{ variantId: 'q8', requiredFiles: ['onnx/model_quantized.onnx'] }` 在两个仓库都存在，§3.6.1 的降精度方案成立。
**警告**：int8 / quantized / uint8 三者体积几乎相同（569.7–571.0 MB），**不能凭体积猜文件名**；必须按 v4 的 `DEFAULT_DTYPE_SUFFIX_MAPPING`（`q8 → _quantized`）反推，再落到 `requiredFiles`。

### 9.2 核实方法（可复现，两条命令）

- **库 API（离线，读已安装的类型声明）**:
  `grep -rn "maxThreads" node_modules/node-llama-cpp/dist --include=*.d.ts` → 读 `dist/bindings/getLlama.d.ts:96-105` 与 `dist/evaluator/LlamaContext/types.d.ts:60-103`；版本用 `node -e "console.log(require('./node_modules/node-llama-cpp/package.json').version)"`。
  **不要凭记忆写 API 名**——本轮就是靠这个方法发现 `threads.nThreads` / `nBatch` 根本不存在。
- **远端权重文件名（联网）**: `curl -s "https://hf-mirror.com/api/models/<repo-id>/tree/main/onnx" | grep -E '"path"|"size"'`。仓库 API 返回的是 JSON 文件树，比读 README 或猜后缀可靠。
