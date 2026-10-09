# Journal 条目化改造设计（按时间追加 + 标签/作品关联）

- 日期：2026-10-09
- 状态：已评审（brainstorming 逐节确认通过）
- 范围：仅设计，不含实现；实现计划另见后续 writing-plans 产出
- 目标读者：journal 子系统改造的实施者与 reviewer

## 1. 背景与动机

当前日志（Journal）按"每天一整篇可自由编辑的 Markdown 文档"建模：正文真源是
`journal/YYYY-MM-DD.md`，SQLite 只有 `file_index` 索引行，保存走 800ms 防抖整篇覆写。
为支持后期移动端多模态记录（语音/图片/消费）与云端合并，必须把最小记录单元从
"文档"改为"条目"：每条记录自带全局唯一 ID、时间戳、来源，增量追加、按 ID 去重，
避免文档级合并冲突。

## 2. 现状关键事实（调研结论）

| 事实 | 证据 |
|---|---|
| Journal 7 个 IPC channel，整篇文档语义 | `src/main/ipcMain/journal.ipc.ts:19-74`、`core/apis/journal.api.ts:18-143` |
| 正文真源 `.md`（一天一篇），索引在 `file_index`（`date` 列仅 journal 用） | `core/services/content/journal.service.ts:45-54,148-226`、`schemas/init.sql:18-29` |
| 前端整天 Tiptap 编辑器 + 800ms 防抖整篇保存 | `renderer/components/editor/containers/JournalBlock.vue:84-122` |
| 切分三层 L1结构/L2长度/L3语义，L1 已把"独立时间戳行"当时间线单元（`TIMESTAMP_RE`） | `chunk-splitter.ts:11-26`、`splitting/structure.ts:16-18,124-128` |
| 块锚定 `file_id NOT NULL` + `start_line/end_line`，wiki 回链依赖行区间 | `init.sql:32-60`、`chunk.service.ts:575-591` |
| 下游 8 个 smart-task 只认 `semantic_chunks` + 阶段标记列，不感知 journal 组织形式 | `smart-tasks/task-dag.ts:16-35` 及各 executor |
| `#标签`/`@人物` 经 `inlineTokenSyncService.syncFromMarkdown` 从整篇提取 | `journal.service.ts:217-219`、`inline-token-sync.service.ts:36` |
| 标签为多态表 `tagged_items(tag_id, entity_type, entity_id)`，已有 `'project'`、`'semantic_chunks'` 等 entity_type 先例 | `init.sql:118-125`、`project.dao.ts:71` |
| 作品 = `projects` 表；现有 `project_chunks` 为块粒度关联 | `init.sql:242-268` |
| slash 时间命令插入 `[[HH:mm]]`，与 `TIMESTAMP_RE` 不匹配（现存错配） | `slash/commands/dateTime.commands.ts:26` |
| `getRecentDays` 未按 `journal/%` 过滤，靠 NULL 排序侥幸 | `journal.service.ts:335-338` |
| 全仓无任何用户数据网络同步代码（仅 electron-updater 与资源下载） | `update.service.ts`、`resource-sync.service.ts` |
| DB 基线版本 0.6.0 = migrations 最高版本（铁律） | `init.sql:3,477-488` |

## 3. 已确认的设计决策

