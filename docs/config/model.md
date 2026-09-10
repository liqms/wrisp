# PenTip 模型配置文档

## 概述

模型配置由 `ModelService` 管理，持久化存储在 `config/model.json`。本文档描述模型配置的数据结构、默认值和管理方式。

## 配置文件存储

### 文件路径

- **Windows**: `%APPDATA%/PenTip/config/model.json`
- **macOS**: `~/Library/Application Support/PenTip/config/model.json`
- **Linux**: `~/.config/PenTip/config/model.json`

### 存储格式

JSON 格式，由 `electron-store` 管理。配置损坏时自动清除并恢复默认值（`clearInvalidConfig: true`）。

## 类型定义

### AIProvider — AI 供应商

```typescript
// src/shared/types/model.types.ts
export interface AIProvider {
  id: string; // 供应商唯一标识
  name: string; // 显示名称
  models: Model[]; // 模型列表
  apiKey?: string; // API 密钥
  logoPath?: string; // Logo 路径（如 'logos/deepseek.png'）
  baseUrl: string; // API 基础地址
  websiteUrl?: string; // 官网地址
  locale: Locale; // 区域: 'zhCN' | 'enUS'
  enabled?: boolean; // 是否启用
}
```

### Model — 模型

```typescript
export interface Model {
  id: string; // 模型唯一标识
  name: string; // 模型显示名称
  outputType: OutputModelType; // 输出类型: 'text' | 'image' | 'audio' | 'embedding' | 'reranker'
  contextLength: number; // 上下文长度
  maxTokens: number; // 最大输出 Token 数
  isInputText: boolean; // 是否支持文本输入
  isInputPic: boolean; // 是否支持图片输入
  isInputAudio: boolean; // 是否支持音频输入
  isInputVideo: boolean; // 是否支持视频输入
  structuredOutputs?: boolean; // 是否支持结构化输出
}
```

### DefaultModel — 默认模型

```typescript
export interface DefaultModel {
  outputType: OutputModelType; // 输出类型
  providerId: string; // 供应商 ID
  modelId: string; // 模型 ID
}
```

### ModelConfig — 完整配置根类型

```typescript
export interface ModelConfig {
  aiProviders: AIProvider[]; // AI 供应商列表
  defaultModels: DefaultModel[]; // 默认模型列表
  providerPriority: string[]; // 供应商优先级顺序
  enableAiMode?: boolean; // 是否启用本地 AI 模式
  enableCloudAi?: boolean; // 是否启用云 AI
}
```

## 默认配置

默认配置常量定义在 `src/main/constants/model.constants.ts`：

```typescript
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  aiProviders: [],
  defaultModels: [],
  providerPriority: [],
  enableAiMode: false,
  enableCloudAi: false,
};
```

> **注意**: 内置供应商列表（如 DeepSeek、火山引擎）定义在 `src/main/constants/provider.constants.ts` 的 `PROVIDER` 常量中，运行时通过 `ModelService` 动态合并到配置中。

## 管理方式

### 服务层 (ModelService)

**文件**: `src/main/core/services/model.service.ts`

```typescript
class ModelService {
  public static getInstance(): ModelService;
  public getConfig(): ModelConfig;
  public getValue<T>(keyPath: string): T | undefined;
  public setValue<T>(keyPath: string, value: T): void;
  public resetConfig(): void;
  public downloadModel(type: ModelType): Promise<string>;
  public checkModelExist(): Promise<Record<string, boolean>>;
  public cancelDownload(groupId: string): Promise<void>;
  public reDownloadModel(type: ModelType): Promise<void>;
}
```

**关键行为**:

- 与 `ConfigService` 架构一致，使用 `electron-store` 独立存储
- `setValue()` 直接调用 `this.store.set(keyPath, value)` 持久化
- `downloadModel()` 通过 `TaskQueue` 分发模型文件下载任务
- 根据 `general.locale` 选择国内/国际镜像源

### API 接口层

**文件**: `src/main/core/apis/model.api.ts`

```typescript
async function getConfig(): Promise<ApiResponse<ModelConfig>>;
async function getValue(keyPath: string): Promise<ApiResponse<any>>;
async function setValue(
  keyPath: string,
  value: any,
): Promise<ApiResponse<void>>;
async function resetConfig(): Promise<ApiResponse<void>>;
async function downloadModel(type: ModelType): Promise<ApiResponse<string>>;
async function checkModelExist(): Promise<ApiResponse<Record<string, boolean>>>;
async function reDownloadModel(type: ModelType): Promise<ApiResponse<void>>;
async function cancelDownload(groupId: string): Promise<ApiResponse<void>>;
```

### Store 层 (Pinia)

**文件**: `src/renderer/store/model.store.ts`

```typescript
export const useModelStore = defineStore("model", () => {
  const config = ref<ModelConfig | null>(null);
  const loading = ref(false);
  const errorCode = ref<ErrorCode | null>(null);
  const errorMessage = ref<string | null>(null);
  const isLoaded = computed(() => config.value !== null);
  const hasError = computed(() => errorCode.value !== null);
  const isReady = computed(() => !loading.value && !hasError.value);

  const fetchConfig = async (): Promise<boolean>
  const getConfigValue = async (keyPath: string): Promise<any>
  const setConfigValue = async (keyPath: string, value: any): Promise<boolean>
  const resetModelConfig = async (): Promise<boolean>
  const downloadModel = async (type: ModelType): Promise<string | null>
  const checkModelExist = async (): Promise<Record<string, boolean> | null>
  const reDownloadModel = async (type: ModelType): Promise<boolean>
  const cancelDownload = async (groupId: string): Promise<boolean>
  const addOrUpdateDefaultModel = async (models: DefaultModel[]): Promise<boolean>
  const addOrUpdateAIProvider = async (provider: AIProvider): Promise<boolean>
  const deleteAIProvider = async (providerId: string): Promise<boolean>
});
```

