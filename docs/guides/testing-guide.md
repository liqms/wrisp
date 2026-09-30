# PenTip 单元测试指南

## 目录结构

```
tests/
├── setup/                ← 全局测试 setup 文件
│   └── renderer.ts       ← electronAPI 全局 mock（自动注入 renderer 测试）
├── unit/                  ← 纯逻辑 + mock 依赖
│   ├── shared/            ← 前后端共享纯函数（utils / i18n）
│   │   ├── validate.test.ts
│   │   ├── object.test.ts
│   │   ├── pagination.test.ts
│   │   ├── time.test.ts
│   │   └── locale-keys.test.ts
│   ├── renderer/          ← Vue / Pinia / composables
│   │   ├── notification.store.test.ts
│   │   ├── config.store.test.ts
│   │   └── useTheme.test.ts
│   └── main/              ← 主进程 service / API（mock 下层依赖）
│       └── config.api.test.ts
└── integration/           ← 真实 SQLite 数据库
    └── main/              ← 主进程 DAO 集成测试
        ├── tag.dao.test.ts
        └── project.dao.test.ts
```

**原则**：
- **单测** (`unit/`) — 纯逻辑验证，外部依赖全 mock，不含真实 IO/DB
- **集测** (`integration/`) — 含真实 SQLite `:memory:` 数据库，验证 SQL 正确性

---

## 快速命令

```bash
pnpm test                # 全量运行（单测 + 集测）
pnpm test:watch          # watch 模式
pnpm test:coverage       # 带覆盖率报告
pnpm vitest run <path>   # 指定文件，如 pnpm vitest run tests/unit/main/config.api.test.ts
```

---

## 如何编写测试

### 1. shared 层（纯函数）

最简单，无外部依赖，直接 import + 断言：

```typescript
import { describe, it, expect } from "vitest";
import { validateId } from "@/shared/utils/validate";

describe("validateId", () => {
  it("should return true for valid positive integers", () => {
    expect(validateId(1)).toBe(true);
  });
});
```

### 2. renderer 层  — Pinia store

需要 `setActivePinia(createPinia())` 隔离 store 实例：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useNotificationStore } from "@/renderer/store/notification.store";

describe("useNotificationStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("should start empty", () => {
    const store = useNotificationStore();
    expect(store.notifications).toEqual([]);
  });
});
```

> `tests/setup/renderer.ts` 已自动为所有 renderer 测试注入 `window.electronAPI` mock，无需手动 mock IPC。

### 3. renderer 层  — Composable

Composable 常依赖 Pinia store，需先初始化 store：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useTheme } from "@/renderer/composables/useTheme";
import { useConfigStore } from "@/renderer/store/config.store";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.stubGlobal("matchMedia", (query) => ({
    matches: false, media: query, addEventListener: vi.fn(), ...
  }));
});

it("should reflect light mode", async () => {
  const store = useConfigStore();
  await store.fetchConfig(); // 触发 electronAPI mock → 填充配置
  const theme = useTheme();
  expect(theme.activeMode.value).toBe("light");
});
```

### 4. main 层  — Config API（mock 下层 service）

使用 `vi.mock()` + `vi.hoisted()` 模式：

```typescript
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";

// 1. 在 vi.mock factory 外定义 mock 对象
const mockService = vi.hoisted(() => ({
  getConfig: vi.fn(),
  setValue: vi.fn(),
}));

// 2. vi.mock 会被 hoist 到文件顶部，无需担心导入顺序
vi.mock("@/main/core/services/config.service", () => ({
  configService: mockService,
}));

// 3. 之后正常 import
import { getConfig } from "@/main/core/apis/config.api";

it("should return success response", async () => {
  mockService.getConfig.mockReturnValue({ version: "1.0.0" });
  const result = await getConfig();
  expect(result.success).toBe(true);
});
```

> **关键规则**：`vi.mock()` 中的 factory 不能引用文件级变量。必须用 `vi.hoisted(() => ...)` 或 `vi.fn()` 字面量。

### 5. main 层  — DAO 集成测试（真实 SQLite）

DAO 测试需要完整的 SQLite + schema 初始化：