1. **真源与编辑**：SQLite `journal_entries` 为唯一真源（严格条目化）；`.md` 降级为系统渲染产物；桌面端不再整篇自由编辑。
2. **存量数据**：❗本次调整——**不做存量数据迁移**。数据库按全新初始化设计，仅走纯 DDL 迁移升结构；旧日志文件保持原样不进时间线。
3. **条目编辑形态**：条目正文为 Markdown 字符串，编辑 UI 用轻量多行输入框（追加快输入 + 历史条目内联编辑），不挂 Tiptap。
4. **切块策略**：每条目单独跑现有三层 `splitDocument`；块通过新列 `entry_id` 锚回条目。
5. **本轮范围**：仅数据模型 + 本机条目化；schema 预留同步字段（id/source/occurred_at/updated_at/deleted_at），不实现任何网络同步与交换格式。
6. **关联模型**：标签复用 `tagged_items`（`entity_type='journal_entry'`）；作品新建条目粒度关联表；`#标签`/`&作品`/`@人物` 在输入框解析并在底部提示区展示，只读渲染在条目 meta 行展示。
7. **文件格式与导入**：`.md` 采用"**HH:mm** 条目头 + `<!-- wrisp:entry {json} -->` 注释"两行编码（已对比 `:::entry` 围栏方案后拍板）；导入解析为显式触发的按 `id` upsert（last-write-wins、tombstone 优先、不删除不复活），与未来移动端合并共用同一套规则。

## 4. 数据模型

### 4.1 新表 `journal_entries`（真源）

```sql
CREATE TABLE IF NOT EXISTS journal_entries (
  id           TEXT PRIMARY KEY,        -- UUID v4，本机生成即全局唯一，未来同步去重键
  date         TEXT NOT NULL,           -- YYYY-MM-DD（本地时区，由 occurred_at 派生的冗余列，按天查询/渲染用）
  occurred_at  TEXT NOT NULL,           -- ISO8601 完整时间戳，时间线排序键
  source       TEXT NOT NULL DEFAULT 'desktop',  -- desktop | mobile | import
  type         TEXT NOT NULL DEFAULT 'text',     -- text | voice | image | expense | task（首版只写 text）
  content      TEXT NOT NULL,           -- Markdown 正文，允许多段落，保留 #/&/@ 行内记号
  attachments  TEXT,                    -- JSON 数组（workspace 相对路径，音频/图片）；首版 NULL，仅 schema 占位
  metadata     TEXT,                    -- JSON 对象（金额/商户等结构化字段）；首版 NULL，仅 schema 占位
  chunked_at   TEXT,                    -- 切块阶段标记；脏判定 = chunked_at IS NULL OR updated_at > chunked_at
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,           -- 未来 last-write-wins 冲突判定依据
  deleted_at   TEXT                     -- 软删除 tombstone（同步删除传播所需），UI 不显示
);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date  ON journal_entries(date, occurred_at);
CREATE INDEX IF NOT EXISTS idx_journal_entries_dirty ON journal_entries(chunked_at) WHERE chunked_at IS NULL;
```

同步能力由 `id / occurred_at / updated_at / deleted_at / source` 五列承载；不加入任何
云端状态列（sync_status 等），云端形态未定时不做投机设计。

### 4.2 `semantic_chunks` 新增可空列 `entry_id`

- `ALTER TABLE semantic_chunks ADD COLUMN entry_id TEXT`（仅 journal 块填写）。
- `file_id NOT NULL` 约束不动：每日渲染 `.md` 仍对应一条 `file_index` 行，作为块锚点与 wiki 回链兜底。
- journal 块的 `start_line/end_line` 语义改为**条目正文内部**行区间；wiki 回链优先按 `entry_id` 跳条目，行号仅用于长条目拆分后的段内定位。

### 4.3 条目↔标签关联

不建新表，复用 `tagged_items`：`entity_type = 'journal_entry'`，`entity_id = 条目id`。
标签名不存在时自动 `INSERT OR IGNORE` 进 `tags`（沿用 `inlineTokenSyncService` 现有行为，
作用域从"整篇文档"改为"单条目正文"）。

### 4.4 条目↔作品关联（新表）

```sql
CREATE TABLE IF NOT EXISTS journal_entry_projects (
  entry_id   TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id)        ON DELETE CASCADE,
  added_at   TEXT NOT NULL,
  PRIMARY KEY (entry_id, project_id)
);
```

条目粒度而非块粒度：条目 id 稳定，不随重切漂移。`&作品名称` 按 `projects.name` 匹配
（精确优先，模糊走检索接口）；**无匹配则不建关联、仅在提示区标注未匹配**，不自动创建作品。

