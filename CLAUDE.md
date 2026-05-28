# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # Install dependencies (Node.js 24+, pnpm required)
pnpm dev              # Dev server — scripts/dev.js kills port 5173, starts Vite + Electron
pnpm build            # vue-tsc && vite build (typecheck + compile)
pnpm start            # electron . (run built app)
pnpm lint             # eslint . --fix
pnpm typecheck        # vue-tsc --noEmit
pnpm prod             # vite build && electron-builder (release)
pnpm rebuild          # electron-rebuild -f -w better-sqlite3 (after Node upgrade)
pnpm clean            # Windows-only (uses `del`); on macOS/Linux use rm -rf manually
```

No test framework is configured. No CI/CD.

## Architecture

```
src/
  main/               Electron main process (Node.js, CommonJS output)
    index.ts              Entry: DB migration → create window → register IPC handlers
    preload.ts            Thin entry; delegates to src/main/preload/index.ts
    preload/              contextBridge IPC client modules + listener/notification.ts
    ipcMain/              ipcMain.handle() handlers (one file per domain)
    core/db/              better-sqlite3 layer: connection.ts, base.dao.ts, 15+ entity DAOs
    core/migration/       DB schema migration (applies src/main/schemas/init.sql DDL)
    core/services/        ConfigService (electron-store), WindowService
    core/apis/            Wraps services with try/catch → ResponseWrapper
    core/scheduler/       Task scheduler (commented out in index.ts)
    core/vector/          LanceDB vector store
    schemas/              Copied to dist-electron/schemas at build time via vite config
    utils/                Logger (winston), crypto, version, response.ts (ResponseWrapper)
  renderer/            Vue 3 app (TypeScript, <script setup lang="ts">)
    main.ts               Creates app, installs Pinia → Router → Naive UI → i18n
    App.vue                Naive UI providers, theme, initI18n() on mounted
    router/                Vue Router (hash history)
    store/                 Pinia composition API stores (config, capture, notification, webview, system)
    composables/           Thin wrappers around stores for component use
    views/                 Page components (Welcome, CaptureView, DemoView, ChatView)
    plugins/               Naive UI + i18n setup
  shared/              Code shared across main and renderer
    enums/                 Config, error codes, AI, record, log, user enums
    types/                 TypeScript interfaces
    i18n/                  Internationalization resources
```

## IPC channel pattern

To add a new IPC channel, create files in all four locations:
1. `src/main/preload/modules/<domain>.ts` — `ipcRenderer.invoke()` via contextBridge
2. `src/main/ipcMain/<domain>.ipc.ts` — `ipcMain.handle()`, calls core/api
3. `src/main/core/apis/<domain>.api.ts` — business logic wrapped in ResponseWrapper
4. Register in `src/main/ipcMain/index.ts`

Renderer accesses via `window.electronAPI.<domain>.<method>()`.

## Database (better-sqlite3)

- `src/main/core/db/connection.ts` — WAL mode, foreign keys ON
- Workspace path set via `globalThis.__PENTIP_WORKSPACE_PATH__` (shared across module bundles)
- `BaseDao` in `base.dao.ts` — abstract class with auto-timestamps (`created_at`, `updated_at`), table name validation, paginated queries
- Migration reads `src/main/schemas/init.sql` for DDL
- Full storage architecture: `docs/storage/storage.md`

## Config

- Singleton `ConfigService` (electron-store) at `<userData>/config/app.json`
- Defaults: `src/main/constants/config.constants.ts`
- Config changes trigger `configMigration` and `databaseMigration`
- Details: `docs/config/config.md`

## Error handling

- API layer (`core/apis/`) returns `ResponseWrapper.success(data)` / `ResponseWrapper.error(ErrorCode, error)`
- `ErrorCode` enum: string values with `ERROR.` prefix (exception: `WEBVIEW_DESTROY_FAILED` lacks prefix)
- Renderer: `handleApiError(response, showNotification?)` in `src/renderer/utils/error.utils.ts`

## Enums convention

```typescript
export const THEME = { DARK: 'dark', LIGHT: 'light' } as const;
export type Theme = (typeof THEME)[keyof typeof THEME];
```

## Key constraints & pitfalls

1. **Strict TypeScript**: `noUnusedLocals` and `noUnusedParameters` are errors — builds fail on unused vars
2. **Port 5173 strict**: Vite dev server will error if port is in use; dev.js auto-kills the occupant
3. **CommonJS output**: The project is `"type": "commonjs"` — main/preload build to CJS
4. **Path alias**: `@/` → `./src/` in both tsconfig and Vite
5. **i18n init ordering**: Must call `initI18n()` after Pinia store creation (done in `renderer/main.ts` + `App.vue` mounted)
6. **`.env` checked in**: The file is committed — never put secrets in it
7. **`docs/` is gitignored**: Documentation lives outside the repo
8. **Scheduler disabled**: `Scheduler.getInstance()` is commented out in `src/main/index.ts`
9. **Only Capture menu wired**: Other routes (Create, Think, Chat) exist in router but not in sidebar menu
10. **`clean` script is Windows-only**: Uses `del` command
11. **Global state pattern**: Workspace path uses `globalThis` to survive module bundling — fragile, avoid adding more globalThis usage

## Vue / styling conventions

- `<script setup lang="ts">` syntax throughout
- SCSS via sass-embedded
- Naive UI component library (not Element Plus, despite `@element-plus/icons-vue` being listed as a dependency)
- Route guard in router `beforeEach` handles WebView hide on chat exit (incomplete)
