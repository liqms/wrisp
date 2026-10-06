# Wrisp AI 模型方案

**版本**：v4.0\
**最后更新**：2026-10-05\
**核心理念**：

| 目标       | 要求                                    |
| ---------- | --------------------------------------- |
| 本地优先   | 数据完全本地可控                        |
| AI Native  | AI 能力嵌入记录、整理、推演、创作全流程 |
| 中英文优先 | 统一语义空间支持中英文混合              |
| 零配置     | 安装即用，无需 Python / Ollama / Docker |

---

## 一、硬件配置要求

| 配置项      | 最低要求                        | 推荐配置                       | 说明                                                                |
| ----------- | ------------------------------- | ------------------------------ | ------------------------------------------------------------------- |
| 内存 (RAM)  | **8 GB**                        | 16 GB 或更高                   | 嵌入 2GB + 重排序 2GB + LLM 5GB（峰值约 9GB），8GB 可运行但并发受限 |
| 磁盘空间    | **≥6 GB**                       | ≥10 GB                         | 首次自动下载约 5.83 GB，知识库按需增长                              |
| 操作系统    | Windows 10/11, macOS 11+, Linux | 同左                           | 全平台使用 node-llama-cpp + transformers.js，无 MLX 依赖             |
| 网络        | 首次启动必须联网（下载模型）    | 视配置而定                     | 开启本地智能后续可完全离线；开启云端智能需网络调用 API              |
| GPU（可选） | 无要求                          | NVIDIA GTX 1060 6GB 或更高     | 支持 CUDA / Vulkan 加速，可显著提升推理速度（GPU 检测暂未实现）      |

---

## 二、模型列表

### 2.1 内置模型（首次启动按需下载）

| 模型                    | 参数 | 量化大小  | 格式          | 后端              | 用途说明                                       |
| ----------------------- | ---- | --------- | ------------- | ----------------- | ---------------------------------------------- |
| **bge-m3**              | 568M | ~1.13 GB | ONNX FP16     | transformers.js   | 多语言语义向量化，输出 1024 维向量，相似度计算  |
| **bge-reranker-v2-m3**  | 568M | ~1.8 GB  | ONNX FP16     | transformers.js   | 多语言交叉编码器重排序，搜索结果精排            |
| **Qwen3.5-4B**          | 4B   | ~2.9 GB  | GGUF UD-Q4_K_XL | node-llama-cpp  | 通用本地生成，Unsloth Dynamic 量化，中英极强    |

> 以上三个模型下载后共约 **5.83 GB**。嵌入 + 重排序为 base 包（~2.93 GB），LLM 为 core 包（~2.9 GB）。

### 2.2 云端模型（用户自选 API）

支持任何 **OpenAI 兼容** 的 API 端点，通过 `aiProviders` 配置接入，包括但不限于：

- GPT-4o / GPT-4o-mini
- Claude 3.5 Sonnet / Opus
- DeepSeek-V4
- Gemini 1.5 Pro / Flash
- 本地部署的 vLLM / Ollama 代理

每个服务商可配置多个模型，支持按任务类型（`taskType`）指定默认模型，并通过 `providerPriority` 设置服务商优先级。

---

## 三、系统架构

### 3.1 分层架构

```
┌───────────────────────────────────────────────────────────┐
│                      调用方                                │
│  smart-tasks executors / ai.service / search.service      │
└──────────────┬────────────────────────┬───────────────────┘
               │                        │
     ┌─────────▼─────────┐   ┌──────────▼──────────┐
     │  ModelRouter       │   │  LocalGateway        │
     │  任务路由决策      │   │  本地推理统一入口    │
     │  cloud→local 降级  │   │  embed/rerank/generate│
     └─────────┬─────────┘   └──────────┬──────────┘
               │                        │
     ┌─────────▼─────────┐   ┌──────────▼──────────┐
     │  modelService      │   │  LocalAiManager      │
     │  配置持久化        │   │  Worker 线程管理     │
     │  enableAiMode      │   │  消息调度/流式回调   │
     │  enableCloudAi     │   └──────────┬──────────┘
     │  aiProviders       │              │
     └────────────────────┘   ┌──────────▼──────────┐
                              │  Worker Thread       │
                              │  (local-ai-worker.js)│
                              │  ├ embedding-handler │
                              │  ├ rerank-handler    │
                              │  └ llm-handler       │
                              └─────────────────────┘
```

