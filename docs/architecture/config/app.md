# PenTip 应用配置文档

## 概述

应用配置由 `ConfigService` 管理，持久化存储在 `config/app.json`。本文档描述配置的数据结构、默认值和管理方式。

## 配置文件存储

### 文件路径

- **Windows**: `%APPDATA%/PenTip/config/app.json`
- **macOS**: `~/Library/Application Support/PenTip/config/app.json`
- **Linux**: `~/.config/PenTip/config/app.json`

### 存储格式

JSON 格式，由 `electron-store` 管理。配置损坏时自动清除并恢复默认值（`clearInvalidConfig: true`）。

## 类型定义

### General — 通用配置

```typescript
// src/shared/types/config.types.ts
export interface General {
  themeMode: ThemeMode;       // 主题模式: 'light' | 'dark' | 'system'
  themeColor: ThemeColor;     // 主题颜色: 'blue' | 'green' | 'orange' | 'purple' | 'pink' | 'cyan'
  locale: Locale;             // 语言: 'zhCN' | 'enUS'
  updateChannel: UpdateChannel; // 更新渠道: 'stable' | 'beta'
}
```

### MiniProgram — 小程序配置

```typescript
export interface MiniProgram {
  id: string;        // 小程序唯一标识
  name: string;      // 显示名称
  url: string;       // 访问地址
  icon: string;      // 图标地址
  area: string;      // 区域: 'china' | 'overseas'
  isHidden: boolean; // 是否在列表隐藏
}
```

### UserInfo — 用户信息

```typescript
export interface UserInfo {
  nickname: string;            // 用户昵称
  avatar?: string;             // 头像路径（相对路径，如 'avatar/01.png'）
  token?: string;              // 认证令牌
  refreshToken?: string;       // 刷新令牌
  registrationDate: string;    // 注册日期 (ISO 8601)
  lastLoginDate?: string;      // 最后登录日期 (ISO 8601)
  email?: string;              // 邮箱地址
  bio?: string;                // 个人简介
  preferences: {
    country?: string;          // 国家或地区
    timezone: string;          // 时区 (IANA 格式)
    notification: boolean;     // 通知开关
  };
}
```

### FailoverConfig — 降级/熔断配置

```typescript
export interface FailoverConfig {
  maxRetries: number;                // 最大重试次数
  retryDelayMs: number;              // 重试间隔（毫秒）
  circuitBreakerThreshold: number;   // 熔断阈值
  cooldownMs: number;                // 冷却时间（毫秒）
}
```

### SkillsConfig — Skills 远程更新配置

```typescript
export interface SkillsConfig {
  remoteUpdateEnabled: boolean;      // 是否启用远程更新
  remoteUpdateUrl: string;           // 远程更新地址
}
```

### KeymapItem — 快捷键配置

```typescript
export interface KeymapItem {
  id: string;   // 快捷键唯一标识
  keys: string; // 按键组合（如 'Ctrl+K'）
}
```

### AppConfig — 完整配置根类型

```typescript
export interface AppConfig {
  general: General;                  // 通用配置
  miniPrograms: MiniProgram[];       // 小程序列表
  defaultMiniProgramId?: string;     // 默认小程序 ID
  userInfo: UserInfo;                // 用户信息
  version: string;                   // 配置版本
  workspace: string;                 // 工作目录路径
  currentProjectId?: string;         // 当前项目 ID
  isFirstLaunch: boolean;            // 是否首次启动
  isUpdateLaunch: boolean;           // 是否更新后首次启动
  updatedAt: string;                 // 最后更新时间 (ISO 8601)
  failoverConfig: FailoverConfig;    // 降级/熔断配置
  skillsConfig: SkillsConfig;        // Skills 远程更新配置
  shortcuts?: KeymapItem[];          // 快捷键列表
}
```

## 默认配置

默认配置常量定义在 `src/main/constants/config.constants.ts`：

