# 行内语义 Token（双链 / 标签 / 人物）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在编辑器中实现 Logseq 风格的行内语义 token：`[[双链]]` 弱化显示、`#标签`/`@人物` 悬浮高亮；输入 `@`/`#` 后实时搜索人物表/标签表下拉筛选；保存文档时自动将 `#标签` 入标签表、`@人物` 入新建的人物表（均按名称+归属去重）。

**Architecture:** 纯文本即数据——markdown 存储格式零改动，编辑器用 ProseMirror Decoration 插件实时渲染 token，建议下拉用 `@tiptap/suggestion` 双触发（`@`→characters 表、`#`→tags 表），主进程保存链路挂一个同步服务。token 解析正则放在 `src/shared/utils/text-tokens.ts`，编辑器与主进程共用同一套规则，保证所见即所存。

**Tech Stack:** Tiptap v3（Extension + Suggestion + Decoration）、better-sqlite3（BaseDao 模式）、Electron IPC 4 层模式、Vitest。

**注意：** 本仓库 `docs/` 目录被 gitignore（AGENTS.md pitfall #7），计划文档不提交 git；每个任务的源码提交照常执行。

---

## 人物表（characters）设计说明

### 字段设计

| 字段                        | 类型 | 约束                                                           | 说明                                                                                                         |
| --------------------------- | ---- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `id`                        | TEXT | PRIMARY KEY                                                    | UUID（BaseDao 自动生成）                                                                                     |
| `name`                      | TEXT | NOT NULL                                                       | 人物名称（`@` 后的内容）                                                                                     |
| `owner_type`                | TEXT | NOT NULL DEFAULT `'contact'`, CHECK `IN ('contact','project')` | 人物归属类型：`contact`=联系人（现实中的人，如日志里提及的某人）；`project`=作品人物（某个作品中创作的角色） |
| `owner_id`                  | TEXT | REFERENCES projects(id) ON DELETE CASCADE                      | 归属作品 ID；`owner_type='contact'` 时为 NULL。作品删除时其人物级联删除                                      |
| `description`               | TEXT | DEFAULT `''`                                                   | 人物简介                                                                                                     |
| `metadata`                  | TEXT | DEFAULT `'{}'`                                                 | 人物元信息（JSON 字符串，与 pages.metadata 同模式）：别名、性别、生日、颜色标记等扩展字段                    |
| `created_at` / `updated_at` | TEXT | NOT NULL                                                       | BaseDao 自动时间戳                                                                                           |

### 归属规则（@提及同步时的写入归属）

| 保存场景                                      | owner_type | owner_id                             |
| --------------------------------------------- | ---------- | ------------------------------------ |
| 日志（journal）保存                           | `contact`  | NULL（日志中提及的人视为现实联系人） |
| 作品页面（page）保存且 `page.project_id` 有值 | `project`  | `page.project_id`                    |
| 作品页面保存但无 `project_id`                 | `contact`  | NULL                                 |

### 唯一性设计

同名人物允许归属不同作品（两个作品各有「张三」），联系人按名称全局唯一。由于 SQLite 的 `UNIQUE` 约束中 NULL 不参与唯一比较（`(name,'contact',NULL)` 可重复插入），采用**表达式唯一索引**：

```sql
CREATE UNIQUE INDEX idx_characters_identity ON characters(name, owner_type, COALESCE(owner_id, ''));
```

DAO 的按身份查询使用同样的表达式匹配：`WHERE name = ? AND owner_type = ? AND COALESCE(owner_id, '') = ?`。

### 迁移策略

- 新装用户：`init.sql`（projects 表之后）直接建表
- 老用户（数据库基线 0.1.0）：执行迁移文件 `src/main/schemas/migrations/0.2.0_add_characters_table.sql`
- **关键坑**：`database.migration.ts` 的 `buildMigrationsFromFiles` 执行文件迁移后，只在 `migrations_db` 表已有对应 pending 记录时才 `markAsExecuted`——纯新增的迁移文件执行后**不会自动登记**，会导致每次启动重复执行。因此迁移 SQL 末尾必须自登记 `INSERT OR IGNORE INTO migrations_db`（status='executed'，executed_at 用 `strftime` 生成 ISO 格式与基线一致，保证 `getCurrentVersion()` 的 `ORDER BY executed_at DESC` 排序正确）
- `vite.config.mts` 的 `copySchemas()` 用 `copyRecursive` 递归拷贝整个 `src/main/schemas/`，新增的 `migrations/` 子目录自动进入构建产物，无需改构建配置

---

### Task 1: 共享 token 解析工具

**Files:**

- Create: `src/shared/utils/text-tokens.ts`
- Modify: `src/shared/utils/index.ts`
- Test: `tests/unit/shared/text-tokens.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/shared/text-tokens.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import {
  extractInlineTokens,
  extractTagNames,
  extractCharacterNames,
} from "@/shared/utils/text-tokens";

describe("extractInlineTokens", () => {
  it("解析 [[双链]]：返回 wiki token，value 为括号内内容", () => {
    const tokens = extractInlineTokens("今天写了[[项目计划]]");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toEqual({
      type: "wiki",
      start: 4,
      end: 12,
      symbolLength: 2,
      value: "项目计划",
    });
  });

  it("解析 #标签：位于行首或空白后，value 不含 #", () => {
    const tokens = extractInlineTokens("#科幻 这是正文 #灵感");
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toEqual({
      type: "tag",
      start: 0,
      end: 3,
      symbolLength: 1,
      value: "科幻",
    });
    expect(tokens[1].value).toBe("灵感");
  });

  it("解析 @人物：位于行首或空白后，value 不含 @", () => {
    const tokens = extractInlineTokens("和@张三 聊了聊");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toEqual({
      type: "mention",
      start: 1,
      end: 4,
      symbolLength: 1,
      value: "张三",
    });
  });

  it("混合 token 按位置排序", () => {
    const tokens = extractInlineTokens("#标签 和@张三 讨论了[[计划]]");
    expect(tokens.map((t) => t.type)).toEqual(["tag", "mention", "wiki"]);
  });

  it("行中非空白后的 # 与 @ 不解析（避开邮箱/序号）", () => {
    expect(extractInlineTokens("mail a@b.com").map((t) => t.type)).toEqual([
      "mention",
    ]); // @b 解析为 mention？不 —— @ 前是 a（非空白），不解析
  });

  it("纯数字开头的 # 不解析为标签（避开序号）", () => {
    expect(
      extractInlineTokens("#1 完成事项 #2 待办").filter(
        (t) => t.type === "tag",
      ),
    ).toHaveLength(0);
  });

  it("markdown 标题 # 空格形式不解析为标签", () => {
    expect(
      extractInlineTokens("# 标题").filter((t) => t.type === "tag"),
    ).toHaveLength(0);
  });

  it("未闭合的 [[ 不解析", () => {
    expect(extractInlineTokens("[[未闭合")).toHaveLength(0);
  });

  it("空字符串返回空数组", () => {
    expect(extractInlineTokens("")).toEqual([]);
  });
});

describe("extractTagNames / extractCharacterNames", () => {
  const md = "#科幻 和@张三 聊了 #科幻 又见@李四";

  it("extractTagNames 去重并保序", () => {
    expect(extractTagNames(md)).toEqual(["科幻"]);
  });

  it("extractCharacterNames 去重并保序", () => {
    expect(extractCharacterNames(md)).toEqual(["张三", "李四"]);
  });
});
```

注意：上面第 5 个用例 `mail a@b.com` 的断言写错了，正确断言应是：

```typescript
it("行中非空白后的 @ 不解析（避开邮箱）", () => {
  expect(extractInlineTokens("mail a@b.com")).toHaveLength(0);
});
```

实现时用正确版本（`a@b.com` 中 `@` 前是 `a`，lookbehind 拒绝；`b.com` 里没有触发条件）。

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm vitest run tests/unit/shared/text-tokens.test.ts
```

Expected: FAIL，报错 `Failed to resolve import "@/shared/utils/text-tokens"`。

- [ ] **Step 3: 实现 `src/shared/utils/text-tokens.ts`**

```typescript
/**
 * 行内语义 token（[[双链]] / #标签 / @人物）的统一解析。
 * 编辑器 Decoration 渲染与主进程保存同步共用同一套规则，保证所见即所存。
 */

/** token 类型：wiki=[[双链]] / tag=#标签 / mention=@人物 */
export type InlineTokenType = "wiki" | "tag" | "mention";

export interface InlineToken {
  type: InlineTokenType;
  /** token 起始偏移（含符号，基于传入文本的偏移量） */
  start: number;
  /** token 结束偏移（含符号/右括号，exclusive） */
  end: number;
  /** 前置符号长度：wiki=2（[[），tag/mention=1 */
  symbolLength: number;
  /** 去除符号后的内容 */
  value: string;
}

