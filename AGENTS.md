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
pnpm clean            # del /Q /S dist-renderer dist-electron release node_modules\.vite
pnpm start            # electron . (run built app)
```

- Node.js 24+, pnpm required.
- `pnpm dev` runs `scripts/dev.js` which auto-kills any process on port 5173, then starts Vite. Vite-plugin-electron spawns Electron automatically.
- `pnpm rebuild` required after Node.js version changes (better-sqlite3 native addon).
- No test framework configured. No CI/CD.

## Architecture

```
src/
  main/          Electron main process (Node)
    index.ts         Entry: creates window, loads env, runs DB migration, registers IPC handlers
    preload.ts       Delegates to src/main/preload/index.ts
    preload/         IPC client modules (exposed to renderer via contextBridge)
    ipcMain/         IPC server handlers (one file per domain)
    core/db/         better-sqlite3 DAO layer (connection.ts, base.dao.ts, per-entity DAOs)
    core/migration/  Database migration logic
    core/services/   Business logic services (ConfigService, WindowService)
    core/apis/       API layer wrapping services with error handling
    core/scheduler/  Task scheduler (currently commented out in index.ts)
    core/vector/     Vector store (LanceDB)
    schemas/         Copied to dist-electron/schemas at build time
    utils/           Logger (winston), crypto, version, response wrapper
  renderer/      Vue 3 app
    main.ts          Entry: creates Vue app, installs Pinia, Router, Naive UI, i18n
    App.vue          Root component (Naive UI providers, theme, i18n init)
    router/          Vue Router (hash history)
    store/           Pinia stores (composition API)
    views/           Page components (Welcome, CaptureView, DemoView, ChatView)
    composables/     Wrapper composables for stores (useConfig, useCapture, etc.)
    plugins/         Naive UI + i18n setup
    styles/          SCSS global styles
  shared/        Code shared between main and renderer
    enums/           Config, error codes, AI, record, log, user enums
    types/           TypeScript interfaces (config, capture, API, system, webview, notification)
    i18n/            Internationalization
```

## Key patterns

### IPC channels
Each domain has a pair: `src/main/preload/modules/<domain>.ts` + `src/main/ipcMain/<domain>.ipc.ts`.
- **Preload** uses `ipcRenderer.invoke()` and exports typed object.
- **IPC handler** uses `ipcMain.handle()` and calls `src/main/core/apis/<domain>.api.ts`.
- **Renderer** accesses via `window.electronAPI.<domain>.<method>()`.
- `src/main/ipcMain/index.ts` imports and registers all handlers.

To add a new channel, create files in all four locations: preload module → ipcMain handler → core/api function → register in ipcMain/index.ts.

### Database (better-sqlite3)
- Connection: `src/main/core/db/connection.ts` — WAL mode, foreign keys ON. Workspace path stored on `globalThis.__PENTIP_WORKSPACE_PATH__`.
- Base DAO: `src/main/core/db/base.dao.ts` — abstract class with auto-timestamps (`created_at`, `updated_at`), table name validation, paginated query support.
- 15+ entity DAOs extend BaseDao (block, concept, topic, page, tag, reflection, temporalEvent, semanticLink, etc.).
- Migration: `src/main/core/migration/` applies `src/main/schemas/init.sql` DDL.
- Full storage architecture: see `docs/storage/storage.md`.

### Config (electron-store)
- Singleton `ConfigService` stores at `<userData>/config/app.json`.
- Defaults defined in `src/main/constants/config.constants.ts`.
- Config changes trigger `configMigration` and `databaseMigration`.
- Details: `docs/config/config.md`.

### Error handling
- **API layer** (`core/apis/`): All functions wrapped in try/catch, returning `ResponseWrapper.success(data)` or `ResponseWrapper.error(ErrorCode, error)`.
- **Renderer utils** (`src/renderer/utils/error.utils.ts`): `handleApiError(response, showNotification?)` for UI error display.
- `ErrorCode` enum (`src/shared/enums/errorCode.enums.ts`): string values like `'ERROR.CONFIG.GET_FAILED'`, categorized by prefix.
- `src/main/utils/response.ts` provides `ResponseWrapper` class.

### Pinia stores
All stores use composition API (`defineStore('name', () => { ... })`). Five stores in `src/renderer/store/`: config, capture, notification, webview, system. Composables in `src/renderer/composables/` wrap stores for component use.

### Enums pattern
Each enum constant object has a matching derived union type, e.g.:
```typescript
export const THEME = { DARK: 'dark', LIGHT: 'light' } as const;
export type Theme = (typeof THEME)[keyof typeof THEME];
```

## Conventions

- Vue files: `<script setup lang="ts">` syntax.
- Source: TypeScript throughout. `noUnusedLocals` and `noUnusedParameters` are **strict** (build fails on unused vars).
- `.env` is checked into the repo. Do NOT commit secrets to it.
- `docs/` is gitignored — do not read from/write to it at runtime.
- Preload entry is `src/main/preload.ts` but actual logic lives in `src/main/preload/index.ts`.
- Path alias: `@/` → `./src/` (tsconfig + vite config).
- Styling: Sass (sass-embedded) with SCSS. Router: hash history (`createWebHashHistory`).
- i18n depends on Pinia store state — `initI18n()` must be called **after** store creation.

## Key pitfalls

1. **`pnpm clean` is Windows-only**: Uses `del` command — won't work on macOS/Linux (use `rm -rf` manually).
2. **Scheduler disabled**: `Scheduler.getInstance()` in `src/main/index.ts` is commented out. Uncomment and add import to enable.
3. **i18n init ordering**: `initI18n()` called both in `renderer/main.ts` and `App.vue` mounted — both after Pinia init.
4. **Route guard incomplete**: `beforeEach` guard in router handles WebView hide on chat page exit, but logic is incomplete.
5. **Sidebar menu limited**: Only "Capture" menu item active. Create/Think/Chat routes exist but aren't exposed via menu.
6. **ErrorCode inconsistency**: `'WEBVIEW_DESTROY_FAILED'` lacks the `'ERROR.'` prefix that other codes have.
7. **`src/main/utils/error.ts` is empty**: All error handling is inline in `core/apis/` functions.
8. **Workspace path via globalThis**: `__PENTIP_WORKSPACE_PATH__` on `globalThis` is used to share state across module bundling — fragile with tree-shaking.
