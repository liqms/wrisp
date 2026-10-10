# Wrisp — Agent Guide

## Quick start

```bash
pnpm install
pnpm dev              # dev server (Electron + Vite, strict port 5173)
pnpm typecheck        # vue-tsc --noEmit (included in build)
pnpm lint             # eslint . --fix
pnpm test             # vitest run
pnpm test:watch       # vitest (watch mode)
pnpm test:coverage    # vitest run --coverage (v8 provider)
pnpm build            # vue-tsc && vite build
pnpm prod             # vite build && electron-builder (production release)
pnpm rebuild          # electron-rebuild -f -w better-sqlite3 (after Node.js upgrade)
pnpm clean            # rd /Q /S dist-renderer dist-electron release (Windows only)
pnpm start            # electron . (run built app)
```

- Node.js 24+, pnpm required.
- `pnpm dev` runs `scripts/dev.js`: it frees port 5173 (kills the occupying process), patches `execSync` so `taskkill` failures don't crash the dev process, then spawns `vite`. `vite-plugin-electron` starts Electron automatically.
- `pnpm rebuild` required after Node.js version changes (better-sqlite3 native addon).
- `pnpm clean` is Windows-only (`rd`); on Unix use `rm -rf dist-renderer dist-electron release`.
- Tests: Vitest (happy-dom, globals), setup in `tests/setup/renderer.ts`, specs in `tests/unit/` and `tests/integration/`. Test types via `tsconfig.vitest.json`. No CI/CD workflows in `.github`.

## Specialized agents

Task-specific agent definitions live in [`.github/agents/`](.github/agents/). They use a 3-tier progressive-loading model — load only what a task touches, not everything at once.

- **Tier 0 — router (always on)**: [`wrisp-router`](.github/agents/wrisp-router.md) decomposes a request, identifies touched source roots + subsystems, dispatches to Tier 1/2, and aggregates results. Entry point for any non-trivial change.
- **Tier 1 — layer agents (by source root)**: [`main-process-agent`](.github/agents/main-process-agent.md), [`renderer-agent`](.github/agents/renderer-agent.md), [`shared-agent`](.github/agents/shared-agent.md).
- **Tier 2 — domain agents (by subsystem)**: [`ipc-channel-agent`](.github/agents/ipc-channel-agent.md), [`dao-agent`](.github/agents/dao-agent.md), [`migration-agent`](.github/agents/migration-agent.md), [`model-gateway-agent`](.github/agents/model-gateway-agent.md), [`smart-tasks-agent`](.github/agents/smart-tasks-agent.md), [`task-queue-agent`](.github/agents/task-queue-agent.md), [`vector-agent`](.github/agents/vector-agent.md), [`skills-agent`](.github/agents/skills-agent.md), [`scheduler-agent`](.github/agents/scheduler-agent.md), [`editor-agent`](.github/agents/editor-agent.md), [`store-agent`](.github/agents/store-agent.md), [`ui-component-agent`](.github/agents/ui-component-agent.md), [`i18n-agent`](.github/agents/i18n-agent.md), [`project-domain-agent`](.github/agents/project-domain-agent.md), [`wrisp-test-agent`](.github/agents/wrisp-test-agent.md) (测试规划 / 用例设计 / 执行归因 / 缺陷修复联动 / 覆盖率守护，仅产出 `tests/**`).

Each agent defines: triggers, knowledge scope, workflow, project-specific pitfalls, a YAML dispatch context contract, and an exit checklist. Start from `wrisp-router` and follow its keyword→agent mapping table.

## Architecture

Single-package Electron + Vue 3 app. Three source roots in `src/`:

