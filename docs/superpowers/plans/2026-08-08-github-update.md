# GitHub 升级功能实现计划（electron-updater GitHub Provider）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用 electron-builder + electron-updater 的 GitHub provider，实现 GitHub Actions 自动打包发布到 GitHub Releases，并在应用内从 GitHub 完成检查/下载/安装升级。

**Architecture:** 在 `package.json` 的 `build.publish` 配置 GitHub provider（owner=`liqms`, repo=`pentip`），electron-builder 打包时自动生成 `app-update.yml`（内含 provider 配置）。新增 `.github/workflows/release.yml`：推送 `v*` 标签时在 win/mac/linux 三平台构建并 `electron-builder --publish always`（用 `GH_TOKEN`）上传到 Releases。主进程复用现有基于 `autoUpdater` 的 `UpdateService`，完善事件转发（`update-available` / `download-progress` / `update-downloaded`）到渲染进程，并新增 `update` IPC 域（4 层模式）暴露 `check` / `download` / `install`。设置页"检查更新"触发，`UpdatePrompt.vue` 展示版本、更新说明与下载进度。

**Tech Stack:** electron-builder、electron-updater、GitHub Actions、Electron、Vue 3 + Naive UI。

---

## 文件结构

**新增：**
- `.github/workflows/release.yml` — GitHub Actions 打包发布工作流
- `src/main/core/apis/update.api.ts` — IPC API 包装层
- `src/main/ipcMain/update.ipc.ts` — IPC 处理器
- `src/main/preload/modules/update.ts` — 预加载模块
- `src/main/preload/types/update.ts` — 预加载类型
- `src/main/preload/listeners/update.ts` — 更新事件桥（转发下载进度）

**修改：**
- `package.json` — `build.publish` 增加 GitHub provider
- `src/main/core/services/update.service.ts` — 完善 autoUpdater 事件与下载流程
- `src/main/ipcMain/index.ts` — 注册 update handler
- `src/main/index.ts` — 调用 registerUpdateHandlers + 初始化 updateService
- `src/main/preload/modules/index.ts` — 注册 update 模块
- `src/main/preload/types/index.ts` — 合并 UpdateApi 类型（若以模块聚合）
- `src/renderer/types/electron.d.ts` — 声明 `update` 域与进度监听
- `src/renderer/components/settings/GeneralSettings.vue` — 接入"检查更新"与进度
- `src/shared/i18n/locales/zhCN.ts` / `enUS.ts` — 增加 UPDATE 文案 + ERROR.UPDATE
- `src/shared/enums/errorCode.enums.ts` — 增加更新错误码

---

### Task 1: electron-builder GitHub publish 配置

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 增加 GitHub publish 配置**

在 `package.json` 的 `build` 对象中（`appId` 同级）新增 `publish` 字段，并在 `nsis` 中开启 `publishAutoUpdate`：

```json
  "build": {
    "appId": "com.pentip.app",
    "productName": "PenTip",
    "publish": {
      "provider": "github",
      "owner": "liqms",
      "repo": "pentip",
      "private": false,
      "releaseType": "release"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "perMachine": false,
      "publishAutoUpdate": true
    }
  }
```

> electron-builder 打包时据此在应用内生成 `app-update.yml`（electron-updater 读取该文件定位 GitHub Releases）；Windows NSIS 会额外生成并上传 `latest.yml`（electron-updater 在 Windows 上的更新清单）。macOS 需要代码签名 + 公证才能被 electron-updater 自动更新（本计划提供配置，签名由 CI secrets 注入，见 Task 2）。

- [ ] **Step 2: 本地验证 build 配置可解析**

Run: `pnpm exec electron-builder --help >/dev/null`
Expected: 命令正常执行（配置解析无误）

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "build(update): configure electron-builder github publish provider"
```

---

### Task 2: GitHub Actions 打包发布工作流

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: 创建 release 工作流**

创建 `.github/workflows/release.yml`：

```yaml
name: Build & Release

