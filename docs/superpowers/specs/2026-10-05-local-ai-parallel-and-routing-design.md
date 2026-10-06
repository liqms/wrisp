# Wrisp 本地 AI 并行化与云端优先路由 — 设计文档

| 字段       | 值                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 日期       | 2026-10-05                                                                                                                   |
| 状态       | 设计待评审                                                                                                                   |
| 范围       | 本地三类模型（embedding / reranker / llm）的并行执行能力；LLM 路由策略（云端优先 + 按任务类型覆盖）                          |
| 相关子系统 | model-gateway（local-gateway / router / hardware）、smart-tasks（scheduler / executors / task-dag）、config、renderer 设置页 |
| 前置完成   | Step 0（每类模型独立 worker 线程）已实现并通过验证                                                                           |

---

## 1. 背景与目标

### 1.1 背景

1. 本地 LLM（qwen3.5-4b）在执行智能整理时**体验偏慢**，用户希望启用并行处理任务。
2. 本地三类模型（embedding / reranker / llm）当前**共享同一个 worker 线程**，即使调用方并发，推理也无法真正并行。
3. 若用户启用云端增强且存在可用云端模型配置，LLM 应**优先走云端**，此情形下不需要本地 LLM；仅当用户指定具体场景时才走本地 LLM。

### 1.2 目标

| 编号 | 目标                                                                                |
| ---- | ----------------------------------------------------------------------------------- |
| G1   | 三类模型可并行执行（每类独立 worker 线程 + executor 内部有界并发 + 跨 family 并行） |
| G2   | LLM 路由改为「云端优先」，并支持**按任务类型**逐个指定走本地                        |
| G3   | 内存不足时安全降级：求和门控不通过则回退到当前串行行为，不冒险加载                  |
| G4   | 走云端时**不加载**本地 LLM，避免无谓占用 3–4GB 内存                                 |

### 1.3 非目标

- 不做多用户/多任务的资源配额系统。
- 不引入「用户可配最大同时驻留模型数」（备选方案，已在本轮评估中排除）。
- 不改任务切分粒度、不改 DAG 依赖关系、不改进度/步骤上报粒度。
- 不改动云端 provider 的接入方式与 failover 策略。
- 不做 GPU/VRAM 的显式门控（当前 `gpu: "auto"`，显存不足由 node-llama-cpp 自行回退 CPU）。

---

## 2. 需求决策（本轮澄清结论）

| 编号 | 决策点             | 结论                                                                          |
| ---- | ------------------ | ----------------------------------------------------------------------------- |
| D1   | 并行目标           | **两者都要，分阶段做**：先做 executor 内部并发，再做三模型常驻/跨 family 并行 |
| D2   | 路由覆盖形态       | **按任务类型逐个配置**（默认云端优先，可逐个指定走本地）                      |
| D3   | 内存门控策略       | **求和门控 + 超限回退**：多个 family 同时驻留时按求和判定，不足则回退组间串行 |
| D4   | 本地不可用时的处理 | **回退云端**：被指定走本地但本地不可用时，若云端可用则回退云端并记日志        |
| D5   | worker 拆分        | **每类模型各自一个 worker 线程**，复用同一入口 + `workerData.family` 区分     |

---

## 3. 内存评估

### 3.1 三类模型驻留开销（注册表口径）

| family    | 模型                                         | 权重 sizeGB | 最低可用内存 minMemoryGB |
| --------- | -------------------------------------------- | ----------- | ------------------------ |
| embedding | bge-m3（transformers.js / FP16）             | 1.13        | 2                        |
| reranker  | bge-reranker-v2-m3（transformers.js / FP16） | 1.8         | 2                        |
| llm       | qwen3.5-4b（node-llama-cpp / UD-Q4_K_XL）    | 2.9         | 5                        |
| 合计      | —                                            | **5.83**    | **9**                    |

### 3.2 结论

- 三模型同时驻留的实际工作集约 **8.0GB**（权重 + 运行时开销），加 Electron/Node 基线约 0.5–0.8GB → **实际约 8.5–9GB**。
- 按注册表保守口径合计 **9GB**：即**最低可用内存约 9GB**；建议 ≥12GB，16GB+ 舒适。
- LLM context 池并发夹紧到上限（5）时再增约 1.5–2GB（每 context 约 0.5GB KV cache）→ 峰值约 10GB。
- GPU 驻留另计：显存约 6GB（llm 4GB + embedding/reranker 各约 1GB）。