**关键行为**:

- `addOrUpdateAIProvider()` / `deleteAIProvider()` 更新后自动调用 `window.electronAPI.ai.refreshConfig()` 刷新 LLM 网关
- `setConfigValue()` 使用深拷贝更新本地状态，剥离 Vue 响应式 Proxy 确保 IPC 序列化正常

### Composable 层

**文件**: `src/renderer/composables/useModel.ts`

```typescript
export function useModel(options?: UseModelOptions) {
  // 便捷计算属性
  const providers = computed<AIProvider[]>
  const defaultModels = computed<DefaultModel[]>
  const providerPriority = computed<string[]>
  const enableCloudAi = computed<boolean>
  const enableAiMode = computed<boolean>

  // 下载状态
  const downloadGroupId = ref<string | null>
  const isDownloadingModels = ref<boolean>

  // 核心方法
  const init = async (): Promise<boolean>
  const ensureLoaded = async (): Promise<boolean>
  const getValue = async <T>(keyPath: string): Promise<T | null>
  const setValue = async <T>(keyPath: string, value: T): Promise<boolean>
  const resetConfig = async (): Promise<boolean>
  const downloadModel = async (type: ModelType): Promise<string | null>
  const checkModelExist = async (): Promise<Record<string, boolean> | null>
  const reDownloadModel = async (type: ModelType): Promise<boolean>
  const cancelDownload = async (groupId: string): Promise<boolean>
  const updateEnableAiMode = async (enable: boolean): Promise<boolean>
  const updateEnableCloudAi = async (enable: boolean): Promise<boolean>
  const addOrUpdateDefaultModel = async (models: DefaultModel[]): Promise<boolean>
  const addOrUpdateAIProvider = async (provider: AIProvider): Promise<boolean>
  const deleteAIProvider = async (providerId: string): Promise<boolean>
}
```

## 配置操作示例

### 基本使用

```typescript
import { useModel } from "@/renderer/composables/useModel";

const { providers, defaultModels, enableAiMode, enableCloudAi, setValue } =
  useModel({ autoInit: true });

// 获取供应商列表
console.log(providers.value);
// 切换本地 AI 模式
await setValue("enableAiMode", true);
// 切换云 AI
await setValue("enableCloudAi", true);
```

### 管理 AI 供应商

```typescript
const { addOrUpdateAIProvider, deleteAIProvider } = useModel();

// 添加/更新供应商
await addOrUpdateAIProvider({
  id: "custom-provider",
  name: "自定义供应商",
  baseUrl: "https://api.example.com",
  locale: "zhCN",
  models: [],
});

// 删除供应商
await deleteAIProvider("custom-provider");
```

### 管理默认模型

```typescript
const { addOrUpdateDefaultModel } = useModel();

await addOrUpdateDefaultModel([
  { outputType: "text", providerId: "deepseek", modelId: "deepseek-v4-pro" },
]);
```

### 模型下载

```typescript
const { downloadModel, checkModelExist, cancelDownload, reDownloadModel } =
  useModel();

// 下载基础模型（embedding + reranker）
const groupId = await downloadModel("base");

// 检查模型文件是否已下载
const exists = await checkModelExist();

// 取消下载
await cancelDownload(groupId);

// 重新下载
await reDownloadModel("base");
```

### 启用本地 AI（含自动下载）

```typescript
const { updateEnableAiMode, isDownloadingModels } = useModel();

// 开启本地 AI：自动检查模型 → 未下载则自动下载
await updateEnableAiMode(true);

// 关闭本地 AI：取消下载任务 → 更新配置
await updateEnableAiMode(false);
```

## 错误处理

### 错误代码

```typescript
export enum ErrorCode {
  MODEL_GET_CONFIG_FAILED = "MODEL_GET_CONFIG_FAILED",
  MODEL_GET_VALUE_FAILED = "MODEL_GET_VALUE_FAILED",
  MODEL_SET_VALUE_FAILED = "MODEL_SET_VALUE_FAILED",
  MODEL_RESET_CONFIG_FAILED = "MODEL_RESET_CONFIG_FAILED",
  MODEL_DOWNLOAD_FAILED = "MODEL_DOWNLOAD_FAILED",
  MODEL_CHECK_EXIST_FAILED = "MODEL_CHECK_EXIST_FAILED",
  MODEL_REDOWNLOAD_FAILED = "MODEL_REDOWNLOAD_FAILED",
  MODEL_CANCEL_DOWNLOAD_FAILED = "MODEL_CANCEL_DOWNLOAD_FAILED",
}
```

### 处理策略

| 场景             | 处理方式                                             |
| ---------------- | ---------------------------------------------------- |
| 配置加载失败     | 使用默认配置，记录错误日志                           |
| 配置更新失败     | 抛出错误，不修改本地状态                             |
| 配置键路径不存在 | `getValue` 返回 `undefined`，`setValue` 记录错误日志 |
| 模型下载失败     | 通过 `TaskQueue` 重试机制处理                        |
| 配置损坏         | `electron-store` 自动清除并恢复默认值                |
