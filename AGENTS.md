# PenTip — Agent Guide

## Quick start

```bash
pnpm install
pnpm dev              # dev server (Electron + Vite, strict port 5173)
pnpm typecheck        # vue-tsc --noEmit (included in build)
pnpm lint             # eslint . --fix
pnpm build            # vue-tsc && vite build
pnpm prod             # vite build && electron-builder (production release)
pnpm rebuild          # electron-rebuild -f -w better-sqlite3 (after Node.js upgrade)
pnpm clean            # del /Q /S dist-renderer dist-electron release node_modules\.vite (Windows only)
pnpm start            # electron . (run built app)
```

- Node.js 24+, pnpm required.
- `pnpm dev` runs `scripts/dev.js` which auto-kills any process on port 5173, then starts `vite`. `vite-plugin-electron` spawns Electron automatically.
- `pnpm rebuild` required after Node.js version changes (better-sqlite3 native addon).
- `pnpm clean` uses Windows `del` — on Unix use `rm -rf dist-renderer dist-electron release`.
- No test framework configured. No CI/CD.

## Architecture

Single-package Electron + Vue 3 app. Three source roots in `src/`:

- **`src/main/`** — Electron main process (Node)
  - `index.ts` entry: loads env (`dotenv`), creates window, runs DB migration, registers 5 IPC handlers. Scheduler init is commented out.
  - `preload.ts` → `preload/index.ts` — thin wrapper; actual logic in `preload/index.ts`
  - `preload/modules/` — 9 modules: ai, capture, config, logger, project, skill, system, webview, window
  - `ipcMain/` — 5 handlers: config, logger, system, webview, window (registered in `ipcMain/index.ts`, imported in `main/index.ts`)
  - `core/apis/` — API layer: try/catch wrappers returning `ResponseWrapper`
  - `core/services/` — Business logic: config, window, webview, system, notification, record, cleanup
  - `core/db/` — 17 entity DAOs extending `BaseDao<T,C,U>` (better-sqlite3, WAL mode, foreign keys ON)
  - `core/scheduler/` — Scheduler + backup/cleanup tasks (exists but disabled in main entry)
  - `core/migration/` — Config + database migration logic (applies `schemas/init.sql`)
  - `core/vector/` — LanceDB vector store
  - `schemas/` — `init.sql` copied to `dist-electron/schemas` at build time (`vite.config.ts:copySchemas`)

- **`src/renderer/`** — Vue 3 app
  - `main.ts` entry: creates Vue app, installs Pinia → Router → Naive UI → i18n (initI18n after Pinia)
  - `router/` — Hash history. Routes: Welcome, Capture, Chat, Projects. Route guard hides webview on chat exit.
  - `store/` — 6 Pinia stores (composition API): config, capture, notification, project, system, webview
  - `views/` — Welcome.vue, CaptureView.vue, webview/ChatView.vue, ProjectView.vue. SettingsView is a component at `components/SettingsView.vue` (not a route view).
  - `layouts/` — MenuLayout.vue only (sidebar shows Capture, Projects, and Chat menu items)
  - `composables/` — 8 wrappers: useConfig, useCapture, useProject, useSystem, useWebView, useTheme, useNotification
  - `components/` — AppHeader.vue, SettingsView.vue, settings/GeneralSettings.vue, settings/ModelSettings.vue, settings/KeymapSettings.vue

- **`src/shared/`** — Main–renderer shared code
  - `enums/` — Config, error codes, AI, capture, project, log, user, themeColor
  - `types/`, `i18n/`, `utils/`, `helper/`

Path alias: `@/` → `./src/` (tsconfig.app.json + vite.config.ts).

## Key facts

- **IPC 4-layer pattern**: preload module (`preload/modules/<domain>.ts`) → preload types → core API (`core/apis/<domain>.api.ts`) → ipcMain handler (`ipcMain/<domain>.ipc.ts`). Register in `ipcMain/index.ts`. Reference: `.github/instructions/ipc-channel.instructions.md`. Prompt template: `.github/prompts/add-ipc-channel.prompt.md`.
- **DAO pattern**: 17 entity DAOs extend `BaseDao<T,C,U>`. Reference: `.github/instructions/dao-pattern.instructions.md`.
- **DB path**: `<workspace>/sqlite/main.db` (workspace from config or `globalThis.__PENTIP_WORKSPACE_PATH__`).
- **Config**: electron-store at `<userData>/config/app.json`. Defaults in `src/main/constants/config.constants.ts`.
- **i18n**: Must init after Pinia store creation (done in both `renderer/main.ts` and `App.vue` mounted).
- **TypeScript strict**: `noUnusedLocals` + `noUnusedParameters` are **strict** — build fails on unused vars.
- **Enums pattern**: `export const X = { ... } as const` + `type X = (typeof X)[keyof typeof X]`.
- **ESLint**: flat config (`eslint.config.js`). `vue/multi-word-component-names: "off"`.
- **Styling**: Sass (sass-embedded) with SCSS.

## Key pitfalls

1. **pnpm clean is Windows-only**: Uses `del` command.
2. **Scheduler disabled**: `Scheduler.getInstance()` in `src/main/index.ts` is commented out. Uncomment + add import to enable.
3. **Router has been updated**: Routes now include Welcome, Capture, Chat, and Projects. SettingsView is a modal component (`components/SettingsView.vue`), not a route view — do not import it as a route component.
4. **Route guard incomplete**: `beforeEach` guard handles webview hide on chat exit but logic is incomplete.
5. **i18n init ordering**: `initI18n()` called in both `renderer/main.ts` and `App.vue` mounted — both after Pinia init.
6. **`src/main/utils/error.ts` is empty**: All error handling is inline in `core/apis/`.
7. **docs/ is gitignored**: Don't reference docs/ files — they may not exist for all developers.
8. **Preload entry indirection**: `src/main/preload.ts` delegates to `preload/index.ts`. Add new preload modules in `preload/modules/` and register in `preload/modules/index.ts`.
9. **MenuLayout has hardcoded Chinese labels**: The "作品" menu label in `MenuLayout.vue` is hardcoded Chinese text, not using i18n.
10. **Missing view files no longer a build blocker**: Welcome.vue, CaptureView.vue, ProjectView.vue, and webview/ChatView.vue all exist. No route references to non-existent view files.




