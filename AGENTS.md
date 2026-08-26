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
- **Tier 2 — domain agents (by subsystem)**: [`ipc-channel-agent`](.github/agents/ipc-channel-agent.md), [`dao-agent`](.github/agents/dao-agent.md), [`migration-agent`](.github/agents/migration-agent.md), [`model-gateway-agent`](.github/agents/model-gateway-agent.md), [`smart-tasks-agent`](.github/agents/smart-tasks-agent.md), [`task-queue-agent`](.github/agents/task-queue-agent.md), [`vector-agent`](.github/agents/vector-agent.md), [`skills-agent`](.github/agents/skills-agent.md), [`scheduler-agent`](.github/agents/scheduler-agent.md), [`editor-agent`](.github/agents/editor-agent.md), [`store-agent`](.github/agents/store-agent.md), [`ui-component-agent`](.github/agents/ui-component-agent.md), [`i18n-agent`](.github/agents/i18n-agent.md), [`project-domain-agent`](.github/agents/project-domain-agent.md).

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
  - `schemas/` — `init.sql` copied to `dist-electron/schemas` at build time (`vite.config.ts:copySchemas`). `migrations/` is empty.
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
- **Tests**: Vitest + happy-dom; unit/integration specs in `tests/`, coverage via `@vitest/coverage-v8`, shared setup `tests/setup/renderer.ts`.

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