### 3.3 门控口径选择

阶段二求和门控采用 **minMemoryGB 求和（9GB）**，与现有 `isLocalEmbeddingAvailable()` 对 embedding+reranker 求和 4GB 的口径一致，偏保守、避免换页。
（备选：sizeGB 求和 ≈5.83GB，更省内存但风险更高；本轮不采用。）

---

## 4. 现状与缺口

### 4.1 现状

| 模块            | 现状                                                                               | 位置                                                                                       |
| --------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 本地 worker     | 单一 worker 承载三类模型                                                           | `local-gateway/worker/index.ts`（Step 0 前）                                               |
| LLM 并发        | 已有有界 LlamaContext 池 + FIFO 排队                                               | `local-gateway/worker/llm-handler.ts`（`acquireContext` / `releaseContext` / `waitQueue`） |
| LLM 并发控制器  | 信号量，maxConcurrent 默认 5，支持 high/low 优先级                                 | `model-gateway/llm-concurrency-controller.ts`                                              |
| 内存门控        | `canLoadModel(minMemoryGB)` 为**逐 family 独立判定**，不求和                       | `local-gateway/hardware.ts`                                                                |
| LLM 并发推荐    | `recommendLlmConcurrency()` 按可用内存夹紧 ∈ [1, maxConcurrency]                   | `local-gateway/hardware.ts`                                                                |
| 路由            | `taskRules` 全部 `primary: cloud, fallback: local`；`route()` 仅按可用性选择       | `model-gateway/router.ts`                                                                  |
| 本地 LLM 可用性 | `isLocalLlmAvailable()` **仅检查文件是否下载，无内存门控**                         | `model-gateway/router.ts`                                                                  |
| 调度器          | 按层执行，层内按 family 分组，**组间串行、组内并行**                               | `smart-tasks/scheduler.ts`                                                                 |
| 调度器预加载    | `loadFamilyWithStep()` **无条件预加载**该层 family 的模型                          | `smart-tasks/scheduler.ts`                                                                 |
| 执行器          | `chunk-summary` / `concept-extract` / `semantic-link` 均**逐块串行** `for … await` | `smart-tasks/executors/`                                                                   |
| 批量嵌入        | `embedBatch()` 内部仍是**逐条 `await pipeline()`**                                 | `local-gateway/worker/embedding-handler.ts`                                                |
| 批量重排        | `rerank()` 内部**逐文档串行**推理                                                  | `local-gateway/worker/rerank-handler.ts`                                                   |

### 4.2 缺口

| 编号 | 缺口                                  | 影响                                         |
| ---- | ------------------------------------- | -------------------------------------------- |
| P1   | 单 worker 串行承载三类模型            | 无法真并行；一类模型的加载/卸载/崩溃影响全部 |
| P2   | 执行器逐块串行，浪费已有 LLM 并发能力 | 本地 LLM 慢的直接原因                        |
| P3   | `embedBatch` / `rerank` 为"假批量"    | 向量化与语义链接的额外耗时                   |
| P4   | 无「按任务类型走本地」的覆盖开关      | 无法满足 G2                                  |
| P5   | 调度器无条件预加载本地 LLM            | 走云端时白占 3–4GB（违反 G4）                |
| P6   | `isLocalLlmAvailable()` 无内存门控    | 内存不足仍可能被选中并卡死                   |
| P7   | 无跨 family 求和门控                  | 阶段二并行时有 OOM 风险                      |

---

## 5. 设计

### 5.1 Step 0：每类模型独立 worker 线程（已实现）

**目标**：三类模型各自独立线程，推理互不阻塞，加载/卸载与崩溃相互隔离。

**方案**：复用同一 worker 入口，创建时通过 `workerData.family` 指定承载类别。