on:
  push:
    tags:
      - "v*"
  workflow_dispatch:

jobs:
  release:
    name: Release on ${{ matrix.os }}
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 11.20.0

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Rebuild native modules
        run: pnpm rebuild

      - name: Build & Publish to GitHub Releases
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # macOS 签名与公证（可选，如配置了以下 secrets 则启用）
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: pnpm prod --publish always
```

> `on.push.tags: v*`：仅推送 `v1.1.0` 这类标签时触发。`GH_TOKEN` 使用仓库内置的 `GITHUB_TOKEN`（权限需在仓库 Settings → Actions → General 勾选 "Read and write permissions"）。`pnpm prod` = `vite build && electron-builder`，追加 `--publish always` 即上传到当前 tag 对应的 GitHub Release。三平台 job 各自上传产物到同一 Release，Windows 的 `latest.yml`、macOS 的 `latest-mac.yml`、Linux 的 `latest-linux.yml` 也会一并上传，供 electron-updater 使用。

- [ ] **Step 2: 验证 YAML 语法**

Run: `node -e "const y=require('js-yaml'); const fs=require('fs'); y.load(fs.readFileSync('.github/workflows/release.yml','utf8')); console.log('YAML OK')"`
Expected: 输出 `YAML OK`（若 js-yaml 未安装可用 `pnpm dlx js-yaml` 或跳过，仅人工确认缩进正确）

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci(update): add github actions build & release workflow"
```

---

### Task 3: 完善 UpdateService（autoUpdater 事件 + 下载）

**Files:**
- Modify: `src/main/core/services/update.service.ts`

> 现有 `UpdateService` 已用 `autoUpdater` 实现了 `check()` / `download()` / `install()`。本任务在保留其 electron-updater 用法基础上，增加：`autoDownload=false`、暴露下载进度与状态回调、支持外部注入事件处理。

- [ ] **Step 1: 重写 UpdateService**

将 `src/main/core/services/update.service.ts` 整体替换为：

```ts
import { autoUpdater } from "electron-updater";
import { Logger } from "@/main/utils/logger";

/** 下载进度信息 */
export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

/** 更新事件回调集合 */
export interface UpdateEventHandlers {
  onAvailable?: (info: { version: string; releaseNotes?: string }) => void;
  onDownloadProgress?: (progress: UpdateProgress) => void;
  onDownloaded?: (path: string) => void;
  onError?: (message: string) => void;
}

/**
 * 更新服务（electron-updater + GitHub provider）
 * 提供应用更新检查、下载、安装功能
 */
class UpdateService {
  private static instance: UpdateService;

  private constructor() {
    autoUpdater.logger = Logger;
    // 由用户在检查时主动触发下载，避免自动下载
    autoUpdater.autoDownload = false;
    // 应用启动时不自动检查，由"检查更新"按钮触发
    autoUpdater.autoCheckForUpdates = false;
  }

  public static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  /** 注册更新事件处理器（如转发到渲染进程） */
  public onEvents(handlers: UpdateEventHandlers): void {
    if (handlers.onAvailable) {
      autoUpdater.on("update-available", (info) => {
        handlers.onAvailable?.({
          version: info.version,
          releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes : "",
        });
      });
    }
    if (handlers.onDownloadProgress) {
      autoUpdater.on("download-progress", (progress) => {
        handlers.onDownloadProgress?.({
          percent: progress.percent,
          bytesPerSecond: progress.bytesPerSecond,
          transferred: progress.transferred,
          total: progress.total,
        });
      });
    }
    if (handlers.onDownloaded) {
      autoUpdater.on("update-downloaded", (info) => {
        handlers.onDownloaded?.(info.path);
      });
    }
    if (handlers.onError) {
      autoUpdater.on("error", (err) => {
        handlers.onError?.(err?.message ?? String(err));
      });
    }
  }

  /**
   * 检查更新。返回是否发现可用更新。
   */
  public async check(): Promise<boolean> {
    try {
      const result = await autoUpdater.checkForUpdates();
      return !!result?.updateInfo;
    } catch (error) {
      Logger.error("检查更新失败", { error: String(error) });
      throw error;
    }
  }

  /**
   * 下载更新（autoDownload=false 时需手动调用）
   */
  public async download(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      Logger.error("下载更新失败", { error: String(error) });
      throw error;
    }
  }

  /**
   * 安装更新（静默下载完成后调用，Windows/mac 会退出并重启）
   */
  public install(): void {
    autoUpdater.quitAndInstall();
  }
}

export default UpdateService;

export const updateService = UpdateService.getInstance();
```