### 4.5 关联真源规则

`appendEntry / updateEntry` 时由**主进程**对条目正文重新解析 `#标签`/`&作品`/`@人物`，
先删该条目旧关联（`tagged_items` 中 `entity_type='journal_entry' AND entity_id=?`、
`journal_entry_projects` 中 `entry_id=?`）再重建。解析幂等、随内容编辑自动收敛。
`@人物` 归属沿用 `{ type: 'contact' }` 不变。渲染端提示区只做预览，落库以主进程解析为准。

## 5. `.md` 文件：确定性渲染产物

- 路径不变：`journal/YYYY-MM-DD.md`。条目增/改/软删后，将当日全部未删除条目按
  `occurred_at` 升序渲染覆写。
- 条目头统一渲染为 `**HH:mm**`（恰好匹配现有 `TIMESTAMP_RE`，保证文件可读且解析器可往返识别）。
- 正文原样保留 `#`/`&`/`@` 记号——文件自解释；关联表为权威，文件内容为冗余一致。
- 渲染是纯函数（同条目集 → 同字节），继续经 `fileService.writeFile`（沿用末尾空行规范化）。
- `wiki.service` 的 `journal/%` 统计、FTS、行区间回链兜底均不受影响。
- 用户手工编辑 `.md` 不承诺支持：该日一旦有条目（被"接管"），下次渲染即覆盖手工编辑。

### 5.1 渲染保护规则（关键，防误删历史数据）

**某日只有产生第一个条目时才被接管渲染。** 若当日 `journal_entries` 无记录而
`journal/YYYY-MM-DD.md` 已存在且非空（旧版整篇日志），**跳过渲染，绝不覆盖**。
不做自动反向导入、不做解析迁移；旧文件原样留在磁盘，不进时间线；需要找回旧内容
只能通过显式导入（5.3）。

**已接受的覆盖边界**：保护只在"当日零条目"时生效。用户在仍有旧版整篇内容的日子
追加第一条新条目起，该日即被接管，后续渲染不再保留旧内容。这是放弃存量迁移的
既定代价；如需保留旧内容，用户在切换前自行复制走文件即可（新版不提供备份）。

### 5.2 每日日志文件格式（可往返的导入契约）

每个条目两行头部——`**HH:mm**` 条目头（人读）+ 紧随的 HTML 注释行（机读，渲染器不可见）：

```markdown
<!-- wrisp:journal {"format":1,"date":"2026-10-09"} -->
# 2026-10-09

**09:32**
<!-- wrisp:entry {"id":"a1b2…","at":"2026-10-09T09:32:00+08:00","src":"desktop","type":"text","u":"2026-10-09T09:32:00+08:00"} -->
今天研究了 LanceDB 的 IVF-PQ 索引……
第二段照常写，无需转义。

**10:15**
<!-- wrisp:entry {"id":"c3d4…","at":"2026-10-09T10:15:00+08:00","src":"mobile","type":"voice","u":"…","att":["journal/attachments/2026-10-09/x.m4a"],"meta":{"amount":35,"merchant":"星巴克"}} -->
刚在星巴克花了 35 买咖啡
```

- 注释 JSON 字段：`id`（去重键）、`at`（带时区完整时刻，排序键）、`src`、`type`、
  `u`（= DB `updated_at`，导入冲突判定）、`att`（workspace 相对路径数组）、`meta`。
  解析器对未知键向前兼容（忽略）。
- 渲染排序键 `(at, id)` 升序；同日多条同分钟不丢序（秒与时区在注释内）。
- 首行文件级标记 `<!-- wrisp:journal {"format":1,...} -->` 声明格式版本；`# YYYY-MM-DD` 标题行保留可读性。
- 附件不随文本往返，`att` 仅透传路径。

转义规则（封闭且可测，保证往返无歧义）。触发条件一律**整行锚定**，且代码围栏内的行一律不转义（规则 3），因此「未转义的整行头形状」必然出自渲染器：