### 3.2 核心模块

| 模块                    | 文件路径                                        | 职责                                                     |
| ----------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| **ModelRouter**         | `model-gateway/router.ts`                       | 任务路由决策：按 TaskType 选择 cloud 或 local，支持降级   |
| **LocalGateway**        | `model-gateway/local-gateway/gateway.ts`        | 本地推理统一入口：embed / embedBatch / rerank / generate  |
| **LocalAiManager**      | `model-gateway/local-gateway/manager.ts`        | Worker 线程生命周期管理、消息调度、流式 token 回调        |
| **ModelManager**        | `model-gateway/local-gateway/model-manager.ts`  | 模型文件管理：下载、检查、加载、卸载、空闲回收            |
| **ModelRegistry**       | `model-gateway/local-gateway/model-registry.ts` | 模型元数据注册表：BUILTIN_MODELS 定义所有内置模型规格      |
| **Hardware**            | `model-gateway/local-gateway/hardware.ts`       | 硬件检测：内存可用性、LLM 并发推荐                        |
| **ModelService**        | `services/ai/model.service.ts`                 | 配置持久化（electron-store）、下载任务分发、镜像选择      |
| **Worker**              | `local-gateway/worker/index.ts`                 | Worker 线程入口，分发消息到各 handler                     |

### 3.3 Worker 线程架构

所有本地 AI 推理在**单一 Worker 线程**中执行，避免阻塞主进程：

- Worker 由 Vite 独立打包为 CJS（`dist-electron/local-ai-worker.js`）
- 主进程通过 `worker_threads` 启动，基于消息 ID 的请求-响应配对
- 流式生成通过 `llm-token` 消息逐 token 回调，最终由 `llm-result` settle
- Worker 异常退出时自动重启（延迟 1s）
- 三个 handler 分别处理 embedding / rerank / llm 消息

---

## 四、模式配置

### 4.1 双开关模型

系统通过两个独立开关控制 AI 能力来源，非互斥关系：

| 开关             | 类型      | 默认值  | 说明                                          |
| ---------------- | --------- | ------- | --------------------------------------------- |
| `enableAiMode`   | boolean   | false   | 启用本地 AI（嵌入 + 重排序 + LLM）            |
| `enableCloudAi`  | boolean   | false   | 启用云端 AI（需至少配置一个 enabled 的服务商）|
| `aiProviders`    | AIProvider[] | []    | 云端服务商列表（id / name / apiKey / baseUrl）|
| `defaultModels`  | DefaultModel[] | []  | 按任务类型指定默认云端模型                    |
| `providerPriority` | string[] | []      | 服务商优先级排序                              |

### 4.2 能力可用性判定

| 能力               | 判定条件                                                          |
| ------------------ | ----------------------------------------------------------------- |
| 本地嵌入可用       | `enableAiMode` = true + bge-m3 已下载 + 可用内存 ≥ 4GB（嵌入+重排序）|
| 本地 LLM 可用      | `enableAiMode` = true + qwen3.5-4b 已下载                         |
| 云端可用           | `enableCloudAi` = true + aiProviders 中至少一个 enabled           |

### 4.3 实际行为矩阵

| enableAiMode | enableCloudAi | 嵌入/重排序    | LLM 生成任务           |
| ------------ | ------------- | -------------- | ---------------------- |
| false        | false         | 不可用         | 不可用                 |
| true         | false         | 本地           | 本地（qwen3.5-4b）     |
| false        | true          | 不可用         | 云端                   |
| true         | true          | 本地           | 云端优先，本地降级     |

> 嵌入和重排序始终在本地执行，不经过 ModelRouter 路由——原始文本不出设备。

---

## 五、任务路由

### 5.1 路由规则

ModelRouter 对 **9 种文本生成任务**统一采用 **云端优先、本地降级** 策略：