/** [[双链]]：同一行内闭合，内容不含中括号与换行 */
const WIKI_LINK_RE = /\[\[([^\[\]\n]+)\]\]/g;
/** #标签：位于行首或空白后，首字符非数字（避开序号），内容不含空白与 # */
const TAG_RE = /(?<!\S)#(?!\d)[^\s#]+/g;
/** @人物：位于行首或空白后，内容不含空白、@ 与 #（避开邮箱地址） */
const MENTION_RE = /(?<!\S)@[^\s@#]+/g;

/**
 * 解析文本中的全部行内语义 token，按出现位置排序
 * @param text 纯文本（通常为单个 ProseMirror text node 的文本或整篇 markdown）
 */
export function extractInlineTokens(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];

  for (const match of text.matchAll(WIKI_LINK_RE)) {
    const start = match.index ?? 0;
    tokens.push({
      type: "wiki",
      start,
      end: start + match[0].length,
      symbolLength: 2,
      value: match[1],
    });
  }

  for (const match of text.matchAll(TAG_RE)) {
    const start = match.index ?? 0;
    tokens.push({
      type: "tag",
      start,
      end: start + match[0].length,
      symbolLength: 1,
      value: match[0].slice(1),
    });
  }

  for (const match of text.matchAll(MENTION_RE)) {
    const start = match.index ?? 0;
    tokens.push({
      type: "mention",
      start,
      end: start + match[0].length,
      symbolLength: 1,
      value: match[0].slice(1),
    });
  }

  tokens.sort((a, b) => a.start - b.start);
  return tokens;
}

/** 提取 markdown 中全部 #标签 名（去重，保持出现顺序） */
export function extractTagNames(markdown: string): string[] {
  const names = extractInlineTokens(markdown)
    .filter((t) => t.type === "tag")
    .map((t) => t.value);
  return [...new Set(names)];
}

/** 提取 markdown 中全部 @人物 名（去重，保持出现顺序） */
export function extractCharacterNames(markdown: string): string[] {
  const names = extractInlineTokens(markdown)
    .filter((t) => t.type === "mention")
    .map((t) => t.value);
  return [...new Set(names)];
}
```

- [ ] **Step 4: 在 `src/shared/utils/index.ts` 追加导出**

```typescript
export * from "./time";
export * from "./object";
export * from "./validate";
export * from "./id";
export * from "./text-tokens";
```

- [ ] **Step 5: 运行测试确认通过**

```bash
pnpm vitest run tests/unit/shared/text-tokens.test.ts
```

Expected: PASS（全部用例）。

- [ ] **Step 6: 提交**

```bash
git add src/shared/utils/text-tokens.ts src/shared/utils/index.ts tests/unit/shared/text-tokens.test.ts
git commit -m "feat(shared): add inline semantic token parser for wiki/tag/mention"
```

---

### Task 2: characters 表（init.sql + 迁移 SQL）

**Files:**

- Modify: `src/main/schemas/init.sql:246`（projects 表定义之后、pages 表之前）
- Modify: `src/main/schemas/init.sql:336`（索引区，idx_tags_name 之后）
- Create: `src/main/schemas/migrations/0.2.0_add_characters_table.sql`

**背景：** 表结构变动走正式迁移文件（而非 ensureXxx 幂等方法）。注意 `buildMigrationsFromFiles`（[database.migration.ts:503-535](file:///d:/Code/Github/Wrisp/src/main/core/migration/database.migration.ts#L503-L535)）执行文件迁移后不会自动登记 `migrations_db`，迁移 SQL 必须自登记，否则每次启动重复执行。

- [ ] **Step 1: init.sql 增加 characters 表（新装用户）**

在 `src/main/schemas/init.sql` 中，projects 表（第 219-246 行）结束之后、`CREATE TABLE IF NOT EXISTS pages` 之前插入（characters 的 owner_id 外键引用 projects，必须置于其后）：

```sql
-- 人物表（@人物提及同步，v0.2.0）
CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_type TEXT NOT NULL DEFAULT 'contact' CHECK (owner_type IN ('contact', 'project')),
    owner_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    description TEXT DEFAULT '',
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

在索引区 `CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);`（第 336 行）之后插入：

```sql
-- 人物索引：同名人物可归属不同作品（表达式唯一索引，NULL 归属按空串参与唯一比较）
CREATE UNIQUE INDEX IF NOT EXISTS idx_characters_identity ON characters(name, owner_type, COALESCE(owner_id, ''));
CREATE INDEX IF NOT EXISTS idx_characters_owner ON characters(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name);
```

- [ ] **Step 2: 创建迁移文件（老用户升级）**

创建 `src/main/schemas/migrations/0.2.0_add_characters_table.sql`：

```sql
-- v0.2.0 新增人物表：@人物提及同步
-- 归属：contact=联系人（现实中的人） / project=作品人物（owner_id 指向 projects）
-- 唯一性：同名人物可归属不同作品；联系人按名称全局唯一（表达式唯一索引）
CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_type TEXT NOT NULL DEFAULT 'contact' CHECK (owner_type IN ('contact', 'project')),
    owner_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    description TEXT DEFAULT '',
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_characters_identity ON characters(name, owner_type, COALESCE(owner_id, ''));
CREATE INDEX IF NOT EXISTS idx_characters_owner ON characters(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name);

-- 自登记迁移记录：buildMigrationsFromFiles 不会为文件迁移写入 migrations_db，
-- 不自登记会导致每次启动重复执行（SQL 幂等不报错但版本不前进）。
-- executed_at 用 strftime 生成 ISO 格式，与 init.sql 基线一致，保证 getCurrentVersion 排序正确。
INSERT OR IGNORE INTO migrations_db (id, version, name, description, sql_statement, status, executed_at, execution_time, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '0.2.0',
    'Add Characters Table',
    '新增人物表：@人物提及同步（归属联系人/作品、简介、元信息）',
    'CREATE TABLE characters (id, name, owner_type, owner_id, description, metadata, created_at, updated_at) + unique index idx_characters_identity',
    'executed',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    0,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
```

- [ ] **Step 3: 写迁移文件的失败测试**

创建 `tests/integration/main/migrations.characters.test.ts`（验证迁移 SQL 在「老库」上可执行且自登记生效——mock 骨架与 tag.dao.test.ts 一致）：

```typescript
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/tmp"),
    getVersion: vi.fn(() => "1.0.0"),
    getName: vi.fn(() => "Wrisp"),
    on: vi.fn(),
  },
  BrowserWindow: vi.fn(),
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
}));
vi.mock("@/main/utils/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}));

const MIGRATION_FILE = path.resolve(
  process.cwd(),
  "src/main/schemas/migrations/0.2.0_add_characters_table.sql",
);

describe("0.2.0 characters 迁移文件", () => {
  /** 模拟老库：仅有 migrations_db（0.1.0 基线）与 projects 表 */
  function createLegacyDb(): Database.Database {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec(`
      CREATE TABLE migrations_db (
          id TEXT PRIMARY KEY,
          version TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          sql_statement TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          executed_at TEXT DEFAULT '',
          execution_time INTEGER,
          checksum TEXT DEFAULT '',
          error_message TEXT DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          CHECK (status IN ('pending', 'executed', 'failed'))
      );
      INSERT INTO migrations_db (id, version, name, description, sql_statement, status, executed_at, created_at, updated_at)
      VALUES ('00000000-0000-0000-0000-000000000001', '0.1.0', 'Init', '', '--', 'executed', '2026-06-28T00:00:00.000Z', '2026-06-28T00:00:00.000Z', '2026-06-28T00:00:00.000Z');

      CREATE TABLE projects (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          file_path TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
      );
    `);
    return db;
  }

  beforeEach(() => {
    expect(fs.existsSync(MIGRATION_FILE)).toBe(true);
  });

  it("老库执行迁移后：characters 表创建、唯一索引生效", () => {
    const db = createLegacyDb();
    db.exec(fs.readFileSync(MIGRATION_FILE, "utf-8"));

    const cols = db.prepare("PRAGMA table_info(characters)").all() as {
      name: string;
    }[];
    expect(cols.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        "id",
        "name",
        "owner_type",
        "owner_id",
        "description",
        "metadata",
        "created_at",
        "updated_at",
      ]),
    );

    // 表达式唯一索引：同名联系人重复插入被拒
    db.prepare(
      "INSERT INTO characters (id, name, owner_type, owner_id, created_at, updated_at) VALUES ('c1', '张三', 'contact', NULL, '2026-09-05T00:00:00.000Z', '2026-09-05T00:00:00.000Z')",
    ).run();
    expect(() =>
      db
        .prepare(
          "INSERT INTO characters (id, name, owner_type, owner_id, created_at, updated_at) VALUES ('c2', '张三', 'contact', NULL, '2026-09-05T00:00:00.000Z', '2026-09-05T00:00:00.000Z')",
        )
        .run(),
    ).toThrow();
    db.close();
  });

  it("迁移自登记 migrations_db（0.2.0 executed），重复执行幂等", () => {
    const db = createLegacyDb();
    const sql = fs.readFileSync(MIGRATION_FILE, "utf-8");

    db.exec(sql);
    const record = db
      .prepare("SELECT * FROM migrations_db WHERE version = '0.2.0'")
      .get() as { status: string };
    expect(record.status).toBe("executed");

    // 重复执行不报错（IF NOT EXISTS + INSERT OR IGNORE）
    expect(() => db.exec(sql)).not.toThrow();
    const count = (
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM migrations_db WHERE version = '0.2.0'",
        )
        .get() as { n: number }
    ).n;
    expect(count).toBe(1);
    db.close();
  });
});
```

- [ ] **Step 4: 运行测试确认失败**

```bash
pnpm vitest run tests/integration/main/migrations.characters.test.ts
```

Expected: FAIL——迁移文件不存在（Step 2 已创建则直接 PASS，属正常；此步骤用于确认文件就位前的失败状态）。

- [ ] **Step 5: 验证迁移逻辑（手工核对，无需新代码）**

核对 `src/main/index.ts` 的 `initializeDatabase()`（第 81-82 行）：`executeDatabaseMigration(getTargetVersion())` 会加载 `migrations/` 目录的 0.2.0 文件（当前数据库基线 0.1.0 < 0.2.0 → 执行）。无需在 `main/index.ts` 追加任何 ensureXxx 调用。