1. 正文整行若匹配条目头模式（`HH:mm` / `**HH:mm**` / `[[HH:mm]]` / 带日期前缀）→
   对**参与匹配的那个锚定标点**加反斜杠，逐字转义：粗体形式每个 `*` 都转义为
   `\*\*HH:mm\*\*`；裸形式转义冒号 `09\:30`；方括号形式转义首个左括号 `\[[09:30]]`。
   解析时按**同一套字符集**（`\*` `\[` `\:`）逐个去掉反斜杠还原，不做「剥掉全部反斜杠」的
   宽松还原——后者会把用户本就写下的 `\*` 也吞掉。还原是纯字符串操作，不解析 Markdown。
2. 正文整行即 `<!-- wrisp:entry ... -->` 形状时 → 转义首个字符为 `\<!-- ...`（CommonMark
   会把 `\<` 按字面渲染）。**不使用** HTML 实体 `&#60;`：实体改变可见文本、在代码块里失效、
   且要求导入端做实体解码。行中**包含**但不整行匹配该注释的（如「注释样例 <!-- wrisp:entry {} -->
   结束」）**不转义**——解析器整行锚定，中间出现不产生歧义。
3. 代码围栏（```）内的时间戳行永不作为条目头——沿用 `splitting/structure.ts` 现有的
   围栏内不识别规则。**例外**：`**HH:mm**` 行紧随一行 `<!-- wrisp:entry ... -->` 的两行组合
   是权威条目边界，即使处于「围栏内」也生效，并在此处重置围栏状态。理由：某条目正文含**未闭合**
   围栏时，整文件围栏态会一直为「内」，若不加例外，其后所有条目的头部与正文都会被吞成一条
   （静默合并 + 丢 id，不可恢复）；而「在代码块里粘贴一个完整两行头部样例」只会把一条条目
   拆成两条（用户可见、可手工合并），是远更轻的失效模式。

### 5.3 导入解析算法（`journal:importDayFile`，显式触发，不自动执行）

逐行扫描，命中条目头后检查下一行是否为 `wrisp:entry` 注释，分两类：

**带注释（wrisp 渲染产物）**——按 `id` upsert：
- DB 无此 id → 插入（`source` 取 `src`，可为 mobile/import）；
- DB 有此 id 且未软删 → 仅当 `payload.u > DB.updated_at` 时更新，否则保留（last-write-wins，
  与未来移动端合并同一规则）；
- DB 有此 id 但已软删 → 跳过（tombstone 优先；导入永不删除、永不复活已删条目）。

**裸时间戳行（手工编辑/外部工具产物）**——推断式导入：
- `at` = 文件名日期 + 行内时间（无秒补 `:00`，本地时区）；`source='import'`、`type='text'`；
- `id` = sha256(命名空间盐 + 日期 + at + 正文) 派生的 **UUID 形状**确定性 ID（取摘要十六进制的
  前 32 位按 8-4-4-4-12 排布，并把 version 半字节强制为 `5`、variant 为 `8|9|a|b`）。
  它**不是** RFC 4122 的 name-based（UUIDv5）算法——本项目无 uuid 依赖，SHA-1 名字哈希不可用；
  任何外部实现（含未来移动端）必须复刻本定义而非直接调 UUIDv5，否则同一手工条目会算出不同 id。
  重复导入同内容自然幂等去重；
- 与带注释条目同 id 冲突时（注释条目已被导入过）：按 upsert 规则处理，推断 ID 不再重复插入。

导入的条目走与 `appendEntry/updateEntry` **相同**的后置管线（关联重建 + 置脏 + 按条目切块），
不存在第二套语义。解析成功后当日即被接管（条目表有行 → 后续渲染正常覆盖，见 5.1）。

UI 入口（首版唯一）：JournalView 中"当日条目为空但 `.md` 非空"的日容器上显示
"导入此文件"按钮 → 调 `journal:importDayFile(date)`，替代旧版"加载/覆盖"询问弹窗
（原 `syncLocalFiles` 职责的收敛去向）。

## 6. IPC / 四层接口（preload module → preload type → core/apis → ipcMain，照 IPC 规范同步）

### 6.1 新 channel

| channel | 入参 | 返回 | 说明 |
|---|---|---|---|
| `journal:appendEntry` | `{ date?, occurredAt?, content, source?, type?, attachments?, metadata? }` | `ApiResponse<string>`（条目 id） | `occurredAt` 缺省为当前时刻；触发重渲染 + 关联重建 + 置脏 |
| `journal:updateEntry` | `{ id, content?, occurredAt? }` | `ApiResponse<boolean>` | 刷新 `updated_at`；重渲染 + 关联重建 + 置脏 |
| `journal:deleteEntry` | `{ id }` | `ApiResponse<boolean>` | 软删除（写 `deleted_at`）；重渲染 + 删关联 + 删该条目旧块 |
| `journal:listEntries` | `{ date }` | `ApiResponse<JournalEntryView[]>` | 当日未删除条目按 `occurred_at` 升序；**后端 JOIN 带出 tags/projects** |
| `journal:listRecentDays` | `{ days, beforeDate? }` | `ApiResponse<Array<{ date, entries: JournalEntryView[] }>>` | 替代旧 `getRecentDays`，支撑无限滚动 |
| `journal:importDayFile` | `{ date }` | `ApiResponse<{ imported: number, updated: number, skipped: number }>` | 显式导入当日 `.md`（解析算法见 5.3）；"当日条目为空但文件非空"的日容器提供入口 |

`JournalEntryView = JournalEntry + { tags: {id,name}[], projects: {id,name}[] }`。

### 6.2 旧 channel 处置

| 旧 channel | 处置 |
|---|---|
| `journal:create` / `journal:update` / `journal:delete` | 删除（整篇语义作废） |
| `journal:getRecentDays` | 由 `journal:listRecentDays` 替代 |
| `journal:checkTodayJournalExists` | 由 ensure-today 流程吸收（不再单独暴露） |
| `journal:syncLocalFiles` | **删除**，由 `journal:importDayFile`（5.3）显式导入替代 |
| `journal:resetJournalTable` | 保留并扩展：清 `journal_entries` + 其 `tagged_items`/`journal_entry_projects` 关联 + journal 块 |

共享类型同步：`journal.types.ts` 重写为条目类型（`JournalEntry` 等），删除死类型
`JournalFileQuery`，纠正"来自 pages 表"的错误注释；条目 `source`/`type` 枚举放
`shared/enums/journal.enums.ts`（该文件现仅含 `SEARCH_TYPE`）。

另：若现有 project 接口不支持按名称模糊检索，补一个轻量 `project:searchByName`
（供 composer 的 `&` 下拉查询用）。

## 7. 语义管线（调度粒度：文件 → 条目）

- 写路径置脏后沿用现有任务队列 + 去抖：journal 侧改为 `scheduleJournal(date)`，
  groupId `journal-chunk:{date}` 防重，保留 5s 静默窗口（`CHUNK_SILENT_WINDOW_MS`）合并连续保存。
- 处理器 `processJournalDay(date)`：
  1. 取该日全部脏条目（`chunked_at IS NULL OR updated_at > chunked_at`，未软删）；
  2. **逐条** `splitDocument(entry.content)`（三层切分器原样复用，L3 对短条目自然退化为单块）；
  3. 以 `entry_id` 做差异同步：先删该条目旧块（级联清 `concept_chunks`/`topic_chunks`/
     `semantic_links` 等，沿用 `resetJournalTable` 已有的删块路径），再插入新块（填 `entry_id`、
     `file_id` 指当日 `file_index`、行区间为条目内部行号）；
  4. 成功后写 `chunked_at`（不刷新 `updated_at`，避免自脏——参考 `PageDao.recordStage()` 惯例）。
- `#标签`/`@人物` 提取不再挂在整篇保存路径上，改为条目落库时按条目正文运行（见 4.5）。
- 下游 8 个 smart-task **零改动**（只认 `semantic_chunks` + 阶段标记列）。
- `ChunkType` 维持 `"journal"` 不变，不新增 `"journal_entry"`。
- `thresholdForChunkType("journal")` 阈值首版不动，实施后按块规模数据再评估。