| 改动                            | 内容                                                                                                                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `local-gateway/worker/index.ts` | 读取 `workerData.family`；用 `FAMILY_MESSAGE_TYPES` 只放行本 family 的消息类型（`generate-stream` 特判保留）；未注入 family 时退化为全部处理器（向后兼容）。启动时记录 `[Worker] 线程启动 { family }`                                                   |
| `local-gateway/manager.ts`      | 新增 `WorkerChannel` 类：封装单 family 的 `worker` / `pendingMessages` / `streamCallbacks` / 自动重启；`LocalAiManager` 持有 `channels: Record<ModelFamily, WorkerChannel>`；`embed`/`rerank`/`generate` 分别投递到对应线程；`dispose()` 并行终止三线程 |
| `vite.config.mts`               | **不变**——单入口单产物 `dist-electron/local-ai-worker.js`，三线程复用同一份代码                                                                                                                                                                         |

**关键细节**：

- `WorkerChannel.terminate()` 置 `disposed = true`，`handleExit`/`restartWorker` 据此跳过自动重启 —— 否则 `terminate()` 触发的非零退出码会导致线程无限重启泄漏。
- 对外 API（`loadEmbeddingModel` / `ensureRerankModel` / `generateStream` / `isLlmBusy` 等）**签名不变**，`model-manager.ts` / `gateway.ts` / `scheduler.ts` 无需改动。

**验证结果**：`pnpm typecheck` 通过；`eslint` 无告警；`vite build` 产出 `local-ai-worker.js`（161.99 kB）；用 `npx electron` 实跑探针确认 family 过滤生效（`llm + embed` → `未知消息类型: embed`，`embedding + generate` → `未知消息类型: generate`，`reranker + unload-llm` → `未知消息类型: unload-llm`），未注入 family 时正常放行至 handler。

---

### 5.2 路由改造：云端优先 + 按任务类型覆盖

**配置字段**（`ModelConfig`，默认值入 `src/main/constants/model.constants.ts`）：

```ts
/** 指定必须走本地 LLM 的任务类型；缺省 = 云端优先。仅对 LLM 类任务有意义。 */
localLlmTasks?: TaskType[];
```

- 默认 `[]`：旧用户升级后行为与现状**完全一致**（云端优先）。bump `ModelConfig.version` 至下一版本号，新字段由 electron-store 默认值合并补齐，**无需破坏性迁移**。
- 可配置范围限定为 3 个智能整理 LLM 场景（见下表），UI 仅在这些场景上暴露「走本地」复选框。

**路由决策改写**（`model-gateway/router.ts` 的 `route()`）：

```
preferLocal = localLlmTasks.includes(task)
if preferLocal:
    本地 LLM 可用 → local
    否则云端可用 → cloud        // D4：回退云端
    否则 throw
else（默认，云端优先）:
    云端可用 → cloud            // G4：启用云端增强且有可用 provider 即走云端，不加载本地 LLM
    否则本地 LLM 可用 → local    // 保留离线可用性
    否则 throw
```

`taskRules` 的 `primary` / `fallback` 字段保留，但实际决策改由「用户覆盖 + 可用性」驱动。

**补内存门控**（`isLocalLlmAvailable()`）：

```ts
const enabled = modelService.getValue<boolean>("enableAiMode");
if (!enabled) return false;
if (!canLoadModel(getFamilyMinMemoryGB("llm"))) return false; // 新增：与 isLocalEmbeddingAvailable 对齐
const checkResult = await modelManager.checkModelFiles("qwen3.5-4b");
return checkResult.complete;
```

**消除无条件预加载**（`smart-tasks/scheduler.ts`）：

- 执行前逐个对 LLM 任务的 `TaskType` 调用 `modelRouter.route(taskType)`，结果为 `"local"` 的任务对应 family 计入「本轮真正需要本地的 family 集合」。
- 仅当 `llm` 在该集合中时才调用 `loadFamilyWithStep("llm", …)`。
- `embedding` / `reranker` 不参与云端路由（云端仅覆盖 LLM），仍按需本地加载。

**智能任务 → TaskType 映射**：

| 智能任务        | TaskType         | 模型 family       |
| --------------- | ---------------- | ----------------- |
| chunk-summary   | `summary`        | llm               |
| concept-extract | `concept_naming` | llm               |
| topic-summary   | `topic_summary`  | llm               |
| chunk-vectorize | —                | embedding（本地） |
| semantic-link   | —                | reranker（本地）  |
| topic-detection | —                | 无模型            |