- **`src/main/`** — Electron main process (Node)
  - `index.ts` entry: loads env (`dotenv`), runs DB init/migration, registers protocol handler, initializes skill manager + vector service, restores the persistent task queue (user-confirmed resume flow), starts 3 task workers, creates window/menu/tray, registers 19 IPC handler groups (20 exported in `ipcMain/index.ts`; `search` not wired — see pitfall #4), and starts the scheduler (`scheduler.startAll()`).
  - `preload.ts` → `preload/index.ts` — deprecated thin wrapper; real logic in `preload/index.ts` (contextBridge exposes `window.electronAPI` = 20 domain modules + generic IPC + notification listener).
  - `preload/modules/` — 20 modules: ai, concept, config, journal, logger, model, page, project, reflection, search, skill, smart-task, system, tag, task, template, topic, update, webview, window (registered in `preload/modules/index.ts`); `preload/listeners/` — download + notification event bridges.
  - `ipcMain/` — 20 handler files: window, system, logger, config, webview, journal, project, ai, skill, model, tag, page, concept, topic, reflection, smart-task, task, search, template, update. All except `search` are registered in `main/index.ts` (19 of 20).
  - `core/apis/` — per-domain API layer (19 files; `window` has no API layer — see pitfall #5) returning `ResponseWrapper` (`src/main/utils/response.ts`).
  - `core/services/` — business logic: ai, chunk, cleanup, concept, config, download, journal, model, notification, page, project, reflection, search, system, tag, template, topic, tray, update, vector, webview, window + `base/` (auto, backup, file, workspace-init).
  - `core/db/` — 20 entity DAOs + `migrationDb.dao` extending `BaseDao<T,C,U>` (better-sqlite3, WAL mode, foreign keys ON).
  - `core/scheduler/` — Scheduler + backup/cleanup tasks (**enabled** in main entry).
  - `core/migration/` — config / database / model migration logic (applies `schemas/init.sql`). `getTargetVersion()` uses `getDatabaseVersion() || "0.0.0"` as lower bound (see pitfall #18).
  - `core/vector/` — LanceDB vector store.
  - `core/model-gateway/` — LLM gateway (adapters for openai/claude/deepseek/qwen/volcengine/local, provider manager, router with failover/load-balancer/model-selector, cost tracker) + local gateway (embedding/LLM/rerank workers).
  - `core/skills/` — skill manager/executor/schema-validator/updater + tool registry.
  - `core/smart-tasks/` — DAG task scheduler + executors (chunk-summary, chunk-vectorize, concept-extract, semantic-link, topic-detection, topic-summary).
  - `core/task-queue/` — persistent task queue + executor (3 workers, resume-on-start flow, `model:download-file` handler).
  - `schemas/` — `init.sql` (full current schema + baseline migration record) copied to `dist-electron/schemas` at build time (`vite.config.ts:copySchemas`). `migrations/` holds versioned upgrade SQL files (`{x.y.z}_{name}.sql`) for existing DBs — see 「数据库版本号与迁移变更规范」.
  - Also: `menu.ts`, `protocol.ts`, `types/db/`, `constants/` (config/model/auto/folder), `utils/` (crypto, http, i18n, logger, response, version).

- **`src/renderer/`** — Vue 3 app
  - `main.ts` entry: creates Vue app, installs Router → Pinia → Naive UI → i18n, then awaits `initI18n()` before `app.mount()`.
  - `router/` — Hash history. Routes under `MenuLayout`: Welcome, Journal, Wiki, Projects. No route guards.
  - `store/` — 14 Pinia stores (composition API): ai, config, download, journal, model, notification, page, project, shortcut, system, tag, template, webview, wiki.
  - `views/` — Welcome.vue, JournalView.vue, WikiView.vue, ProjectView.vue.
  - `layouts/` — MenuLayout.vue only (sidebar shows Journal + Projects).
  - `composables/` — 14 wrappers: useAIStream, useConfig, useJournal, useModel, useNotification, usePage, useProject, useSearch, useShortcut, useSystem, useTag, useTheme, useWebView, useWiki.
  - `plugins/` — i18n.ts, naive-ui.ts.
  - `components/` — AppHeader, GlobalSearch, NotificationToast, SettingsView (modal, not a route view), UpdatePrompt, WebViewContainer + subdirs `base/`, `editor/` (Tiptap + slash menu), `project/`, `settings/`, `welcome/`, `wiki/`.
  - `styles/` — global.scss, themes.scss, `_variables.scss`, `_fonts.scss`, `_markdown.scss`.
  - `utils/`, `types/` (electron.d.ts declares `window.electronAPI`).

- **`src/shared/`** — Main–renderer shared code
  - `enums/` — ai, config, errorCode, journal, log, page, profession, project, provider, task, template, themeColor, user
  - `types/` — api, base, chunk, config, journal, llm, menu, model, notification, page, skill, system, tag, task, template, webview
  - `i18n/` — `types.ts` + `locales/enUS.ts` + `locales/zhCN.ts`
  - `utils/` — id, object, pagination, time, validate

Path alias: `@/` → `./src/` (tsconfig.app.json, vite.config.ts, vitest.config.ts).

## Key facts

- **IPC 4-layer pattern**: preload module (`preload/modules/<domain>.ts`) → preload type (`preload/types/<domain>.ts`) → core API (`core/apis/<domain>.api.ts`) → ipcMain handler (`ipcMain/<domain>.ipc.ts`), registered in `ipcMain/index.ts` and wired in `main/index.ts`. Reference: `.github/instructions/ipc-channel.instructions.md`. Prompt template: `.github/prompts/add-ipc-channel.prompt.md`.
- **DAO pattern**: 20 entity DAOs + `migrationDb.dao` extend `BaseDao<T,C,U>` (table-name validation + auto timestamps). Reference: `.github/instructions/dao-pattern.instructions.md`.
- **DB path**: `<workspace>/sqlite/main.db` (workspace from config or `globalThis.__WRISP_WORKSPACE_PATH__`).
- **Config**: electron-store at `<userData>/config/app.json`. Defaults in `src/main/constants/config.constants.ts`; migrations in `core/migration/config.migration.ts`.
- **i18n**: `initI18n()` lives in `renderer/plugins/i18n.ts`; awaited before mount in `renderer/main.ts` and called again in `App.vue` mounted — both after Pinia is installed.
- **TypeScript strict**: `noUnusedLocals` + `noUnusedParameters` are **strict** in `tsconfig.app.json` — build fails on unused vars. `tsconfig.vitest.json` relaxes them for tests.
- **Enums pattern**: `export const X = { ... } as const` + `type X = (typeof X)[keyof typeof X]`.
- **ESLint**: flat config (`eslint.config.mjs`). `vue/multi-word-component-names: "off"`.
- **Styling**: Sass (sass-embedded) with SCSS.
- **Frontend notifications**: renderer-process toasts (`notify.info/success/warn/error`) must go through `useFrontendNotification()` from `src/renderer/composables/useNotification.ts` — do NOT use Naive UI's `useMessage()` directly; keep `useDialog()` only for modal confirmations.
- **Tests**: Vitest + happy-dom; unit/integration specs in `tests/`, coverage via `@vitest/coverage-v8`, shared setup `tests/setup/renderer.ts`.

## 数据库版本号与迁移变更规范

背景：`src/main/schemas/init.sql` 承载**当前完整 schema**，全新库启动时只执行 `init.sql`；`src/main/schemas/migrations/` 只用于升级存量库。两者必须同步，否则下次启动会重放 `ADD COLUMN`（SQLite 无 `IF NOT EXISTS`）并因 `duplicate column name` 直接崩溃。

术语与铁律：

- **目标版本** = `migrations/` 下迁移文件的最高版本号。
- **基线版本** = `init.sql` 文末写入 `migrations_db` 那条记录的 `version`。
- **铁律：基线版本 === 目标版本。** 三处（`init.sql` 头部注释、`init.sql` 基线记录、`migrations/` 最高文件）必须完全相同。

### 1. 触发条件（何时必须改版本号）

满足任一即**必须**新增迁移版本，并把 `init.sql` 基线同步到新版本：

- 新增 / 修改 / 删除 表、列、索引（任何 DDL 变更）。
- 新增一张需要存量库补齐的表（参考 `0.2.0` characters、`0.3.0` creation_sessions）。
- 新增列只在全新库存在、存量库需要补列。
- 需要一次性数据重建（去重、回填、清标记等，参考 `0.5.0` dedupe）。

**不需要**改版本号：仅改业务代码 / DAO 查询 / 索引使用方式、不触碰 schema 的重构。

### 2. 命名规则与格式

- 迁移文件名：`{x.y.z}_{snake_case_name}.sql`，例如 `0.5.1_chunk_stage_marks.sql`。
  - 必须是**三段数字** `x.y.z`；禁止 `v` 前缀、两位、四位或缺段（解析正则为 `^(\d+\.\d+\.\d+)_(.+)\.sql$`，见 `parseMigrationFileName`）。
  - 选号：兼容性小修用 patch（如 `0.5.0` → `0.5.1`），结构性 / 行为性变更加 minor；排序由 `compareVersions` 决定。
- 迁移文件**末尾必须自登记**迁移记录（直接照抄任一现有迁移文件的模板）：
  - `INSERT OR IGNORE INTO migrations_db (...) VALUES (...)`；
  - `id` 用 `00000000-0000-0000-0000-0000000000NN` 递增；
  - `executed_at` / `created_at` / `updated_at` 用 `strftime('%Y-%m-%dT%H:%M:%fZ','now')`（与 `init.sql` 基线的 ISO 格式一致，保证 `getCurrentVersion` 排序正确）。
- DDL 尽量写成幂等：`CREATE TABLE/INDEX IF NOT EXISTS`。

### 3. 操作步骤

1. 确定新版本号（严格大于当前 `migrations/` 最高版本）。
2. 新增 `migrations/<version>_<name>.sql`：写 schema 变更 + 末尾自登记记录。
3. 同步 `init.sql`（**最容易漏，也是历史事故根因**）：
   - 把同一批表 / 列 / 索引补进 `init.sql`；
   - 更新头部注释 `-- 版本: x.y.z`；
   - **把文末基线记录的 `version` 改成新版本号**。
4. 涉及数据重建（非纯 DDL）时：在 `core/migration/database.migration.ts` 增加**幂等**方法，并在 `main/index.ts` 的 `initializeDatabase()` 中按顺序调用（参考 `applyConceptDedupMigration()` / `ensureChunkSummaryStageColumn()`，只在跨越该版本时执行一次）。
5. 需要为存量库补列时，优先用 `ensureXxxColumn()` 模式（`PRAGMA table_info` 判存在后再 `ALTER`），不要依赖迁移文件被重放。
6. 执行第 5 节的验证。

### 4. 责任人与审批

- **责任人**：本次 schema 变更的**作者**，负责「迁移文件 + `init.sql` 基线 + 测试」三处一致。
- **审批人**：PR 至少 **1 名 reviewer** 审批；涉及 schema / 基线变更的 PR 需在描述中标注 `DB migration`。
- **Reviewer 检查清单**：
  - [ ] `init.sql` 基线版本 == `migrations/` 最高版本（第 2 节铁律）。
  - [ ] `init.sql` 与迁移文件给出的表 / 列 / 索引一致。
  - [ ] 迁移文件已自登记且可重复执行不报错。
  - [ ] 数据重建步骤幂等、且只在跨越该版本时执行一次。
  - [ ] 第 5 节自动化测试通过。
- 本项目无 CI（`.github` 无 workflows），审批与验证均为本地手动执行。

### 5. 验证方法

- 自动化：`pnpm test`（重点 `tests/integration/main/migrations.*.test.ts`、`concept-dedup-migration.test.ts`、`chunk-stage-marks.test.ts`）；`pnpm typecheck`；`pnpm lint`。
  （注：`better-sqlite3` 原生模块同一时刻只能匹配一种 ABI——跑测试用 Node ABI，跑应用用 Electron ABI，切换时执行 `pnpm rebuild`。)
- 手动「两步启动」验证（复现 / 防回归关键，务必执行第 2 步）：
  1. 删除 `<workspace>/sqlite/*.db` → 启动应用 → 正常退出。
  2. **再次启动**（首次仅执行 `init.sql`，迁移文件要到第二次启动才可能被重放）→ 若报 `duplicate column name`，即基线未同步，回到第 3 节。
- 存量库验证：用旧版本 DB 启动，确认迁移成功、`migrations_db` 版本前进。
- 版本核对 SQL（最高 `executed_at` 的 `version` 应等于目标版本）：

  ```sql
  SELECT version, status, executed_at FROM migrations_db ORDER BY executed_at DESC;
  ```

## Key pitfalls

1. **pnpm clean is Windows-only**: Uses `rd /Q /S dist-renderer dist-electron release 2>nul`; on Unix use `rm -rf dist-renderer dist-electron release`.
2. **Scheduler is enabled**: `scheduler.startAll()` runs in `src/main/index.ts` — do not treat it as disabled. Backup/cleanup tasks live in `core/scheduler/`.
3. **Router is minimal**: Routes are Welcome, Journal, Wiki, Projects only. Capture/Chat/Think routes were removed; `SettingsView` is a modal component (`components/SettingsView.vue`), not a route view.
4. **search IPC is not wired**: `search.ipc.ts` is exported in `ipcMain/index.ts` and preload/API modules exist, but `registerSearchHandlers` is NOT called in `main/index.ts`. Wire it up if search should work end-to-end.
5. **window IPC breaks the 4-layer pattern**: `window` has preload + ipcMain modules but no `core/apis/window.api.ts`.
6. **i18n init ordering**: `initI18n()` must run after Pinia store creation; it's awaited before mount in `renderer/main.ts` and called again in `App.vue` mounted.
7. **docs/ is gitignored**: Don't reference docs/ files — they may not exist for all developers.
8. **Preload entry indirection**: `src/main/preload.ts` delegates to `preload/index.ts`. Add new preload modules in `preload/modules/`, register in `preload/modules/index.ts`, and add types in `preload/types/`.
9. **MenuLayout has hardcoded Chinese labels**: The "作品" menu label is hardcoded (Journal uses i18n).
10. **Capture/Think/Chat were removed**: `capture.*`, `think.*`, `CaptureView.vue`, `ChatView.vue` are gone; `views/webview/` is empty — don't reference them.
11. **`src/main/utils/error.ts` no longer exists**: Error responses go through `utils/response.ts` (`ResponseWrapper`) and inline try/catch in `core/apis/`.
12. **Tests live outside src**: Vitest include patterns target `tests/unit/**` and `tests/integration/**`, not `src/**/__tests__`; `tsconfig.vitest.json` exists but is not part of the `tsconfig.json` project references.
13. **Typecheck excludes tests**: `vue-tsc` only checks `src/` (tsconfig.app.json); test files are only checked when `tsconfig.vitest.json` is explicitly invoked.
14. **Database uses v2 tables only**: `semantic_chunks`/`concept_chunks`/`topic_chunks`/`concepts`/`topics`/`topic_concepts` exist; v1 tables (`blocks`/`concept_blocks`/`topic_blocks`) do **not** exist. `semantic_chunks` must not contain `content_type`, `source`, `language`, `metadata`, `parent_chunk_id`, `split_index`, or `is_memo` fields.
15. **`v-html` must be sanitized**: All `v-html` usage must go through `sanitizeHtml()` from `src/renderer/utils/sanitize.ts`.
16. **CJS worker path resolution**: In CJS modules use `createRequire(__filename)` instead of `import.meta.url` (compiles to `undefined` under Vite). Worker files must be bundled separately (CJS format), referenced via `__dirname`, and use `parentPort.on('message')`/`parentPort.postMessage()` (Node worker_threads), not `self.onmessage`/`self.postMessage`. Vite main/preload/worker entries use `target: 'node22'`.
17. **ProseMirror text scanning**: `doc.textBetween` returns empty string (`""`) at node boundaries, not `\n` — scanning loops must check for `""` as a termination condition. Backward slash-command searches must use `doc.resolve(pos).start()` as the lower bound, never `Math.max(0, pos - N)` (a fixed window crosses into the previous block).
18. **Migration target version lower bound**: `getTargetVersion()` in `core/migration/database.migration.ts` must use `this.getDatabaseVersion() || "0.0.0"` — without the current-version lower bound, an empty `migrations/` dir plus an already-executed baseline defaults to `0.0.0` and triggers a false "current version higher than target" warning.
19. **Migration baseline must equal the highest migration version**: When adding `schemas/migrations/<x.y.z>_<name>.sql`, you MUST also add the same DDL to `init.sql` AND bump the `version` of the baseline record at the end of `init.sql` to `<x.y.z>`. Otherwise a fresh DB records the old baseline, replays the migration files on the next launch, and crashes with `duplicate column name` (SQLite `ALTER TABLE ADD COLUMN` has no `IF NOT EXISTS`). Full procedure: see 「数据库版本号与迁移变更规范」 above.

## Documentation management

`docs/` maintains a living index at [`docs/INDEX.md`](docs/INDEX.md). **Every time a file is added, renamed, moved, or deleted under `docs/`, you must同步更新 `docs/INDEX.md`** — including the directory tree, file table, and any cross-references in other docs that point to the changed file.

Rules:

- **Sync on change**: Any `docs/` file add/rename/move/delete → update `docs/INDEX.md` in the same commit.
- **Cross-reference repair**: After moving a file, grep all `docs/**/*.md` for stale relative links and fix them.
- **Directory taxonomy**: `architecture/` = technical design, `features/` = feature descriptions, `product/` = strategy & roadmap, `user-research/` = user-type analysis, `guides/` = how-to, `ui/` = UI design, `decisions/` = ADR, `discussions/` = discussion notes, `superpowers/` = dev plans & specs.
- **File naming**: `features/` uses `<module>-features.md`; `user-research/` uses `<user-type>.md`; `decisions/` and `discussions/` use `YYYY-MM-DD-<topic>.md`.