## 8. Schema 变更与迁移（纯 DDL，无数据迁移）

1. 新增 `src/main/schemas/migrations/0.7.0_journal_entries.sql`：
   - `CREATE TABLE IF NOT EXISTS journal_entries ...` + 两个索引；
   - `CREATE TABLE IF NOT EXISTS journal_entry_projects ...`；
   - `ALTER TABLE semantic_chunks ADD COLUMN entry_id TEXT`（SQLite 可空无默认 ADD COLUMN 安全）；
     若走代码兜底则改用 `ensureEntryIdColumn()` 幂等模式（`PRAGMA table_info` 判存在）；
   - 末尾自登记 `INSERT OR IGNORE INTO migrations_db`，id 用
     `00000000-0000-0000-0000-000000000010`，时间戳用 `strftime('%Y-%m-%dT%H:%M:%fZ','now')` 模板。
2. `init.sql` 三处同步：同批表/列/索引并入；头部注释 `-- 版本: 0.7.0`；文末基线记录
   version `0.6.0 → 0.7.0`（铁律：基线 === migrations 最高版本，否则两步启动崩溃）。
3. **明确不做**：任何旧 `.md` 解析迁移、备份、`migrateJournalToEntries()` 类数据重建方法、
   "检测到旧日志文件询问加载"逻辑。
