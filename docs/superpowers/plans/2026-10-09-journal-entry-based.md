# Journal 条目化改造 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把日志从"按天整篇 Markdown 文档"改造为"SQLite `journal_entries` 条目为真源、按时间戳追加"的模型，`.md` 降级为可往返导入的确定性渲染产物；条目直接关联标签（复用 `tagged_items`）与作品（新表 `journal_entry_projects`）。

**Architecture:** 每日志 = 条目行（id/occurred_at/source/type/content/chunked_at/updated_at/deleted_at）；写路径 = 落库 → 重渲染当日 `.md`（受空表日保护规则约束）→ 行内记号（`#标签`/`&作品`/`@人物`）解析重建关联 → 按"日"去抖调度切块；切块 = 逐条目跑现有三层 `splitDocument`，块经新列 `semantic_chunks.entry_id` 锚回条目。IPC 走四层模式（preload module → preload type → core/apis → ipcMain）。存量数据不迁移，仅纯 DDL 升库 0.7.0。

**Tech Stack:** Electron + Vue 3 + TypeScript strict、better-sqlite3、Naive UI、Vitest（happy-dom + `// @vitest-environment node`）、Sass、vue-i18n。

**Spec:** `docs/superpowers/specs/2026-10-09-journal-entry-based-design.md`（本计划逐节对应其 §3~§13，实现时两文并读）

## Global Constraints

- Node.js 24+ / pnpm；`@/` 别名 → `./src/`。
- TypeScript strict，`noUnusedLocals`/`noUnusedParameters` 在 `tsconfig.app.json` 严格生效——删除任何不再使用的导入/变量，否则 `pnpm typecheck` 失败。
- 每个任务收尾必须：`pnpm typecheck` 通过 + 本任务测试通过 + `pnpm lint` + git 提交（提交信息风格照 `git log`，中文 `feat:`/`refactor:`/`test:` 前缀）。
- 集成测试依赖 better-sqlite3 的 Node ABI；若刚跑过 `pnpm dev`/Electron 构建，先执行 `pnpm rebuild` 再跑测试（反之亦然）。
- DB 迁移铁律（AGENTS.md）：迁移文件末尾自登记 `INSERT OR IGNORE INTO migrations_db`；`init.sql` 头部注释、基线记录 version、`migrations/` 最高版本三处必须同为 `0.7.0`；迁移文件名 `0.7.0_journal_entries.sql`（三段版本 + snake_case）。
- 渲染层前端通知只用 `useFrontendNotification()`；任何 `v-html` 必须过 `sanitizeHtml()`（`src/renderer/utils/sanitize.ts`）。
- 本计划期间**不删除旧 channel**（additive 推进，Task 10 统一清理），保证每任务结束时应用可编译、可运行。
- i18n 新增 key 必须同时写入 `src/shared/i18n/locales/enUS.ts` 与 `zhCN.ts`。
- 条目 `occurred_at`/`created_at`/`updated_at` 一律存 UTC ISO（`new Date().toISOString()`）；`date` 为本地时区 `YYYY-MM-DD`。

## 文件结构（本计划创建/修改的全貌）

**新建**
- `src/main/schemas/migrations/0.7.0_journal_entries.sql` — 纯 DDL + 自登记
- `src/main/types/db/journalEntry.types.ts` — 行类型（main 侧）
- `src/main/core/db/journalEntry.dao.ts` — `JournalEntryDao`（条目 + 两张关联的读写；DAO 惯例同类内直写 SQL）
- `src/main/core/services/content/journal/journal-render.ts` — 确定性渲染器 + 5.2 格式解析 + 转义（纯函数，无 DB/IO）
- `src/main/core/services/content/journal/journal-entry.tokens.ts` — 条目行内记号聚合解析（薄封装）
- `src/renderer/components/editor/containers/JournalEntryItem.vue` — 只读条目 + meta 行 + 内联编辑
- `src/renderer/components/editor/containers/JournalEntryComposer.vue` — 今日追加入 + 底部提示区 + `&` 作品下拉
- `tests/integration/main/migrations.journal-entries.test.ts`
- `tests/integration/main/journal-entries.dao.test.ts`
- `tests/integration/main/chunk.sync-by-entry.test.ts`
- `tests/unit/main/journal-render.test.ts`
- `tests/unit/main/journal.service.entries.test.ts`
- `tests/unit/main/text-tokens.project.test.ts`
- `tests/unit/renderer/journal.store.test.ts`

**修改（核心）**
- `src/main/schemas/init.sql`（表/列/索引 + 基线 0.7.0）
- `src/shared/types/journal.types.ts`、`src/shared/enums/journal.enums.ts`、`src/shared/utils/text-tokens.ts`
- `src/main/types/db/chunk.types.ts`、`src/main/types/db/index.ts`、`src/main/core/db/chunk.dao.ts`、`src/main/core/db/index.ts`
- `src/main/core/services/content/chunk.service.ts`、`chunk-index.service.ts`
- `src/main/core/services/content/journal.service.ts`（追加条目编排，Task 10 删旧路径）
- `src/main/core/apis/journal.api.ts`、`ipcMain/journal.ipc.ts`、`preload/modules/journal.ts`、`preload/types/journal.ts`
- `apis/project.api.ts`、`ipcMain/project.ipc.ts`、`preload/modules/project.ts`、`preload/types/project.ts`（searchByName）
- `src/main/index.ts`（`journal:chunk-day` handler + 基线版本检查）
- `src/renderer/store/journal.store.ts`、`composables/useJournal.ts`、`views/JournalView.vue`、`components/editor/containers/JournalBlock.vue`
- `src/shared/i18n/locales/enUS.ts`、`zhCN.ts`

**下游不动（仅回归验证）：** smart-tasks 8 执行器、`task-dag.ts`、`wiki.service.ts`、page 体系、update/resource-sync。

---

### Task 1: Schema 0.7.0 —— 迁移文件 + init.sql 基线同步

**Files:**
- Create: `src/main/schemas/migrations/0.7.0_journal_entries.sql`
- Modify: `src/main/schemas/init.sql`（`:3` 版本注释、`:32-60` semantic_chunks、`:477-488` 基线记录、新增表段）
- Test: `tests/integration/main/migrations.journal-entries.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: 表 `journal_entries`、`journal_entry_projects`，列 `semantic_chunks.entry_id`，`migrations_db` 记录 `0.7.0`（id `00000000-0000-0000-0000-000000000010`）。Task 3/5 的 DAO 与类型以此为前提。

- [ ] **Step 1: 写失败的迁移集成测试**

创建 `tests/integration/main/migrations.journal-entries.test.ts`（模式照抄 `migrations.page-stage-marks.test.ts`：内存库 + 直接 `db.exec` SQL 文件）：

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const MIGRATION_FILE = path.resolve(
  process.cwd(),
  "src/main/schemas/migrations/0.7.0_journal_entries.sql",
);
const TS = "2026-01-01T00:00:00.000Z";

/** 复刻 0.7.0 之前的最小依赖集：migrations_db + file_index + semantic_chunks + tags + tagged_items + projects */
function createLegacyDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE migrations_db (
      id TEXT PRIMARY KEY, version TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      description TEXT DEFAULT '', sql_statement TEXT NOT NULL, status TEXT DEFAULT 'pending',
      executed_at TEXT DEFAULT '', execution_time INTEGER, checksum TEXT DEFAULT '',
      error_message TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    INSERT INTO migrations_db (id, version, name, sql_statement, status, created_at, updated_at)
      VALUES ('baseline', '0.6.0', 'baseline', 'init', 'executed', '${TS}', '${TS}');
    CREATE TABLE file_index (
      id TEXT PRIMARY KEY, file_path TEXT NOT NULL UNIQUE, file_hash TEXT NOT NULL,
      file_size INTEGER DEFAULT 0, date TEXT, name TEXT, last_synced TEXT,
      sync_status TEXT DEFAULT 'pending', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE tags (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE tagged_items (
      tag_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      added_at TEXT NOT NULL, PRIMARY KEY (tag_id, entity_type, entity_id)
    );
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, file_path TEXT NOT NULL, description TEXT,
      type TEXT, status TEXT DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      ai_summary TEXT DEFAULT '', structure TEXT DEFAULT '', metadata TEXT DEFAULT '{}',
      is_pinned INTEGER NOT NULL DEFAULT 0, CHECK (status IN ('active', 'deleted'))
    );
  `);
  return db;
}

function tableNames(db: Database.Database): string[] {
  return (db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as Array<{ name: string }>).map((r) => r.name);
}