```typescript
export const DEFAULT_APP_CONFIG: AppConfig = {
  general: {
    themeMode: THEME_MODE.DARK,
    themeColor: THEME_COLOR.GREEN,
    locale: LOCALE.ZH,
    updateChannel: UPDATE_CHANNEL.STABLE,
  },
  miniPrograms: [
    { id: "deepseek", name: "DeepSeek", url: "https://chat.deepseek.com/", icon: "https://chat.deepseek.com/favicon.ico", area: "china", isHidden: false },
    { id: "doubao", name: "Doubao", url: "https://www.doubao.com/chat/", icon: "https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/doubao/chat/favicon.png", area: "china", isHidden: false },
    { id: "openai", name: "OpenAI Chat", url: "https://www.openai.com/chat/", icon: "https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/doubao/chat/favicon.png", area: "china", isHidden: false },
  ],
  defaultMiniProgramId: "deepseek",
  userInfo: {
    nickname: "用户",
    avatar: "avatar/01.png",
    token: "",
    refreshToken: "",
    registrationDate: TimeUtil.toISOString(Date.now()),
    lastLoginDate: TimeUtil.toISOString(Date.now()),
    email: "",
    bio: "",
    preferences: {
      country: "中国",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      notification: true,
    },
  },
  version: "0.0.0",
  workspace: "",
  currentProjectId: "",
  isFirstLaunch: true,
  isUpdateLaunch: false,
  updatedAt: "",
  failoverConfig: {
    maxRetries: 2,
    retryDelayMs: 1000,
    circuitBreakerThreshold: 3,
    cooldownMs: 30000,
  },
  skillsConfig: {
    remoteUpdateEnabled: true,
    remoteUpdateUrl: "",
  },
  shortcuts: [],
};
```

> **注意**: `ConfigService.getDefaultConfig()` 会在默认值基础上覆盖 `workspace`（设为 `~/Documents/PenTip`）、`version`（设为当前应用版本）和 `updatedAt`（设为当前时间）。

## 枚举值

相关枚举定义在 `src/shared/enums/config.enums.ts`：

```typescript
export const THEME_MODE = { LIGHT: "light", DARK: "dark", SYSTEM: "system" } as const;
export const THEME_COLOR = { BLUE: "blue", GREEN: "green", ORANGE: "orange", PURPLE: "purple", PINK: "pink", CYAN: "cyan" } as const;
export const LOCALE = { ZH: "zhCN", EN: "enUS" } as const;
export const UPDATE_CHANNEL = { STABLE: "stable", BETA: "beta" } as const;
```

## 管理方式

### 配置服务层 (ConfigService)

**文件**: `src/main/core/services/config.service.ts`

```typescript
class ConfigService {
  public static getInstance(): ConfigService;
  public getConfig(): AppConfig;
  public getValue<T>(keyPath: string): T | undefined;
  public setValue<T>(keyPath: string, value: T): void;
  public setWorkspace(workspacePath: string): void;
  public resetConfig(): void;
  public getStaticPath(type?: string): string;
}
```

**关键行为**:
- 配置加载时自动执行 `ObjectUtil.deepMerge` 合并默认值与用户配置
- 版本升级时自动调用 `configMigration.migrateConfig()` 执行迁移
- `setWorkspace()` 会关闭旧数据库连接 → 更新配置 → 创建目录 → 初始化新数据库 → 广播 `workspace:changed` 事件

### API 接口层

**文件**: `src/main/core/apis/config.api.ts`

```typescript
async function getConfig(): Promise<ApiResponse<AppConfig>>;
async function getValue(keyPath: string): Promise<ApiResponse<any>>;
async function setValue(keyPath: string, value: any): Promise<ApiResponse<void>>;
async function resetConfig(): Promise<ApiResponse<void>>;
async function setWorkspace(workspacePath: string): Promise<ApiResponse<void>>;
```

### Store 层 (Pinia)

**文件**: `src/renderer/store/config.store.ts`

```typescript
export const useConfigStore = defineStore("config", () => {
  const config = ref<AppConfig | null>(null);
  const loading = ref(false);
  const errorCode = ref<ErrorCode | null>(null);
  const errorMessage = ref<string | null>(null);
  const isLoaded = computed(() => config.value !== null);

  const fetchConfig = async (): Promise<void>
  const getConfigValue = async (keyPath: string): Promise<any>
  const setConfigValue = async (keyPath: string, value: any): Promise<boolean>
  const resetConfig = async (): Promise<boolean>
  const setWorkspace = async (workspacePath: string): Promise<boolean>
  const setError = (code: ErrorCode | null, message?: string)
  const clearError = (): void
  const clearConfig = (): void
});
```

### Composable 层

**文件**: `src/renderer/composables/useConfig.ts`