验证点：

1. `loadMigrationFiles()` 解析 `0.2.0_add_characters_table.sql` → version=0.2.0 ✅（文件名格式 `{version}_{name}.sql`）
2. `copySchemas()` 的 `copyRecursive` 递归拷贝整个 schemas 目录 → migrations 子目录自动进构建产物 ✅
3. 新装用户：`initDatabaseSchema()`（含 characters）→ return；第二次启动 currentVersion=0.1.0 < 0.2.0 → 执行迁移文件（IF NOT EXISTS 幂等）→ 自登记（OR IGNORE 幂等）✅
4. 老用户：currentVersion=0.1.0 < 0.2.0 → 建表 + 自登记；下次启动 executedVersions 含 0.2.0 → 跳过 ✅

- [ ] **Step 6: 类型检查**

```bash
pnpm typecheck
```

Expected: 无错误（本任务只改 SQL 文件，typecheck 作为回归确认）。

- [ ] **Step 7: 提交**

```bash
git add src/main/schemas/init.sql src/main/schemas/migrations/0.2.0_add_characters_table.sql
git commit -m "feat(db): add characters table via init.sql and 0.2.0 migration"
```

---

### Task 3: character 类型 + DAO

**Files:**

- Create: `src/shared/types/character.types.ts`
- Modify: `src/shared/types/index.ts`
- Create: `src/main/types/db/character.types.ts`
- Modify: `src/main/types/db/index.ts`
- Create: `src/main/core/db/character.dao.ts`
- Modify: `src/main/core/db/index.ts`
- Test: `tests/integration/main/character.dao.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/integration/main/character.dao.test.ts`（完整复制 `tests/integration/main/tag.dao.test.ts` 的 electron/winston/connection mock 骨架，替换 DAO 与断言）：

```typescript
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/tmp"),
    getVersion: vi.fn(() => "1.0.0"),
    getName: vi.fn(() => "Wrisp"),
    on: vi.fn(),
  },
  BrowserWindow: vi.fn(),
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
}));
vi.mock("@/main/utils/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}));
vi.mock("winston", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  format: {
    combine: vi.fn(),
    timestamp: vi.fn(),
    printf: vi.fn(),
    colorize: vi.fn(),
    simple: vi.fn(),
    json: vi.fn(),
  },
  transports: { Console: vi.fn(), File: vi.fn() },
  addColors: vi.fn(),
}));
vi.mock("winston-daily-rotate-file", () => ({ default: vi.fn() }));

let memDb: Database.Database | null = null;
function initMemDb(): Database.Database {
  memDb = new Database(":memory:");
  memDb.pragma("journal_mode = WAL");
  memDb.pragma("foreign_keys = ON");

  const schemaPath = path.resolve(process.cwd(), "src/main/schemas/init.sql");
  if (fs.existsSync(schemaPath)) {
    memDb.exec(fs.readFileSync(schemaPath, "utf-8"));
  }
  return memDb;
}
vi.mock("@/main/core/db/connection", () => ({
  getDatabase: () => {
    if (!memDb) initMemDb();
    return memDb!;
  },
  initDatabase: () => {
    if (!memDb) initMemDb();
    return memDb!;
  },
  closeDatabase: () => {
    memDb?.close();
    memDb = null;
  },
  setWorkspacePath: vi.fn(),
  getDbPath: () => ":memory:",
  isDatabaseConnected: () => memDb !== null,
}));

import { CharacterDao } from "@/main/core/db/character.dao";
import { getDatabase } from "@/main/core/db/connection";

describe("CharacterDao", () => {
  let dao: CharacterDao;
  let projectId: string;

  beforeEach(() => {
    const db = getDatabase();
    db.exec("DELETE FROM characters");
    db.exec("DELETE FROM projects");
    // 外键依赖：插入测试作品（projects 必填字段以 init.sql 为准，
    // 若报 NOT NULL 约束错误，按 PRAGMA table_info(projects) 补齐）
    db.prepare(
      "INSERT INTO projects (id, title, file_path, status, created_at, updated_at) VALUES ('p-test-1', '测试作品', '/tmp/p1', 'active', '2026-09-05T00:00:00.000Z', '2026-09-05T00:00:00.000Z')",
    ).run();
    projectId = "p-test-1";
    dao = new CharacterDao();
  });

  it("should create a character with generated UUID", () => {
    const id = dao.create({ name: "张三" });
    expect(id).toBeDefined();

    const saved = dao.findById(id);
    expect(saved).not.toBeNull();
    expect(saved!.name).toBe("张三");
    expect(saved!.owner_type).toBe("contact");
    expect(saved!.owner_id).toBeNull();
    expect(saved!.metadata).toBe("{}");
    expect(saved!.created_at).toBeDefined();
    expect(saved!.updated_at).toBeDefined();
  });

  it("should create a project-owned character with owner_id", () => {
    const id = dao.create({
      name: "林黛玉",
      owner_type: "project",
      owner_id: projectId,
    });
    const saved = dao.findById(id);
    expect(saved!.owner_type).toBe("project");
    expect(saved!.owner_id).toBe(projectId);
  });

  it("should find a character by identity (name + owner)", () => {
    dao.create({ name: "张三" });
    dao.create({ name: "张三", owner_type: "project", owner_id: projectId });

    const contact = dao.findByIdentity("张三", "contact", null);
    expect(contact).not.toBeNull();
    expect(contact!.owner_type).toBe("contact");

    const owned = dao.findByIdentity("张三", "project", projectId);
    expect(owned).not.toBeNull();
    expect(owned!.owner_type).toBe("project");
  });

  it("should return null for non-existent identity", () => {
    expect(dao.findByIdentity("不存在的人", "contact", null)).toBeNull();
  });

  it("should enforce identity uniqueness via expression index", () => {
    dao.create({ name: "张三" });
    expect(() => dao.create({ name: "张三" })).toThrow();
    // 同名但不同归属可共存
    expect(() =>
      dao.create({ name: "张三", owner_type: "project", owner_id: projectId }),
    ).not.toThrow();
  });

  it("should cascade delete project-owned characters when project is deleted", () => {
    dao.create({ name: "王五", owner_type: "project", owner_id: projectId });
    const db = getDatabase();
    db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
    expect(dao.findByIdentity("王五", "project", projectId)).toBeNull();
  });

  it("should find characters by name with LIKE", () => {
    dao.create({ name: "张三" });
    dao.create({ name: "张三丰" });
    dao.create({ name: "李四" });

    const results = dao.findByNameLike("张三");
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.name).sort()).toEqual(["张三", "张三丰"]);
  });

  it("should escape LIKE wildcards in query", () => {
    dao.create({ name: "a%c" });
    const results = dao.findByNameLike("%");
    expect(results.map((r) => r.name)).toEqual(["a%c"]);
  });

  it("should respect limit in LIKE query", () => {
    for (let i = 1; i <= 10; i++) {
      dao.create({ name: `人物-${i}` });
    }
    expect(dao.findByNameLike("人物", 5)).toHaveLength(5);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm vitest run tests/integration/main/character.dao.test.ts
```

Expected: FAIL，`Failed to resolve import "@/main/core/db/character.dao"`。

- [ ] **Step 3: 实现类型文件**

创建 `src/shared/types/character.types.ts`：

```typescript
import {
  Id,
  Timestamp,
  Ensure,
  NonEmptyString,
  Name,
  Description,
  QueryParams,
} from "@/shared/types";

export type CharacterId = Id;

/** 人物归属类型：contact=联系人（现实中的人）/ project=作品人物（owner_id 指向作品） */
export type CharacterOwnerType = "contact" | "project";

/** 人物元信息（metadata JSON 的结构约定，均为可选扩展字段） */
export interface CharacterMetadata {
  /** 别名列表 */
  aliases?: string[];
  /** 性别 */
  gender?: string;
  /** 出生日期（自由格式） */
  birthday?: string;
  /** 其他扩展信息 */
  [key: string]: unknown;
}

export interface Character {
  id: CharacterId;
  name: Name;
  owner_type: CharacterOwnerType;
  /** 归属作品 ID；owner_type='contact' 时为 null */
  owner_id: CharacterId | null;
  description: Description;
  /** 元信息 JSON 字符串（CharacterMetadata 序列化） */
  metadata: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CharacterCreate {
  id?: CharacterId;
  name: Name;
  owner_type?: CharacterOwnerType;
  owner_id?: CharacterId | null;
  description?: Description;
  metadata?: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

export interface CharacterUpdate {
  name?: Name;
  owner_type?: CharacterOwnerType;
  owner_id?: CharacterId | null;
  description?: Description;
  metadata?: string;
  updated_at?: Timestamp;
}

export type StrictCharacterCreate = Ensure<
  CharacterCreate,
  {
    id: NonEmptyString<CharacterId>;
    name: NonEmptyString<Name>;
  }
>;

export interface CharacterQuery extends QueryParams {
  name?: Name;
  owner_type?: CharacterOwnerType;
  owner_id?: CharacterId | null;
}
```

创建 `src/main/types/db/character.types.ts`——内容与上面完全一致（tag 的双类型文件模式，见 `src/main/types/db/tag.types.ts` 与 `src/shared/types/tag.types.ts` 的现状）。

在 `src/shared/types/index.ts` 末尾追加：

```typescript
export * from "./character.types";
```