4. 新增 DAO：`journalEntry.dao.ts`（extends `BaseDao`）+ `journalEntryProject.dao.ts` 或并入前者；
   类型入 `types/db/`，导出到对应 index。
5. 验证（照 AGENTS.md 第 5 节）：
   - `pnpm test`（重点新增 `tests/integration/main/migrations.0.7.0.test.ts`）；
   - `pnpm typecheck`、`pnpm lint`；
   - 两步启动手动验证（删库→启动→退出→再启动，无 duplicate column 报错）；
   - `SELECT version, status, executed_at FROM migrations_db ORDER BY executed_at DESC` 首行 = 0.7.0。

## 9. 渲染层 UI

- `JournalView.vue`：保持"按天堆叠 + 触底 +5 天"时间线滚动结构；数据源改为
  `journal:listRecentDays`。原 `ensureTodayJournal`（建空文档/询问加载）简化为：不再建空文档，
  composer 首次追加时才落条目；"当日条目为空但 `.md` 非空"的旧日志日，日容器上显示
  "导入此文件"按钮（调 `journal:importDayFile`，见 5.3）。
- `JournalBlock.vue`：从"整日 Tiptap + 800ms 防抖整篇保存"瘦身为**日容器**（日期头 + 条目列表），
  删除整篇保存路径。
- 新组件 `JournalEntryComposer`（仅今日顶部）：
  - 多行 Markdown 轻量输入；`Ctrl+Enter` 追加条目（`occurredAt` = 当前时刻）；
  - 输入框高度随内容**自适应增长**，最小高度约 2 行；直接用 Naive UI
    `n-input type="textarea" :autosize="{ minRows: 2, maxRows: 12 }"`——超出 maxRows
    后框内滚动，避免超长草稿把时间线顶走（maxRows 常量放组件内，可调）；
  - 输入中解析 `#标签`（自动补全走现有标签数据）与 `&`（其后触发作品名模糊查询下拉，
    选中后往正文写 `&作品名称` 记号）；
  - **底部提示文字区**实时显示解析结果，如：`标签：#阅读 #LanceDB ｜ 作品：《X项目》`；
    `&` 无匹配时标注"未匹配作品"；提示区固定贴在输入框下方，随自适应高度一起下移；
  - 替换原 JournalBlock 的编辑器与防抖保存职责。