**UI**：设置 → 模型 → 「云端增强」区域下，列出 3 个 LLM 任务的「走本地」复选框；仅当 `enableAiMode` 开启时可用。

---

### 5.3 阶段一：executor 内部并发

**目标**：把执行器里浪费掉的并发能力用起来（P2），并修正「假批量」（P3）。

#### 5.3.1 通用并发工具

新增 `src/main/core/smart-tasks/concurrency.ts`：

```ts
/** 有界并发执行；结果保持输入顺序；单项失败不中断（由 fn 内部 try/catch）；每项启动前检查取消信号 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  cancelSignal?: { cancelled: boolean },
): Promise<R[]>;
```

三个执行器共用，避免各写一份。

#### 5.3.2 LLM 执行器改为有界并发

| 执行器                        | 改动                                                   |
| ----------------------------- | ------------------------------------------------------ |
| `chunk-summary.executor.ts`   | `for … await` → `mapWithConcurrency(blocks, limit, …)` |
| `concept-extract.executor.ts` | 同上                                                   |
| `semantic-link.executor.ts`   | 同上，但 limit 取独立常量（见下）                      |

- **limit（LLM 类）**：`LocalAiManager` 新增 `getLlmConcurrency(): number`（返回加载时按内存夹紧后的 context 池大小）。云端路径由 `LLMConcurrencyController` 上限兜底。取 `Math.max(1, getLlmConcurrency())`。
  - 说明：超出 context 池的请求会在 worker 内 FIFO 排队（`waitQueue`），不会超额创建 context，也不会出错。
- **limit（semantic-link）**：独立常量，取 `3`。其瓶颈是「LanceDB ANN（I/O）→ reranker（CPU）」交替，适度并发让 I/O 与 CPU 重叠即可；更高只会让 reranker 在线程内排队。
- 语义保持：每个块仍是「生成 → 写库」的独立原子单元；`ai_summary` / `last_smart_processed_at` / `temporal_score` 的写入彼此无依赖，并发不串数据。
- `progressManager.update` 为纯计数，并发调用安全（JS 单线程，`processed++` 无竞态）。
- **取消语义**：`cancelSignal.cancelled` 只阻止「新项取用」，已在途的项自然完成，与现状一致。

#### 5.3.3 真批量推理

| 位置                                   | 改动                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `embedding-handler.ts` 的 `embedBatch` | 逐条 `await pipeline(text)` → 一次 `await pipeline(texts, …)` 数组推理，再按序切分结果 |
| `rerank-handler.ts` 的 `rerank`        | per-document 循环 → 一次批量推理，再按序组装并排序                                     |

这两项在 worker 内部，与 5.3.2 解耦，可单独验证。

---

### 5.4 阶段二：跨 family 并行 + 求和内存门控

**目标**：同层不同 family 的组可真并行（依赖 Step 0），内存不足时安全退回串行。

#### 5.4.1 求和内存门控

`local-gateway/hardware.ts` 新增：

```ts
/** 多个 family 能否同时驻留：按 minMemoryGB 求和与当前可用内存比较（保守口径） */
export function canLoadModelFamilies(families: ModelFamily[]): boolean;
```

- 计算口径：`Σ getFamilyMinMemoryGB(family)` 与 `os.freemem()` 比较（embedding 2 + reranker 2 + llm 5 = 9GB）。
- 保留 `canLoadModel` 供单模型场景使用。

#### 5.4.2 同层「组间串行」改为门控决定并行/串行

`smart-tasks/scheduler.ts` 当前对同层 family 组无条件串行（约 L154–215）。改为：

```
层内涉及的 family 集合 F
if canLoadModelFamilies(F):
    Promise.all(各组)          // 真并行（Step 0 后为不同线程）
else:
    逐组串行                    // 与现状完全一致（D3 的超限回退）
```

#### 5.4.3 释放策略调整

现有逻辑「本层后续组 + 所有后续层都不再需要该 family 就立刻释放」在并行下会抽掉仍被同层他组使用的模型。改为：

- **同层全部结束后**，再按 `remainingTasks` 统一判定并释放各 family（复用 `isModelFamilyNeeded`）。
- `releaseFamily` 的既有保护保留：llm 在途（`isLlmBusy()`）则跳过；有 `idleTimeoutOverride` 则跳过。