在 `src/main/types/db/index.ts` 顶部导出区追加（`export * from "./tag.types";` 之后）：

```typescript
export * from "./character.types";
```

- [ ] **Step 4: 实现 `src/main/core/db/character.dao.ts`**

```typescript
import { BaseDao } from "./base.dao";
import {
  Character,
  CharacterCreate,
  CharacterUpdate,
  CharacterOwnerType,
  Name,
} from "@/main/types/db";

export class CharacterDao extends BaseDao<
  Character,
  CharacterCreate,
  CharacterUpdate
> {
  constructor() {
    super("characters");
  }

  /**
   * 按身份查询人物（名称 + 归属），与 idx_characters_identity 唯一索引的表达式一致
   * @param name 人物名称
   * @param ownerType 归属类型（contact/project）
   * @param ownerId 归属作品 ID（contact 时传 null）
   */
  findByIdentity(
    name: Name,
    ownerType: CharacterOwnerType,
    ownerId: string | null,
  ): Character | null {
    const sql = `SELECT * FROM ${this.tableName} WHERE name = ? AND owner_type = ? AND COALESCE(owner_id, '') = ?`;
    return this.queryOne(sql, [name, ownerType, ownerId ?? ""]);
  }

  /**
   * 根据名称模糊查询人物列表（全局搜索，供 @ 建议下拉）
   * @param name 名称关键词（自动转义 LIKE 通配符）
   * @param limit 最大返回条数（默认 50）
   */
  findByNameLike(name: string, limit: number = 50): Character[] {
    // 转义 LIKE 通配符 %、_ 及反斜杠
    const escaped = name.replace(/[\\%_]/g, "\\$&");
    const sql = `SELECT * FROM ${this.tableName} WHERE name LIKE ? ESCAPE '\\' ORDER BY name ASC LIMIT ?`;
    return this.query(sql, [`%${escaped}%`, limit]);
  }
}
```

在 `src/main/core/db/index.ts` 追加导出（`export * from './tag.dao'` 之后）：

```typescript
export * from "./character.dao";
```

- [ ] **Step 5: 运行测试确认通过**

```bash
pnpm vitest run tests/integration/main/character.dao.test.ts
```

Expected: PASS（9 个用例）。若「外键级联删除」用例失败，检查连接 mock 的 `initMemDb` 是否执行 `pragma("foreign_keys = ON")`（已设置）。

- [ ] **Step 6: 提交**

```bash
git add src/shared/types/character.types.ts src/shared/types/index.ts src/main/types/db/character.types.ts src/main/types/db/index.ts src/main/core/db/character.dao.ts src/main/core/db/index.ts tests/integration/main/character.dao.test.ts
git commit -m "feat(db): add character types and dao with owner identity"
```

---

### Task 4: character 服务层 + IPC 4 层接线

**Files:**

- Modify: `src/shared/enums/errorCode.enums.ts`
- Create: `src/main/core/services/character.service.ts`
- Create: `src/main/core/apis/character.api.ts`
- Create: `src/main/ipc/character.ipc.ts`（注意：实际目录是 `src/main/ipcMain/character.ipc.ts`）
- Modify: `src/main/ipcMain/index.ts`
- Modify: `src/main/index.ts`（import 块 + 注册调用）
- Create: `src/main/preload/types/character.ts`
- Create: `src/main/preload/modules/character.ts`
- Modify: `src/main/preload/types/index.ts`
- Modify: `src/main/preload/modules/index.ts`
- Modify: `src/renderer/types/electron.d.ts`

- [ ] **Step 1: ErrorCode 枚举扩展**

在 `src/shared/enums/errorCode.enums.ts` 的 TAG 块（第 50 行 `TAG_NOT_FOUND` 之后）追加：

```typescript
  // ============ 人物错误 ============
  CHARACTER_QUERY_FAILED = "ERROR.CHARACTER.QUERY_FAILED",
  CHARACTER_CREATE_FAILED = "ERROR.CHARACTER.CREATE_FAILED",
```

`ErrorCategory` 联合类型（第 184 行 `"SUCCESS"` 之前）追加：

```typescript
  | "CHARACTER" // 人物错误
```

`getErrorCategory` 的 switch（`case "WEBVIEW":` 分支之后任意位置）追加：

```typescript
    case "CHARACTER":
      return "CHARACTER";
```

- [ ] **Step 2: 实现 `src/main/core/services/character.service.ts`**

```typescript
import { CharacterDao } from "@/main/core/db";
import type {
  Character,
  CharacterId,
  CharacterOwnerType,
} from "@/main/types/db";
import { Logger } from "@/main/utils/logger";

/** 人物归属：type=contact 时 id 必须为 null；type=project 时 id 为作品 ID */
export interface CharacterOwner {
  type: CharacterOwnerType;
  id?: string | null;
}

/**
 * 人物服务
 * 提供人物表查询与按「名称+归属」去重的批量写入（@人物提及同步）
 */
class CharacterService {
  private static instance: CharacterService | null = null;
  private characterDao: CharacterDao;

  private constructor() {
    this.characterDao = new CharacterDao();
  }

  /**
   * 获取 CharacterService 单例实例
   */
  public static getInstance(): CharacterService {
    if (!CharacterService.instance) {
      CharacterService.instance = new CharacterService();
    }
    return CharacterService.instance;
  }

  /**
   * 模糊查询人物（供编辑器 @ 建议下拉，全局搜索不过滤归属）
   * @param name 名称关键词
   * @param options.limit 最大返回条数（默认 8）
   */
  public findCharacters(
    name: string,
    options: { limit?: number } = {},
  ): Character[] {
    try {
      const { limit = 8 } = options;
      return this.characterDao.findByNameLike(name, limit);
    } catch (error) {
      Logger.error("查询人物失败", { error: String(error), name });
      throw error;
    }
  }

  /**
   * 按「名称+归属」批量写入人物（去重：入参去重 + 跳过已存在身份，事务内执行）
   * 同名人物归属不同作品可共存；归属内按名称唯一
   * @param names 人物名称数组
   * @param owner 人物归属（contact / project+作品ID）
   * @returns 人物 ID 数组（与去重后的名称一一对应）
   */
  public upsertByName(names: string[], owner: CharacterOwner): CharacterId[] {
    try {
      const unique = [
        ...new Set(names.map((n) => n.trim()).filter((n) => n !== "")),
      ];
      if (unique.length === 0) {
        return [];
      }
      const ownerType: CharacterOwnerType = owner.type;
      const ownerId = owner.type === "project" && owner.id ? owner.id : null;
      return this.characterDao.transaction(() => {
        const ids: CharacterId[] = [];
        for (const name of unique) {
          const existing = this.characterDao.findByIdentity(
            name,
            ownerType,
            ownerId,
          );
          if (existing) {
            ids.push(existing.id);
            continue;
          }
          ids.push(
            this.characterDao.create({
              name,
              owner_type: ownerType,
              owner_id: ownerId,
            }),
          );
        }
        return ids;
      });
    } catch (error) {
      Logger.error("批量写入人物失败", {
        error: String(error),
        names,
        owner,
      });
      throw error;
    }
  }
}

export const characterService = CharacterService.getInstance();
```

- [ ] **Step 3: 实现 `src/main/core/apis/character.api.ts`**

```typescript
import { characterService } from "@/main/core/services/character.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { Character, ApiResponse } from "@/shared/types";
import { Logger } from "@/main/utils/logger";

/**
 * 模糊查询人物（编辑器 @ 建议下拉）
 */
async function findCharacters(
  name: string,
  options?: { limit?: number },
): Promise<ApiResponse<Character[]>> {
  try {
    const characters = characterService.findCharacters(name, options ?? {});
    return response.success(characters);
  } catch (error) {
    Logger.error("查询人物失败", { error: String(error), name, options });
    return response.error(ErrorCode.CHARACTER_QUERY_FAILED, error as Error);
  }
}

export { findCharacters };
```

- [ ] **Step 4: 实现 `src/main/ipcMain/character.ipc.ts`**

```typescript
import { ipcMain } from "electron";
import { findCharacters } from "@/main/core/apis/character.api";
import type { Character, ApiResponse } from "@/shared/types";

export function registerCharacterHandlers(): void {
  ipcMain.handle(
    "character:find",
    async (
      _,
      name: string,
      options?: { limit?: number },
    ): Promise<ApiResponse<Character[]>> => {
      return findCharacters(name, options);
    },
  );
}
```

在 `src/main/ipcMain/index.ts` 追加导出（`export { registerTagHandlers } from './tag.ipc'` 之后）：

```typescript
export { registerCharacterHandlers } from "./character.ipc";
```

在 `src/main/index.ts`：

1. import 块（第 32 行 `registerTagHandlers,` 之后）追加 `registerCharacterHandlers,`
2. 注册调用区（第 190 行 `registerTagHandlers();` 之后）追加：

```typescript
registerCharacterHandlers();
```

- [ ] **Step 5: preload 模块与类型**

创建 `src/main/preload/types/character.ts`：

```typescript
import type { Character, ApiResponse } from "@/shared/types";

export interface CharacterAPI {
  findCharacters(
    name: string,
    options?: { limit?: number },
  ): Promise<ApiResponse<Character[]>>;
}
```

创建 `src/main/preload/modules/character.ts`：

```typescript
import { ipcRenderer } from "electron";
import type { CharacterAPI } from "../types/character";
import type { Character, ApiResponse } from "@/shared/types";

export const characterModule: CharacterAPI = {
  findCharacters: (name, options) =>
    ipcRenderer.invoke("character:find", name, options) as Promise<
      ApiResponse<Character[]>
    >,
};
```