- 新组件 `JournalEntryItem`：
  - meta 行 = `HH:mm` + 来源徽标（首版仅 desktop）+ 标签 chips + 作品名（数据由
    `listEntries/listRecentDays` 的 JOIN 结果一次带出，前端不逐条查询）；
  - 正文只读 Markdown 渲染（必须走 `sanitizeHtml()`）；
  - 点击 → 内联 textarea 编辑（同样 `autosize`，`minRows` 按原内容行数起步）→ 保存 `updateEntry`；
    删除 → 确认 → `deleteEntry`。
- store：`journal.store.ts` 重构为 `days: Array<{ date, entries }>` + `appendEntry/updateEntry/deleteEntry`
  + 分页 loadMore；`useJournal.ts` 随store 调整。
- slash 时间命令（`[[HH:mm]]`）保留但语义降级为"正文内插时间文本"，不再承担条目边界职责；
  条目边界 = 数据记录，不靠文本约定（同时消除与 `TIMESTAMP_RE` 的现存错配——该正则此后
  仅用于解析历史/外部文件场景，journal 主链路不再依赖）。
- 首版交互约束：**追加只针对今日**；任意历史条目可编辑/删除；改时间、向历史日期补记不做
  （移动端场景由 `occurred_at` 字段承载，UI 留给移动端 App）。

## 10. 测试策略

单元（`tests/unit/`）：
- 渲染纯函数：排序、软删排除、`**HH:mm**` 条目头、确定性输出（同条目集两渲染字节一致）；
- 渲染保护：空表 + 已存在非空 `.md` → 不写文件；
- 行内记号解析：`#`/`&`/`@` 混排、作品名带空格、多标签去重、未匹配作品只提示不建关联；
- 关联重建幂等：updateEntry 两次不产生重复 `tagged_items`/`journal_entry_projects`；
- 脏判定与重切：entry 更新 → 旧块按 `entry_id` 删除、新块插入、`chunked_at` 回写不刷 `updated_at`；
- `listRecentDays` 分页（beforeDate 游标）；
- 文件格式往返：渲染→解析条目集一致；转义规则 1/2/3（正文含 `**HH:mm**` 行、含 `wrisp:entry`
  字面量、代码围栏内时间戳）各自有守护用例；
- 导入 upsert：无 id 插入、`u` 较旧不更新、较新更新、软删 id 跳过、裸时间戳推断导入
  （确定性 UUIDv5 重复导入幂等）、混合文件（注释条目+手工裸条目）一次解析正确分类。

集成（`tests/integration/main/`）：
- `migrations.0.7.0.test.ts`：存量库升级后新表/新列存在、自登记记录版本前进、迁移文件可重复执行；
- 新库 init.sql 与迁移结果 schema 一致。

回归：
- wiki 回链优先跳条目、行号兜底仍可用；
- 条目编辑后 smart-tasks 阶段标记正常推进（chunk-summary/vectorize/concept/topic/link）；
- `journalCount` 统计、标签页/人物页按 entity 查询；
- 删除条目后其块与级联关联清理、FTS 更新。

## 11. 非目标（本轮 YAGNI 边界）

- 网络同步协议、冲突解决、条目导出/交换格式（JSONL 等）；
- 移动端对接、附件/语音上传 UI（`attachments`/`metadata` 仅 schema 占位，代码路径不读写）；
- 历史日期补记、条目拖拽/合并/多选批量操作；
- 每条目 Tiptap 富文本实例；
- 旧日志 `.md` 的解析迁移与反向导入。

## 12. 影响文件清单（实施时的 touch set）