- [ ] **Step 2: 运行类型检查**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/main/core/services/update.service.ts
git commit -m "feat(update): wire autoUpdater events and manual download flow"
```

---

### Task 4: IPC API 与事件转发

**Files:**
- Create: `src/main/core/apis/update.api.ts`
- Create: `src/main/ipcMain/update.ipc.ts`
- Modify: `src/main/ipcMain/index.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: 创建 update API（含事件转发）**

创建 `src/main/core/apis/update.api.ts`：

```ts
import { ipcMain, BrowserWindow } from "electron";
import { updateService } from "@/main/core/services/update.service";

/** 将更新事件转发到所有窗口的渲染进程 */
function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

/** 更新域 API 注册 */
export function registerUpdateApi(): void {
  // 事件桥：主进程 -> 渲染进程
  updateService.onEvents({
    onAvailable: (info) => broadcast("update:available", info),
    onDownloadProgress: (progress) => broadcast("update:download-progress", progress),
    onDownloaded: (path) => broadcast("update:downloaded", path),
    onError: (message) => broadcast("update:error", message),
  });

  // 渲染进程 -> 主进程
  ipcMain.handle("update:check", async (): Promise<boolean> => {
    return updateService.check();
  });

  ipcMain.handle("update:download", async (): Promise<void> => {
    await updateService.download();
  });

  ipcMain.handle("update:install", (): void => {
    updateService.install();
  });
}
```

- [ ] **Step 2: 创建 ipcMain 处理器**

创建 `src/main/ipcMain/update.ipc.ts`：

```ts
import { registerUpdateApi } from "@/main/core/apis/update.api";

/** 注册更新域 IPC 处理器（委托 core/apis/update.api） */
export function registerUpdateHandlers(): void {
  registerUpdateApi();
}
```

- [ ] **Step 3: 在 ipcMain/index.ts 导出**

在 `src/main/ipcMain/index.ts` 追加：

```ts
export { registerUpdateHandlers } from "./update.ipc";
```

- [ ] **Step 4: 在 main/index.ts 调用**

在 `src/main/index.ts` import 区追加：

```ts
import { registerUpdateHandlers } from "./ipcMain/update.ipc";
```

在既有 `registerXxxHandlers(...)` 并列处调用（只调用一次）：

```ts
registerUpdateHandlers();
```