在 `src/main/preload/modules/index.ts`：

1. 追加 import：`import { characterModule } from "./character";`（tag import 之后）
2. modules 对象追加：`character: characterModule,`（`tag: tagModule,` 之后）

在 `src/main/preload/types/index.ts`：

1. 追加 import：`import type { CharacterAPI } from "./character";`（TagAPI import 之后）
2. `ElectronAPI` 接口追加：`character: CharacterAPI;`（`tag: TagAPI;` 之后）
3. 末尾 export type 块追加：`CharacterAPI,`（`TagAPI,` 之后）

- [ ] **Step 6: renderer 类型声明**

在 `src/renderer/types/electron.d.ts`：

1. import 区（第 24 行 Tag 类型 import 之后）追加：

```typescript
import type { Character } from "@/shared/types";
```

2. `ElectronAPI` 接口中 Tag 块（第 189 行 `};` 之后）追加：

```typescript
  // Character 相关
  character: {
    findCharacters(name: string, options?: { limit?: number }): Promise<ApiResponse<Character[]>>;
  };
```

- [ ] **Step 7: i18n 错误文案（两个 locale 同步加，否则 locale-keys 测试失败）**

`src/shared/i18n/locales/zhCN.ts`：

1. ERROR.CATEGORY 中 `TAG: "标签错误",` 之后追加：`CHARACTER: "人物错误",`
2. ERROR.TAG 块（第 551 行 `},` 之后）追加：

```typescript
    CHARACTER: {
      QUERY_FAILED: "查询人物失败",
      CREATE_FAILED: "保存人物失败",
    },
```

`src/shared/i18n/locales/enUS.ts` 对应位置（TAG 块之后）：

1. CATEGORY：`CHARACTER: "Character error",`
2. ERROR 块：

```typescript
    CHARACTER: {
      QUERY_FAILED: "Failed to query characters",
      CREATE_FAILED: "Failed to save characters",
    },
```

- [ ] **Step 8: 类型检查 + locale 一致性测试**

```bash
pnpm typecheck
pnpm vitest run tests/unit/shared/locale-keys.test.ts
```

Expected: 均通过。

- [ ] **Step 9: 提交**

```bash
git add src/shared/enums/errorCode.enums.ts src/main/core/services/character.service.ts src/main/core/apis/character.api.ts src/main/ipcMain/character.ipc.ts src/main/ipcMain/index.ts src/main/index.ts src/main/preload/types/character.ts src/main/preload/modules/character.ts src/main/preload/types/index.ts src/main/preload/modules/index.ts src/renderer/types/electron.d.ts src/shared/i18n/locales/zhCN.ts src/shared/i18n/locales/enUS.ts
git commit -m "feat(ipc): add character domain with find ipc channel"
```

---

### Task 5: 保存时自动同步（标签/人物入库）

**Files:**

- Create: `src/main/core/services/inline-token-sync.service.ts`
- Modify: `src/main/core/services/journal.service.ts:177`（update() 写文件后）
- Modify: `src/main/core/services/page.service.ts:243`（updatePage() 写内容后）
- Test: `tests/integration/main/inline-token-sync.service.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/integration/main/inline-token-sync.service.test.ts`（mock 骨架与 Task 3 的 character.dao.test.ts 完全一致，替换 import 与用例）：

```typescript
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/tmp"),
    getVersion: vi.fn(() => "1.0.0"),
    getName: vi.fn(() => "Wrisp"),
    on: vi.fn(),
  },
  BrowserWindow: vi.fn(),
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
}));
vi.mock("@/main/utils/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}));
vi.mock("winston", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  format: {
    combine: vi.fn(),
    timestamp: vi.fn(),
    printf: vi.fn(),
    colorize: vi.fn(),
    simple: vi.fn(),
    json: vi.fn(),
  },
  transports: { Console: vi.fn(), File: vi.fn() },
  addColors: vi.fn(),
}));
vi.mock("winston-daily-rotate-file", () => ({ default: vi.fn() }));

let memDb: Database.Database | null = null;
function initMemDb(): Database.Database {
  memDb = new Database(":memory:");
  memDb.pragma("journal_mode = WAL");
  memDb.pragma("foreign_keys = ON");
  const schemaPath = path.resolve(process.cwd(), "src/main/schemas/init.sql");
  if (fs.existsSync(schemaPath)) {
    memDb.exec(fs.readFileSync(schemaPath, "utf-8"));
  }
  return memDb;
}
vi.mock("@/main/core/db/connection", () => ({
  getDatabase: () => {
    if (!memDb) initMemDb();
    return memDb!;
  },
  initDatabase: () => {
    if (!memDb) initMemDb();
    return memDb!;
  },
  closeDatabase: () => {
    memDb?.close();
    memDb = null;
  },
  setWorkspacePath: vi.fn(),
  getDbPath: () => ":memory:",
  isDatabaseConnected: () => memDb !== null,
}));

import { inlineTokenSyncService } from "@/main/core/services/inline-token-sync.service";
import { TagDao } from "@/main/core/db/tag.dao";
import { CharacterDao } from "@/main/core/db/character.dao";
import { getDatabase } from "@/main/core/db/connection";

describe("InlineTokenSyncService", () => {
  let tagDao: TagDao;
  let characterDao: CharacterDao;
  let projectId: string;

  beforeEach(() => {
    const db = getDatabase();
    db.exec("DELETE FROM tags");
    db.exec("DELETE FROM characters");
    db.exec("DELETE FROM projects");
    db.prepare(
      "INSERT INTO projects (id, title, file_path, status, created_at, updated_at) VALUES ('p-test-1', '测试作品', '/tmp/p1', 'active', '2026-09-05T00:00:00.000Z', '2026-09-05T00:00:00.000Z')",
    ).run();
    projectId = "p-test-1";
    tagDao = new TagDao();
    characterDao = new CharacterDao();
  });

  it("同步 #标签 与 @人物 到对应表（默认联系人归属）", () => {
    inlineTokenSyncService.syncFromMarkdown("#科幻 和@张三 讨论了[[计划]]", {
      type: "contact",
    });

    expect(tagDao.findByName("科幻")).not.toBeNull();
    const character = characterDao.findByIdentity("张三", "contact", null);
    expect(character).not.toBeNull();
    expect(character!.owner_id).toBeNull();
  });

  it("作品页面同步时 @人物 归属该作品", () => {
    inlineTokenSyncService.syncFromMarkdown("和@林黛玉 聊了", {
      type: "project",
      id: projectId,
    });

    const character = characterDao.findByIdentity(
      "林黛玉",
      "project",
      projectId,
    );
    expect(character).not.toBeNull();
    expect(character!.owner_type).toBe("project");
    expect(character!.owner_id).toBe(projectId);
  });

  it("重复同步去重，不产生重复记录", () => {
    const md = "#科幻 和@张三 聊天";
    inlineTokenSyncService.syncFromMarkdown(md, { type: "contact" });
    inlineTokenSyncService.syncFromMarkdown(md, { type: "contact" });

    const tags = tagDao.findByNameLike("科幻");
    expect(tags).toHaveLength(1);
    const characters = characterDao.findByNameLike("张三");
    expect(characters).toHaveLength(1);
  });

  it("同名人物不同归属分别入库", () => {
    inlineTokenSyncService.syncFromMarkdown("和@张三 聊天", {
      type: "contact",
    });
    inlineTokenSyncService.syncFromMarkdown("和@张三 聊天", {
      type: "project",
      id: projectId,
    });

    const characters = characterDao.findByNameLike("张三");
    expect(characters).toHaveLength(2);
    expect(characters.filter((c) => c.owner_type === "contact")).toHaveLength(
      1,
    );
    expect(characters.filter((c) => c.owner_type === "project")).toHaveLength(
      1,
    );
  });

  it("空内容与空字符串直接返回，不抛错", () => {
    expect(() => {
      inlineTokenSyncService.syncFromMarkdown("", { type: "contact" });
      inlineTokenSyncService.syncFromMarkdown("   ", { type: "contact" });
      inlineTokenSyncService.syncFromMarkdown("普通文本没有 token", {
        type: "contact",
      });
    }).not.toThrow();
    expect(tagDao.findAll()).toHaveLength(0);
    expect(characterDao.findAll()).toHaveLength(0);
  });

  it("[[双链]] 不入任何表（仅渲染，不持久化）", () => {
    inlineTokenSyncService.syncFromMarkdown("参见[[项目计划]]", {
      type: "contact",
    });
    expect(tagDao.findAll()).toHaveLength(0);
    expect(characterDao.findAll()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm vitest run tests/integration/main/inline-token-sync.service.test.ts
```

Expected: FAIL，`Failed to resolve import "@/main/core/services/inline-token-sync.service"`。

- [ ] **Step 3: 实现 `src/main/core/services/inline-token-sync.service.ts`**