```typescript
export function useConfig(options?: UseConfigOptions) {
  // 便捷计算属性
  const general = computed<General | null>
  const miniPrograms = computed<MiniProgram[] | null>
  const defaultMiniProgramId = computed<string>
  const userInfo = computed<UserInfo | null>
  const isAuthenticated = computed<boolean>
  const hasProfile = computed<boolean>
  const registrationDays = computed<number>
  const workspace = computed<string>
  const currentProjectId = computed<string>
  const themeMode = computed<ThemeMode>
  const themeColor = computed<ThemeColor>
  const locale = computed<Locale>
  const version = computed<string>
  const shortcuts = computed<KeymapItem[]>

  // 核心方法
  const init = async (): Promise<boolean>
  const ensureLoaded = async (): Promise<boolean>
  const getValue = async <T>(keyPath: string): Promise<T | null>
  const setValue = async <T>(keyPath: string, value: T): Promise<boolean>
  const updateThemeMode = async (themeMode: ThemeMode): Promise<boolean>
  const updateThemeColor = async (color: string): Promise<boolean>
  const updateLocale = async (locale: string): Promise<boolean>
  const updateNickname = async (nickname: string): Promise<boolean>
  const updateAvatar = async (avatar: string): Promise<boolean>
  const updateBio = async (bio: string): Promise<boolean>
  const updateDefaultMiniProgramId = async (id: string): Promise<boolean>
  const updateWorkspace = async (workspace: string): Promise<boolean>
  const updateCurrentProjectId = async (id: string): Promise<boolean>
  const updateIsFirstLaunch = async (val: boolean): Promise<boolean>
  const updateIsUpdateLaunch = async (val: boolean): Promise<boolean>
  const updateShortcuts = async (shortcuts: KeymapItem[]): Promise<boolean>
  const reset = async (): Promise<boolean>
  const clearError = (): void

  // 监听器
  const watchConfig = <T>(selector, callback, options?)
  const watchConfigValue = <T>(keyPath, callback, options?)
  const watchLoaded = (callback, options?)
}
```

## 配置操作示例

### 基本使用

```typescript
import { useConfig } from "@/renderer/composables/useConfig";

const { themeMode, themeColor, locale, setValue, updateThemeMode, updateLocale } = useConfig({ autoInit: true });

// 更新主题模式
await updateThemeMode("dark");
// 更新语言
await updateLocale("enUS");
// 设置特定配置项
await setValue("failoverConfig.maxRetries", 5);
```

### 用户信息操作

```typescript
const { updateNickname, updateAvatar, updateBio } = useConfig();

await updateNickname("新昵称");
await updateAvatar("avatar/02.png");
await updateBio("这是我的个人简介");
await setValue("userInfo.email", "user@example.com");
await setValue("userInfo.preferences.timezone", "America/New_York");
```

### 监听配置变化

```typescript
const { watchConfig, watchConfigValue } = useConfig();

watchConfigValue("general.themeColor", (newColor, oldColor) => {
  console.log("主题颜色变化:", { newColor, oldColor });
});
```

### 工作空间操作

```typescript
const { updateWorkspace } = useConfig();

// 切换工作目录（主进程会自动关闭旧数据库、创建目录、初始化新数据库并广播 workspace:changed 事件）
await updateWorkspace("/path/to/new/workspace");
```

## 版本迁移

**文件**: `src/main/core/migration/config.migration.ts`

当检测到应用版本升级时，`ConfigService.loadConfig()` 自动执行迁移：

```typescript
if (needsMigration(configVersion, appVersion)) {
  mergedConfig = configMigration.migrateConfig(mergedConfig, configVersion, appVersion);
}
```

## 错误处理

### 错误代码

```typescript
export enum ErrorCode {
  CONFIG_GET_FAILED = "CONFIG_GET_FAILED",
  CONFIG_UPDATE_FAILED = "CONFIG_UPDATE_FAILED",
  CONFIG_RESET_FAILED = "CONFIG_RESET_FAILED",
  CONFIG_KEY_PATH_INVALID = "CONFIG_KEY_PATH_INVALID",
}
```

### 处理策略

| 场景 | 处理方式 |
|------|----------|
| 配置加载失败 | 使用默认配置，记录错误日志 |
| 配置更新失败 | 抛出错误，不修改本地状态 |
| 配置键路径不存在 | `getValue` 返回 `undefined`，`setValue` 记录错误日志 |
| 配置损坏 | `electron-store` 自动清除并恢复默认值 |

## 事件通信

### workspace:changed

当工作空间路径变更时，主进程向所有渲染进程广播 `workspace:changed` 事件，`config.store.ts` 监听该事件并自动重新加载配置。

```typescript
// 主进程广播
BrowserWindow.getAllWindows().forEach((win) => {
  win.webContents.send("workspace:changed", normalizedPath);
});

// 渲染进程监听
onElectron("workspace:changed", async () => {
  await fetchConfig();
});
```