describe("0.7.0 journal_entries 迁移", () => {
  it("在存量库上建两张新表、补 entry_id 列并自登记 0.7.0", () => {
    const db = createLegacyDb();
    db.exec(fs.readFileSync(MIGRATION_FILE, "utf-8"));

    expect(tableNames(db)).toEqual(
      expect.arrayContaining(["journal_entries", "journal_entry_projects"]),
    );
    const chunkCols = (db.prepare("PRAGMA table_info(semantic_chunks)").all() as Array<{ name: string }>)
      .map((c) => c.name);
    expect(chunkCols).toContain("entry_id");

    const record = db
      .prepare("SELECT version, status FROM migrations_db WHERE version = '0.7.0'")
      .get() as { version: string; status: string } | undefined;
    expect(record?.status).toBe("executed");
    db.close();
  });

  it("CREATE TABLE IF NOT EXISTS + 自登记：重复执行迁移文件不报错", () => {
    const db = createLegacyDb();
    const sql = fs.readFileSync(MIGRATION_FILE, "utf-8");
    db.exec(sql);
    db.exec(sql); // 建表幂等；semantic_chunks 在测试库中不存在时 ADD COLUMN 跳过
    db.close();
  });

  it("新条目行可写入，关联表外键级联删除生效", () => {
    const db = createLegacyDb();
    db.exec(fs.readFileSync(MIGRATION_FILE, "utf-8"));
    db.prepare(
      `INSERT INTO journal_entries (id, date, occurred_at, source, type, content, created_at, updated_at)
       VALUES ('e1', '2026-10-09', '2026-10-09T01:00:00.000Z', 'desktop', 'text', '内容', ?, ?)`,
    ).run(TS, TS);
    db.prepare("INSERT INTO projects (id, name, file_path, created_at, updated_at) VALUES ('p1', '作品A', '/x', ?, ?)").run(TS, TS);
    db.prepare("INSERT INTO journal_entry_projects (entry_id, project_id, added_at) VALUES ('e1', 'p1', ?)").run(TS);
    expect((db.prepare("SELECT COUNT(*) n FROM journal_entry_projects").get() as { n: number }).n).toBe(1);
    db.prepare("DELETE FROM journal_entries WHERE id = 'e1'").run();
    expect((db.prepare("SELECT COUNT(*) n FROM journal_entry_projects").get() as { n: number }).n).toBe(0);
    db.close();
  });

  it("init.sql 全新库含同构表/列，基线版本为 0.7.0", () => {
    const fresh = new Database(":memory:");
    fresh.exec(fs.readFileSync(path.resolve(process.cwd(), "src/main/schemas/init.sql"), "utf-8"));
    expect(tableNames(fresh)).toEqual(
      expect.arrayContaining(["journal_entries", "journal_entry_projects"]),
    );
    const chunkCols = (fresh.prepare("PRAGMA table_info(semantic_chunks)").all() as Array<{ name: string }>)
      .map((c) => c.name);
    expect(chunkCols).toContain("entry_id");
    const baseline = fresh
      .prepare("SELECT version FROM migrations_db ORDER BY version DESC LIMIT 1")
      .get() as { version: string };
    expect(baseline.version).toBe("0.7.0");
    fresh.close();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/integration/main/migrations.journal-entries.test.ts`
Expected: FAIL（迁移文件不存在 / ENOENT）

- [ ] **Step 3: 写迁移文件**

创建 `src/main/schemas/migrations/0.7.0_journal_entries.sql`：

```sql
-- v0.7.0 Journal 条目化：日志真源从"每日整篇 .md"迁移为 journal_entries 条目表
-- 背景：移动端多源记录与云端合并要求以"条目"为最小同步单元（id 全局唯一、自带时间戳、
--       软删除 tombstone、updated_at 冲突判定）。.md 文件降级为确定性渲染产物。
--       本迁移为纯 DDL：不解析、不搬运任何存量日志内容（设计决策见 spec §3-2）。
-- semantic_chunks.entry_id：journal 块锚回条目（wiki 回链优先按条目定位）；可空，
--       page/其它来源块不填。file_id NOT NULL 锚定模型保持不变。

CREATE TABLE IF NOT EXISTS journal_entries (
    id           TEXT PRIMARY KEY,
    date         TEXT NOT NULL,
    occurred_at  TEXT NOT NULL,
    source       TEXT NOT NULL DEFAULT 'desktop',
    type         TEXT NOT NULL DEFAULT 'text',
    content      TEXT NOT NULL,
    attachments  TEXT,
    metadata     TEXT,
    chunked_at   TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    deleted_at   TEXT,
    CHECK (source IN ('desktop', 'mobile', 'import')),
    CHECK (type IN ('text', 'voice', 'image', 'expense', 'task'))
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_date  ON journal_entries(date, occurred_at);
CREATE INDEX IF NOT EXISTS idx_journal_entries_dirty ON journal_entries(chunked_at) WHERE chunked_at IS NULL;

CREATE TABLE IF NOT EXISTS journal_entry_projects (
    entry_id   TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id)        ON DELETE CASCADE,
    added_at   TEXT NOT NULL,
    PRIMARY KEY (entry_id, project_id)
);

-- ADD COLUMN 无 IF NOT EXISTS，靠自登记防止重放；init 阶段（semantic_chunks 尚未建表时）
-- 用 __wrisp_chunk_cols 判断跳过，全新库由 init.sql 直接带列。
CREATE TABLE IF NOT EXISTS __wrisp_chunk_cols (name TEXT);
INSERT INTO __wrisp_chunk_cols SELECT name FROM pragma_table_info('semantic_chunks');

-- 有表且无列才 ALTER（pragma 子查询为 0 行时整条 UPDATE/ALTER 分支不执行）
-- SQLite 不支持条件 DDL，采用"执行器容错"策略：database.migration.ts 对重复列有自愈补登记，
-- 全新库本文件不被执行（基线=0.7.0），存量库此处必然有表无列，直接 ALTER 安全。
DROP TABLE __wrisp_chunk_cols;
ALTER TABLE semantic_chunks ADD COLUMN entry_id TEXT;

-- 自登记迁移记录（模板照 0.6.0_page_stage_marks.sql）
INSERT OR IGNORE INTO migrations_db (id, version, name, description, sql_statement, status, executed_at, execution_time, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000010',
    '0.7.0',
    'Journal Entries',
    '新增 journal_entries、journal_entry_projects 表与 semantic_chunks.entry_id 列，日志条目化为移动端合并预留同步能力',
    'CREATE TABLE journal_entries / journal_entry_projects; ALTER TABLE semantic_chunks ADD COLUMN entry_id',
    'executed',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    0,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
```

> 注意 Step 1 测试第 2 用例"重复执行不报错"与裸 `ALTER` 冲突（SQLite ADD COLUMN 重复执行报 duplicate column）。照 0.6.0 测试的先例，重复执行断言应为 **toThrow(/duplicate column name/i)**——把用例 2 改成与 `migrations.page-stage-marks.test.ts` 相同的写法：`expect(() => db.exec(sql)).toThrow(/duplicate column name/i);`，语义是"靠自登记防重放，裸 ALTER 重放必报错提示未登记"。同时删除上面 `__wrisp_chunk_cols` 探测块（保留注释说明全新库由 init.sql 带列、存量库走本 ALTER）。最终迁移文件以简化版为准：两张 CREATE TABLE IF NOT EXISTS + 两条索引 + 裸 ALTER + 自登记。

- [ ] **Step 4: 同步 init.sql（三处）**

1. `src/main/schemas/init.sql:3`：`-- 版本: 0.6.0` → `-- 版本: 0.7.0`。
2. `semantic_chunks` 建表（`:59` `CHECK` 前）加一列：

```sql
    -- journal 条目化（0.7.0）：条目锚点，仅 chunk_type='journal' 的块填写
    entry_id TEXT,
```

并在 `:60` 表定义后追加索引：

```sql
CREATE INDEX IF NOT EXISTS idx_semantic_chunks_entry ON semantic_chunks(entry_id);
```

3. 在 `-- ==================== 插入初始迁移记录 ====================` 之前追加两张新表（与迁移文件同文，CREATE INDEX 齐全）。
4. 文末基线记录（`:477-488`）：`'0.6.0'` → `'0.7.0'`，description/sql_statement 文案追加 `journal_entries, journal_entry_projects` 与新索引（照抄迁移文件语句列表补进 `:483` 的清单）。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm vitest run tests/integration/main/migrations.journal-entries.test.ts tests/integration/main/migrations.page-stage-marks.test.ts`
Expected: 全部 PASS（第二个文件守护"基线版本改动没破坏旧断言"——注意它断言 baseline 是 `0.6.0`，现基线升 0.7.0 后该用例会失败：**把 `migrations.page-stage-marks.test.ts` 中基线断言改为 `toBe("0.7.0")`**，其余旧迁移测试若同样按 version DESC 取基线也一并核对更新）。

- [ ] **Step 6: 全量回归 + 提交**

Run: `pnpm test && pnpm typecheck`
Expected: PASS
```bash
git add src/main/schemas tests/integration/main/migrations.journal-entries.test.ts tests/integration/main/migrations.page-stage-marks.test.ts
git commit -m "feat(db): 新增 journal_entries 条目表与 semantic_chunks.entry_id，基线升 0.7.0"
```

---

### Task 2: 共享契约 —— 条目类型 / 枚举 / `&作品` 记号解析

**Files:**
- Modify: `src/shared/types/journal.types.ts`（新增，旧类型暂留）
- Modify: `src/shared/enums/journal.enums.ts`（新增，`SEARCH_TYPE` 保留——`settings/*` 有引用，勿动）
- Modify: `src/shared/utils/text-tokens.ts`（新增 `extractProjectNames`；**不要**扩展 `InlineTokenType`，编辑器 Decorations 只认 wiki/tag/mention 三型，扩展会波及 Tiptap 插件）
- Test: `tests/unit/main/text-tokens.project.test.ts`

**Interfaces:**
- Consumes: 无
- Produces（Task 3/5/6/7/8 依赖的精确签名）:

```ts
// journal.types.ts 新增
export interface JournalEntry {
  id: Id;
  date: string;                      // YYYY-MM-DD（本地）
  occurred_at: Timestamp;            // UTC ISO
  source: JournalEntrySource;        // "desktop" | "mobile" | "import"
  type: JournalEntryType;            // "text" | "voice" | "image" | "expense" | "task"
  content: Content;                  // Markdown 正文（保留 #/&/@ 记号原文）
  attachments: string[] | null;      // workspace 相对路径（首版恒 null）
  metadata: Record<string, unknown> | null;
  chunked_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: Timestamp | null;
}
export interface JournalEntryBrief { id: Id; name: string }
export interface JournalEntryView extends Omit<JournalEntry, "attachments" | "metadata"> {
  tags: JournalEntryBrief[];
  projects: JournalEntryBrief[];
}
export interface JournalDayView {
  date: string;
  has_legacy_file: boolean;          // 当日无条目但存在旧版整篇 .md（导入入口显示条件）
  entries: JournalEntryView[];
}
export interface JournalEntryCreatePayload {
  content: Content;
  occurredAt?: Timestamp;            // 缺省 = 当前时刻
  source?: JournalEntrySource;
  type?: JournalEntryType;
  attachments?: string[];
  metadata?: Record<string, unknown>;
}
export interface JournalEntryUpdatePayload { id: Id; content?: Content; occurredAt?: Timestamp }
export interface JournalImportResult { imported: number; updated: number; skipped: number }

// journal.enums.ts 新增（项目惯例 as const）
export const JOURNAL_ENTRY_SOURCE = { DESKTOP: "desktop", MOBILE: "mobile", IMPORT: "import" } as const;
export type JournalEntrySource = (typeof JOURNAL_ENTRY_SOURCE)[keyof typeof JOURNAL_ENTRY_SOURCE];
export const JOURNAL_ENTRY_TYPE = { TEXT: "text", VOICE: "voice", IMAGE: "image", EXPENSE: "expense", TASK: "task" } as const;
export type JournalEntryType = (typeof JOURNAL_ENTRY_TYPE)[keyof typeof JOURNAL_ENTRY_TYPE];

// text-tokens.ts 新增
export function extractProjectNames(markdown: string): string[];
```

- [ ] **Step 1: 写失败的 extractProjectNames 测试**

`tests/unit/main/text-tokens.project.test.ts`：

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { extractProjectNames } from "@/shared/utils/text-tokens";

describe("extractProjectNames（&作品记号）", () => {
  it("提取裸记号名（单 token）", () => {
    expect(extractProjectNames("续写 &长夜行 第三章")).toEqual(["长夜行"]);
  });
  it("方括号形式支持带空格名称", () => {
    expect(extractProjectNames("关联 &[星际回声 计划] 与 &[星潮]")).toEqual(["星际回声 计划", "星潮"]);
  });
  it("行中无前置空白的 & 不提取（URL 等）", () => {
    expect(extractProjectNames("see a&b 链接 &A")).toEqual(["A"]);
  });
  it("去重且保持出现顺序", () => {
    expect(extractProjectNames("&甲 与 &乙 与 &甲")).toEqual(["甲", "乙"]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/unit/main/text-tokens.project.test.ts` → FAIL（extractProjectNames 未导出）

- [ ] **Step 3: 实现**

`text-tokens.ts` 末尾追加：

```ts
/** &作品：裸形式 &[^\s&\[\]]+ 或方括号形式 &[...]（支持带空格的作品名）；要求行首或空白后开始，避开 URL 的 & */
const PROJECT_RE = /(?<!\S)&\[([^\]\n]+)\]|(?<!\S)&([^\s&[\]]+)/g;

/** 提取 markdown 中全部 &作品 名（去重，保持出现顺序） */
export function extractProjectNames(markdown: string): string[] {
  const names: string[] = [];
  for (const match of markdown.matchAll(PROJECT_RE)) {
    const name = (match[1] ?? match[2]).trim();
    if (name) names.push(name);
  }
  return [...new Set(names)];
}
```

`journal.types.ts` / `journal.enums.ts` 按上方 Interfaces 原文追加（不删除旧 `JournalFileInfo` 等，Task 10 清理）。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/unit/main/text-tokens.project.test.ts` → PASS

- [ ] **Step 5: 全量校验 + 提交**

Run: `pnpm typecheck && pnpm lint`
```bash
git add src/shared/types/journal.types.ts src/shared/enums/journal.enums.ts src/shared/utils/text-tokens.ts tests/unit/main/text-tokens.project.test.ts
git commit -m "feat(shared): 日志条目类型契约与 &作品 行内记号解析"
```

---

### Task 3: `JournalEntryDao`（条目行 + 关联读写 + 视图组装）

**Files:**
- Create: `src/main/types/db/journalEntry.types.ts`
- Create: `src/main/core/db/journalEntry.dao.ts`
- Modify: `src/main/core/db/index.ts`（`export * from './journalEntry.dao'`）
- Modify: `src/main/types/db/index.ts`（导出新类型）
- Test: `tests/integration/main/journal-entries.dao.test.ts`

**Interfaces:**
- Consumes: Task 1 表结构；Task 2 `JournalEntry` 等共享类型；`BaseDao<T, C, U>`（`create` 缺 id 自动生成、`update` 自动刷新 `updated_at`、`execute/query/queryOne/transaction` 可用；阶段标记类写入必须绕过 `update` 直写 SQL）。
- Produces:

```ts
// journalEntry.types.ts（main 行类型，attachments/metadata 为 JSON 文本列）
export interface JournalEntryRow {
  id: Id; date: string; occurred_at: Timestamp; source: string; type: string;
  content: Content; attachments: string | null; metadata: string | null;
  chunked_at: Timestamp | null; created_at: Timestamp; updated_at: Timestamp;
  deleted_at: Timestamp | null;
}
export interface JournalEntryRowCreate {
  id?: Id; date: string; occurred_at: Timestamp; source?: string; type?: string;
  content: Content; attachments?: string | null; metadata?: string | null;
  chunked_at?: Timestamp | null; created_at?: Timestamp; updated_at?: Timestamp; deleted_at?: Timestamp | null;
}
export interface JournalEntryRowUpdate {
  date?: string; occurred_at?: string; source?: string; type?: string; content?: Content;
  attachments?: string | null; metadata?: string | null; chunked_at?: string | null;
  deleted_at?: string | null; updated_at?: string;
}

// journalEntry.dao.ts —— class JournalEntryDao extends BaseDao<JournalEntryRow, JournalEntryRowCreate, JournalEntryRowUpdate>
//   constructor(){ super("journal_entries", { enabled: true, createdAtField: "created_at", updatedAtField: "updated_at" }); }
listActiveByDate(date: string): JournalEntryRow[]
listAllByDate(date: string): JournalEntryRow[]            // 含软删（导入 upsert 判 tombstone 用）
listDirtyByDate(date: string): JournalEntryRow[]           // 未软删 AND (chunked_at IS NULL OR updated_at > chunked_at)
recordChunked(id: Id, ts: Timestamp): void                 // 直写 SQL，不刷 updated_at（防自脏，仿 ChunkDao.recordStage）
softDelete(id: Id, ts: Timestamp): number                  // 直写 deleted_at + updated_at
listActiveDates(limit: number, beforeDate?: string): string[]
hasActiveEntries(date: string): boolean
replaceAssociations(entryId: Id, tagIds: string[], projectIds: string[], ts: Timestamp): void
listLegacyDates(limit: number): string[]                   // file_index 中 journal/% 且当日无条目
assembleViews(dates: string[]): JournalDayView[]           // JOIN tagged_items/tags 与 journal_entry_projects/projects 组装视图，含 has_legacy_file
```

- [ ] **Step 1: 写失败测试（真实内存库，模式照 `tag.dao.test.ts`：mock `@/main/core/db/connection`）**

`tests/integration/main/journal-entries.dao.test.ts`：

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let memDb: Database.Database | null = null;
function mem() {
  if (!memDb) {
    memDb = new Database(":memory:");
    memDb.pragma("foreign_keys = ON");
    memDb.exec(fs.readFileSync(path.resolve(process.cwd(), "src/main/schemas/init.sql"), "utf-8"));
  }
  return memDb;
}
vi.mock("@/main/core/db/connection", () => ({
  getDatabase: () => mem(),
  setWorkspacePath: vi.fn(),
}));
vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { JournalEntryDao } from "@/main/core/db/journalEntry.dao";

const TS = "2026-10-09T01:00:00.000Z";
const D = "2026-10-09";

function seed(db: Database.Database, sql: string, ...p: unknown[]) { db.prepare(sql).run(...p); }

describe("JournalEntryDao", () => {
  let dao: JournalEntryDao;
  beforeEach(() => {
    dao = new JournalEntryDao();
    mem().exec("DELETE FROM journal_entries; DELETE FROM journal_entry_projects; DELETE FROM tagged_items; DELETE FROM tags;");
  });

  it("create 生成 id 并按日期读取；软删行不出现在 listActiveByDate", () => {
    const id = dao.create({ date: D, occurred_at: TS, content: "早间记录" });
    expect(dao.listActiveByDate(D).map((r) => r.id)).toContain(id);
    dao.softDelete(id, "2026-10-09T02:00:00.000Z");
    expect(dao.listActiveByDate(D).map((r) => r.id)).not.toContain(id);
    expect(dao.listAllByDate(D).find((r) => r.id === id)?.deleted_at).toBe("2026-10-09T02:00:00.000Z");
  });

  it("脏判定：chunked_at 为空或 updated_at 更新过才算脏；recordChunked 不刷 updated_at", () => {
    const id = dao.create({ date: D, occurred_at: TS, content: "a" });
    expect(dao.listDirtyByDate(D).map((r) => r.id)).toContain(id);
    dao.recordChunked(id, "2026-10-09T01:30:00.000Z");
    const row = dao.findById(id)!;
    expect(row.chunked_at).toBe("2026-10-09T01:30:00.000Z");
    expect(row.updated_at).toBe(row.created_at); // 关键：水位线未动
    expect(dao.listDirtyByDate(D)).toHaveLength(0);
    dao.update(id, { content: "b" }); // update 刷 updated_at → 重新变脏
    expect(dao.listDirtyByDate(D).map((r) => r.id)).toContain(id);
  });

  it("replaceAssociations 先删后建、幂等", () => {
    const id = dao.create({ date: D, occurred_at: TS, content: "#标签 x" });
    seed(mem(), "INSERT INTO tags (id, name, created_at, updated_at) VALUES ('t1', '标签', ?, ?)", TS, TS);
    seed(mem(), "INSERT INTO projects (id, name, file_path, created_at, updated_at) VALUES ('p1', '作品A', '/x', ?, ?)", TS, TS);
    dao.replaceAssociations(id, ["t1"], ["p1"], TS);
    dao.replaceAssociations(id, ["t1"], ["p1"], TS);
    expect((mem().prepare("SELECT COUNT(*) n FROM tagged_items WHERE entity_type='journal_entry'").get() as { n: number }).n).toBe(1);
    expect((mem().prepare("SELECT COUNT(*) n FROM journal_entry_projects").get() as { n: number }).n).toBe(1);
    dao.replaceAssociations(id, [], [], TS);
    expect((mem().prepare("SELECT COUNT(*) n FROM tagged_items").get() as { n: number }).n).toBe(0);
  });

  it("assembleViews 返回按 (occurred_at,id) 排序的条目并带 tags/projects 名称", () => {
    const a = dao.create({ date: D, occurred_at: "2026-10-09T01:00:00.000Z", content: "x &作品A" });
    const b = dao.create({ date: D, occurred_at: "2026-10-09T02:00:00.000Z", content: "y #标签" });
    seed(mem(), "INSERT INTO tags (id, name, created_at, updated_at) VALUES ('t1', '标签', ?, ?)", TS, TS);
    seed(mem(), "INSERT INTO projects (id, name, file_path, created_at, updated_at) VALUES ('p1', '作品A', '/x', ?, ?)", TS, TS);
    dao.replaceAssociations(a, [], ["p1"], TS);
    dao.replaceAssociations(b, ["t1"], [], TS);
    const days = dao.assembleViews([D]);
    expect(days).toHaveLength(1);
    expect(days[0].entries.map((e) => e.id)).toEqual([a, b]);
    expect(days[0].entries[0].projects).toEqual([{ id: "p1", name: "作品A" }]);
    expect(days[0].entries[1].tags).toEqual([{ id: "t1", name: "标签" }]);
    expect(days[0].has_legacy_file).toBe(false);
  });

  it("listLegacyDates：有 journal 文件索引但当日无条目的日期入选", () => {
    seed(mem(), "INSERT INTO file_index (id, file_path, file_hash, date, created_at, updated_at) VALUES ('f1', 'journal/2026-10-08.md', 'h', '2026-10-08', ?, ?)", TS, TS);
    const id = dao.create({ date: "2026-10-07", occurred_at: "2026-10-07T01:00:00.000Z", content: "z" });
    expect(dao.listLegacyDates(30)).toEqual(["2026-10-08"]);
    seed(mem(), "INSERT INTO file_index (id, file_path, file_hash, date, created_at, updated_at) VALUES ('f2', 'journal/2026-10-07.md', 'h', '2026-10-07', ?, ?)", TS, TS);
    dao.softDelete(id, TS);
    expect(dao.listLegacyDates(30)).toContain("2026-10-07");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/integration/main/journal-entries.dao.test.ts` → FAIL（模块不存在）

- [ ] **Step 3: 实现 DAO**

`src/main/types/db/journalEntry.types.ts`：按 Interfaces 原文三个 interface（import `Id/Timestamp/Content` 自 `@/shared/types`）。

`src/main/core/db/journalEntry.dao.ts`（完整实现）：

```ts
import { BaseDao } from "./base.dao";
import type {
  JournalEntryRow,
  JournalEntryRowCreate,
  JournalEntryRowUpdate,
} from "@/main/types/db";
import type { JournalDayView, JournalEntryView, JournalEntryBrief } from "@/shared/types";
import type { Id } from "@/shared/types";

/**
 * 日志条目 DAO（journal_entries 表，日志真源）
 * 关联表约定：标签走多态表 tagged_items（entity_type = 'journal_entry'），
 * 作品走 journal_entry_projects。association 一律"先删后建"，由条目保存路径全量重建。
 * chunked_at 是阶段水位线：写它必须走 recordChunked（不刷 updated_at），
 * 否则 Task 5 的脏判定 `updated_at > chunked_at` 会被自己顶高，条目无限重切。
 */
const ENTRY_TAG_ENTITY = "journal_entry";

export class JournalEntryDao extends BaseDao<JournalEntryRow, JournalEntryRowCreate, JournalEntryRowUpdate> {
  constructor() {
    super("journal_entries", {
      enabled: true,
      createdAtField: "created_at",
      updatedAtField: "updated_at",
    });
  }

  listActiveByDate(date: string): JournalEntryRow[] {
    return this.query(
      `SELECT * FROM journal_entries
       WHERE date = ? AND deleted_at IS NULL
       ORDER BY occurred_at ASC, id ASC`,
      [date],
    );
  }

  listAllByDate(date: string): JournalEntryRow[] {
    return this.query(`SELECT * FROM journal_entries WHERE date = ?`, [date]);
  }

  listDirtyByDate(date: string): JournalEntryRow[] {
    return this.query(
      `SELECT * FROM journal_entries
       WHERE date = ? AND deleted_at IS NULL
         AND (chunked_at IS NULL OR updated_at > chunked_at)`,
      [date],
    );
  }

  recordChunked(id: Id, ts: string): void {
    this.execute(`UPDATE journal_entries SET chunked_at = ? WHERE id = ?`, [ts, id]);
  }

  softDelete(id: Id, ts: string): number {
    return this.execute(
      `UPDATE journal_entries SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [ts, ts, id],
    ).changes;
  }

  listActiveDates(limit: number, beforeDate?: string): string[] {
    const sql = beforeDate
      ? `SELECT DISTINCT date FROM journal_entries
         WHERE deleted_at IS NULL AND date < ? ORDER BY date DESC LIMIT ?`
      : `SELECT DISTINCT date FROM journal_entries
         WHERE deleted_at IS NULL ORDER BY date DESC LIMIT ?`;
    const params = beforeDate ? [beforeDate, limit] : [limit];
    return (this.query(sql, params) as Array<{ date: string }>).map((r) => r.date);
  }

  hasActiveEntries(date: string): boolean {
    const row = this.queryOne(
      `SELECT 1 AS one FROM journal_entries WHERE date = ? AND deleted_at IS NULL LIMIT 1`,
      [date],
    ) as { one: number } | null;
    return row !== null;
  }

  listLegacyDates(limit: number): string[] {
    const sql = `
      SELECT DISTINCT fi.date AS date FROM file_index fi
      WHERE fi.file_path LIKE 'journal/%' AND fi.date IS NOT NULL
        AND fi.date NOT IN (SELECT DISTINCT date FROM journal_entries)
      ORDER BY fi.date DESC LIMIT ?`;
    return (this.query(sql, [limit]) as Array<{ date: string }>).map((r) => r.date);
  }

  replaceAssociations(entryId: Id, tagIds: string[], projectIds: string[], ts: string): void {
    this.transaction(() => {
      this.execute(`DELETE FROM tagged_items WHERE entity_type = ? AND entity_id = ?`, [
        ENTRY_TAG_ENTITY,
        entryId,
      ]);
      this.execute(`DELETE FROM journal_entry_projects WHERE entry_id = ?`, [entryId]);
      for (const tagId of tagIds) {
        this.execute(
          `INSERT OR IGNORE INTO tagged_items (tag_id, entity_type, entity_id, added_at)
           VALUES (?, ?, ?, ?)`,
          [tagId, ENTRY_TAG_ENTITY, entryId, ts],
        );
      }
      for (const projectId of projectIds) {
        this.execute(
          `INSERT OR IGNORE INTO journal_entry_projects (entry_id, project_id, added_at)
           VALUES (?, ?, ?)`,
          [entryId, projectId, ts],
        );
      }
    });
  }

  /** 按日期集合组装时间线视图（标签/作品 JOIN 一次带出，渲染层不逐条查询） */
  assembleViews(dates: string[]): JournalDayView[] {
    if (dates.length === 0) return [];
    const legacy = new Set(this.listLegacyDates(1000));
    const placeholders = dates.map(() => "?").join(",");
    const rows = this.query(
      `SELECT * FROM journal_entries
       WHERE date IN (${placeholders}) AND deleted_at IS NULL
       ORDER BY date DESC, occurred_at ASC, id ASC`,
      dates,
    ) as JournalEntryRow[];

    const entryIds = rows.map((r) => r.id);
    const tagByEntry = new Map<string, JournalEntryBrief[]>();
    const projectByEntry = new Map<string, JournalEntryBrief[]>();
    if (entryIds.length > 0) {
      const ep = entryIds.map(() => "?").join(",");
      const tagRows = this.query(
        `SELECT ti.entity_id AS entry_id, t.id, t.name
         FROM tagged_items ti JOIN tags t ON t.id = ti.tag_id
         WHERE ti.entity_type = ? AND ti.entity_id IN (${ep})
         ORDER BY t.name ASC`,
        [ENTRY_TAG_ENTITY, ...entryIds],
      ) as Array<{ entry_id: string; id: string; name: string }>;
      for (const r of tagRows) {
        const list = tagByEntry.get(r.entry_id) ?? [];
        list.push({ id: r.id, name: r.name });
        tagByEntry.set(r.entry_id, list);
      }
      const projectRows = this.query(
        `SELECT jep.entry_id, p.id, p.name
         FROM journal_entry_projects jep JOIN projects p ON p.id = jep.project_id
         WHERE jep.entry_id IN (${ep})
         ORDER BY p.name ASC`,
        entryIds,
      ) as Array<{ entry_id: string; id: string; name: string }>;
      for (const r of projectRows) {
        const list = projectByEntry.get(r.entry_id) ?? [];
        list.push({ id: r.id, name: r.name });
        projectByEntry.set(r.entry_id, list);
      }
    }

    const dayMap = new Map<string, JournalEntryView[]>();
    for (const row of rows) {
      const view: JournalEntryView = {
        id: row.id,
        date: row.date,
        occurred_at: row.occurred_at,
        source: row.source as JournalEntryView["source"],
        type: row.type as JournalEntryView["type"],
        content: row.content,
        chunked_at: row.chunked_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
        tags: tagByEntry.get(row.id) ?? [],
        projects: projectByEntry.get(row.id) ?? [],
      };
      const list = dayMap.get(row.date) ?? [];
      list.push(view);
      dayMap.set(row.date, list);
    }

    const result: JournalDayView[] = [];
    for (const date of dates) {
      result.push({
        date,
        has_legacy_file: legacy.has(date) && !dayMap.has(date),
        entries: dayMap.get(date) ?? [],
      });
    }
    return result;
  }

  /** 供 Service 按名称解析标签/作品 id（不新建，缺失返回空数组） */
  findTagIdsByNames(names: string[]): Array<{ name: string; id: string }> {
    return names.flatMap((name) => {
      const row = this.queryOne(
        `SELECT id FROM tags WHERE name = ?`,
        [name],
      ) as { id: string } | null;
      return row ? [{ name, id: row.id }] : [];
    });
  }

  findProjectIdsByNames(names: string[]): Array<{ name: string; id: string }> {
    return names.flatMap((name) => {
      const row = this.queryOne(
        `SELECT id FROM projects WHERE name = ? AND status = 'active' LIMIT 1`,
        [name],
      ) as { id: string } | null;
      return row ? [{ name, id: row.id }] : [];
    });
  }
}
```

> `attachments/metadata` 的 JSON 序列化/反序列化归 Service（DAO 只见 TEXT）；`create()` 时若显式传了 `id`（导入路径需要确定性 id），确认 BaseDao 不覆盖已有 id——实现时先读 `base.dao.ts:164` 附近验证；若其强制生成，改为 DAO 内自写 `insertExplicit(row)`（`INSERT INTO journal_entries (...) VALUES (...)` 直插）。

`src/main/core/db/index.ts` 追加 `export * from './journalEntry.dao'`；`src/main/types/db/index.ts` 追加 `export * from './journalEntry.types'`（具名风格与文件现状一致）。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/integration/main/journal-entries.dao.test.ts` → PASS

- [ ] **Step 5: 全量校验 + 提交**

Run: `pnpm typecheck`
```bash
git add src/main/core/db src/main/types/db tests/integration/main/journal-entries.dao.test.ts
git commit -m "feat(db): 新增 JournalEntryDao（条目 CRUD/脏水位线/标签作品关联/时间线视图组装）"
```

---

### Task 4: `journal-render.ts` —— 确定性渲染器 + 5.2 格式解析（纯函数）

**Files:**
- Create: `src/main/core/services/content/journal/journal-render.ts`
- Test: `tests/unit/main/journal-render.test.ts`

**Interfaces:**
- Consumes: `NodeCryptoUtil.sha256`（`src/main/utils/crypto.ts`）、`TimeUtil.format`。
- Produces:

```ts
export interface JournalEntryMetaPayload {
  id: string; at: string; src: string; type: string;
  u?: string; att?: string[]; meta?: Record<string, unknown>;
}
export interface ParsedJournalEntry {
  id: string;
  occurred_at: string;          // 有 meta 用 payload.at 原值；裸头为 date + 头部时间（naive ISO 本地）
  source: string; type: string;
  updated_at: string | null;    // payload.u；裸头 null
  content: string;
  attachments: string[] | null; metadata: Record<string, unknown> | null;
  has_meta: boolean;
}
export function renderJournalDay(date: string, entries: JournalEntryRowLike[], fileDate?: string): string
//   JournalEntryRowLike = { id, occurred_at, source, type, content, attachments, metadata, updated_at }
export function parseJournalDayFile(date: string, markdown: string): ParsedJournalEntry[]
export function inferEntryId(date: string, occurredAt: string, content: string): string
export function localTimeHeader(occurredAtIso: string): string  // → "HH:mm"（本地时区，供渲染头）
```

- [ ] **Step 1: 写失败测试**

`tests/unit/main/journal-render.test.ts`（要点：往返一致、三条转义、旧格式兼容、确定性字节）：

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  renderJournalDay,
  parseJournalDayFile,
  inferEntryId,
} from "@/main/core/services/content/journal/journal-render";

const e = (over: Record<string, unknown> = {}) => ({
  id: "e1",
  occurred_at: "2026-10-09T01:32:00.000Z",
  source: "desktop",
  type: "text",
  content: "今天研究了 LanceDB",
  attachments: null,
  metadata: null,
  updated_at: "2026-10-09T01:32:00.000Z",
  ...over,
});

describe("renderJournalDay / parseJournalDayFile", () => {
  it("渲染包含文件标记、日期标题与条目头+注释元数据", () => {
    const md = renderJournalDay("2026-10-09", [e()]);
    expect(md).toContain(`<!-- wrisp:journal {"format":1,"date":"2026-10-09"} -->`);
    expect(md).toContain("<!-- wrisp:entry {");
    expect(md).toContain("\"id\":\"e1\"");
    expect(md).toMatch(/\*\*\d{2}:\d{2}\*\*/);
  });

  it("确定性：同输入两次渲染字节一致", () => {
    const a = renderJournalDay("2026-10-09", [e(), e({ id: "e2", occurred_at: "2026-10-09T02:00:00.000Z" })]);
    const b = renderJournalDay("2026-10-09", [e(), e({ id: "e2", occurred_at: "2026-10-09T02:00:00.000Z" })]);
    expect(a).toBe(b);
  });

  it("渲染→解析往返：条目集字段一致", () => {
    const entries = [e(), e({ id: "e2", content: "#标签 与 &[星际回声 计划]\n第二段落", source: "mobile", type: "voice" })];
    const md = renderJournalDay("2026-10-09", entries);
    const parsed = parseJournalDayFile("2026-10-09", md);
    expect(parsed.map((p) => p.id)).toEqual(["e1", "e2"]);
    expect(parsed[1].content).toBe(entries[1].content);
    expect(parsed[1].source).toBe("mobile");
    expect(parsed[1].updated_at).toBe(entries[1].updated_at);
  });

  it("转义规则1：正文中整行时间戳被 \\ 前缀保护，解析还原且不产生新条目", () => {
    const md = renderJournalDay("2026-10-09", [e({ content: "计划表：\n**09:30**\n09:45\n完毕" })]);
    expect(md).toContain("\\**09:30**");
    expect(md).toContain("\\09:45");
    const parsed = parseJournalDayFile("2026-10-09", md);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe("计划表：\n**09:30**\n09:45\n完毕");
  });

  it("转义规则2：正文含 wrisp:entry 字面量被 \\ 前缀保护", () => {
    const tricky = "注释样例 <!-- wrisp:entry {} --> 结束";
    const parsed = parseJournalDayFile("2026-10-09", renderJournalDay("2026-10-09", [e({ content: tricky })]));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe(tricky);
  });

  it("转义规则3：代码围栏内的时间戳行不转义、解析不切分", () => {
    const body = "示例：\n```text\n09:30 standup\n```\n结束";
    const md = renderJournalDay("2026-10-09", [e({ content: body })]);
    expect(md).toContain("09:30 standup"); // 围栏内不加 \
    const parsed = parseJournalDayFile("2026-10-09", md);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe(body);
  });

  it("旧格式兼容：裸时间戳行、**09:30**、[[09:30]] 都成为推断条目（确定性 id 幂等）", () => {
    const legacy = "# 2026-10-08\n\n09:30\n晨会纪要\n\n**10:15**\n咖啡\n\n[[11:00]]\n读完一章\n";
    const parsed = parseJournalDayFile("2026-10-08", legacy);
    expect(parsed).toHaveLength(3);
    expect(parsed.map((p) => p.has_meta)).toEqual([false, false, false]);
    expect(parsed.map((p) => p.source)).toEqual(["import", "import", "import"]);
    expect(parsed[0].occurred_at).toBe("2026-10-08T09:30:00");
    const again = parseJournalDayFile("2026-10-08", legacy);
    expect(again.map((p) => p.id)).toEqual(parsed.map((p) => p.id)); // UUIDv5 风格确定性 id → 重复导入幂等
  });

  it("整篇无时间戳行 → 全文一条", () => {
    const parsed = parseJournalDayFile("2026-10-08", "今天随手记，没有任何时间戳。\n第二段。\n");
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe("今天随手记，没有任何时间戳。\n第二段。");
    expect(parsed[0].occurred_at).toBe("2026-10-08T00:00:00");
  });

  it("inferEntryId 生成合法 8-4-4-4-12 且内容不同 id 不同", () => {
    const a = inferEntryId("2026-10-08", "2026-10-08T09:30:00", "x");
    const b = inferEntryId("2026-10-08", "2026-10-08T09:30:00", "y");
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/unit/main/journal-render.test.ts` → FAIL

- [ ] **Step 3: 实现**

`src/main/core/services/content/journal/journal-render.ts`（完整实现要点，函数体按此写）：

```ts
import { NodeCryptoUtil } from "@/main/utils";
import { TimeUtil } from "@/shared/utils";
import type { JournalEntryRow } from "@/main/types/db";

/** 文件级标记与条目注释（spec §5.2；未知 JSON 键解析时忽略 → 向前兼容） */
export const JOURNAL_FILE_FORMAT = 1;

const DAY_MARKER_RE = /^\s*<!--\s*wrisp:journal\s+(\{.*\})\s*-->\s*$/;
const ENTRY_META_RE = /^\s*<!--\s*wrisp:entry\s+(\{.*\})\s*-->\s*$/;
const CODE_FENCE_RE = /^\s*(`{3,}|~{3,})/;
/** 条目头三种形态：加粗（可带日期）、[[HH:mm]]（可带日期）、裸时间戳。整行锚定。 */
const HEADER_BOLD_RE =
  /^\s*\*\*(?:(\d{4}-\d{2}-\d{2})[ T])?(\d{1,2}:\d{2})(?::(\d{2}))?\*\*\s*$/;
const HEADER_WIKI_RE =
  /^\s*\[\[(?:(\d{4}-\d{2}-\d{2})[ T])?(\d{1,2}:\d{2})(?::(\d{2}))?\]\]\s*$/;
const HEADER_BARE_RE =
  /^\s*(?:(\d{4}-\d{2}-\d{2})[ T])?(\d{1,2}:\d{2})(?::(\d{2}))?\s*$/;

export interface JournalEntryRowLike {
  id: string; occurred_at: string; source: string; type: string;
  content: string; attachments: string[] | null; metadata: Record<string, unknown> | null;
  updated_at: string;
}
export interface ParsedJournalEntry {
  id: string; occurred_at: string; source: string; type: string;
  updated_at: string | null; content: string;
  attachments: string[] | null; metadata: Record<string, unknown> | null;
  has_meta: boolean;
}

/** 转义/解析共用的头识别：返回头时间三元信息或 null（行首 \ 视为转义不算头） */
function matchHeader(line: string): { hh: string; mm: string; ss: string | null } | null {
  if (line.startsWith("\\")) return null;
  for (const re of [HEADER_BOLD_RE, HEADER_WIKI_RE, HEADER_BARE_RE]) {
    const m = re.exec(line);
    if (m) return { hh: m[2].slice(0, 2), mm: m[3 - 1] ?? m[2] ? "" : "", ss: null };
  }
  return null;
}
```

> ⚠️ 上面 `matchHeader` 是示意；实现按显式分组写：对三个正则各取 `(?:日期)? 时间`，`m = bold.exec(line)` 命中则 `time = m[2]`、`ss = m[3] ?? null`；wiki/bare 同理。三处返回统一 `{ time: "HH:mm"|"H:mm", sec: string|null }`。

核心函数：

```ts
/** 标记代码围栏内的行下标（照抄 structure.ts:28-46 的 markCodeFenceLines 逻辑） */
function markCodeFenceLines(lines: string[]): Set<number> { /* 同 structure.ts 实现 */ }

function needsEscape(line: string): boolean {
  return matchHeader(line) !== null || ENTRY_META_RE.test(line);
}

/** 正文行渲染：围栏外、需转义的行加 \ 前缀；围栏内原样 */
function escapeBodyLine(line: string, insideFence: boolean): string {
  if (insideFence) return line;
  return needsEscape(line) ? `\\${line}` : line;
}
function unescapeBodyLine(line: string): string {
  if (!line.startsWith("\\")) return line;
  const rest = line.slice(1);
  return matchHeader(rest) !== null || ENTRY_META_RE.test(rest) ? rest : line;
}

export function localTimeHeader(occurredAtIso: string): string {
  return TimeUtil.format(occurredAtIso, "HH:mm");
}

export function inferEntryId(date: string, occurredAt: string, content: string): string {
  const hash = NodeCryptoUtil.sha256(`${date}|${occurredAt}|${content}`);
  const h = hash.replace(/-/g, "");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `5${h.slice(13, 16)}`,
    `a${h.slice(17, 20)}`,
    h.slice(20, 32),
  ].join("-");
}

export function renderJournalDay(date: string, entries: JournalEntryRowLike[]): string {
  const sorted = [...entries].sort(
    (a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.id.localeCompare(b.id),
  );
  const parts: string[] = [
    `<!-- wrisp:journal {"format":${JOURNAL_FILE_FORMAT},"date":"${date}"} -->`,
    `# ${date}`,
  ];
  for (const entry of sorted) {
    const payload: Record<string, unknown> = {
      id: entry.id, at: entry.occurred_at, src: entry.source, type: entry.type, u: entry.updated_at,
    };
    if (entry.attachments) payload.att = entry.attachments;
    if (entry.metadata) payload.meta = entry.metadata;
    const bodyLines = entry.content.split("\n");
    const fences = markCodeFenceLines(bodyLines);
    const body = bodyLines
      .map((l, i) => escapeBodyLine(l, fences.has(i)))
      .join("\n");
    parts.push(`**${localTimeHeader(entry.occurred_at)}**\n<!-- wrisp:entry ${JSON.stringify(payload)} -->\n${body}`);
  }
  return `${parts.join("\n\n")}\n`;
}

export function parseJournalDayFile(date: string, markdown: string): ParsedJournalEntry[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const fences = markCodeFenceLines(lines);
  const out: ParsedJournalEntry[] = [];
  let i = 0;
  // 跳过文件标记与 H1 标题（不属于任何条目）
  for (; i < lines.length; i++) {
    if (fences.has(i)) continue;
    if (DAY_MARKER_RE.test(lines[i])) continue;
    if (/^\s*#\s/.test(lines[i])) continue;
    break;
  }
  while (i < lines.length) {
    const header = fences.has(i) ? null : matchHeader(lines[i]);
    if (!header) {
      // 头部之前的散落正文 → 归为一条推断条目
      const orphanStart = i;
      while (i < lines.length && !(fences.has(i) ? false : matchHeader(lines[i]))) i++;
      const body = lines.slice(orphanStart, i).join("\n").trim();
      if (body) out.push(importInferred(date, `${date}T00:00:00`, unescapeBody(body)));
      continue;
    }
    const occurredAt = `${date}T${pad2(header.hh)}:${header.mm}${header.sec ? `:${header.sec}` : ":00"}`;
    let j = i + 1;
    let meta: Record<string, unknown> | null = null;
    if (j < lines.length && !fences.has(j) && !lines[j].startsWith("\\") && ENTRY_META_RE.test(lines[j])) {
      try { meta = JSON.parse(ENTRY_META_RE.exec(lines[j])![1]); } catch { meta = null; }
      if (meta) j++;
    }
    const bodyStart = j;
    while (j < lines.length && !(fences.has(j) ? false : matchHeader(lines[j]))) j++;
    const content = unescapeAll(lines.slice(bodyStart, j).join("\n")).trim();
    if (meta && typeof meta.id === "string") {
      out.push({
        id: meta.id,
        occurred_at: typeof meta.at === "string" ? meta.at : occurredAt,
        source: typeof meta.src === "string" ? meta.src : "import",
        type: typeof meta.type === "string" ? meta.type : "text",
        updated_at: typeof meta.u === "string" ? meta.u : null,
        content,
        attachments: Array.isArray(meta.att) ? (meta.att as string[]) : null,
        metadata: meta.meta && typeof meta.meta === "object" ? (meta.meta as Record<string, unknown>) : null,
        has_meta: true,
      });
    } else if (content) {
      out.push(importInferred(date, occurredAt, content));
    }
    i = j;
  }
  return out;
}

function importInferred(date: string, occurredAt: string, content: string): ParsedJournalEntry {
  return {
    id: inferEntryId(date, occurredAt, content),
    occurred_at: occurredAt, source: "import", type: "text",
    updated_at: null, content, attachments: null, metadata: null, has_meta: false,
  };
}
function pad2(v: string): string { return v.length === 1 ? `0${v}` : v; }
function unescapeAll(text: string): string {
  return text.split("\n").map(unescapeBodyLine).join("\n");
}
```

（实现时把示意代码补全为可编译版本；`JournalEntryRow` 若未用上就改签名用 `JournalEntryRowLike`，别留未用导入。）

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/unit/main/journal-render.test.ts` → PASS（9 用例）

- [ ] **Step 5: 全量校验 + 提交**

Run: `pnpm typecheck && pnpm lint`
```bash
git add src/main/core/services/content/journal tests/unit/main/journal-render.test.ts
git commit -m "feat(journal): 日志文件确定性渲染器与条目格式解析器（往返/转义/旧格式兼容）"
```

---

### Task 5: 切块管线条目化 —— entry_id 全链路 + `journal:chunk-day`

**Files:**
- Modify: `src/main/types/db/chunk.types.ts`（Chunk/ChunkCreate/ChunkUpdate 加 `entry_id`）
- Modify: `src/main/core/db/chunk.dao.ts`（新增 `syncByEntry`）
- Modify: `src/main/core/services/content/chunk.service.ts`（新增 `replaceEntryChunks`）
- Modify: `src/main/core/services/content/chunk-index.service.ts`（`scheduleJournalDay` / `processJournalDay`）
- Modify: `src/main/index.ts`（注册 `journal:chunk-day` handler，`:224` 附近）
- Test: `tests/integration/main/chunk.sync-by-entry.test.ts`

**Interfaces:**
- Consumes: Task 1 `entry_id` 列；Task 3 `JournalEntryDao.listDirtyByDate/recordChunked/listActiveByDate`；`splitDocument`/`collectChunks`/`hasRefineTargets`/`refineDocument`（`chunk-splitter.ts` 现有导出）；`chunkService.dropVectorsByIds`；`FileIndexDao`。
- Produces:

```ts
// chunk-index.service.ts
export const TASK_TYPE_JOURNAL_CHUNK_DAY = "journal:chunk-day";
export function journalChunkDayGroupId(date: string): string; // `journal-chunk-day:${date}`
scheduleJournalDay(date: string): void                          // 5s 静默窗口去抖，键=date
processJournalDay(date: string): Promise<void>                  // 逐脏条目切分→replaceEntryChunks→recordChunked→内联 L3→dropVectors→notifyWikiUpdated
// chunk.service.ts
replaceEntryChunks(entryId: Id, fileId: Id, filePath: string, chunks: SplitChunk[]): ChunkSyncResult
// chunk.dao.ts
syncByEntry(entryId: ChunkId, chunks: ChunkCreate[]): ChunkSyncResult
```

- [ ] **Step 1: 写失败测试（真实内存库测 syncByEntry 差异语义）**

`tests/integration/main/chunk.sync-by-entry.test.ts`（mock connection + logger 模式同 Task 3；init.sql 建全 schema）：

```ts
// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let memDb: Database.Database | null = null;
function mem() {
  if (!memDb) {
    memDb = new Database(":memory:");
    memDb.pragma("foreign_keys = ON");
    memDb.exec(fs.readFileSync(path.resolve(process.cwd(), "src/main/schemas/init.sql"), "utf-8"));
  }
  return memDb;
}
vi.mock("@/main/core/db/connection", () => ({ getDatabase: () => mem(), setWorkspacePath: vi.fn() }));
vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { ChunkDao } from "@/main/core/db/chunk.dao";

const TS = "2026-10-09T01:00:00.000Z";

function seedFileAndEntry(db: Database.Database) {
  db.exec("DELETE FROM file_index; DELETE FROM semantic_chunks; DELETE FROM journal_entries;");
  db.prepare(
    "INSERT INTO file_index (id, file_path, file_hash, created_at, updated_at) VALUES ('f1', 'journal/2026-10-09.md', 'h', ?, ?)",
  ).run(TS, TS);
  db.prepare(
    `INSERT INTO journal_entries (id, date, occurred_at, source, type, content, created_at, updated_at)
     VALUES ('e1', '2026-10-09', ?, 'desktop', 'text', 'x', ?, ?)`,
  ).run(TS, TS, TS);
}

function makeRecord(content: string, hash: string, entryId = "e1") {
  return {
    file_id: "f1", file_path: "journal/2026-10-09.md",
    start_line: 1, end_line: 2, content, content_hash: hash,
    chunk_type: "journal" as const, entry_id: entryId, status: "active" as const,
  };
}

describe("ChunkDao.syncByEntry", () => {
  it("同 hash 复用 id（保留摘要/标记水位线），异 hash 删旧插新", () => {
    seedFileAndEntry(mem());
    const dao = new ChunkDao();
    const first = dao.syncByEntry("e1", [makeRecord("段落A", "hash-a"), makeRecord("段落B", "hash-b")]);
    expect(first.inserted).toBe(2);
    const keptA = dao.query("SELECT * FROM semantic_chunks ORDER BY start_line ASC") as Array<{ id: string; content_hash: string }>;
    // 重切：A 不变、B 改成 C
    const second = dao.syncByEntry("e1", [makeRecord("段落A", "hash-a"), makeRecord("段落C", "hash-c")]);
    expect(second.reused).toBe(1);
    expect(second.inserted).toBe(1);
    expect(second.removedIds).toHaveLength(1);
    const after = dao.query("SELECT content_hash FROM semantic_chunks") as Array<{ content_hash: string }>;
    expect(after.map((r) => r.content_hash).sort()).toEqual(["hash-a", "hash-c"]);
    const reusedRow = dao.findById(keptA[0].id);
    expect(reusedRow?.content_hash).toBe("hash-a"); // 未变块 id 与内容保留
  });

  it("entry 维度删除不越界影响其它 entry/文件的块", () => {
    seedFileAndEntry(mem());
    const dao = new ChunkDao();
    mem().prepare(
      `INSERT INTO journal_entries (id, date, occurred_at, source, type, content, created_at, updated_at)
       VALUES ('e2', '2026-10-09', ?, 'desktop', 'text', 'y', ?, ?)`,
    ).run(TS, TS, TS);
    dao.syncByEntry("e1", [makeRecord("段落A", "hash-a")]);
    dao.syncByEntry("e2", [makeRecord("段落E2", "hash-e2", "e2")]);
    dao.syncByEntry("e1", []);
    const rest = dao.query("SELECT entry_id FROM semantic_chunks") as Array<{ entry_id: string }>;
    expect(rest).toEqual([{ entry_id: "e2" }]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/integration/main/chunk.sync-by-entry.test.ts` → FAIL

- [ ] **Step 3: 实现**

1. `chunk.types.ts`：`Chunk` 增 `/** 条目锚点（0.7.0，仅 chunk_type='journal' 的块填写） */ entry_id: Id | null;`；`ChunkCreate` 增 `entry_id?: Id | null;`；`ChunkUpdate` 增 `entry_id?: Id | null;`。
2. `chunk.dao.ts`：新增 `syncByEntry` —— 完整复制 `syncByFile`（`:303-370`）的多重回配、复用只动行区间不动 content/标记、`removeChunksWithRelations` 收尾的算法，唯一差异是把三处 `file_id = ?` 换为 `entry_id = ?`，签名 `syncByEntry(entryId: ChunkId, chunks: ChunkCreate[]): ChunkSyncResult`；`create(chunk)` 的记录需含 `entry_id`（调用方传入）。注释说明与 syncByFile 的对称关系。
3. `chunk.service.ts` 新增：

```ts
/**
 * 让某条日志条目的语义块与切分结果一致（entry 维度差异同步，spec §7）。
 * file_id/file_path 由调用方传入（当日渲染 .md 的索引行），行号为条目内部行号。
 */
public replaceEntryChunks(
  entryId: Id,
  fileId: Id,
  filePath: string,
  chunks: SplitChunk[],
): ChunkSyncResult {
  const records: ChunkCreate[] = chunks.map((chunk) => ({
    file_id: fileId,
    file_path: filePath,
    start_line: chunk.startLine,
    end_line: chunk.endLine,
    section_title: chunk.sectionTitle,
    content: chunk.content,
    content_hash: chunk.contentHash,
    chunk_type: "journal" as const,
    entry_id: entryId,
    word_count: chunk.wordCount,
    status: "active" as const,
  }));
  return this.chunkDao.syncByEntry(entryId, records);
}
```

4. `chunk-index.service.ts` 新增（不进 pending Map，与 file 调度隔离）：

```ts
export const TASK_TYPE_JOURNAL_CHUNK_DAY = "journal:chunk-day";
export function journalChunkDayGroupId(date: string): string {
  return `journal-chunk-day:${date}`;
}

// class 内：
/** 当日条目切块调度：5s 静默窗口合并连续保存（与 schedule() 同参数语义，键为日期） */
private pendingJournalDays = new Map<string, NodeJS.Timeout>();
public scheduleJournalDay(date: string): void {
  if (!date) return;
  const existing = this.pendingJournalDays.get(date);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    this.pendingJournalDays.delete(date);
    void this.enqueueJournalDay(date);
  }, CHUNK_SILENT_WINDOW_MS);
  timer.unref();
  this.pendingJournalDays.set(date, timer);
}

private async enqueueJournalDay(date: string): Promise<void> {
  const groupId = journalChunkDayGroupId(date);
  try {
    const oldTasks = await taskQueue.getTasksByGroup(groupId);
    for (const task of oldTasks) {
      if (task.status === "pending" || task.status === "running") await taskQueue.cancel(task.id);
    }
    await taskQueue.enqueue({ type: TASK_TYPE_JOURNAL_CHUNK_DAY, payload: { date }, groupId });
  } catch (error) {
    Logger.error("[ChunkIndex] 日志日切块入队失败", { date, error: String(error) });
  }
}

/**
 * 逐脏条目切块（spec §7）：每条独立跑 splitDocument（L1+L2），
 * 长条目在有本地嵌入模型时内联 L3 精修（失败/不可用降级保留 L2），
 * 按 entry_id 差异同步后回写 chunked_at（recordChunked，不刷 updated_at）。
 */
public async processJournalDay(date: string): Promise<void> {
  const entries = this.journalEntryDao.listDirtyByDate(date);
  if (entries.length === 0) return;
  const filePath = `${JOURNAL_DIR}/${date}.md`;
  const fileIndex = this.fileIndexDao.findByFilePath(filePath);
  if (!fileIndex) {
    Logger.warn("[ChunkIndex] 当日日志索引缺失，跳过条目切块", { date });
    return;
  }
  const localReady = await modelRouter.isLocalAvailable();
  const embedder: SentenceEmbedder = async (texts) => (await embedBatch(texts)).map((r) => r.vector);

  for (const entry of entries) {
    let result = splitDocument(entry.content);
    if (localReady && hasRefineTargets(result)) {
      try {
        const refined = await refineDocument(result, embedder, thresholdForChunkType("journal"));
        if (!isSameBoundary(collectChunks(result.segments), refined)) {
          result = { segments: /* 见下：以 refined 数组重建可直接落库形态 */ null, chunks: refined } as never;
        }
      } catch (error) {
        Logger.debug("[ChunkIndex] 条目 L3 精修降级", { entryId: entry.id, error: String(error) });
      }
    }
    const chunks = (result as { chunks?: SplitChunk[]; segments?: ... }).chunks
      ?? collectChunks(result.segments);
    const synced = chunkService.replaceEntryChunks(entry.id, fileIndex.id, fileIndex.file_path, chunks);
    await chunkService.dropVectorsByIds(synced.removedIds);
    this.journalEntryDao.recordChunked(entry.id, new Date().toISOString());
  }
  this.fileIndexDao.updateSyncStatus(fileIndex.id, "synced");
  notifyWikiUpdated();
  Logger.info("[ChunkIndex] 日志条目切块完成", { date, entries: entries.length });
}
```

> 实现注记：`refineDocument` 返回 `SplitChunk[]`（非 SplitResult），上面 `result = {...}` 示意不成立——正确写法：先 `const coarse = splitDocument(entry.content)`，`let chunks = collectChunks(coarse.segments)`；若需精修，`chunks = await refineDocument(coarse, embedder, thresholdForChunkType("journal"))`；再落库。类头部需补 `private journalEntryDao = new JournalEntryDao()` 与 `JOURNAL_DIR` 导入。

5. `src/main/index.ts`（`file:chunk-refine` 注册之后）：

```ts
// 注册日志条目切块处理器（条目化：按日聚合脏条目）
taskExecutor.registerHandler("journal:chunk-day", async (task) => {
  const payload = typeof task.payload === "string" ? JSON.parse(task.payload) : task.payload;
  const { date } = payload ?? {};
  await chunkIndexService.processJournalDay(date);
});
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/integration/main/chunk.sync-by-entry.test.ts` → PASS
再跑既有块测试防回归：`pnpm vitest run tests/unit/main tests/integration/main --dir tests` 中 chunk 相关套件全绿。

- [ ] **Step 5: 全量校验 + 提交**

Run: `pnpm typecheck`（`Chunk` 类型加列后若有构造点缺 `entry_id`，按报错补 `entry_id: null`）
```bash
git add src/main/types/db/chunk.types.ts src/main/core/db/chunk.dao.ts src/main/core/services/content/chunk.service.ts src/main/core/services/content/chunk-index.service.ts src/main/index.ts tests/integration/main/chunk.sync-by-entry.test.ts
git commit -m "feat(chunks): 日志条目按 entry_id 差异切块（syncByEntry/journal:chunk-day 任务）"
```

---

### Task 6: journal.service 条目编排 + api/ipc/preload 新 channel（additive 主链路）

**Files:**
- Modify: `src/main/core/services/content/journal.service.ts`（新增条目方法，旧方法暂留）
- Modify: `src/main/core/apis/journal.api.ts`、`src/main/ipcMain/journal.ipc.ts`
- Modify: `src/main/preload/modules/journal.ts`、`src/main/preload/types/journal.ts`
- Test: `tests/unit/main/journal.service.entries.test.ts`

**Interfaces:**
- Consumes: Task 2/3/4/5 全部产出。
- Produces（Service 对外 + preload `window.electronAPI.journal.*`，Task 7/8/9 依赖）:

```ts
// journal.service.ts 新增（class JournalService）
appendEntry(record: JournalEntryCreatePayload): string
updateEntry(record: JournalEntryUpdatePayload): boolean
deleteEntry(id: Id): boolean
listEntries(date: string): JournalEntryView[]
listRecentDays(days?: number, beforeDate?: string): JournalDayView[]
importDayFile(date: string, overwrite?: boolean): JournalImportResult
resetEntries(): number
// 私有：ensureDayFile(date)（5.1 渲染保护 + 写文件 + 维护 file_index 行与 hash）
//      syncEntryAssociations(entryId, content)（#/&/@ 解析→tagService/characterService/project 解析→replaceAssociations）
// api/ipc channel：journal:appendEntry / updateEntry / deleteEntry / listEntries / listRecentDays / importDayFile；
// journal:resetJournalTable 语义切换为 resetEntries（仍用原 channel 名，返回清除条目数）
```

- [ ] **Step 1: 写失败单测（mock DAO 与外部服务，模式照 `journal-reset-vector-cleanup.test.ts`）**

`tests/unit/main/journal.service.entries.test.ts` 覆盖用例（断言要点列全，测试代码按 vi.mock 模板展开）：

```ts
// @vitest-environment node —— mock 清单：
// @/main/core/db（JournalEntryDao/FileIndexDao/ChunkDao 类桩）、
// @/main/core/services/base/file.service、@/main/core/services/content/chunk-index.service、
// @/main/core/services/content/journal/journal-render（spy renderJournalDay/parseJournalDayFile）、
// @/main/core/services/project/tag.service、@/main/core/services/content/character.service、
// @/main/core/db/tag.dao 与 project.dao（findByName/findByNameLike 桩）、@/main/utils/logger、@/main/utils（NodeCryptoUtil: generateUUID/sha256）
import { journalService } from "@/main/core/services/content/journal.service";

describe("journal.service 条目编排", () => {
  it("appendEntry：缺省 occurredAt 用当前时刻；date 由本地时区派生；create→关联→渲染→调度切块按序发生", () => {
    const id = journalService.appendEntry({ content: "晨记 #思考 &作品A" });
    expect(entryCreateMock).toHaveBeenCalled();
    expect(assocMock).toHaveBeenCalled();          // replaceAssociations 经 ensure 的 tag/project 解析
    expect(renderDayFileMock).toHaveBeenCalled();   // ensureDayFile 触发 writeFile
    expect(scheduleJournalDayMock).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(typeof id).toBe("string");
  });

  it("appendEntry 空内容抛错（trim 后为空）", () => {
    expect(() => journalService.appendEntry({ content: "   " })).toThrow();
  });

  it("updateEntry：不存在 id 返回 false；成功时刷内容并重新关联、重渲染", () => { /* ... */ });

  it("deleteEntry：软删除 + 清关联 + 重渲染 + 调度（切块任务里删除该 entry 的块）", () => {
    expect(entryDao.softDeleteMock).toHaveBeenCalled();
    expect(entryDao.replaceAssociationsMock).toHaveBeenCalledWith(expect.any(String), [], [], expect.any(String));
  });

  it("渲染保护（5.1）：当日无条目且 .md 非空 → 不写文件；条目非空 → 写", () => {
    fileExistsMock.mockReturnValue(true); fileReadMock.mockReturnValue("旧整篇日志");
    listActiveMock.mockReturnValue([]);
    journalService["ensureDayFile"]("2026-10-08");
    expect(writeFileMock).not.toHaveBeenCalled();
    listActiveMock.mockReturnValue([fakeRow()]);
    journalService["ensureDayFile"]("2026-10-08");
    expect(writeFileMock).toHaveBeenCalled();
    // file_index 行：不存在则 create（hash/size/date），存在则 update hash
  });

  it("importDayFile：当日已有条目且 overwrite=false → 全部 skipped；解析结果 upsert 走 id 对比（tombstone 跳过、u 新才更新、无 id 插入）", () => { /* 三种分支各一断言 */ });

  it("importDayFile 成功后走与 append 相同的后置管线（关联重建 + 渲染接管 + 调度）", () => { /* ... */ });

  it("listRecentDays：今天始终在结果里（空条目）；has_legacy_file 来自 DAO；结果按日期 DESC", () => { /* ... */ });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/unit/main/journal.service.entries.test.ts` → FAIL

- [ ] **Step 3: 实现 Service（journal.service.ts 追加，方法体核心逻辑）**

关键实现（其余按测试断言补全；`Json` 列在此层序列化）：

```ts
import type {
  JournalEntryCreatePayload, JournalEntryUpdatePayload, JournalEntryView,
  JournalDayView, JournalImportResult, Id,
} from "@/shared/types";
import { JournalEntryDao } from "@/main/core/db";
import { parseEntryTokens } from "./journal/journal-entry.tokens";
import { renderJournalDay, parseJournalDayFile } from "./journal/journal-render";
import { tagService } from "@/main/core/services/project/tag.service";
import { characterService } from "@/main/core/services/content/character.service";
import { ProjectDao } from "@/main/core/db";

// class 内新增字段：
private journalEntryDao = new JournalEntryDao();
private projectDao = new ProjectDao();

appendEntry(record: JournalEntryCreatePayload): string {
  const content = (record.content ?? "").trim();
  if (content === "") throw new Error("日志条目内容不能为空");
  const occurredAt = record.occurredAt || new Date().toISOString();
  const date = TimeUtil.format(occurredAt, "YYYY-MM-DD");
  const now = new Date().toISOString();
  const id = this.journalEntryDao.create({
    date, occurred_at: occurredAt,
    source: record.source || "desktop", type: record.type || "text",
    content,
    attachments: record.attachments ? JSON.stringify(record.attachments) : null,
    metadata: record.metadata ? JSON.stringify(record.metadata) : null,
    created_at: now, updated_at: now,
  });
  this.afterEntryWrite(id, date);
  return id;
}

private afterEntryWrite(entryId: string, date: string): void {
  this.syncEntryAssociations(entryId, /* 由调用方传 content 亦可 */);
  this.ensureDayFile(date);
  chunkIndexService.scheduleJournalDay(date);
}

private syncEntryAssociations(entryId: string, content: string): void {
  try {
    const tokens = parseEntryTokens(content);
    const now = new Date().toISOString();
    if (tokens.tags.length > 0) {
      tagService.createTags(tokens.tags.map((name) => ({ name })));
    }
    const tagIds = this.journalEntryDao.findTagIdsByNames(tokens.tags).map((r) => r.id);
    const projectIds = this.journalEntryDao
      .findProjectIdsByNames(tokens.projects)  // 先精确，再按名模糊取首个
      .map((r) => r.id);
    if (tokens.characters.length > 0) {
      characterService.upsertByName(tokens.characters, { type: "contact" });
    }
    this.journalEntryDao.replaceAssociations(entryId, tagIds, projectIds, now);
  } catch (error) {
    Logger.error("同步日志条目关联失败", { error: String(error), entryId });
  }
}

/** spec §5.1 渲染保护 + file_index 行维护 */
private ensureDayFile(date: string): void {
  const filePath = this.getJournalFilePath(date);
  const entries = this.journalEntryDao.listActiveByDate(date);
  if (entries.length === 0 && fileService.exists(filePath)) {
    const existing = fileService.readFile(filePath);
    if (existing && existing.trim() !== "") return; // 旧版整篇日志：绝不覆盖
  }
  const md = renderJournalDay(date, entries.map((row) => ({
    id: row.id, occurred_at: row.occurred_at, source: row.source, type: row.type,
    content: row.content,
    attachments: row.attachments ? JSON.parse(row.attachments) : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    updated_at: row.updated_at,
  })));
  fileService.writeFile(filePath, md);
  const info = fileService.getFileInfo(filePath);
  const now = new Date().toISOString();
  const index = this.fileIndexDao.findByFilePath(filePath);
  if (index) {
    this.fileIndexDao.update(index.id, {
      file_hash: info?.hash || "", file_size: info?.size || 0,
      updated_at: info?.modifiedAt || now, sync_status: "pending",
    });
  } else {
    this.fileIndexDao.create({
      id: NodeCryptoUtil.generateUUID(), file_path: filePath,
      file_hash: info?.hash || "", file_size: info?.size || 0,
      date, name: `${date}.md`, updated_at: info?.modifiedAt || now, sync_status: "pending",
    });
  }
}

importDayFile(date: string, overwrite = false): JournalImportResult {
  const result: JournalImportResult = { imported: 0, updated: 0, skipped: 0 };
  const filePath = this.getJournalFilePath(date);
  if (!fileService.exists(filePath)) return result;
  const parsed = parseJournalDayFile(date, fileService.readFile(filePath));
  const existingRows = this.journalEntryDao.listAllByDate(date);
  const existingActive = existingRows.filter((r) => !r.deleted_at);
  if (existingActive.length > 0 && !overwrite) {
    result.skipped = parsed.length;
    return result;
  }
  const byId = new Map(existingRows.map((r) => [r.id, r]));
  for (const p of parsed) {
    const current = byId.get(p.id);
    if (!current) {
      const now = new Date().toISOString();
      this.journalEntryDao.create({
        id: p.id, date, occurred_at: p.occurred_at, source: p.source, type: p.type,
        content: p.content,
        attachments: p.attachments ? JSON.stringify(p.attachments) : null,
        metadata: p.metadata ? JSON.stringify(p.metadata) : null,
        created_at: now, updated_at: p.updated_at || now,
      });
      this.syncEntryAssociations(p.id, p.content);
      result.imported += 1;
    } else if (current.deleted_at) {
      result.skipped += 1; // tombstone 优先：导入不复活
    } else if (p.updated_at && p.updated_at > current.updated_at) {
      this.journalEntryDao.update(p.id, { content: p.content, occurred_at: p.occurred_at, updated_at: p.updated_at });
      this.syncEntryAssociations(p.id, p.content);
      result.updated += 1;
    } else if (!p.has_meta && p.content !== current.content) {
      // 推断条目内容变了（旧文件被手工编辑）：按确定性 id 收敛为一次更新
      this.journalEntryDao.update(p.id, { content: p.content });
      this.syncEntryAssociations(p.id, p.content);
      result.updated += 1;
    } else {
      result.skipped += 1;
    }
  }
  if (result.imported > 0 || result.updated > 0) {
    this.ensureDayFile(date);
    chunkIndexService.scheduleJournalDay(date);
  }
  return result;
}

listRecentDays(days = 3, beforeDate?: string): JournalDayView[] {
  const dates = this.journalEntryDao.listActiveDates(days + 1, beforeDate);
  const today = TimeUtil.getLocalDateString();
  const windowStart = /* beforeDate ?? dates[days] ?? 最早日：取本窗口内最小日期，无则 today */;
  const legacy = this.journalEntryDao.listLegacyDates(1000)
    .filter((d) => d < (beforeDate || today) && d >= windowStart);
  const merged = [...new Set([...dates, ...legacy, today])];
  return this.journalEntryDao.assembleViews(
    merged.sort((a, b) => b.localeCompare(a)).slice(0, days + 1),
  );
}
```

> 实现注记：`listRecentDays` 的窗口计算以"取回条目日 → 合并 legacy/today → 排序截断"为准，简单做法：`dates = union(entryDates(days+1), legacy.slice(0, days+1), [today])`，DESC 排序后 `slice(0, days+1)`；`assembleViews(dates.slice(0, days+1))`。beforeDate 翻页时透传给 `listActiveDates`。另 `updateEntry/deleteEntry`：update 取行→merge `content/occurred_at`（改 occurred_at 时重算 `date` 并保证 `afterEntryWrite` 对**新旧两个日期各调一次 ensureDayFile**）；delete 走 `softDelete + replaceAssociations(id, [], [], now) + ensureDayFile + scheduleJournalDay`。`syncEntryAssociations` 签名固定为 `(entryId, content)`，`afterEntryWrite` 传入 content。

`journal-entry.tokens.ts`（新文件，Task 6 引用）：

```ts
import { extractTagNames, extractCharacterNames, extractProjectNames } from "@/shared/utils/text-tokens";

export interface EntryTokens { tags: string[]; projects: string[]; characters: string[] }

/** 聚合解析条目正文的三种行内记号（#标签 / &作品 / @人物） */
export function parseEntryTokens(content: string): EntryTokens {
  return {
    tags: extractTagNames(content),
    projects: extractProjectNames(content),
    characters: extractCharacterNames(content),
  };
}
```

**api/ipc/preload 追加（四层同文件，旧函数保留）**：新函数 `appendEntry/updateEntry/deleteEntry/listEntries/listRecentDays/importDayFile` 走 `response.success/error`，错误码复用 `ErrorCode.JOURNAL_CREATE_FAILED / JOURNAL_UPDATE_FAILED / JOURNAL_DELETE_FAILED / JOURNAL_GET_FAILED / JOURNAL_QUERY_FAILED`；ipc 处理器逐一 `ipcMain.handle("journal:appendEntry", ...)` 等 6 个；preload module/type 各加 6 个方法（签名与 api 一致）。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/unit/main/journal.service.entries.test.ts` → PASS

- [ ] **Step 5: 全量校验 + 提交**

Run: `pnpm typecheck && pnpm test`
```bash
git add src/main/core/services/content src/main/core/apis/journal.api.ts src/main/ipcMain/journal.ipc.ts src/main/preload tests/unit/main/journal.service.entries.test.ts
git commit -m "feat(journal): 条目编排服务与新 IPC channel（append/update/delete/list/import，additive）"
```

---

### Task 7: `project:searchByName` 四层（composer `&` 下拉数据源）

**Files:**
- Modify: `src/main/core/apis/project.api.ts`、`src/main/ipcMain/project.ipc.ts`、`src/main/preload/modules/project.ts`、`src/main/preload/types/project.ts`

**Interfaces:**
- Consumes: 现成 `ProjectDao.findByNameLike(name): Project[]`（`project.dao.ts:135`）。
- Produces: channel `project:searchByName`，入参 `name: string`，返回 `ApiResponse<Array<{ id: string; name: string }>>`；preload `window.electronAPI.project.searchByName(name)`。Task 9 composer 依赖。

- [ ] **Step 1: 实现（无独立测试，类型检查 + Task 9 手测覆盖）**

api 追加（模式照现有函数）：

```ts
async function searchProjectsByName(name: string): Promise<ApiResponse<Array<{ id: string; name: string }>>> {
  try {
    const projects = projectService.searchByName(name); // 若 project.service 无此方法则在 api 层直接 new ProjectDao().findByNameLike(name)
    return response.success(projects.map((p) => ({ id: p.id, name: p.name })));
  } catch (error) {
    Logger.error("按名称检索作品失败", { error: String(error), name });
    return response.error(ErrorCode.PROJECT_GET_FAILED, error as Error); // 若无恰适错误码，用 ErrorCode.COMMON_QUERY_ERROR 类既有条目
  }
}
```

ipc 追加 `ipcMain.handle("project:searchByName", (_, name: string) => searchProjectsByName(name));`；preload module 与 type 各加 `searchByName(name: string)`。（先 `grep -n "searchByName" src/main/core/services/project/project.service.ts` 确认缺口，缺则走 `projectService` 内加薄方法 `searchByName(name) => projectDao.findByNameLike(name)`，保持四层不穿透 DAO 的惯例。）

- [ ] **Step 2: 校验 + 提交**

Run: `pnpm typecheck && pnpm lint`
```bash
git add src/main/core/apis/project.api.ts src/main/ipcMain/project.ipc.ts src/main/preload src/main/core/services/project
git commit -m "feat(project): 新增 project:searchByName 供日志条目作品检索"
```

---

### Task 8: 渲染层 store/composable（additive 新状态与动作）

**Files:**
- Modify: `src/renderer/store/journal.store.ts`、`src/renderer/composables/useJournal.ts`
- Test: `tests/unit/renderer/journal.store.test.ts`

**Interfaces:**
- Consumes: Task 6 preload 新方法；Task 2 `JournalDayView/JournalEntryView/JournalEntryCreatePayload` 等。
- Produces（Task 9 依赖）:

```ts
// store 新增（旧 state/方法保留至 Task 10）
const days = ref<JournalDayView[]>([]);
const daysLoading = ref(false);
const loadingMoreDays = ref(false);
const hasMoreDays = ref(true);
loadRecentDays(days?: number): Promise<void>
loadMoreDays(): Promise<boolean>           // beforeDate=现有最早日期，追加合并去重
appendEntry(payload: JournalEntryCreatePayload): Promise<string | null>
updateEntry(payload: JournalEntryUpdatePayload): Promise<boolean>
deleteEntryLocal(id: string): void          // 乐观：从 days 中移除
requestDeleteEntry(id: string): Promise<boolean>
requestImportDayFile(date: string, overwrite?: boolean): Promise<JournalImportResult | null>
clearDays(): void
```

（store 动作成功后一律**重新拉取当日**刷新：`const refreshDay = async (date) => { const res = await api.listEntries(date); ... }`——简化实现为先 `loadRecentDays(days.value.length || 5)` 全量刷新；append 路径可本地乐观插入再刷新。）

- [ ] **Step 1: 写失败测试（happy-dom，直接覆写 window mock 的 journal 域）**

`tests/unit/renderer/journal.store.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useJournalStore } from "@/renderer/store/journal.store";
import type { JournalDayView } from "@/shared/types";

const api = {
  appendEntry: vi.fn(), updateEntry: vi.fn(), deleteEntry: vi.fn(),
  listEntries: vi.fn(), listRecentDays: vi.fn(), importDayFile: vi.fn(),
};
Object.defineProperty(window, "electronAPI", {
  configurable: true,
  value: { ...(window as unknown as { electronAPI: unknown }).electronAPI ?? {}, journal: api },
});

const ok = <T,>(data: T) => ({ success: true, data, code: "SUCCESS" as never, timestamp: Date.now() });
const DAY: JournalDayView = { date: "2026-10-09", has_legacy_file: false, entries: [] };

describe("journal.store 条目动作", () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks(); });

  it("loadRecentDays 填充 days 并按响应排序保留", async () => {
    api.listRecentDays.mockResolvedValue(ok([DAY]));
    const store = useJournalStore();
    await store.loadRecentDays(5);
    expect(store.days).toEqual([DAY]);
  });

  it("appendEntry 成功后刷新列表；失败返回 null 并记录 errorCode", async () => {
    api.appendEntry.mockResolvedValue(ok("e1"));
    api.listRecentDays.mockResolvedValue(ok([{ ...DAY, entries: [] }]));
    const store = useJournalStore();
    const id = await store.appendEntry({ content: "x" });
    expect(id).toBe("e1");
    expect(api.listRecentDays).toHaveBeenCalled();
    api.appendEntry.mockResolvedValue({ success: false, data: null, code: "ERROR.JOURNAL.CREATE_FAILED", timestamp: 0 });
    expect(await store.appendEntry({ content: "x" })).toBeNull();
    expect(store.errorCode).not.toBeNull();
  });

  it("loadMoreDays 用 beforeDate 翻页并把新日期追加、同日期合并去重", async () => {
    const store = useJournalStore();
    store.days = [{ date: "2026-10-09", has_legacy_file: false, entries: [] }];
    api.listRecentDays.mockResolvedValue(ok([
      { date: "2026-10-09", has_legacy_file: false, entries: [] },
      { date: "2026-10-08", has_legacy_file: true, entries: [] },
    ]));
    const added = await store.loadMoreDays();
    expect(api.listRecentDays).toHaveBeenCalledWith(expect.any(Number), "2026-10-09");
    expect(store.days.map((d) => d.date)).toEqual(["2026-10-09", "2026-10-08"]);
    expect(added).toBe(true);
  });

  it("requestDeleteEntry 成功后本地移除", async () => {
    const store = useJournalStore();
    store.days = [{ date: "d1", has_legacy_file: false, entries: [
      { id: "e1", date: "d1", occurred_at: "", source: "desktop", type: "text", content: "", chunked_at: null, created_at: "", updated_at: "", deleted_at: null, tags: [], projects: [] },
    ] }];
    api.deleteEntry.mockResolvedValue(ok(true));
    const done = await store.requestDeleteEntry("e1");
    expect(done).toBe(true);
    expect(store.days[0].entries).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/unit/renderer/journal.store.test.ts` → FAIL

- [ ] **Step 3: 实现 store/composable 追加**（代码按测试断言语义写；`useJournal.ts` 把新增项原样透出并保留旧透出）

- [ ] **Step 4: 跑测试确认通过** → PASS

- [ ] **Step 5: `pnpm typecheck && pnpm lint` + 提交**

```bash
git add src/renderer/store/journal.store.ts src/renderer/composables/useJournal.ts tests/unit/renderer/journal.store.test.ts
git commit -m "feat(renderer): journal store 条目化状态与动作（days/append/update/delete/import）"
```

---

### Task 9: UI —— Composer / EntryItem / 日容器 / JournalView + i18n

**Files:**
- Create: `src/renderer/components/editor/containers/JournalEntryComposer.vue`
- Create: `src/renderer/components/editor/containers/JournalEntryItem.vue`
- Modify: `src/renderer/components/editor/containers/JournalBlock.vue`（重写为日容器）
- Modify: `src/renderer/views/JournalView.vue`（days 数据源 + 导入入口 + 滚动策略）
- Modify: `src/shared/i18n/locales/enUS.ts`、`zhCN.ts`

**Interfaces:**
- Consumes: Task 8 composable 全量；Task 2 类型；`useTag().findTags`（标签提示仅用本地解析结果，不必查库）；`window.electronAPI.project.searchByName`（Task 7）。

**i18n 新增 key（`TIPS.JOURNAL` 对象内，两语言各一份）：**

```ts
// zhCN
APPEND_PLACEHOLDER: "记一条…（Ctrl+Enter 追加）  #标签  &作品  @人物",
APPEND_ACTION: "追加",
ENTRY_TAGS_LABEL: "标签",
ENTRY_PROJECTS_LABEL: "作品",
ENTRY_PROJECT_UNMATCHED: "未匹配作品",
ENTRY_SOURCE: { DESKTOP: "桌面", MOBILE: "移动", IMPORT: "导入" },
ENTRY_EDIT_PLACEHOLDER: "编辑条目内容",
ENTRY_SAVE: "保存",
ENTRY_CANCEL: "取消",
ENTRY_DELETE: "删除",
ENTRY_DELETE_CONFIRM: "删除该条日志？（可在回收中找回前的版本不含）",  // 正式文案：删除该条日志？删除后不可恢复。
IMPORT_FILE: "导入此文件",
IMPORT_RESULT: "导入完成：新增 {imported} 条，更新 {updated} 条，跳过 {skipped} 条",
LEGACY_HINT: "检测到旧版整篇日志，导入后将由条目接管渲染",
// enUS 对应英文一份
```

- [ ] **Step 1: `JournalEntryItem.vue`**

```vue
<template>
  <div class="journal-entry-item" :class="{ editing }">
    <div class="entry-meta">
      <span class="entry-time">{{ displayTime }}</span>
      <n-tag size="small" :bordered="false" type="default">
        {{ t(`TIPS.JOURNAL.ENTRY_SOURCE.${entry.source.toUpperCase()}`) }}
      </n-tag>
      <n-tag v-for="tag in entry.tags" :key="tag.id" size="tiny" :bordered="false">#{{ tag.name }}</n-tag>
      <n-tag v-for="p in entry.projects" :key="p.id" size="tiny" :bordered="false" type="info">&{{ p.name }}</n-tag>
      <span class="entry-actions" v-if="!editing">
        <n-button text size="tiny" @click="startEdit">{{ t("TIPS.JOURNAL.ENTRY_EDIT_PLACEHOLDER").slice(0, 0) || "" }}</n-button>
      </span>
    </div>
    <template v-if="!editing">
      <div class="entry-content" v-html="renderedContent" @dblclick="startEdit"></div>
      <div class="entry-toolbar">
        <n-button text size="tiny" @click="startEdit">{{ t("ACTION.COMMON.EDIT") }}</n-button>
        <n-button text size="tiny" type="error" @click="confirmDelete">{{ t("TIPS.JOURNAL.ENTRY_DELETE") }}</n-button>
      </div>
    </template>
    <template v-else>
      <n-input
        v-model:value="draft"
        type="textarea"
        :autosize="{ minRows: Math.min(2, draftLines), maxRows: 12 }"
        :placeholder="t('TIPS.JOURNAL.ENTRY_EDIT_PLACEHOLDER')"
      />
      <n-flex justify="end" class="edit-actions">
        <n-button size="tiny" quaternary @click="cancelEdit">{{ t("TIPS.JOURNAL.ENTRY_CANCEL") }}</n-button>
        <n-button size="tiny" type="primary" :disabled="draft.trim() === ''" @click="saveEdit">{{ t("TIPS.JOURNAL.ENTRY_SAVE") }}</n-button>
      </n-flex>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useDialog } from "naive-ui";
import type { JournalEntryView } from "@/shared/types";
import { TimeUtil } from "@/shared/utils";
import { sanitizeHtml } from "@/renderer/utils/sanitize";
import { useJournal } from "@/renderer/composables/useJournal";

const props = defineProps<{ entry: JournalEntryView }>();

const { t } = useI18n();
const dialog = useDialog();
const { updateEntry, requestDeleteEntry } = useJournal();

const editing = ref(false);
const draft = ref("");
const draftLines = computed(() => Math.max(1, draft.value.split("\n").length));
const displayTime = computed(() => TimeUtil.format(props.entry.occurred_at, "HH:mm"));

// 只读正文：无第三方 markdown 依赖的最小渲染——转 <br> 前先整体 HTML 转义再过 sanitizeHtml 白名单
const renderedContent = computed(() =>
  sanitizeHtml(props.entry.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")),
);

function startEdit() { draft.value = props.entry.content; editing.value = true; }
function cancelEdit() { editing.value = false; }
async function saveEdit() {
  const okd = await updateEntry({ id: props.entry.id, content: draft.value });
  if (okd) editing.value = false;
}
function confirmDelete() {
  dialog.warning({
    title: t("TIPS.JOURNAL.ENTRY_DELETE"),
    content: t("TIPS.JOURNAL.ENTRY_DELETE_CONFIRM"),
    positiveText: t("ACTION.COMMON.CONFIRM"),
    negativeText: t("ACTION.COMMON.CANCEL"),
    onPositiveClick: () => void requestDeleteEntry(props.entry.id),
  });
}
</script>
```

> 实现注记：① 模板里那个 `t(...).slice(0,0)` 占位按钮是草稿残留，删除之（编辑/删除按钮已在工作区）；② 先 grep `src/renderer/utils/sanitize.ts` 与既有 markdown 渲染用法（如 `marked`），若项目已有 markdown→HTML 工具则替换 `renderedContent` 为 `sanitizeHtml(mdToHtml(content))`——**禁止 v-html 不过 sanitize**。③ `ACTION.COMMON.EDIT/CONFIRM/CANCEL` 等既有 key 需 grep locales 确认存在，缺则补一份。

- [ ] **Step 2: `JournalEntryComposer.vue`**

```vue
<template>
  <div class="journal-entry-composer">
    <n-input
      v-model:value="draft"
      type="textarea"
      :autosize="{ minRows: 2, maxRows: 12 }"
      :placeholder="t('TIPS.JOURNAL.APPEND_PLACEHOLDER')"
      @keydown="onKeydown"
      @update:value="onInput"
    />
    <!-- & 作品候选下拉 -->
    <div v-if="projectCandidates.length" class="project-candidates">
      <div
        v-for="p in projectCandidates"
        :key="p.id"
        class="candidate-item"
        @mousedown.prevent="pickProject(p.name)"
      >&{{ p.name }}</div>
    </div>
    <!-- 底部提示区：解析出的标签/作品，未匹配高亮 -->
    <div class="composer-hints">
      <template v-if="hintTags.length">
        <span class="hint-label">{{ t("TIPS.JOURNAL.ENTRY_TAGS_LABEL") }}：</span>
        <n-tag v-for="n in hintTags" :key="n" size="tiny" :bordered="false">#{{ n }}</n-tag>
      </template>
      <template v-if="hintProjects.length">
        <span class="hint-label">{{ t("TIPS.JOURNAL.ENTRY_PROJECTS_LABEL") }}：</span>
        <n-tag
          v-for="n in hintProjects"
          :key="n.name"
          size="tiny"
          :bordered="false"
          :type="n.matched ? 'info' : 'warning'"
        >&{{ n.name }}{{ n.matched ? "" : `（${t("TIPS.JOURNAL.ENTRY_PROJECT_UNMATCHED")}）` }}</n-tag>
      </template>
    </div>
    <n-flex justify="end">
      <n-button
        size="small"
        type="primary"
        :disabled="draft.trim() === '' || submitting"
        :loading="submitting"
        @click="submit"
      >{{ t("TIPS.JOURNAL.APPEND_ACTION") }}</n-button>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useFrontendNotification } from "@/renderer/composables/useNotification";
import { extractTagNames, extractProjectNames } from "@/shared/utils/text-tokens";
import { useJournal } from "@/renderer/composables/useJournal";

const emit = defineEmits<{ (e: "appended"): void }>();

const { t } = useI18n();
const notify = useFrontendNotification();
const { appendEntry } = useJournal();

const draft = ref("");
const submitting = ref(false);
const projectCandidates = ref<Array<{ id: string; name: string }>>([]);
const knownProjects = ref<Set<string>>(new Set());

const hintTags = computed(() => extractTagNames(draft.value));
const hintProjects = computed(() =>
  extractProjectNames(draft.value).map((name) => ({ name, matched: knownProjects.value.has(name) })),
);

let projectSearchTimer: ReturnType<typeof setTimeout> | null = null;

function onInput() {
  // 光标处正在输入的 &token → 防抖 300ms 模糊检索作品
  const m = /&([^\s&\[\]]*)$/.exec(draft.value);
  if (projectSearchTimer) clearTimeout(projectSearchTimer);
  if (!m) { projectCandidates.value = []; return; }
  projectSearchTimer = setTimeout(async () => {
    const res = await window.electronAPI.project.searchByName(m[1]);
    if (res.success && res.data) {
      projectCandidates.value = res.data as Array<{ id: string; name: string }>;
      for (const p of projectCandidates.value) knownProjects.value.add(p.name);
    }
  }, 300);
}

function pickProject(name: string) {
  // 替换尾部进行中的 &token 为选中的作品名（含空格则方括号包裹）
  const wrapped = /\s/.test(name) ? `&[${name}]` : `&${name}`;
  draft.value = draft.value.replace(/&[^\s&\[\]]*$/, `${wrapped} `);
  projectCandidates.value = [];
  knownProjects.value.add(name);
}

function onKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); void submit(); }
}

async function submit() {
  if (submitting.value || draft.value.trim() === "") return;
  submitting.value = true;
  const id = await appendEntry({ content: draft.value });
  submitting.value = false;
  if (id) {
    draft.value = "";
    projectCandidates.value = [];
    emit("appended");
  } else {
    notify.error(t("TIPS.JOURNAL.APPEND_ACTION"));
  }
}
</script>
```

- [ ] **Step 3: `JournalBlock.vue` 重写为日容器**

props 改 `{ day: JournalDayView }`；模板 = 日期头（沿用现有 `displayDate` 逻辑与样式）+ `<JournalEntryComposer v-if="isToday" @appended="() => {}" />` + `v-for` 条目 `<JournalEntryItem :entry="e" />` + `day.has_legacy_file` 时导入按钮：

```vue
<n-alert v-if="day.has_legacy_file" type="info" class="legacy-alert">
  <template #header>{{ t("TIPS.JOURNAL.LEGACY_HINT") }}</template>
  <n-button size="small" type="primary" :loading="importing" @click="doImport">
    {{ t("TIPS.JOURNAL.IMPORT_FILE") }}
  </n-button>
</n-alert>
```

```ts
async function doImport() {
  importing.value = true;
  const res = await requestImportDayFile(props.day.date);
  importing.value = false;
  if (res) notify.success(t("TIPS.JOURNAL.IMPORT_RESULT", { imported: res.imported, updated: res.updated, skipped: res.skipped }));
}
```

删除 TiptapEditor、editContent/防抖/onBeforeUnmount 全部旧逻辑（旧整篇编辑作废；组件内不再有 800ms 保存）。

- [ ] **Step 4: `JournalView.vue` 切换数据源**

`recentJournals` → `days`；`ensureTodayJournal` 整个删除（今日空条目也渲染——`listRecentDays` 后端保证今日必在）；`loadMoreJournals` 调 `loadMoreDays()`；workspace watch 改调 `clearDays()` + `loadRecentDays(5)`；"加载/覆盖"dialog 删除（旧文件询问逻辑移除，legacy 日容器自带导入按钮）。

- [ ] **Step 5: i18n 两 locale 补 key**（`TIPS.JOURNAL` 对象内追加上述键值；插值文案用 `{imported}` vue-i18t 复数/插值语法）

- [ ] **Step 6: 手动走查（UI 变更必须真机验证）**

Run: `pnpm dev`，逐项检查并记录结果：
1. 今日 composer：输入 `#测试 记一条 &某作品名`，底部提示区实时出现标签与作品（未匹配标注黄）；`&` 后弹出候选、点选回填。
2. Ctrl+Enter 追加成功、输入框清空、当日条目刷新显示（meta 行：时间 + 桌面徽标 + 标签 + 作品）。
3. 双击/编辑历史条目 → 保存生效，`.md` 文件同步更新为 `**HH:mm**` + 注释头格式；输入框高度随内容增长且 minRows=2。
4. 删除条目 → 确认弹窗 → 条目消失、文件重渲染。
5. 造一个无条目的旧 `journal/2026-10-08.md`（手写内容）→ 时间线出现该日 + 导入按钮 → 导入 → toast 计数正确、旧文件被条目接管（重渲染为新格式）。
6. Wiki 页回链 journal 块跳转不报错（行区间兜底路径）。

Expected: 全部通过；任何一条不过 → 修复后重跑本步。

- [ ] **Step 7: 校验 + 提交**

Run: `pnpm typecheck && pnpm lint`
```bash
git add src/renderer/components/editor/containers src/renderer/views/JournalView.vue src/shared/i18n
git commit -m "feat(ui): 日志条目化 UI（composer 记号提示/条目卡片/日容器/导入入口）"
```

---

### Task 10: 旧路径清理 + 全量验证

**Files:**
- Modify: `journal.service.ts`、`journal.api.ts`、`ipcMain/journal.ipc.ts`、`preload/modules|types/journal.ts`、`journal.store.ts`、`useJournal.ts`、`src/shared/types/journal.types.ts`、`src/shared/enums/journal.enums.ts`
- Delete: 旧 channel 与旧类型、`syncLocalFiles`/`scanJournalFiles`/`checkTodayJournalExists`/`create/update/delete/getRecentDays`（service 侧删除前确认 `settings` 处是否有 `resetJournalTable` 调用点——channel 名保留、指向 `resetEntries`）、tests 中旧用例（`journal-reset-vector-cleanup.test.ts` 改写为新 reset 语义或删除）
- 核对: `MenuLayout.vue` 与路由不需改动；`wiki.service.ts` 只读验证

**Step 序列：**

- [ ] **Step 1: grep 全量引用点后删除**

```bash
grep -rn "createJournal\|updateJournal\|deleteJournal\|getRecentDays\|checkTodayJournalExists\|syncLocalFiles\|JournalFileInfo\|JournalFileCreate\|JournalFileUpdate\|JournalFileQuery" src tests --include="*.ts" --include="*.vue"
```

逐点迁移到新 API 后删除旧定义；`journal.types.ts` 头部保留条目类型并删旧块（含"来自 pages 表"错误注释）；preload type `JournalAPI` 重写为新 7 方法（含 `resetJournalTable`）。

- [ ] **Step 2: 两步启动验证（迁移铁律手动关）**

1. 删 `<workspace>/sqlite/*.db` → `pnpm dev` 启动 → 正常退出。
2. **再次启动**（第二次才会重放迁移文件路径）→ 无 `duplicate column name`；sqlite 执行：

```sql
SELECT version, status, executed_at FROM migrations_db ORDER BY executed_at DESC LIMIT 3;
```
Expected: 首行 `0.7.0 | executed`。存量库同法验证版本前进。

- [ ] **Step 3: 全量门禁**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: 全绿。特别回归：`migrations.journal-entries`、`journal-entries.dao`、`chunk.sync-by-entry`、`journal-render`、`journal.service.entries`、`journal.store`；旧 smart-tasks 套件不因 `entry_id` 列变化而失败。

- [ ] **Step 4: 端到端手测（复用 Task 9 Step 6 清单 + 新增两条）**

- 追加一条长条目（>500 字，多段）→ 稍候（5s + 队列）→ `SELECT content FROM semantic_chunks WHERE entry_id IS NOT NULL` 出现多块、`journal_entries.chunked_at` 已回写且 `updated_at` 未变。
- 编辑该条目中间某段 → 重切后未变段落**复用原块 id**（`syncByEntry` 语义）：比对编辑前后块 id 集合交集非空。

- [ ] **Step 5: 提交**

```bash
git add -u src tests
git commit -m "refactor(journal): 移除整篇文档旧写入路径与过期类型（条目化收尾）"
```

---

## Self-Review 结论（已执行）

1. **Spec 覆盖**：§4 数据模型→T1/T2/T3；§5 渲染与保护/格式/导入→T4/T6；§6 IPC→T6/T7/T10；§7 切块→T5/T6；§8 迁移→T1（纯 DDL，无数据迁移 = spec §3-2）；§9 UI→T8/T9；§10 测试→各任务 TDD 步骤 + T10；§13 风险：自脏（T3 recordChunked 测试）、级联清理（T5 复用 removeChunksWithRelations）、基线失同步（T1 Step 5 + T10 Step 2）。spec §5.1 "接管即覆盖"边界由 T6 渲染保护测试用例守护。
2. **占位符**：Task 4 Step 3 与 Task 6 Step 3 中"实现注记"给出的修正即为定稿要求（示意代码不可照抄处均已标注正确写法），无遗留 TBD。
3. **类型一致性**：`JournalEntryView/JournalDayView/has_legacy_file` 在 T2 定义、T3 assembleViews/T6 listRecentDays/T8 store/T9 props 同文；`scheduleJournalDay/processJournalDay/replaceEntryChunks/syncByEntry` 定义于 T5、消费于 T5/T6；`appendEntry` 载荷名 `JournalEntryCreatePayload` 全链一致。
4. **范围**：单计划 10 任务，顺序执行；T1→T5 为地基，T6/T7 可并行，T8→T9→T10 串行。