| 层 | 文件 |
|---|---|
| 契约 | `src/shared/types/journal.types.ts`（重写）、`src/shared/enums/journal.enums.ts`（补 source/type 枚举） |
| IPC 四层 | `src/main/ipcMain/journal.ipc.ts`、`core/apis/journal.api.ts`、`preload/modules/journal.ts`、`preload/types/journal.ts` |
| 服务 | `core/services/content/journal.service.ts`（重写为条目编排）、新 `journal-render.service.ts`（或并入 journal.service：确定性渲染器 + 5.2 格式解析器 + 5.3 导入 upsert，纯函数优先）、`chunk-index.service.ts`（scheduleJournal/processJournalDay）、`inline-token-sync.service.ts`（按条目作用域，小改） |
| DAO/类型 | 新 `core/db/journalEntry.dao.ts`、`journalEntryProject` 关联 DAO、`types/db/journalEntry.types.ts`；`chunk.dao.ts` 增按 entry_id 差异同步；`fileIndex` 相关沿用 |
| Schema | `schemas/init.sql`（表/列/索引 + 基线 0.7.0）、新 `schemas/migrations/0.7.0_journal_entries.sql`、`core/migration/database.migration.ts`（`ensureEntryIdColumn()` 兜底，可选） |
| 管线 | `main/index.ts` 任务 handler payload（如需）、`chunk.service.ts`（entry 维度同步入口） |
| UI | `views/JournalView.vue`、`components/editor/containers/JournalBlock.vue`（瘦身）、新 `JournalEntryComposer.vue`/`JournalEntryItem.vue`、`store/journal.store.ts`、`composables/useJournal.ts`、slash `dateTime.commands.ts`（语义降级注释） |
| 下游不动 | smart-tasks 8 执行器、`task-dag.ts`、wiki/search/concept/topic service（仅回归验证）；page 体系、update/resource-sync 完全不涉及 |

## 13. 风险与对策

| 风险 | 对策 |
|---|---|
| 首次启动渲染覆盖旧日志 | 5.1 渲染保护规则：空表日不渲染，已有非空文件绝不覆盖（含单元测试守护）；某日一旦追加首条则被接管，旧内容覆盖属已接受代价（见 5.1） |
| `chunked_at` 回写刷新 `updated_at` 导致自脏循环 | 仿 `PageDao.recordStage()` 模式：阶段标记写入不触碰 `updated_at` |
| 删块级联遗漏（concept_chunks/topic_chunks/semantic_links/reflection_chunks/project_chunks/temporal_events） | 复用 `resetJournalTable` 已验证的删块路径，抽成按 `entry_id` 的删除方法并集成测试 |
| `&作品` 重名/改名导致关联漂移 | 关联以 `project_id` 为准，正文记号仅展示；解析按名称精确优先、匹配不到不建关联 |
| 第三方工具改写/丢失注释头 → 元数据退化为推断导入，再导入会产生新 ID | 注释行是权威、缺失才推断；同一"文件↔条目表"的往返以 wrisp 渲染为准，导入入口仅在"当日无条目"时暴露（5.3），已接管日不提供文件导入，杜绝混源 |
| 基线版本失同步（AGENTS.md 隐患 #19） | 迁移 + init.sql + 基线记录三处同 PR 修改；两步启动手动验证写入测试计划 |
| 条目块数量变多推高 AI 成本 | 首版不动阈值，观察 `journal` 类块规模后再调 `thresholdForChunkType` |
| `listRecentDays` 与旧查询行为差异（原查询未过滤 journal） | 新查询以 `journal_entries` 为源，天然修复；wiki 统计口径回归测试覆盖 |

## 14. 一句话总结

日志最小单元从"文档"改为 `journal_entries` 条目（SQLite 真源，`.md` 只是带
`**HH:mm**` 条目头 + `wrisp:entry` 注释元数据的确定性渲染产物，可显式导入往返回库），
块经 `entry_id` 锚回条目，`#标签`/`&作品`/`@人物`
在 composer 输入时解析并落 `tagged_items`/`journal_entry_projects`；本轮纯 DDL 升库、
不迁存量数据，同步所需的 id/source/时间戳/软删字段全部就位但不接网络。