| 任务类型           | TaskType 常量         | 首选源  | 降级源  | 说明                     |
| ------------------ | --------------------- | ------- | ------- | ------------------------ |
| 概念命名与演化摘要 | CONCEPT_NAMING        | cloud   | local   | 云端质量更优             |
| 主题命名与摘要     | TOPIC_SUMMARY         | cloud   | local   | 云端质量更优             |
| 摘要               | SUMMARY               | cloud   | local   | 云端质量更优             |
| 反思               | REFLECTION            | cloud   | local   | 云端质量更优             |
| 改写               | REWRITE               | cloud   | local   | 云端质量更优             |
| 润色               | POLISH                | cloud   | local   | 云端质量更优             |
| 续写               | CONTINUE              | cloud   | local   | 云端质量更优             |
| 扩写               | EXPAND                | cloud   | local   | 云端质量更优             |
| 多模态             | MULTIMODAL            | cloud   | local   | 云端质量更优             |

### 5.2 路由决策流程

```
route(task)
  ├── 查 taskRules[task] → { primary: "cloud", fallback: "local" }
  ├── isSourceAvailable("cloud")?  → 是 → 返回 "cloud"
  ├── isSourceAvailable("local")?  → 是 → 返回 "local"（降级）
  └── 都不可用 → 抛异常
```

### 5.3 嵌入/重排序路由

嵌入和重排序**不经过 ModelRouter**，直接调用 LocalGateway：

- **内容向量化**：始终本地（bge-m3），原始文本不出设备
- **语义检索**：始终本地，向量比对在设备内完成
- **结果重排序**：始终本地（bge-reranker-v2-m3）

---

## 六、模型生命周期

### 6.1 加载策略

| 模型类型     | 加载时机                 | 冷启动耗时       | 热启动     |
| ------------ | ------------------------ | ---------------- | ---------- |
| 嵌入模型     | 首次 embed 调用或预热    | ~2-3s（1.13GB）  | <100ms     |
| 重排序模型   | 首次 rerank 调用或预热   | ~3-5s（1.8GB）   | <100ms     |
| LLM          | 首次 generate 调用       | ~3-5s（2.9GB）   | <200ms     |

### 6.2 空闲卸载

| 模型类型     | 默认空闲超时 | 特殊处理                                                   |
| ------------ | ------------ | ---------------------------------------------------------- |
| 嵌入模型     | 5 分钟       | 搜索预热后延长至 30 分钟（SEARCH_MODEL_KEEPALIVE_MS）     |
| 重排序模型   | 5 分钟       | 搜索预热后延长至 30 分钟                                  |
| LLM          | 5 分钟       | 有在途生成请求时不卸载（isLlmBusy 检查），重新调度计时器  |

### 6.3 搜索模型预热

用户打开搜索/输入时调用 `warmupSearchModels()`：
1. 提前加载嵌入 + 重排序模型（避免首次搜索阻塞数秒）
2. 将两者的空闲超时延长至 30 分钟（避免反复冷启动）

### 6.4 LLM 并发自适应

LLM 加载时根据可用内存自动调整 context 池并发数：

```
recommendLlmConcurrency(modelSizeGB, maxConcurrency)
  affordable = floor((freeMem - modelSize - 1GB) / 0.5GB)
  return min(max(affordable, 1), maxConcurrency)
```

- 每个并发 context 占约 0.5GB KV cache
- 预留 1GB 系统余量
- 结果只向下夹紧：∈ [1, maxConcurrency]，绝不超过配置上限（默认 2）

---

## 七、渐进式加载策略