```typescript
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// ── 四个必要的 vi.mock ──
vi.mock("electron", () => ({ app: { ... }, BrowserWindow: vi.fn(), ... }));
vi.mock("@/main/utils/logger", () => ({ Logger: { debug: vi.fn(), ... } }));
vi.mock("winston", () => ({ ... }));
vi.mock("winston-daily-rotate-file", () => ({ default: vi.fn() }));

// ── 内存 DB ──
let memDb: Database.Database | null = null;
function initMemDb(): Database.Database {
  memDb = new Database(":memory:");
  memDb.pragma("journal_mode = WAL");
  memDb.pragma("foreign_keys = ON");
  const sql = fs.readFileSync(path.resolve(process.cwd(), "src/main/schemas/init.sql"), "utf-8");
  memDb.exec(sql);
  return memDb;
}
vi.mock("@/main/core/db/connection", () => ({
  getDatabase: () => { if (!memDb) initMemDb(); return memDb!; },
  closeDatabase: () => { memDb?.close(); memDb = null; },
  setWorkspacePath: vi.fn(),
  getDbPath: () => ":memory:",
}));

import { TagDao } from "@/main/core/db/tag.dao";
import { getDatabase } from "@/main/core/db/connection";

describe("TagDao", () => {
  let dao: TagDao;
  beforeEach(() => {
    getDatabase().exec("DELETE FROM tags");
    dao = new TagDao();
  });

  it("should create", () => {
    const id = dao.create({ name: "test" });
    expect(dao.findById(id)!.name).toBe("test");
  });
});
```

**注意**：
- 每个 `beforeEach` 需清空测试涉及的所有表（`DELETE FROM table`）
- 有外键依赖的表，先删子表再删父表
- schema 使用 `process.cwd()` 定位，不从 `__dirname` 推断

---

## 测试环境划分

| 层 | 环境 | setup 文件 | 特点 |
|---|---|---|---|
| shared | `happy-dom`（默认） | 无 | 纯 TS 函数，无环境依赖 |
| renderer | `happy-dom`（默认） | `tests/setup/renderer.ts` | 自动注入 `window.electronAPI` mock |
| main (unit) | `node` (`@vitest-environment node`) | 在测试文件内 inline | 全 mock 下层依赖 |
| main (integration) | `node` (`@vitest-environment node`) | 在测试文件内 inline | 真实 SQLite `:memory:` |

> **`@vitest-environment node`** 注解必须写在测试文件**第一行**（注释也可以），vitest 会据此切换环境。

---

## 已知注意事项

1. **`vi.mock()` hoisting** — factory 中不能引用文件级变量。使用 `vi.hoisted(() => { ... })` 创建 mock 对象，或直接在 factory 中用 `vi.fn()` 字面量。

2. **`window.electronAPI`** — 仅在 happy-dom/jsdom 环境下存在。node 环境的 main 测试中不要引用 `window`。

3. **`better-sqlite3` 版本** — 原生插件需与系统 Node.js 版本匹配。如遇 NODE_MODULE_VERSION 错误，执行：
   ```bash
   cd node_modules/better-sqlite3 && npx node-gyp rebuild
   ```

4. **DAO schema** — 集测只用 `init.sql`，**不**执行 migration 文件（`init.sql` 已包含最终表定义）。

5. **Pinia 隔离** — 每个 `describe` 的 `beforeEach` 中必须调用 `setActivePinia(createPinia())`，否则多个测试共享 store 状态导致断言失败。

6. **`noUnusedLocals` / `noUnusedParameters`** — `tsconfig.vitest.json` 已关闭这两项检查，测试中无需担心未使用的导入。

---

## 添加新测试的快速清单

- [ ] 确定层：shared / renderer / main
- [ ] 确定类型：unit（纯逻辑/mock） / integration（真实 DB）
- [ ] 放入对应目录：`tests/{unit|integration}/{shared|renderer|main}/`
- [ ] shared / renderer：不需要环境注解
- [ ] main：文件首行加 `// @vitest-environment node`
- [ ] renderer：利用 `tests/setup/renderer.ts` 中的 electronAPI mock
- [ ] main 集测：复制 DAO 测试模板（4 个 vi.mock + 内存 DB init）
- [ ] main 单测：`vi.hoisted()` 创建 mock service，`vi.mock()` 替换依赖
- [ ] 运行 `pnpm vitest run <你的文件>` 验证通过