- [ ] **Step 5: 运行类型检查**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/core/apis/update.api.ts src/main/ipcMain/update.ipc.ts src/main/ipcMain/index.ts src/main/index.ts
git commit -m "feat(update): add update ipc api and event bridge"
```

---

### Task 5: 预加载模块与类型

**Files:**
- Create: `src/main/preload/types/update.ts`
- Create: `src/main/preload/modules/update.ts`
- Modify: `src/main/preload/modules/index.ts`

- [ ] **Step 1: 创建预加载类型**

创建 `src/main/preload/types/update.ts`：

```ts
/** 下载进度（由主进程转发） */
export interface UpdateProgressPayload {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

/** 更新域暴露给渲染进程的 API */
export interface UpdateApi {
  /** 检查更新，返回是否发现可用更新 */
  check(): Promise<boolean>;
  /** 下载更新 */
  download(): Promise<void>;
  /** 安装更新 */
  install(): void;
  /** 订阅更新事件 */
  onEvent(
    event: "available" | "download-progress" | "downloaded" | "error",
    listener: (...args: any[]) => void,
  ): void;
}
```

- [ ] **Step 2: 创建预加载模块**

创建 `src/main/preload/modules/update.ts`（参考 `src/main/preload/modules/system.ts` 的 `ipcRenderer` 用法）：

```ts
import { ipcRenderer } from "electron";
import type { UpdateApi } from "@/main/preload/types/update";

/** 更新域预加载模块 */
export const updateModule: UpdateApi = {
  check: () => ipcRenderer.invoke("update:check") as Promise<boolean>,
  download: () => ipcRenderer.invoke("update:download") as Promise<void>,
  install: () => ipcRenderer.invoke("update:install") as void,
  onEvent(event, listener) {
    const channel = `update:${event}`;
    ipcRenderer.on(channel, (_event, payload) => listener(payload));
  },
};
```

- [ ] **Step 3: 注册预加载模块**

在 `src/main/preload/modules/index.ts` 追加 import 与导出字段（与既有 `system` 等模块并列）：

```ts
import { updateModule } from "./update";
// 在导出对象内追加
update: updateModule,
```

- [ ] **Step 4: Commit**

```bash
git add src/main/preload/types/update.ts src/main/preload/modules/update.ts src/main/preload/modules/index.ts
git commit -m "feat(update): expose update preload module"
```

---

### Task 6: 渲染进程类型声明

**Files:**
- Modify: `src/renderer/types/electron.d.ts`

- [ ] **Step 1: 声明 update 域**

在 `src/renderer/types/electron.d.ts` 中，为 `window.electronAPI` 的类型/接口新增 `update` 字段，并导入类型：

```ts
import type { UpdateApi } from "@/main/preload/types/update";

// 在 electronAPI 类型对象/接口中新增：
update: UpdateApi;
```

（若该文件以 `declare global { interface Window { electronAPI: {...} } }` 内联类型定义，则将 `update: UpdateApi;` 加入该对象，并在顶部补 `import type`。）

- [ ] **Step 2: 运行类型检查**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/types/electron.d.ts
git commit -m "feat(update): declare update api in renderer types"
```

---

### Task 7: 国际化与错误码

**Files:**
- Modify: `src/shared/i18n/locales/zhCN.ts`
- Modify: `src/shared/i18n/locales/enUS.ts`
- Modify: `src/shared/enums/errorCode.enums.ts`

- [ ] **Step 1: 增加 UPDATE 块（zhCN）**

在 `src/shared/i18n/locales/zhCN.ts` 顶层新增（与 `SETTINGS` 同级）：

```ts
UPDATE: {
  TITLE: "发现新版本",
  DESCRIPTION: "当前版本 V{current}，检测到新版本 V{version}，是否立即更新？",
  SKIP: "跳过此版本",
  LATER: "稍后再说",
  UPDATE_NOW: "立即更新",
  DOWNLOADING: "正在下载更新… {percent}%",
  DOWNLOADED: "更新包已下载，点击安装",
  NO_UPDATE: "当前已是最新版本",
  CHECK_FAILED: "检查更新失败，请稍后重试",
  INSTALLING: "正在安装更新…",
},
```

- [ ] **Step 2: 增加 UPDATE 块（enUS）**

在 `src/shared/i18n/locales/enUS.ts` 顶层新增同名对象：

```ts
UPDATE: {
  TITLE: "Update Available",
  DESCRIPTION: "Current version V{current}, new version V{version} available. Update now?",
  SKIP: "Skip this version",
  LATER: "Later",
  UPDATE_NOW: "Update Now",
  DOWNLOADING: "Downloading update… {percent}%",
  DOWNLOADED: "Update downloaded. Click to install.",
  NO_UPDATE: "You're up to date",
  CHECK_FAILED: "Failed to check for updates. Please retry later.",
  INSTALLING: "Installing update…",
},
```

- [ ] **Step 3: 增加更新错误码**

在 `src/shared/enums/errorCode.enums.ts` 追加（以该文件既有 `as const` / 枚举风格为准）：

```ts
UPDATE_CHECK_FAILED: 21000,
UPDATE_DOWNLOAD_FAILED: 21001,
UPDATE_INSTALL_FAILED: 21002,
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/i18n/locales/zhCN.ts src/shared/i18n/locales/enUS.ts src/shared/enums/errorCode.enums.ts
git commit -m "feat(update): add update i18n and error codes"
```

---

### Task 8: 设置页接入"检查更新"与进度

**Files:**
- Modify: `src/renderer/components/settings/GeneralSettings.vue`

- [ ] **Step 1: 接入检查更新逻辑**

在 `GeneralSettings.vue` 的 `<script setup>` 中：

1. import 组件与 API：

```ts
import UpdatePrompt from "@/renderer/components/UpdatePrompt.vue";
import { useMessage } from "naive-ui";
import { ref, onUnmounted } from "vue";
```

2. 新增状态与处理函数（替换原空实现 `const checkUpdate = async () => { };`）：

```ts
const message = useMessage();

const updateVisible = ref(false);
const updateVersion = ref("");
const updateNotes = ref("");
const updatePercent = ref(0);
const downloading = ref(false);
const installed = ref(false);

const checkUpdate = async (): Promise<void> => {
  try {
    const hasUpdate = await window.electronAPI.update.check();
    if (!hasUpdate) {
      message.success(t("UPDATE.NO_UPDATE"));
      return;
    }
    updateVisible.value = true;
  } catch (error) {
    message.error(t("UPDATE.CHECK_FAILED"));
  }
};

// 订阅更新事件（可用/进度/下载完成/错误）
window.electronAPI.update.onEvent("available", (info: { version: string; releaseNotes?: string }) => {
  updateVersion.value = info.version;
  updateNotes.value = info.releaseNotes ?? "";
  updateVisible.value = true;
});
window.electronAPI.update.onEvent("download-progress", (p: { percent: number }) => {
  downloading.value = true;
  updatePercent.value = Math.round(p.percent);
});
window.electronAPI.update.onEvent("downloaded", () => {
  downloading.value = false;
  installed.value = true;
  message.success(t("UPDATE.DOWNLOADED"));
});
window.electronAPI.update.onEvent("error", () => {
  downloading.value = false;
  message.error(t("UPDATE.CHECK_FAILED"));
});
```

> `onUnmounted` 用于清理监听（若 preload 的 `onEvent` 未提供 off，可忽略清理，或在 `onUnmounted` 中调用 `window.electronAPI.update.off?.()`，视实现而定）。

- [ ] **Step 2: 新增下载/安装处理函数**

```ts
const handleUpdate = async (): Promise<void> => {
  try {
    await window.electronAPI.update.download();
    // 下载完成后主进程广播 downloaded；此处等待进度即可
  } catch (error) {
    downloading.value = false;
    message.error(t("UPDATE.CHECK_FAILED"));
  }
};

const handleInstall = (): void => {
  window.electronAPI.update.install();
};
```

- [ ] **Step 3: 模板挂载 UpdatePrompt**

在 `GeneralSettings.vue` 模板末尾（根元素内）追加：

```vue
<UpdatePrompt
  v-model:visible="updateVisible"
  :version="updateVersion"
  :release-notes="updateNotes"
  @update="handleUpdate"
  @install="handleInstall"
/>
```

> 需在 `UpdatePrompt.vue` 中补充 `@install` 事件：当 `downloading` 为 true 时主按钮文案改为下载进度，下载完成后点击触发 `install`。为使本任务自洽，同步修改 `UpdatePrompt.vue`：新增 `downloading`/`percent` prop、`@install` emit，并在按钮区显示进度（见 Step 4）。

- [ ] **Step 4: 修改 UpdatePrompt.vue 支持进度与安装**

将 `src/renderer/components/UpdatePrompt.vue` 的 props/emits 与模板按钮区更新为：

```ts
// props 新增：
downloading?: boolean;
percent?: number;

// emits 新增：
(e: "install"): void;
```

模板 footer 改为：

```vue
<template #footer>
  <n-flex justify="end" align="center">
    <n-text v-if="downloading" depth="3">{{ t("UPDATE.DOWNLOADING", { percent }) }}</n-text>
    <n-button v-else-if="installed" type="primary" @click="handleInstall">
      {{ t("UPDATE.INSTALLING") }}
    </n-button>
    <template v-else>
      <n-button @click="handleSkip">{{ t("UPDATE.SKIP") }}</n-button>
      <n-button @click="handleLater">{{ t("UPDATE.LATER") }}</n-button>
      <n-button type="primary" @click="handleUpdate">{{ t("UPDATE.UPDATE_NOW") }}</n-button>
    </template>
  </n-flex>
</template>
```

（`installed` 由父组件传入，或此处仅展示 `downloading` 状态，安装按钮的显隐由父组件控制；以不破坏既有结构为准，最小改动为展示进度文本。）

- [ ] **Step 5: 运行类型检查**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/settings/GeneralSettings.vue src/renderer/components/UpdatePrompt.vue
git commit -m "feat(update): wire check update button with progress and install"
```

---

### Task 9: 全量验证

**Files:** 无新增

- [ ] **Step 1: 全量类型检查 + lint**

Run:

```
pnpm typecheck
pnpm lint
```

Expected: 均 PASS

- [ ] **Step 2: 本地构建验证（不发布）**

Run: `pnpm prod`
Expected: `release/` 下生成各平台安装包，且产物内包含 `app-update.yml`（可在 `release/win-unpacked/resources/app-update.yml` 找到，内含 `provider: github` / `owner: liqms` / `repo: pentip`）

- [ ] **Step 3: 手动冒烟（可选）**

推送一个 `v*` 标签触发 Actions，或本地 `pnpm prod --publish always` 上传后，打开应用设置页点击"检查更新"：
- 有新版时弹出"发现新版本"，展示更新说明
- 点击"立即更新"触发下载并展示进度
- 下载完成后点击安装，应用退出并重启
- 无新版时提示"当前已是最新版本"

- [ ] **Step 4: Commit（若 Step 1 有修复）**

```bash
git add -A
git commit -m "chore(update): fix lint/type issues"
```

---

## 自检

**Spec 覆盖：**
- ✅ 使用 electron-updater 的 GitHub provider → Task 1 `build.publish` + Task 3 `autoUpdater`
- ✅ 实现 GitHub Actions 打包 → Task 2 `release.yml`（三平台构建 + `--publish always`）
- ✅ 从 GitHub 完成升级 → Task 1 生成 `app-update.yml`，Task 3~8 完成检查/下载/安装链路

**占位符扫描：** 无 "TBD/TODO/implement later"；所有代码步骤均含实际实现。Task 8 对 `UpdatePrompt.vue` 的改动已给出 props/emits 与模板片段；Task 6/8 中 "以该文件既有结构为准" 是对既有代码适配说明，步骤均给出落地写法。

**类型一致性：** `update.check()`（Promise<boolean>）、`update.download()`、`update.install()`、`onEvent(event, listener)` 在 Task 5（preload）、Task 6（renderer type）、Task 8（调用）保持一致。事件通道 `update:available` / `update:download-progress` / `update:downloaded` / `update:error` 在 Task 4（broadcast）与 Task 5（onEvent 映射 `update:${event}`）保持一致。