#### 5.4.4 可观测

复用 `smart-tasks/resource-snapshot.ts` 的 `getResourceSnapshot()`，在层并行前后各采一次写入步骤明细，便于诊断「门控为何回退」。

---

## 6. 分阶段、依赖与交付顺序

| 阶段   | 内容                                      | 依赖                       |
| ------ | ----------------------------------------- | -------------------------- |
| Step 0 | 每类模型独立 worker 线程                  | —（已完成）                |
| A      | 路由改造（5.2）                           | —（可与阶段一/二并行推进） |
| B      | 阶段一：executor 内部并发 + 真批量（5.3） | 独立                       |
| C      | 阶段二：跨 family 并行 + 求和门控（5.4）  | Step 0                     |

推荐顺序：**A 与 B 可并行 → C**。C 依赖 Step 0 才能获得真并行收益。

## 7. 验收标准

| 编号 | 验收项                                                                                                                                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------- |
| AC1  | 启用云端增强且有可用云端 provider 时，智能整理的 3 个 LLM 任务走云端，且**本地 LLM 未被加载**（日志无 `load-llm` / 内存无 3–4GB 增量）  |
| AC2  | `localLlmTasks` 命中某任务时，该任务优先走本地；本地不可用（未下载 / 内存不足）时回退云端并记日志                                       |
| AC3  | `localLlmTasks` 为空时，行为与改造前一致（云端优先、云端不可用时降级本地）                                                              |
| AC4  | `chunk-summary` 处理 N 个块时，本地 LLM 路径下实际并发数达到 context 池大小（≥2 且 ≤ 内存夹紧值），且总耗时低于串行基线（同数据量可比） |
| AC5  | `chunk-vectorize` 对一批文本调用一次批量推理（而非逐条），处理数量与向量写入正确                                                        |
| AC6  | 内存充足时，同层 reranker 组与 llm 组并行执行；内存不足时自动回退串行，任务结果不变                                                     |
| AC7  | 取消 / 暂停在并发下仍生效；并发不产生重复写入或数据串扰                                                                                 |
| AC8  | `pnpm typecheck`、`npx eslint`、`npx vite build`、`pnpm test` 全部通过                                                                  |

## 8. 风险与回退

| 风险                      | 说明                                                                   | 回退                           |
| ------------------------- | ---------------------------------------------------------------------- | ------------------------------ |
| 真并行收益受限于 CPU 核数 | CPU-only 且核心少时，并行仍争抢 CPU，收益有限；LLM 走 GPU 时收益最明显 | 门控与并发上限均可下调         |
| 并发写库压力              | better-sqlite3 为同步 API，并发任务在主线程串行落库                    | 必要时降低并发上限             |
| 内存峰值上升              | 跨 family 并行提高峰值                                                 | 求和门控不通过时回退串行（D3） |
| 真批量推理的内存峰值      | 一次批量 16 条会瞬时提高内存                                           | 保留 batchSize 常量，可下调    |
| 路由覆盖误配              | 用户把所有任务设为本地但内存不足                                       | 逐任务回退云端（D4）并记日志   |

## 9. 术语与关键常量

| 名称                                     | 值                                 | 位置                                          |
| ---------------------------------------- | ---------------------------------- | --------------------------------------------- |
| `MODEL_FAMILY_EXECUTION_ORDER`           | `["embedding", "reranker", "llm"]` | `smart-tasks/task-dag.ts`                     |
| `KV_CACHE_PER_CONTEXT_GB`                | 0.5                                | `local-gateway/hardware.ts`                   |
| `MEMORY_RESERVE_GB`                      | 1                                  | `local-gateway/hardware.ts`                   |
| `LLMConcurrencyController.maxConcurrent` | 5                                  | `model-gateway/llm-concurrency-controller.ts` |
| `DEFAULT_LLM_CONFIG.concurrency`         | 2                                  | `local-gateway/types.ts`                      |
| `vectorize batchSize`                    | 16                                 | `chunk-vectorize.executor.ts`                 |
| `ANN_TOP_K` / `RERANK_TOP_K`             | 20 / 5                             | `semantic-link.executor.ts`                   |
| `EMBEDDING_DIMENSION`                    | 1024                               | `local-gateway/model-registry.ts`             |
