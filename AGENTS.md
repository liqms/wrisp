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
- `pnpm rebuild` is required after Node.js version changes (better-sqlite3 native addon).
- No test framework is configured. No CI/CD (.github does not exist).

## Architecture

```
src/
  main/          Electron main process (Node)
    index.ts         Entry: creates window, loads env, runs DB migration, registers IPC handlers
    preload.ts       Delegates to preload/index.ts
    preload/         IPC client modules (exposed to renderer via contextBridge)
    ipcMain/         IPC server handlers (one file per domain)
    core/db/         better-sqlite3 DAO layer (connection, base DAO, per-entity DAOs)
    core/migration/  Database migration logic
    core/services/   Business logic services
    core/apis/       External API integrations
    schemas/         Copied to dist-electron/schemas at build time
    utils/           Logger (winston), etc.
  renderer/      Vue 3 app
    main.ts          Entry: creates Vue app, installs Pinia, Router, Naive UI, i18n
    App.vue          Root component (Naive UI providers, theme, i18n init)
    router/          Vue Router (hash history)
    store/           Pinia stores (config, novel, system, webview, notification)
    views/           Page components (Home, Settings, Chat, Creation, Knowledge)
    layouts/         Layout wrappers
    composables/     Composable functions
    plugins/         Naive UI + i18n setup
    styles/          SCSS global styles
  shared/        Code shared between main and renderer
    enums/           Config, error codes, log levels, novel enums, user enums
    types/           TypeScript interfaces (novel, folder, file, webview, system, notification, config, API types)
    utils/           Shared utilities
    i18n/            Internationalization
    helper/          Shared helpers
```

## Key facts

- **IPC pattern**: Each domain (config, window, system, logger, webview, folder, novel) has a preload module (`src/main/preload/modules/`) and an IPC handler (`src/main/ipcMain/`). The renderer accesses them via `window.electronAPI.<domain>.*`.
- **Database**: SQLite via better-sqlite3, WAL mode, foreign keys ON. Stored at `app.getPath('userData')/database/main.db`. Schema is defined in migration files (see `docs/sqlite.md`).
- **Config**: electron-store based (`docs/config.md`).
- **Path alias**: `@/` maps to `./src/` (configured in tsconfig and vite config).
- **State management**: Pinia stores. i18n depends on store state — `initI18n()` is called after store creation.
- **Styling**: Sass (sass-embedded) with SCSS.
- **Router**: Hash history (`createWebHashHistory`).
- **Nuance**: `pnpm clean` uses Windows `del` command (will fail on Unix/macOS — use `rm -rf` manually).

## Conventions

- Vue files use `<script setup lang="ts">` syntax.
- Source is TypeScript throughout. `noUnusedLocals` and `noUnusedParameters` are strict.
- `.env` is checked into the repo (`.env` is in `.gitignore` but a `.env` file exists). Do NOT commit secrets to it.
- `docs/` is gitignored — do not read from or write to it for runtime configuration.
- Preload entry is `src/main/preload.ts` but actual code lives in `src/main/preload/index.ts`. When adding IPC channels, add both a preload module and an ipcMain handler.