```typescript
import { characterService } from "@/main/core/services/character.service";
import type { CharacterOwner } from "@/main/core/services/character.service";
import { tagService } from "@/main/core/services/tag.service";
import {
  extractTagNames,
  extractCharacterNames,
} from "@/shared/utils/text-tokens";
import { Logger } from "@/main/utils/logger";

/**
 * 行内 token 同步服务：文档保存时解析 markdown，
 * 将 #标签 同步进标签表（按名称去重）、@人物 同步进人物表（按名称+归属去重）。
 * 同步失败仅记录日志，不阻断文档保存。
 */
class InlineTokenSyncService {
  private static instance: InlineTokenSyncService | null = null;

  private constructor() {}

  /**
   * 获取 InlineTokenSyncService 单例实例
   */
  public static getInstance(): InlineTokenSyncService {
    if (!InlineTokenSyncService.instance) {
      InlineTokenSyncService.instance = new InlineTokenSyncService();
    }
    return InlineTokenSyncService.instance;
  }

  /**
   * 解析 markdown 并同步 #标签 / @人物 入库
   * @param markdown 文档内容
   * @param owner @人物的归属：日志传 { type: 'contact' }；
   *              作品页面传 { type: 'project', id: page.project_id }（无 project_id 时传 contact）
   */
  public syncFromMarkdown(markdown: string, owner: CharacterOwner): void {
    if (!markdown || markdown.trim() === "") {
      return;
    }
    try {
      const tagNames = extractTagNames(markdown);
      if (tagNames.length > 0) {
        tagService.createTags(tagNames.map((name) => ({ name })));
      }

      const characterNames = extractCharacterNames(markdown);
      if (characterNames.length > 0) {
        characterService.upsertByName(characterNames, owner);
      }
    } catch (error) {
      Logger.error("同步行内标签/人物失败", { error: String(error) });
    }
  }
}

export const inlineTokenSyncService = InlineTokenSyncService.getInstance();
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm vitest run tests/integration/main/inline-token-sync.service.test.ts
```

Expected: PASS（6 个用例）。tagService.createTags 对已存在名称会抛 `TAG_NAME_ALREADY_EXISTS` 类错误——若测试因此失败，检查 tag.service.createTags 的去重行为：若它对重复名直接抛错，则将同步处改为「先 findTags 精确查询过滤已存在的名称，再批量创建」。实现时按实际行为调整，保证「重复同步去重」用例通过。

- [ ] **Step 5: 挂载到 journal / page 保存链路**

`src/main/core/services/journal.service.ts` 的 `update()`：在 `this.fileIndexDao.update(...)`（内容写盘逻辑完成后、方法返回前）追加（日志中提及的人归属联系人）：

```typescript
// 同步行内 token：#标签入标签表、@人物入人物表（失败不影响保存）
inlineTokenSyncService.syncFromMarkdown(journal.content || "", {
  type: "contact",
});
```

顶部 import 区追加：

```typescript
import { inlineTokenSyncService } from "@/main/core/services/inline-token-sync.service";
```

`src/main/core/services/page.service.ts` 的 `updatePage()`：在内容写文件的 `fileService.writeFile(existing.file_path, updateData.content || "")` 之后追加（作品页面的人物归属该作品；无 project_id 时退化为联系人）：

```typescript
// 同步行内 token：#标签入标签表、@人物入人物表（失败不影响保存）
inlineTokenSyncService.syncFromMarkdown(updateData.content || "", {
  type: existing.project_id ? "project" : "contact",
  id: existing.project_id ?? undefined,
});
```

顶部 import 区追加同样的 import。

注意：`existing` 是 `updatePage()` 内已查出的页面记录（含 `project_id`）；若该方法内变量名不同，以实际为准（实现前先读该方法确认变量名与内容写入位置）。

- [ ] **Step 6: 全量测试回归**

```bash
pnpm test
```

Expected: 全部通过（重点观察 page.service.test.ts 是否受影响）。

- [ ] **Step 7: 提交**

```bash
git add src/main/core/services/inline-token-sync.service.ts src/main/core/services/journal.service.ts src/main/core/services/page.service.ts tests/integration/main/inline-token-sync.service.test.ts
git commit -m "feat(core): sync inline tags/characters on journal and page save"
```

---

### Task 6: 编辑器建议下拉（@人物 / #标签 搜索，插入纯文本）

**Files:**

- Create: `src/renderer/components/editor/features/inline-semantic/inline-semantic-suggest.ts`
- Modify: `src/renderer/components/editor/features/mention/mention-extension.ts`（移除 suggestion，保留 legacy 节点解析）
- Modify: `src/renderer/components/editor/extensions.ts`（接线替换）
- Modify: `src/shared/i18n/locales/zhCN.ts` + `enUS.ts`（EDITOR.INLINE_SEMANTIC.NO_MATCH）
- Test: `tests/unit/renderer/inline-semantic-suggest.test.ts`

**背景：** tiptap v3 的 `@tiptap/suggestion` `Suggestion()` 工厂可直接在自定义 Extension 中挂多个建议插件（已验证 `node_modules/@tiptap/extension-mention/dist/index.js` 的 `getSuggestions` 实现支持 `suggestions` 数组；`Suggestion` 从 `@tiptap/suggestion` 包直接导出）。旧 mention-extension.ts 中的 `createSuggestionRender` 是纯 DOM 下拉渲染器，整体迁移到新文件并参数化图标字符。

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/renderer/inline-semantic-suggest.test.ts`：

```typescript
import { describe, it, expect, vi, beforeAll } from "vitest";
import type { ApiResponse } from "@/shared/types";
import type { Character, Tag } from "@/shared/types";

beforeAll(() => {
  const electronAPI = window.electronAPI as unknown as Record<string, unknown>;
  electronAPI.character = {
    findCharacters: vi.fn().mockImplementation((name: string) =>
      Promise.resolve({
        success: true,
        data: [
          { id: "c1", name: `张${name}` },
          { id: "c2", name: "张三丰" },
        ],
        code: 0,
        timestamp: Date.now(),
      } as ApiResponse<Character[]>),
    ),
  };
  electronAPI.tag = {
    findTags: vi.fn().mockImplementation((name: string) =>
      Promise.resolve({
        success: true,
        data: [{ id: "t1", name: `#${name}` }],
        code: 0,
        timestamp: Date.now(),
      } as ApiResponse<Tag[]>),
    ),
  };
});