| 阶段               | 触发时机         | 下载/加载内容                          | 大小      | 用户感知                         |
| ------------------ | ---------------- | -------------------------------------- | --------- | -------------------------------- |
| **首次启动引导**   | 首次启动         | 引导用户选择启用本地智能和/或云端智能  | -         | 引导界面，用户选择智能模式       |
| **base 包下载**    | 用户启用本地智能 | bge-m3 + bge-reranker-v2-m3            | ~2.93 GB  | 通过 TaskQueue 下载，可追踪进度  |
| **core 包下载**    | 用户启用本地智能 | Qwen3.5-4B（UD-Q4_K_XL 量化）          | ~2.9 GB   | 可选下载，生成任务需要时才必需   |
| **云端配置**       | 用户启用云端智能 | 无下载                                 | -         | 选择服务商并填入 API Key         |
| **运行时模型加载** | 首次调用对应任务 | 将模型载入内存（从磁盘）              | 见 6.1    | 冷启动数秒，后续热启动           |
| **空闲卸载**       | 任务结束后超时   | 释放模型内存                           | -         | 无感知，下次调用重新加载         |

### 7.1 下载镜像

根据 `general.locale` 配置自动选择镜像源：

| locale | 镜像地址                    |
| ------ | --------------------------- |
| zhCN   | `https://hf-mirror.com`     |
| 其他   | `https://huggingface.co`    |

### 7.2 下载任务参数

- 通过 TaskQueue 分发，优先级 `priority=10`
- 最大重试 `maxRetries=2`
- 已存在的文件自动跳过
- 支持按 `groupId` 取消下载

---

## 八、模型规格注册表

所有内置模型在 `model-registry.ts` 中以 `BUILTIN_MODELS` 结构化定义：

| 字段           | bge-m3              | bge-reranker-v2-m3        | qwen3.5-4b                    |
| -------------- | ------------------- | ------------------------- | ----------------------------- |
| modelId        | `bge-m3`            | `bge-reranker-v2-m3`      | `qwen3.5-4b`                  |
| family         | embedding           | reranker                  | llm                           |
| backend        | transformers.js     | transformers.js           | node-llama-cpp                |
| variantId      | fp16                | fp16                      | ud_q4_k_xl                    |
| precision      | FP16                | FP16                      | UD-Q4_K_XL                    |
| sizeGB         | 1.13                | 1.8                       | 2.9                           |
| minMemoryGB    | 2                   | 2                         | 5                             |
| dimension      | 1024                | -                         | -                             |
| 远程来源       | Xenova/bge-m3       | onnx-community/bge-reranker-v2-m3-ONNX | unsloth/Qwen3.5-4B-GGUF |

### 8.1 LLM 默认配置

| 参数          | 值     | 说明                           |
| ------------- | ------ | ------------------------------ |
| contextSize   | 4096   | 上下文窗口长度                 |
| maxTokens     | 1024   | 单次生成最大 token 数          |
| temperature   | 0.7    | 采样温度                       |
| gpu           | auto   | 推理设备（auto / cpu）         |
| concurrency   | 2      | context 池大小（按内存自适应） |

### 8.2 嵌入默认配置

| 参数      | 值                | 说明               |
| --------- | ----------------- | ------------------ |
| modelName | Xenova/bge-m3     | 模型标识           |
| pooling   | cls               | 池化方法           |
| normalize | true              | 向量归一化         |

---

## 九、组件速查表

| 组件                          | 是否必须 | 下载时机     | 大小      | 归属模式            |
| ----------------------------- | -------- | ------------ | --------- | ------------------- |
| bge-m3（嵌入）                | 是       | base 包下载  | 1.13 GB  | 本地智能 + 云端智能 |
| bge-reranker-v2-m3（重排序）  | 是       | base 包下载  | 1.8 GB   | 本地智能 + 云端智能 |
| Qwen3.5-4B（本地 LLM）        | 是       | core 包下载  | 2.9 GB   | 仅本地智能          |
| 云端 API 配置                 | 否       | 用户手动配置 | -         | 仅云端智能          |
| transformers.js 运行时        | 是       | 打包在应用中 | ~30 MB   | 本地智能            |
| node-llama-cpp 运行时         | 是       | 打包在应用中 | ~20 MB   | 本地智能            |
| LanceDB 向量库                | 是       | 首次运行创建 | -         | 本地智能 + 云端智能 |

**护城河声明**：Wrisp 的长期价值不在于具体模型，而在于 **文件优先的知识体系 + 长期个人语义索引**——即对用户 Markdown 文件的持久化语义索引和知识网络建模，这是任何通用模型无法替代的。