describe("loadCharacterItems / loadTagItems", () => {
  it("空 query 不触发 IPC，返回空数组", async () => {
    const { loadCharacterItems, loadTagItems } =
      await import("@/renderer/components/editor/features/inline-semantic/inline-semantic-suggest");
    expect(await loadCharacterItems("")).toEqual([]);
    expect(await loadTagItems("")).toEqual([]);
    expect(window.electronAPI.character.findCharacters).not.toHaveBeenCalled();
    expect(window.electronAPI.tag.findTags).not.toHaveBeenCalled();
  });

  it("非空 query 调 IPC 并映射为 { id, label }", async () => {
    const { loadCharacterItems, loadTagItems } =
      await import("@/renderer/components/editor/features/inline-semantic/inline-semantic-suggest");
    const characters = await loadCharacterItems("三");
    expect(characters).toEqual([
      { id: "c1", label: "张三" },
      { id: "c2", label: "张三丰" },
    ]);
    const tags = await loadTagItems("科幻");
    expect(tags).toEqual([{ id: "t1", label: "#科幻" }]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm vitest run tests/unit/renderer/inline-semantic-suggest.test.ts
```

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 `inline-semantic-suggest.ts`**

```typescript
import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { Suggestion } from "@tiptap/suggestion";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import type { ApiResponse, Character, Tag } from "@/shared/types";
import { t } from "@/renderer/plugins/i18n";

/** 建议列表项：id 用于去重标识，label 用于展示与插入 */
export interface SuggestItem {
  id: string;
  label: string;
}

/** 下拉渲染器内部状态 */
interface MenuState {
  menu: HTMLDivElement | null;
  items: SuggestItem[];
  selected: number;
  clientRect: (() => { top: number; bottom: number; left: number }) | null;
  command: ((item: SuggestItem) => void) | null;
}

/**
 * 搜索人物表（@ 触发）：query 为空时不搜索、不显示下拉
 */
export async function loadCharacterItems(
  query: string,
): Promise<SuggestItem[]> {
  if (!query) return [];
  try {
    const response = (await window.electronAPI.character.findCharacters(query, {
      limit: 8,
    })) as ApiResponse<Character[]>;
    const list = response.success && response.data ? response.data : [];
    return list.map((c) => ({ id: c.id, label: c.name }));
  } catch {
    return [];
  }
}

/**
 * 搜索标签表（# 触发）：query 为空时不搜索、不显示下拉
 */
export async function loadTagItems(query: string): Promise<SuggestItem[]> {
  if (!query) return [];
  try {
    const response = (await window.electronAPI.tag.findTags(query, {
      limit: 8,
    })) as ApiResponse<Tag[]>;
    const list = response.success && response.data ? response.data : [];
    return list.map((tag) => ({ id: tag.id, label: tag.name }));
  } catch {
    return [];
  }
}

/** 空查询且无结果时不显示下拉；有查询词时显示空态提示 */
function shouldShowMenu(props: SuggestionProps<SuggestItem>): boolean {
  return props.items.length > 0 || props.query.trim().length > 0;
}

function applyMenuStyles(menu: HTMLDivElement): void {
  Object.assign(menu.style, {
    position: "fixed",
    zIndex: "1000",
    minWidth: "180px",
    maxWidth: "320px",
    maxHeight: "240px",
    overflowY: "auto",
    background: "var(--bg-color, #fff)",
    border: "1px solid var(--border-color, #e0e0e0)",
    borderRadius: "8px",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
    padding: "4px",
  } satisfies Partial<CSSStyleDeclaration>);
}

function applyItemStyles(item: HTMLDivElement, active: boolean): void {
  Object.assign(item.style, {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 10px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    background: active ? "var(--primary-color, #18a058)" : "transparent",
    color: active ? "#fff" : "inherit",
  } satisfies Partial<CSSStyleDeclaration>);
}

function createSuggestionRender(iconChar: string): {
  onStart: (props: SuggestionProps<SuggestItem>) => void;
  onUpdate: (props: SuggestionProps<SuggestItem>) => void;
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
  onExit: () => void;
} {
  const state: MenuState = {
    menu: null,
    items: [],
    selected: 0,
    clientRect: null,
    command: null,
  };

  const destroyMenu = (): void => {
    state.menu?.remove();
    state.menu = null;
    state.items = [];
    state.selected = 0;
    state.clientRect = null;
    state.command = null;
  };

  const renderItems = (): void => {
    const menu = state.menu;
    if (!menu) return;
    menu.innerHTML = "";

    if (state.items.length === 0) {
      const empty = document.createElement("div");
      Object.assign(empty.style, {
        padding: "8px 10px",
        fontSize: "12px",
        opacity: "0.6",
      } satisfies Partial<CSSStyleDeclaration>);
      empty.textContent = t("EDITOR.INLINE_SEMANTIC.NO_MATCH");
      menu.appendChild(empty);
      return;
    }

    state.items.forEach((item, index) => {
      const itemEl = document.createElement("div");
      applyItemStyles(itemEl, index === state.selected);

      const icon = document.createElement("span");
      icon.textContent = iconChar;
      icon.style.opacity = "0.6";
      const label = document.createElement("span");
      label.textContent = item.label;

      itemEl.appendChild(icon);
      itemEl.appendChild(label);
      itemEl.addEventListener("mousedown", (event) => {
        event.preventDefault();
        state.command?.(item);
      });
      itemEl.addEventListener("mouseenter", () => {
        state.selected = index;
        renderItems();
      });

      menu.appendChild(itemEl);
    });
  };

  const position = (): void => {
    const rect = state.clientRect?.();
    if (!rect || !state.menu) return;
    Object.assign(state.menu.style, {
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
    } satisfies Partial<CSSStyleDeclaration>);
  };

  const sync = (props: SuggestionProps<SuggestItem>): void => {
    if (!shouldShowMenu(props)) {
      destroyMenu();
      return;
    }
    if (!state.menu) {
      const menu = document.createElement("div");
      applyMenuStyles(menu);
      document.body.appendChild(menu);
      state.menu = menu;
    }
    state.items = props.items;
    state.selected = 0;
    state.clientRect = props.clientRect ?? null;
    state.command = props.command;
    renderItems();
    position();
  };

  return {
    onStart: sync,
    onUpdate: sync,
    onKeyDown: ({ event }) => {
      if (!state.menu) return false;
      if (event.key === "ArrowUp") {
        state.selected =
          (state.selected - 1 + state.items.length) % state.items.length;
        renderItems();
        return true;
      }
      if (event.key === "ArrowDown") {
        state.selected = (state.selected + 1) % state.items.length;
        renderItems();
        return true;
      }
      if (event.key === "Enter") {
        const item = state.items[state.selected];
        if (item) state.command?.(item);
        return true;
      }
      if (event.key === "Escape") {
        destroyMenu();
        return true;
      }
      return false;
    },
    onExit: destroyMenu,
  };
}

/** 选中后插入纯文本（与手动输入行为完全一致），后缀空格便于连续书写 */
function insertPlainText(
  editor: SuggestionProps<SuggestItem>["editor"],
  range: { from: number; to: number },
  char: string,
  label: string,
): void {
  editor
    .chain()
    .focus()
    .insertContentAt(range, [{ type: "text", text: `${char}${label} ` }])
    .run();
}

/**
 * 行内语义建议扩展：@ 搜索人物表、# 搜索标签表，选中插入纯文本。
 * tiptap v3 的 Suggestion 工厂支持在单个 Extension 中挂多个建议插件。
 */
export function createInlineSemanticSuggestExtension() {
  return Extension.create({
    name: "inlineSemanticSuggest",
    addProseMirrorPlugins() {
      const editor = this.editor;

      const atOptions: SuggestionOptions<SuggestItem> = {
        editor,
        char: "@",
        pluginKey: new PluginKey("inlineSemanticAt"),
        items: ({ query }) => loadCharacterItems(query),
        render: createSuggestionRender("@"),
        command: ({ editor: ed, range, props }) => {
          insertPlainText(ed, range, "@", props.label);
        },
      };

      const hashOptions: SuggestionOptions<SuggestItem> = {
        editor,
        char: "#",
        pluginKey: new PluginKey("inlineSemanticHash"),
        items: ({ query }) => loadTagItems(query),
        render: createSuggestionRender("#"),
        command: ({ editor: ed, range, props }) => {
          insertPlainText(ed, range, "#", props.label);
        },
      };

      return [Suggestion(atOptions), Suggestion(hashOptions)];
    },
  });
}
```

- [ ] **Step 4: 旧 mention 扩展降级为 legacy 解析**

改写 `src/renderer/components/editor/features/mention/mention-extension.ts`：

1. 删除 suggestion 相关代码（`MentionSuggestionConfig`、`createSuggestionRender`、`loadMentionItems`、`cachedItems`、`resetMentionCache`、`@tiptap/suggestion` 的 import）
2. 保留 `Mention` 节点本身（历史文档中的 mention 节点仍可解析/渲染/Backspace 删除）
3. 新导出：

```typescript
import { Mention } from "@tiptap/extension-mention";

/**
 * 旧版 @ 提及节点：仅保留历史文档的解析与渲染能力，
 * 不再挂载 suggestion 插件（新输入走 inline-semantic-suggest，插入纯文本）
 */
export function createLegacyMentionExtension() {
  return Mention.extend({
    addProseMirrorPlugins() {
      // 移除内置 suggestion 插件，避免与新扩展的 @ 触发冲突
      return [];
    },
  }).configure({
    HTMLAttributes: {
      class: "mention-node",
    },
  });
}
```

- [ ] **Step 5: extensions.ts 接线**

`src/renderer/components/editor/extensions.ts`：

1. 删除 `createMentionExtension` 的 import，改为：

```typescript
import { createLegacyMentionExtension } from "./features/mention/mention-extension";
import { createInlineSemanticSuggestExtension } from "./features/inline-semantic/inline-semantic-suggest";
```

2. 扩展数组中 `createMentionExtension()` 替换为：

```typescript
    createLegacyMentionExtension(),
    createInlineSemanticSuggestExtension(),
```

- [ ] **Step 6: i18n key（两个 locale 同步加）**

`src/shared/i18n/locales/zhCN.ts` EDITOR 块内（SLASH 块结束后、BLOCKS 之前，约第 250 行）追加：

```typescript
    INLINE_SEMANTIC: {
      NO_MATCH: "无匹配结果",
    },
```

`src/shared/i18n/locales/enUS.ts` 对应位置：

```typescript
    INLINE_SEMANTIC: {
      NO_MATCH: "No matches",
    },
```

- [ ] **Step 7: 运行测试 + 类型检查**

```bash
pnpm vitest run tests/unit/renderer/inline-semantic-suggest.test.ts tests/unit/shared/locale-keys.test.ts
pnpm typecheck
```

Expected: 均通过。若 `SuggestionOptions` 泛型报 editor 类型不匹配，参考现有 mention-extension.ts 中 `Omit<SuggestionOptions<MentionItem>, "editor">` 的写法调整类型。

- [ ] **Step 8: 提交**

```bash
git add src/renderer/components/editor/features/inline-semantic/inline-semantic-suggest.ts src/renderer/components/editor/features/mention/mention-extension.ts src/renderer/components/editor/extensions.ts src/shared/i18n/locales/zhCN.ts src/shared/i18n/locales/enUS.ts tests/unit/renderer/inline-semantic-suggest.test.ts
git commit -m "feat(editor): add character/tag suggestion dropdown inserting plain text"
```

---

### Task 7: Decoration 渲染（Logseq 风格）+ 样式

**Files:**

- Create: `src/renderer/components/editor/features/inline-semantic/inline-semantic-decoration.ts`
- Modify: `src/renderer/components/editor/extensions.ts`（追加 decoration 扩展）
- Modify: `src/renderer/styles/_markdown.scss`（新增 .inline-sem 样式 + 更新 .mention-node）
- Test: `tests/unit/renderer/inline-semantic-decoration.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/renderer/inline-semantic-decoration.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { createInlineSemanticDecoration } from "@/renderer/components/editor/features/inline-semantic/inline-semantic-decoration";

function createEditor(content: string): Editor {
  return new Editor({
    extensions: [StarterKit, createInlineSemanticDecoration()],
    content,
  });
}

/** 从插件状态中取出全部 decoration 的 class 组合 */
function decorationsOf(editor: Editor): string[] {
  // @ts-expect-error 访问内部 view 供测试断言
  const decos = editor.view.domAtPos(0) as unknown as { node: HTMLElement };
  void decos;
  return Array.from(editor.state.doc.descendants(() => true)).map(() => "");
}

describe("InlineSemanticDecoration", () => {
  it("文本中的 [[双链]]/#标签/@人物 生成带 class 的 DOM", () => {
    const editor = createEditor("<p>[[计划]] 和 #科幻 与@张三</p>");
    const html = editor.view.dom.innerHTML;
    expect(html).toContain("inline-sem");
    expect(html).toContain("inline-sem-symbol");
    editor.destroy();
  });

  it("普通文本不产生 decoration", () => {
    const editor = createEditor("<p>普通文本没有 token</p>");
    const html = editor.view.dom.innerHTML;
    expect(html).not.toContain("inline-sem");
    editor.destroy();
  });

  it("代码块内的 token 不渲染 decoration", () => {
    const editor = createEditor("<pre><code>#tag @name [[x]]</code></pre>");
    const html = editor.view.dom.innerHTML;
    expect(html).not.toContain("inline-sem");
    editor.destroy();
  });

  it("编辑（输入新 token）后 decoration 实时更新", () => {
    const editor = createEditor("<p>文本</p>");
    editor.commands.insertContentAt(editor.state.doc.content.size, "#新标签 ");
    const html = editor.view.dom.innerHTML;
    expect(html).toContain("inline-sem");
    editor.destroy();
  });
});

void decorationsOf;
```

注：`decorationsOf` 辅助函数无实际用途，实现时删除；测试断言全部基于 `editor.view.dom.innerHTML`。

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm vitest run tests/unit/renderer/inline-semantic-decoration.test.ts
```

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 `inline-semantic-decoration.ts`**

```typescript
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProsemirrorNode } from "@tiptap/pm/model";
import { extractInlineTokens } from "@/shared/utils/text-tokens";

const inlineSemanticKey = new PluginKey("inlineSemanticDecoration");

/**
 * 遍历文档中的 text node，为 [[双链]] / #标签 / @人物 添加 Decoration：
 * - 整体区间加 .inline-sem（容器样式，悬浮突出）
 * - 符号区间（[[、]]、#、@）加 .inline-sem-symbol（弱化样式）
 */
function buildInlineSemanticDecorations(doc: ProsemirrorNode): Decoration[] {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    // 跳过代码块（其内部的 token 不做语义渲染）
    if (node.type.name === "codeBlock") {
      return false;
    }
    if (!node.isText || !node.text) {
      return true;
    }

    for (const token of extractInlineTokens(node.text)) {
      const from = pos + token.start;
      const to = pos + token.end;

      // 整体容器
      decorations.push(Decoration.inline(from, to, { class: "inline-sem" }));
      // 前置符号
      decorations.push(
        Decoration.inline(from, from + token.symbolLength, {
          class: "inline-sem-symbol",
        }),
      );
      // wiki 的右括号
      if (token.type === "wiki") {
        decorations.push(
          Decoration.inline(to - 2, to, { class: "inline-sem-symbol" }),
        );
      }
    }
    return true;
  });

  return decorations;
}

/**
 * 行内语义 Decoration 扩展：纯视觉渲染，不改变文档结构。
 * markdown 存储格式不变，历史文档打开即生效。
 */
export function createInlineSemanticDecoration() {
  return Extension.create({
    name: "inlineSemanticDecoration",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: inlineSemanticKey,
          state: {
            init: (_, { doc }) =>
              DecorationSet.create(doc, buildInlineSemanticDecorations(doc)),
            apply: (tr, old) => {
              if (tr.docChanged) {
                return DecorationSet.create(
                  tr.doc,
                  buildInlineSemanticDecorations(tr.doc),
                );
              }
              return old.map(tr.mapping, tr.doc);
            },
          },
          props: {
            decorations: (state) => inlineSemanticKey.getState(state),
          },
        }),
      ];
    },
  });
}
```

- [ ] **Step 4: extensions.ts 追加**

`src/renderer/components/editor/extensions.ts`：

1. import：`import { createInlineSemanticDecoration } from "./features/inline-semantic/inline-semantic-decoration";`
2. 扩展数组（`createInlineSemanticSuggestExtension(),` 之后）追加：`createInlineSemanticDecoration(),`

- [ ] **Step 5: 样式（`src/renderer/styles/_markdown.scss`）**

在 `.mention-node` 样式块附近追加，并把旧 mention-node 样式更新为同款风格：

```scss
// 行内语义 token（Logseq 风格）：[[双链]] / #标签 / @人物
// 符号弱化、正文正常显示、悬浮突出显示
.inline-sem,
.inline-sem-symbol,
.mention-node {
  cursor: pointer;
  border-radius: 4px;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.inline-sem:hover,
.inline-sem-symbol:hover,
.mention-node:hover {
  color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 10%, transparent);
}

// 符号（[[、]]、#、@）默认弱化，悬浮时跟随 token 高亮
.inline-sem-symbol {
  color: var(--text-tertiary);

  .inline-sem:hover & {
    color: var(--primary-color);
  }
}
```

同时删除旧 `.mention-node` 原有的绿色实底药丸样式（被上面合并规则取代；若 `.mention-node` 原样式含背景/颜色/内边距等旧规则，直接删除，仅保留上面合并块）。

- [ ] **Step 6: 运行测试确认通过**

```bash
pnpm vitest run tests/unit/renderer/inline-semantic-decoration.test.ts
```

Expected: PASS。若「代码块」用例失败，检查 `doc.descendants` 回调 `return false` 是否正确跳过 codeBlock 子树。

- [ ] **Step 7: 提交**

```bash
git add src/renderer/components/editor/features/inline-semantic/inline-semantic-decoration.ts src/renderer/components/editor/extensions.ts src/renderer/styles/_markdown.scss tests/unit/renderer/inline-semantic-decoration.test.ts
git commit -m "feat(editor): render wiki/tag/mention tokens with logseq-style decorations"
```

---

### Task 8: 全量验证 + 手动验收

- [ ] **Step 1: 全量测试与静态检查**

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Expected: 全部通过。

- [ ] **Step 2: 手动验收（pnpm dev）**

验收清单（在 Journal 或 Wiki 页面编辑器中）：

1. 手动输入 `[[双链测试]]` → `[[`/`]]` 弱化显示，正文正常；鼠标悬浮整体高亮、手型光标
2. 手动输入 `#标签测试` → `#` 弱化；悬浮高亮；历史文档中的 `#旧标签` 打开即渲染
3. 手动输入 `@张三` → 同上
4. 输入 `@` 后无下拉；输入 `@张` 出现人物下拉（前提：人物表已有数据，可先保存一篇含 `@张三` 的文档再试）
5. 输入 `#` 后无下拉；输入 `#科` 出现标签下拉，键盘上下键 + Enter 选中
6. 下拉选中后插入纯文本 `@张三 `（光标在空格后），与手打行为一致
7. `#1 序号`、`a@b.com` 不被解析
8. 保存文档后：标签管理页出现新标签；再次保存同文档不产生重复标签/人物
9. 旧文档中已存在的 mention 节点（绿色药丸）仍正常显示，悬浮样式与新风格一致
10. 代码块内 `#tag` 无渲染
11. **人物归属验收**：在日志中保存 `@李明` → characters 表新增记录 `owner_type='contact'`、`owner_id=NULL`；在作品章节页保存 `@林黛玉` → `owner_type='project'`、`owner_id=该作品ID`；同一作品另一章节再保存 `@林黛玉` 不重复入库；在两个不同作品分别保存同名人物 → 各自独立入库
12. **迁移验收（老库升级）**：用旧版本数据库（无 characters 表）启动新版 → characters 表自动创建，migrations_db 出现 0.2.0 记录（status=executed）；再次重启不重复执行（日志无 "执行数据库迁移 0.2.0"）

- [ ] **Step 3: 遗留项记录（不做，后续迭代）**

- `[[双链]]` 点击跳转（用户已确认暂缓）
- `@人物` 与人物资料的关联管理界面（人物卡片视图、归属编辑、metadata 结构化编辑）
- `@` 下拉按当前上下文过滤归属（在作品页优先显示该作品人物）
- `#标签` 与 tagged_items 关联（按标签筛选文档）

---

## Self-Review 记录

1. **Spec 覆盖检查**：双中括号弱化+悬浮高亮（Task 7）、`#`/`@` 同款交互（Task 7）、`@` 输入首字自动搜索人物表下拉（Task 6）、`#` 输入首字自动搜索标签表（Task 6）、人物表/标签表去重（Task 2 表达式唯一索引 + Task 5 Set 去重 + upsert 跳过已存在身份）、保存文档自动遍历入库（Task 5 挂 journal/page 双链路）、**人物表字段完整**（名称/归属/简介/元信息，Task 2-3）、**表结构变动带迁移 SQL**（Task 2 `0.2.0_add_characters_table.sql` 含自登记）、**人物表设计说明**（文档「人物表（characters）设计说明」章节）、历史文档 `[[2026-09-05]]` 日期 token 自动渲染（Task 7 decoration 纯视觉）——全部覆盖。
2. **占位符扫描**：Task 1 Step 1 中故意标注了一处测试用笔误并给出正确版本（避免照抄错误断言）；Task 3 Step 1 的 projects INSERT 注明了「必填字段以 init.sql 为准，报错时按 PRAGMA 补齐」的兜底策略（测试辅助数据，非实现占位符）；其余无 TBD/TODO。
3. **类型一致性**：`SuggestItem {id, label}` 在 Task 6 内部一致；`Character`/`CharacterId`/`CharacterOwnerType`/`CharacterOwner {type, id?}` 类型 Task 3/4 定义、Task 5 消费，`findByIdentity(name, ownerType, ownerId)` 在 DAO/service/测试三处签名一致；`extractInlineTokens`/`extractTagNames`/`extractCharacterNames` 签名在 Task 1 定义、Task 5/7 消费，一致；`findCharacters(name, { limit })` 在 service/api/preload/electron.d.ts 四层签名一致；`syncFromMarkdown(markdown, owner)` 在 Task 5 定义并在 journal（contact）/page（project|contact）两处挂载点调用一致。
