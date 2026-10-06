# 本地 AI 并行化与云端优先路由 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让本地三类模型（embedding / reranker / llm）的调用可并行、并让 LLM 路由改为「云端优先 + 按任务类型逐个指定走本地」，内存不足时安全回退到串行。

**Architecture:** 分三期落地——A 路由改造（配置字段 → 路由决策 → 调度器按路由预加载 → 设置页 UI）；B executor 内部有界并发 + 真批量推理；C 同层跨 family 门控并行 + 层末统一释放。A/B 互不依赖，C 依赖已完成的 Step 0（每 family 独立 worker 线程）。

**Tech Stack:** Electron 40 + Vue 3 + TypeScript（strict）+ better-sqlite3 + @xenova/transformers（worker 内）+ Vitest（happy-dom，测试在 `tests/**`）。

---

> **执行须知（务必先读）**
>
> - **权威设计文档**：`docs/superpowers/specs/2026-10-05-local-ai-parallel-and-routing-design.md`。本计划与之一一对应，若冲突以 spec 为准。
> - **前置已完成**：Step 0（`manager.ts` 的 `WorkerChannel` + `worker/index.ts` 的 `workerData.family` 过滤）已实现并通过验证，本计划不再改动这两处。
> - **Shell 为 PowerShell**：不支持 `&&`，多条命令用 `;` 连接。
> - **Git 安全**：工作区存在大量与本任务无关的已修改文件。**每个 commit 步骤只 `git add` 本任务列出的具体文件，禁止 `git add -A` / `git add .`。** 若用户未授权提交，跳过 commit 步骤并汇报。
> - **TS strict**：`tsconfig.app.json` 开启 `noUnusedLocals` / `noUnusedParameters`，`pnpm typecheck`（vue-tsc，仅查 `src/`）会因未使用变量失败。
> - 每步 2–5 分钟；先写失败测试 → 跑失败 → 最小实现 → 跑通过 → commit。

---

## File Structure

**新建**

| 文件                                                  | 职责                                                    |
| ----------------------------------------------------- | ------------------------------------------------------- |
| `src/main/core/smart-tasks/concurrency.ts`            | 通用有界并发工具 `mapWithConcurrency`（三个执行器共用） |
| `src/renderer/utils/local-llm-tasks.ts`               | 「走本地」任务勾选的纯函数（便于单测）                  |
| `tests/unit/main/model-config-defaults.test.ts`       | 配置默认值断言（Task 1）                                |
| `tests/unit/main/model-router.test.ts`                | 路由决策断言（Task 2）                                  |
| `tests/unit/main/scheduler-local-families.test.ts`    | `resolveLocalFamilies` 断言（Task 3）                   |
| `tests/unit/renderer/local-llm-tasks.test.ts`         | 勾选纯函数断言（Task 4）                                |
| `tests/unit/main/smart-task-concurrency.test.ts`      | `mapWithConcurrency` 断言（Task 5）                     |
| `tests/unit/main/local-ai-llm-concurrency.test.ts`    | `getLlmConcurrency` 断言（Task 6）                      |
| `tests/unit/main/chunk-summary-concurrency.test.ts`   | chunk-summary 并发断言（Task 7）                        |
| `tests/unit/main/concept-extract-concurrency.test.ts` | concept-extract 并发断言（Task 8）                      |
| `tests/unit/main/semantic-link-concurrency.test.ts`   | semantic-link 并发断言（Task 9）                        |
| `tests/unit/main/embedding-handler-batch.test.ts`     | 批量嵌入断言（Task 10）                                 |
| `tests/unit/main/rerank-handler-batch.test.ts`        | 批量重排断言（Task 11）                                 |
| `tests/unit/main/hardware-family-gate.test.ts`        | 求和门控断言（Task 12）                                 |
| `tests/unit/main/scheduler-layer-families.test.ts`    | 层 family 收集/释放选择断言（Task 13）                  |

**修改**

| 文件                                                                    | 改动                                                                                                  |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/shared/types/model.types.ts`                                       | `ModelConfig` 新增 `localLlmTasks?: TaskType[]`                                                       |
| `src/main/constants/model.constants.ts`                                 | 默认值补 `localLlmTasks: []`，`version` 提升到 `0.2.0`                                                |
| `src/main/core/model-gateway/router.ts`                                 | `route()` 改云端优先 + 覆盖；`isLocalLlmAvailable()` 加内存门控                                       |
| `src/main/core/smart-tasks/task-dag.ts`                                 | 新增 `TASK_LLM_TASK_TYPE`、`resolveLocalFamilies`、`collectLayerFamilies`、`selectReleasableFamilies` |
| `src/main/core/smart-tasks/scheduler.ts`                                | 按路由预加载本地 LLM；同层门控并行；层末统一释放                                                      |
| `src/renderer/components/settings/model/ModelSettings.vue`              | 「云端增强」区域新增 3 个「走本地」复选框                                                             |
| `src/shared/i18n/locales/zhCN.ts` / `enUS.ts`                           | 新增 5 个 i18n key（两个 locale 必须一致）                                                            |
| `src/main/core/model-gateway/local-gateway/manager.ts`                  | 新增 `getLlmConcurrency()`                                                                            |
| `src/main/core/smart-tasks/executors/chunk-summary.executor.ts`         | 逐块串行 → 有界并发                                                                                   |
| `src/main/core/smart-tasks/executors/concept-extract.executor.ts`       | 逐块串行 → 有界并发                                                                                   |
| `src/main/core/smart-tasks/executors/semantic-link.executor.ts`         | 逐块串行 → 有界并发（独立常量 3）                                                                     |
| `src/main/core/model-gateway/local-gateway/worker/embedding-handler.ts` | `embedBatch` 改真批量                                                                                 |
| `src/main/core/model-gateway/local-gateway/worker/rerank-handler.ts`    | `rerank` 改真批量                                                                                     |
| `src/main/core/model-gateway/local-gateway/hardware.ts`                 | 新增 `canLoadModelFamilies`                                                                           |

---

## Phase A — 路由改造

### Task 1: 配置字段 `localLlmTasks` 与默认值

**Files:**

- Modify: `src/shared/types/model.types.ts:38-46`
- Modify: `src/main/constants/model.constants.ts:6-14`
- Test: `tests/unit/main/model-config-defaults.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/main/model-config-defaults.test.ts`：

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { DEFAULT_MODEL_CONFIG } from "@/main/constants/model.constants";

describe("DEFAULT_MODEL_CONFIG", () => {
  it("localLlmTasks 默认为空数组（等价于云端优先）", () => {
    expect(DEFAULT_MODEL_CONFIG.localLlmTasks).toEqual([]);
  });

  it("version 已提升到 0.2.0", () => {
    expect(DEFAULT_MODEL_CONFIG.version).toBe("0.2.0");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/unit/main/model-config-defaults.test.ts`
Expected: FAIL —— `DEFAULT_MODEL_CONFIG.localLlmTasks` 为 `undefined`，`version` 为 `"0.1.9"`。

- [ ] **Step 3: 给 `ModelConfig` 加字段**

把 `src/shared/types/model.types.ts` 的 `ModelConfig` 替换为：

```ts
export interface ModelConfig {
  aiProviders: AIProvider[];
  defaultModels: DefaultModel[];
  providerPriority: string[];
  enableAiMode?: boolean; // 是否启用本地AI模式
  enableCloudAi?: boolean; // 是否启用云AI
  /**
   * 指定必须走本地 LLM 的任务类型；缺省 = 云端优先。仅对 LLM 类任务有意义。
   * 可配置范围限定为智能整理的 3 个 LLM 场景（summary / concept_naming / topic_summary）。
   */
  localLlmTasks?: TaskType[];
  version: string; // 配置文件版本
  updatedAt: string; // 更新时间
}
```

（`TaskType` 已在文件首行 `import { OutputModelType, Locale, TaskType } from "@/shared/enums";` 中导入，无需新增 import。）

- [ ] **Step 4: 更新默认配置**

把 `src/main/constants/model.constants.ts` 的 `DEFAULT_MODEL_CONFIG` 替换为：

```ts
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  aiProviders: DEFAULT_PROVIDER,
  defaultModels: [],
  providerPriority: [],
  enableAiMode: false,
  enableCloudAi: false,
  localLlmTasks: [],
  version: "0.2.0",
  updatedAt: TimeUtil.toISOString(Date.now()),
};
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run tests/unit/main/model-config-defaults.test.ts`
Expected: PASS（2 passed）。

- [ ] **Step 6: 类型检查**

Run: `pnpm typecheck`
Expected: 无错误。

- [ ] **Step 7: Commit**

```bash
git add src/shared/types/model.types.ts src/main/constants/model.constants.ts tests/unit/main/model-config-defaults.test.ts
git commit -m "feat(model): add localLlmTasks config field with cloud-first default"
```

---

### Task 2: 路由决策改为云端优先 + 按任务类型覆盖

**Files:**

- Modify: `src/main/core/model-gateway/router.ts:40-55`（`route`）、`src/main/core/model-gateway/router.ts:96-106`（`isLocalLlmAvailable`）、新增 `getLocalLlmTasks`
- Test: `tests/unit/main/model-router.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/main/model-router.test.ts`：

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const getValueMock = vi.fn();
const checkModelFilesMock = vi.fn();
const canLoadModelMock = vi.fn();

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/services/ai/model.service", () => ({
  modelService: { getValue: (...args: unknown[]) => getValueMock(...args) },
  default: {},
}));
vi.mock("@/main/core/model-gateway/local-gateway/model-manager", () => ({
  modelManager: {
    checkModelFiles: (...args: unknown[]) => checkModelFilesMock(...args),
  },
  default: {},
}));
vi.mock("@/main/core/model-gateway/local-gateway/hardware", () => ({
  canLoadModel: (...args: unknown[]) => canLoadModelMock(...args),
}));

import { modelRouter } from "@/main/core/model-gateway/router";
import { TASK_TYPE } from "@/shared/enums";

/** 构造 modelService.getValue 的返回值：默认无云端、无本地、无覆盖 */
function mockConfig(overrides: Record<string, unknown> = {}): void {
  const base: Record<string, unknown> = {
    enableAiMode: false,
    enableCloudAi: false,
    aiProviders: [],
    localLlmTasks: [],
    ...overrides,
  };
  getValueMock.mockImplementation((key: string) => base[key]);
}

const cloudOn = {
  enableCloudAi: true,
  aiProviders: [{ id: "p1", enabled: true }],
};

describe("ModelRouter.route 云端优先 + 按任务类型覆盖", () => {
  beforeEach(() => {
    getValueMock.mockReset();
    checkModelFilesMock.mockReset().mockResolvedValue({ complete: true });
    canLoadModelMock.mockReset().mockReturnValue(true);
  });

  it("AC1：云端可用且未指定本地时走云端，且不检查本地模型文件", async () => {
    mockConfig(cloudOn);
    await expect(modelRouter.route(TASK_TYPE.SUMMARY)).resolves.toBe("cloud");
    expect(checkModelFilesMock).not.toHaveBeenCalled();
  });

  it("AC2：任务被指定走本地且本地可用时走本地", async () => {
    mockConfig({ enableAiMode: true, localLlmTasks: [TASK_TYPE.SUMMARY] });
    await expect(modelRouter.route(TASK_TYPE.SUMMARY)).resolves.toBe("local");
  });

  it("AC2/D4：指定走本地但本地不可用时回退云端", async () => {
    mockConfig({
      ...cloudOn,
      enableAiMode: false,
      localLlmTasks: [TASK_TYPE.SUMMARY],
    });
    await expect(modelRouter.route(TASK_TYPE.SUMMARY)).resolves.toBe("cloud");
  });

  it("AC2/D4：指定走本地、本地与云端都不可用时抛错", async () => {
    mockConfig({ enableAiMode: false, localLlmTasks: [TASK_TYPE.SUMMARY] });
    await expect(modelRouter.route(TASK_TYPE.SUMMARY)).rejects.toThrow();
  });

  it("AC3：localLlmTasks 为空且云端不可用时降级本地（保留离线可用性）", async () => {
    mockConfig({ enableAiMode: true });
    await expect(modelRouter.route(TASK_TYPE.SUMMARY)).resolves.toBe("local");
  });

  it("P6：云端不可用且内存不足时不选本地 LLM", async () => {
    mockConfig({ enableAiMode: true });
    canLoadModelMock.mockReturnValue(false);
    await expect(modelRouter.route(TASK_TYPE.SUMMARY)).rejects.toThrow();
    expect(checkModelFilesMock).not.toHaveBeenCalled();
  });

  it("未知任务类型抛错", async () => {
    mockConfig({});
    await expect(modelRouter.route("nope" as never)).rejects.toThrow(
      "未知任务类型",
    );
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/unit/main/model-router.test.ts`
Expected: FAIL —— 现状 `taskRules` 全部 `primary: cloud`，内存门控缺失，多个用例与预期不符。

- [ ] **Step 3: 改写 `route()`**

把 `src/main/core/model-gateway/router.ts` 的 `route` 方法（含其上方的 JSDoc）替换为：

```ts
  /**
   * 根据任务类型路由到 local 或 cloud。
   * 默认「云端优先」：启用云端增强且有可用 provider 时走云端，不加载本地 LLM。
   * 用户可在 localLlmTasks 中逐个指定任务走本地；本地不可用时回退云端（D4）。
   * @param task 任务类型
   * @returns RouteTarget
   * @throws 首选源与备选源都不可用
   */
  public async route(task: TaskType): Promise<RouteTarget> {
    if (!taskRules[task]) throw new Error(`未知任务类型: ${task}`);

    const preferLocal = this.getLocalLlmTasks().includes(task);

    if (preferLocal) {
      if (await this.isLocalLlmAvailable()) {
        Logger.info("[ModelRouter] 路由决策", { task, target: "local", reason: "user-preference" });
        return "local";
      }
      if (this.isCloudAvailable()) {
        Logger.info("[ModelRouter] 本地不可用，回退云端", { task });
        return "cloud";
      }
      throw new Error(`本地 LLM 不可用且云端不可用，无法执行任务: ${task}`);
    }

    if (this.isCloudAvailable()) {
      Logger.info("[ModelRouter] 路由决策", { task, target: "cloud" });
      return "cloud";
    }
    if (await this.isLocalLlmAvailable()) {
      Logger.info("[ModelRouter] 云端不可用，降级本地", { task });
      return "local";
    }
    throw new Error(`云端不可用且本地 LLM 未就绪，无法执行任务: ${task}`);
  }

  /** 读取用户指定「走本地 LLM」的任务类型列表；缺失或非法时返回空数组 */
  private getLocalLlmTasks(): TaskType[] {
    const tasks = modelService.getValue<TaskType[]>("localLlmTasks");
    return Array.isArray(tasks) ? tasks : [];
  }
```

（改写后 `route()` 直接调用 `isLocalLlmAvailable()` / `isCloudAvailable()`，文件末尾的私有方法 `isSourceAvailable` 不再被任何地方引用。请**一并删除该方法**（定义在 `router.ts` 末尾 `getAllRouteStatus` 与类结束 `}` 之间），否则 `noUnusedLocals` 会报 “`isSourceAvailable` is declared but its value is never read”。）

- [ ] **Step 4: 给 `isLocalLlmAvailable()` 补内存门控**

把 `src/main/core/model-gateway/router.ts` 的 `isLocalLlmAvailable` 方法替换为：

```ts
  /**
   * 检查本地 LLM 生成能力是否可用
   * 判断标准：enableAiMode 开关启用 + 可用内存足够 + LLM 模型已下载
   */
  public async isLocalLlmAvailable(): Promise<boolean> {
    const enabled = modelService.getValue<boolean>("enableAiMode");
    if (!enabled) return false;

    // 与 isLocalEmbeddingAvailable 对齐：内存不足时不选中本地 LLM，避免加载后卡死（P6）
    const requiredGB = getFamilyMinMemoryGB("llm");
    if (!canLoadModel(requiredGB)) {
      Logger.info("[ModelRouter] 可用内存不足，跳过本地 LLM", { requiredGB });
      return false;
    }

    try {
      const checkResult = await modelManager.checkModelFiles("qwen3.5-4b");
      return checkResult.complete;
    } catch {
      return false;
    }
  }
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run tests/unit/main/model-router.test.ts`
Expected: PASS（7 passed）。

- [ ] **Step 6: 类型检查**

Run: `pnpm typecheck`
Expected: 无错误。

- [ ] **Step 7: Commit**

```bash
git add src/main/core/model-gateway/router.ts tests/unit/main/model-router.test.ts
git commit -m "feat(model-gateway): cloud-first routing with per-task local override"
```

---

### Task 3: 调度器按路由结果决定是否预加载本地 LLM

**Files:**

- Modify: `src/main/core/smart-tasks/task-dag.ts`（新增 `TASK_LLM_TASK_TYPE` 与 `resolveLocalFamilies`）
- Modify: `src/main/core/smart-tasks/scheduler.ts:5`、`:134-161`
- Test: `tests/unit/main/scheduler-local-families.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/main/scheduler-local-families.test.ts`：

```ts
// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  resolveLocalFamilies,
  TASK_LLM_TASK_TYPE,
} from "@/main/core/smart-tasks/task-dag";
import { TASK_TYPE } from "@/shared/enums";

describe("resolveLocalFamilies", () => {
  it("全部路由到云端时不含 llm", async () => {
    const route = vi.fn().mockResolvedValue("cloud");
    const families = await resolveLocalFamilies(
      ["chunk-summary", "concept-extract", "topic-summary"],
      route,
    );
    expect(families.has("llm")).toBe(false);
  });

  it("有任务路由到本地时含 llm", async () => {
    const route = vi.fn(async (task: string) =>
      task === TASK_TYPE.SUMMARY ? "local" : "cloud",
    );
    const families = await resolveLocalFamilies(
      ["chunk-summary", "concept-extract"],
      route,
    );
    expect(families.has("llm")).toBe(true);
  });

  it("非 LLM 任务不触发路由调用", async () => {
    const route = vi.fn().mockResolvedValue("local");
    await resolveLocalFamilies(
      ["chunk-vectorize", "semantic-link", "topic-detection"],
      route,
    );
    expect(route).not.toHaveBeenCalled();
  });

  it("路由抛错时不预加载且不抛出", async () => {
    const route = vi.fn().mockRejectedValue(new Error("both unavailable"));
    const families = await resolveLocalFamilies(["chunk-summary"], route);
    expect(families.size).toBe(0);
  });

  it("映射表仅覆盖 3 个 LLM 任务", () => {
    expect(Object.keys(TASK_LLM_TASK_TYPE).sort()).toEqual([
      "chunk-summary",
      "concept-extract",
      "topic-summary",
    ]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/unit/main/scheduler-local-families.test.ts`
Expected: FAIL —— `resolveLocalFamilies` / `TASK_LLM_TASK_TYPE` 未导出。

- [ ] **Step 3: 在 `task-dag.ts` 增加映射与纯函数**

在 `src/main/core/smart-tasks/task-dag.ts` 顶部 import 区补一行：

```ts
import { TASK_TYPE, type TaskType } from "@/shared/enums";
```

在 `TASK_MODEL_FAMILY` 定义之后追加：

```ts
/**
 * 智能任务 → LLM 路由任务类型（仅 llm family 的任务有值）。
 * 决定调度器是否为本地 LLM 预加载：只有路由判定为「local」的任务才需要本地 LLM。
 */
export const TASK_LLM_TASK_TYPE: Record<string, TaskType | null> = {
  "chunk-summary": TASK_TYPE.SUMMARY,
  "concept-extract": TASK_TYPE.CONCEPT_NAMING,
  "topic-summary": TASK_TYPE.TOPIC_SUMMARY,
};

/**
 * 依据路由决策计算本轮需要预加载的本地 LLM family 集合。
 * - 仅 LLM 类任务参与路由（embedding / reranker / 无模型任务始终按需本地加载）。
 * - 路由不可用（本地与云端都不可用）时视为不需要预加载，交由执行阶段报错。
 */
export async function resolveLocalFamilies(
  taskNames: string[],
  route: (task: TaskType) => Promise<"local" | "cloud">,
): Promise<Set<ModelFamily>> {
  const families = new Set<ModelFamily>();
  for (const name of taskNames) {
    const taskType = TASK_LLM_TASK_TYPE[name];
    if (!taskType) continue;
    try {
      if ((await route(taskType)) === "local") families.add("llm");
    } catch {
      // 路由不可用：不预加载本地 LLM
    }
  }
  return families;
}
```

- [ ] **Step 4: 在 `scheduler.ts` 接入路由判定**

把 `src/main/core/smart-tasks/scheduler.ts:5` 的 task-dag import 替换为：

```ts
import {
  getTaskLayers,
  groupTasksByModelFamily,
  isModelFamilyNeeded,
  resolveLocalFamilies,
} from "./task-dag";
```

在 `import { Logger } from "@/main/utils/logger";` 之后追加：

```ts
import { modelRouter } from "@/main/core/model-gateway/router";
```

在 `const handledFamilies = new Set<ModelFamily>();` 之后追加：

```ts
// 本轮真正需要本地 LLM 的 family 集合：按任务类型路由判定。
// 走云端的 LLM 任务不再预加载本地 LLM（G4：避免白占 3–4GB 内存）
const localFamilies = await resolveLocalFamilies(flatTasks, (task) =>
  modelRouter.route(task),
);
```

把同层分组循环里的预加载段：

```ts
// 记录"启动模型"节点并显式预加载（已加载时幂等返回），加载后采集系统资源快照
if (group.family) {
  await this.loadFamilyWithStep(group.family, taskStepId(group.tasks[0]));
}
```

替换为：

```ts
// 记录"启动模型"节点并显式预加载（已加载时幂等返回），加载后采集系统资源快照。
// 本地 LLM 仅在路由判定为「走本地」时预加载（G4）
const needPreload =
  group.family !== null && (group.family !== "llm" || localFamilies.has("llm"));
if (group.family && needPreload) {
  await this.loadFamilyWithStep(group.family, taskStepId(group.tasks[0]));
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run tests/unit/main/scheduler-local-families.test.ts`
Expected: PASS（5 passed）。

- [ ] **Step 6: 类型检查 + 跑既有调度器相关测试**

Run: `pnpm typecheck; npx vitest run tests/unit/main/smart-task-dag-parallel.test.ts`
Expected: typecheck 无错误；DAG 测试 PASS。

- [ ] **Step 7: Commit**

```bash
git add src/main/core/smart-tasks/task-dag.ts src/main/core/smart-tasks/scheduler.ts tests/unit/main/scheduler-local-families.test.ts
git commit -m "feat(smart-tasks): preload local LLM only when routing targets local"
```

---

### Task 4: 设置页「走本地」复选框 + i18n

**Files:**

- Create: `src/renderer/utils/local-llm-tasks.ts`
- Modify: `src/renderer/components/settings/model/ModelSettings.vue:33-32`（模板）、`:62-160`（脚本/样式）
- Modify: `src/shared/i18n/locales/zhCN.ts:525`、`src/shared/i18n/locales/enUS.ts:533`
- Test: `tests/unit/renderer/local-llm-tasks.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/renderer/local-llm-tasks.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { toggleLocalLlmTask } from "@/renderer/utils/local-llm-tasks";

describe("toggleLocalLlmTask", () => {
  it("勾选时加入任务类型", () => {
    expect(toggleLocalLlmTask([], "summary", true)).toEqual(["summary"]);
  });

  it("取消时移除任务类型", () => {
    expect(
      toggleLocalLlmTask(["summary", "topic_summary"], "summary", false),
    ).toEqual(["topic_summary"]);
  });

  it("重复勾选不产生重复项", () => {
    expect(toggleLocalLlmTask(["summary"], "summary", true)).toEqual([
      "summary",
    ]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/unit/renderer/local-llm-tasks.test.ts`
Expected: FAIL —— 模块 `@/renderer/utils/local-llm-tasks` 不存在。

- [ ] **Step 3: 实现纯函数**

创建 `src/renderer/utils/local-llm-tasks.ts`：

```ts
import type { TaskType } from "@/shared/enums";

/** 切换某个任务的「走本地」勾选，返回新的任务类型列表（去重，保持既有顺序） */
export function toggleLocalLlmTask(
  current: TaskType[],
  task: TaskType,
  checked: boolean,
): TaskType[] {
  const set = new Set(current);
  if (checked) set.add(task);
  else set.delete(task);
  return Array.from(set);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/unit/renderer/local-llm-tasks.test.ts`
Expected: PASS（3 passed）。

- [ ] **Step 5: 补 i18n key（两个 locale 必须同步）**

在 `src/shared/i18n/locales/zhCN.ts` 的 `AI_SETTINGS` 下、`ENABLE_AI_CLOUD_DESC_3` 之后插入：

```ts
      LOCAL_LLM_TASKS: "本地模型使用范围",
      LOCAL_LLM_TASKS_DESC: "默认使用云端增强模型，可勾选以下任务改用本地模型",
      LOCAL_LLM_TASK_SUMMARY: "内容摘要",
      LOCAL_LLM_TASK_CONCEPT: "概念提取",
      LOCAL_LLM_TASK_TOPIC: "主题摘要",
```

在 `src/shared/i18n/locales/enUS.ts` 的 `AI_SETTINGS` 下、`ENABLE_AI_CLOUD_DESC_3` 之后插入：

```ts
      LOCAL_LLM_TASKS: "Local model scope",
      LOCAL_LLM_TASKS_DESC:
        "The cloud model is used by default; check tasks below to run them on the local model",
      LOCAL_LLM_TASK_SUMMARY: "Content summary",
      LOCAL_LLM_TASK_CONCEPT: "Concept extraction",
      LOCAL_LLM_TASK_TOPIC: "Topic summary",
```

- [ ] **Step 6: 在设置页加复选框**

在 `src/renderer/components/settings/model/ModelSettings.vue` 的「云端增强」开关卡片（`v-if`/`updateEnableCloudAi` 那张）之后、模型服务商导航卡片之前，插入：

```vue
<!-- 云端增强下的本地模型使用范围：默认云端优先，可逐个指定走本地 -->
<n-card
  v-if="enableCloudAi"
  size="medium"
  :bordered="false"
  class="setting-card"
>
      <n-flex align="center" class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{
            t("SETTINGS.AI_SETTINGS.LOCAL_LLM_TASKS")
          }}</n-text>
          <n-text class="setting-desc">{{
            t("SETTINGS.AI_SETTINGS.LOCAL_LLM_TASKS_DESC")
          }}</n-text>
        </n-flex>
      </n-flex>
      <n-flex vertical class="local-task-list">
        <n-checkbox
          v-for="task in LLM_TASK_DEFS"
          :key="task.value"
          :checked="localLlmTasks.includes(task.value)"
          :disabled="!enableAiMode"
          @update:checked="(checked: boolean) => toggleLocalTask(task.value, checked)"
        >
          {{ t(task.labelKey) }}
        </n-checkbox>
      </n-flex>
    </n-card>
```

把 `<script setup>` 里的解构行：

```ts
const {
  enableAiMode,
  enableCloudAi,
  updateEnableAiMode,
  updateEnableCloudAi,
  checkModelExist,
  downloadModel,
} = useModel();
```

替换为：

```ts
const {
  config,
  enableAiMode,
  enableCloudAi,
  updateEnableAiMode,
  updateEnableCloudAi,
  checkModelExist,
  downloadModel,
  setValue,
} = useModel();

/** 可指定「走本地」的 3 个 LLM 任务（与后端 TASK_LLM_TASK_TYPE 对应） */
const LLM_TASK_DEFS = [
  { value: "summary", labelKey: "SETTINGS.AI_SETTINGS.LOCAL_LLM_TASK_SUMMARY" },
  {
    value: "concept_naming",
    labelKey: "SETTINGS.AI_SETTINGS.LOCAL_LLM_TASK_CONCEPT",
  },
  {
    value: "topic_summary",
    labelKey: "SETTINGS.AI_SETTINGS.LOCAL_LLM_TASK_TOPIC",
  },
] as const;

type LlmTaskType = (typeof LLM_TASK_DEFS)[number]["value"];

/** 已勾选「走本地」的任务类型 */
const localLlmTasks = computed<LlmTaskType[]>(
  () => config.value?.localLlmTasks ?? [],
);

/** 切换某任务的「走本地」勾选并持久化 */
async function toggleLocalTask(
  task: LlmTaskType,
  checked: boolean,
): Promise<void> {
  await setValue(
    "localLlmTasks",
    toggleLocalLlmTask(localLlmTasks.value, task, checked),
  );
}
```

在 `<script setup>` 顶部 import 区补一行：

```ts
import { toggleLocalLlmTask } from "@/renderer/utils/local-llm-tasks";
```

在 `<style scoped>` 末尾（`.nav-arrow` 规则之后）追加：

```scss
.local-task-list {
  gap: 8px;
  margin-top: $spacing-xs;
}
```

- [ ] **Step 7: 跑 i18n 一致性与勾选测试**

Run: `npx vitest run tests/unit/shared/locale-keys.test.ts tests/unit/renderer/local-llm-tasks.test.ts`
Expected: PASS（locale 键数量与集合一致 + 3 passed）。

- [ ] **Step 8: 类型检查**

Run: `pnpm typecheck`
Expected: 无错误。

- [ ] **Step 9: Commit**

```bash
git add src/renderer/utils/local-llm-tasks.ts src/renderer/components/settings/model/ModelSettings.vue src/shared/i18n/locales/zhCN.ts src/shared/i18n/locales/enUS.ts tests/unit/renderer/local-llm-tasks.test.ts
git commit -m "feat(settings): add per-task local LLM opt-in checkboxes"
```

---

## Phase B — executor 内部并发 + 真批量

### Task 5: 通用有界并发工具 `mapWithConcurrency`

**Files:**

- Create: `src/main/core/smart-tasks/concurrency.ts`
- Test: `tests/unit/main/smart-task-concurrency.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/main/smart-task-concurrency.test.ts`：

```ts
// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { mapWithConcurrency } from "@/main/core/smart-tasks/concurrency";

describe("mapWithConcurrency", () => {
  it("并发不超过 limit 且确实并行", async () => {
    let active = 0;
    let maxObserved = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      active++;
      maxObserved = Math.max(maxObserved, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
    });
    expect(maxObserved).toBeLessThanOrEqual(2);
    expect(maxObserved).toBeGreaterThan(1);
  });

  it("结果保持输入顺序", async () => {
    const result = await mapWithConcurrency([3, 1, 2], 3, async (n) => {
      await new Promise((r) => setTimeout(r, n * 5));
      return n * 10;
    });
    expect(result).toEqual([30, 10, 20]);
  });

  it("取消后不再启动新项", async () => {
    const signal = { cancelled: false };
    const fn = vi.fn(async () => {
      signal.cancelled = true;
      await new Promise((r) => setTimeout(r, 5));
    });
    await mapWithConcurrency([1, 2, 3, 4], 1, fn, signal);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("limit 超过条目数时全部执行", async () => {
    const fn = vi.fn(async (n: number) => n);
    const result = await mapWithConcurrency([1, 2], 10, fn);
    expect(result).toEqual([1, 2]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("limit < 1 时夹紧为 1", async () => {
    let active = 0;
    let maxObserved = 0;
    await mapWithConcurrency([1, 2, 3], 0, async () => {
      active++;
      maxObserved = Math.max(maxObserved, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
    expect(maxObserved).toBe(1);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/unit/main/smart-task-concurrency.test.ts`
Expected: FAIL —— 模块 `@/main/core/smart-tasks/concurrency` 不存在。

- [ ] **Step 3: 实现**

创建 `src/main/core/smart-tasks/concurrency.ts`：

```ts
/**
 * 智能任务通用并发工具
 */

/** 取消信号（与 TaskContext.cancelSignal 同构） */
export interface CancelSignal {
  cancelled: boolean;
}

/**
 * 有界并发执行。
 * - 结果按输入顺序返回；被取消而未执行的位置为 undefined（调用方不应依赖其完整性）。
 * - 单项失败不中断整体：由 fn 内部自行 try/catch。
 * - 每项启动前检查取消信号：已取消则不再启动新项，在途项自然完成。
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  cancelSignal?: CancelSignal,
): Promise<R[]> {
  const safeLimit = Math.max(1, Math.floor(limit));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      if (cancelSignal?.cancelled) return;
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  };

  const runnerCount = Math.min(safeLimit, items.length);
  await Promise.all(Array.from({ length: runnerCount }, () => worker()));
  return results;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/unit/main/smart-task-concurrency.test.ts`
Expected: PASS（5 passed）。

- [ ] **Step 5: Commit**

```bash
git add src/main/core/smart-tasks/concurrency.ts tests/unit/main/smart-task-concurrency.test.ts
git commit -m "feat(smart-tasks): add bounded-concurrency helper"
```

---

### Task 6: `LocalAiManager.getLlmConcurrency()`

**Files:**

- Modify: `src/main/core/model-gateway/local-gateway/manager.ts:394-400`（在 `getLlmModelStatus` 之后新增方法）
- Test: `tests/unit/main/local-ai-llm-concurrency.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/main/local-ai-llm-concurrency.test.ts`：

```ts
// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/model-gateway/local-gateway/model-manager", () => ({
  modelManager: {
    getModelsBasePath: vi.fn(() => "/mock/models"),
    getModelStatus: vi.fn(),
  },
  default: {},
}));

import { localAiManager } from "@/main/core/model-gateway/local-gateway/manager";

describe("LocalAiManager.getLlmConcurrency", () => {
  it("返回配置的并发度", () => {
    localAiManager.configure({ llm: { concurrency: 4 } });
    expect(localAiManager.getLlmConcurrency()).toBe(4);
  });

  it("默认并发度为 2", () => {
    localAiManager.configure({ llm: { concurrency: 2 } });
    expect(localAiManager.getLlmConcurrency()).toBe(2);
  });

  it("并发度至少为 1", () => {
    localAiManager.configure({ llm: { concurrency: 0 } });
    expect(localAiManager.getLlmConcurrency()).toBe(1);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/unit/main/local-ai-llm-concurrency.test.ts`
Expected: FAIL —— `getLlmConcurrency` 不是函数。

- [ ] **Step 3: 实现**

在 `src/main/core/model-gateway/local-gateway/manager.ts` 的 `getLlmModelStatus()` 之后追加：

```ts
  /**
   * 本地 LLM 当前可用的并发度（= 加载时按可用内存夹紧后的 context 池大小）。
   * 供执行器决定有界并发的上限；未加载时以配置上限兜底，至少为 1。
   */
  public getLlmConcurrency(): number {
    const configured = this.llmConfig.concurrency ?? DEFAULT_LLM_CONFIG.concurrency ?? 1;
    return Math.max(1, Math.floor(configured));
  }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/unit/main/local-ai-llm-concurrency.test.ts`
Expected: PASS（3 passed）。

- [ ] **Step 5: 类型检查**

Run: `pnpm typecheck`
Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add src/main/core/model-gateway/local-gateway/manager.ts tests/unit/main/local-ai-llm-concurrency.test.ts
git commit -m "feat(local-gateway): expose LLM context pool concurrency"
```

---

### Task 7: chunk-summary 改为有界并发

**Files:**

- Modify: `src/main/core/smart-tasks/executors/chunk-summary.executor.ts:16-48`
- Test: `tests/unit/main/chunk-summary-concurrency.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/main/chunk-summary-concurrency.test.ts`：

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
const updateMock = vi.fn();
const chatCompletionMock = vi.fn();
const getLlmConcurrencyMock = vi.fn(() => 2);

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/db", () => ({
  ChunkDao: class {
    query = queryMock;
    update = updateMock;
  },
}));
vi.mock("@/main/core/services/ai/ai.service", () => ({
  aiService: {
    chatCompletion: (...args: unknown[]) => chatCompletionMock(...args),
  },
  default: {},
}));
vi.mock("@/main/core/smart-tasks/progress.manager", () => ({
  progressManager: { update: vi.fn(), completeTask: vi.fn() },
}));
vi.mock("@/main/core/model-gateway/local-gateway", () => ({
  localAiManager: { getLlmConcurrency: () => getLlmConcurrencyMock() },
}));

import { ChunkSummaryExecutor } from "@/main/core/smart-tasks/executors/chunk-summary.executor";

function makeBlocks(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `b${i}`,
    content: "x".repeat(300),
    ai_summary: null,
    updated_at: "2026-01-01T00:00:00.000Z",
  }));
}

describe("ChunkSummaryExecutor 有界并发", () => {
  beforeEach(() => {
    queryMock.mockReset();
    updateMock.mockReset();
    chatCompletionMock.mockReset();
    getLlmConcurrencyMock.mockReset().mockReturnValue(2);
  });

  it("AC4：本地并发数达到 context 池大小且写入不串数据", async () => {
    queryMock.mockReturnValue(makeBlocks(5));
    let active = 0;
    let maxObserved = 0;
    chatCompletionMock.mockImplementation(async () => {
      active++;
      maxObserved = Math.max(maxObserved, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      return { content: "summary" };
    });

    const executor = new ChunkSummaryExecutor();
    const result = await executor.run({
      executionId: "e1",
      processedUntil: null,
      cancelSignal: { cancelled: false },
      pauseSignal: { paused: false },
    });

    expect(result.success).toBe(true);
    expect(result.processedCount).toBe(5);
    expect(maxObserved).toBe(2);
    expect(updateMock).toHaveBeenCalledTimes(5);
  });

  it("AC7：取消后不再启动新项并返回已取消", async () => {
    queryMock.mockReturnValue(makeBlocks(4));
    getLlmConcurrencyMock.mockReturnValue(1);
    const cancelSignal = { cancelled: false };
    chatCompletionMock.mockImplementation(async () => {
      cancelSignal.cancelled = true;
      await new Promise((r) => setTimeout(r, 5));
      return { content: "summary" };
    });

    const executor = new ChunkSummaryExecutor();
    const result = await executor.run({
      executionId: "e2",
      processedUntil: null,
      cancelSignal,
      pauseSignal: { paused: false },
    });

    expect(chatCompletionMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.error).toBe("已取消");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/unit/main/chunk-summary-concurrency.test.ts`
Expected: FAIL —— 第一个用例 `maxObserved` 为 1（逐块串行）。

- [ ] **Step 3: 改为有界并发**

在 `src/main/core/smart-tasks/executors/chunk-summary.executor.ts` 顶部 import 区追加：

```ts
import { mapWithConcurrency } from "../concurrency";
import { localAiManager } from "@/main/core/model-gateway/local-gateway";
```

把 `run()` 方法替换为：

```ts
  public async run(context: TaskContext): Promise<TaskResult> {
    const blocks = this.getUnsummarizedBlocks(context.processedUntil);
    const total = blocks.length;

    if (total === 0) {
      return { taskName: this.name, success: true, processedCount: 0 };
    }

    let processed = 0;
    const limit = Math.max(1, localAiManager.getLlmConcurrency());

    await mapWithConcurrency(
      blocks,
      limit,
      async (block) => {
        try {
          const summary = await this.generateSummary(block);
          const update: ChunkUpdate = {
            ai_summary: summary,
            last_smart_processed_at: TimeUtil.getLocalDateString(),
          };
          this.chunkDao.update(block.id, update);
        } catch (error) {
          Logger.error("[ChunkSummaryExecutor] 生成摘要失败", { blockId: block.id, error: String(error) });
        } finally {
          processed++;
          progressManager.update(this.name, processed, total);
        }
      },
      context.cancelSignal,
    );

    if (context.cancelSignal.cancelled) {
      return { taskName: this.name, success: false, processedCount: processed, error: "已取消" };
    }
    return { taskName: this.name, success: true, processedCount: processed };
  }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/unit/main/chunk-summary-concurrency.test.ts`
Expected: PASS（2 passed）。

- [ ] **Step 5: Commit**

```bash
git add src/main/core/smart-tasks/executors/chunk-summary.executor.ts tests/unit/main/chunk-summary-concurrency.test.ts
git commit -m "perf(smart-tasks): bounded concurrency in chunk-summary executor"
```

---

### Task 8: concept-extract 改为有界并发

**Files:**

- Modify: `src/main/core/smart-tasks/executors/concept-extract.executor.ts:18-71`
- Test: `tests/unit/main/concept-extract-concurrency.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/main/concept-extract-concurrency.test.ts`：

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
const updateMock = vi.fn();
const chatCompletionMock = vi.fn();
const getLlmConcurrencyMock = vi.fn(() => 2);
const findByTitleMock = vi.fn(() => null);
const conceptCreateMock = vi.fn(() => "c1");
const findByIdMock = vi.fn(() => ({ id: "c1", title: "a" }));
const conceptChunkCreateMock = vi.fn();

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/db", () => ({
  ChunkDao: class {
    query = queryMock;
    update = updateMock;
  },
}));
vi.mock("@/main/core/db/concept.dao", () => ({
  conceptDao: {
    findByTitle: (...a: unknown[]) => findByTitleMock(...a),
    create: (...a: unknown[]) => conceptCreateMock(...a),
    findById: (...a: unknown[]) => findByIdMock(...a),
  },
}));
vi.mock("@/main/core/db/conceptChunk.dao", () => ({
  conceptChunkDao: {
    create: (...a: unknown[]) => conceptChunkCreateMock(...a),
  },
}));
vi.mock("@/main/core/services/ai/ai.service", () => ({
  aiService: {
    chatCompletion: (...args: unknown[]) => chatCompletionMock(...args),
  },
  default: {},
}));
vi.mock("@/main/core/smart-tasks/progress.manager", () => ({
  progressManager: { update: vi.fn(), completeTask: vi.fn() },
}));
vi.mock("@/main/core/model-gateway/local-gateway", () => ({
  localAiManager: { getLlmConcurrency: () => getLlmConcurrencyMock() },
}));

import { ConceptExtractExecutor } from "@/main/core/smart-tasks/executors/concept-extract.executor";

describe("ConceptExtractExecutor 有界并发", () => {
  beforeEach(() => {
    queryMock.mockReset();
    updateMock.mockReset();
    chatCompletionMock.mockReset();
    getLlmConcurrencyMock.mockReset().mockReturnValue(2);
  });

  it("并发不超过 context 池大小且全部块被处理", async () => {
    queryMock.mockReturnValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `b${i}`,
        content: "text",
        ai_summary: "summary text",
        updated_at: "2026-01-01T00:00:00.000Z",
      })),
    );
    let active = 0;
    let maxObserved = 0;
    chatCompletionMock.mockImplementation(async () => {
      active++;
      maxObserved = Math.max(maxObserved, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      return { content: "a, b" };
    });

    const executor = new ConceptExtractExecutor();
    const result = await executor.run({
      executionId: "e1",
      processedUntil: null,
      cancelSignal: { cancelled: false },
      pauseSignal: { paused: false },
    });

    expect(result.success).toBe(true);
    expect(result.processedCount).toBe(5);
    expect(maxObserved).toBe(2);
    expect(updateMock).toHaveBeenCalledTimes(5);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/unit/main/concept-extract-concurrency.test.ts`
Expected: FAIL —— `maxObserved` 为 1。

- [ ] **Step 3: 改为有界并发**

在 `src/main/core/smart-tasks/executors/concept-extract.executor.ts` 顶部 import 区追加：

```ts
import { mapWithConcurrency } from "../concurrency";
import { localAiManager } from "@/main/core/model-gateway/local-gateway";
```

把 `run()` 方法替换为：

```ts
  public async run(context: TaskContext): Promise<TaskResult> {
    const blocks = this.getUnprocessedBlocks(context.processedUntil);
    const total = blocks.length;

    if (total === 0) {
      return { taskName: this.name, success: true, processedCount: 0 };
    }

    let processed = 0;
    const limit = Math.max(1, localAiManager.getLlmConcurrency());

    await mapWithConcurrency(
      blocks,
      limit,
      async (block) => {
        try {
          const summary = block.ai_summary || block.content;
          const concepts = await this.extractConcepts(summary);

          for (const conceptName of concepts) {
            // 查找或创建概念
            let concept = conceptDao.findByTitle(conceptName);
            if (!concept) {
              const create: ConceptCreate = { title: conceptName, evolving_summary: null };
              const conceptId = conceptDao.create(create);
              concept = conceptDao.findById(conceptId);
              if (!concept) continue;
            }

            // 建立关联
            try {
              const cbCreate: ConceptChunkCreate = {
                concept_id: concept.id,
                chunk_id: block.id,
              };
              conceptChunkDao.create(cbCreate);
            } catch {
              // 可能已存在关联，忽略
            }
          }

          const update: ChunkUpdate = { last_smart_processed_at: new Date().toISOString() };
          this.chunkDao.update(block.id, update);
        } catch (error) {
          Logger.error("[ConceptExtractExecutor] 提取失败", { blockId: block.id, error: String(error) });
        } finally {
          processed++;
          progressManager.update(this.name, processed, total);
        }
      },
      context.cancelSignal,
    );

    if (context.cancelSignal.cancelled) {
      return { taskName: this.name, success: false, processedCount: processed, error: "已取消" };
    }
    return { taskName: this.name, success: true, processedCount: processed };
  }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/unit/main/concept-extract-concurrency.test.ts`
Expected: PASS（1 passed）。

- [ ] **Step 5: Commit**

```bash
git add src/main/core/smart-tasks/executors/concept-extract.executor.ts tests/unit/main/concept-extract-concurrency.test.ts
git commit -m "perf(smart-tasks): bounded concurrency in concept-extract executor"
```

---

### Task 9: semantic-link 改为有界并发（独立常量 3）

**Files:**

- Modify: `src/main/core/smart-tasks/executors/semantic-link.executor.ts:13-117`
- Test: `tests/unit/main/semantic-link-concurrency.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/main/semantic-link-concurrency.test.ts`：

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
const findByIdMock = vi.fn();
const chunkUpdateMock = vi.fn();
const projectFindByMock = vi.fn(() => []);
const findBlockEmbeddingMock = vi.fn();
const searchBlockEmbeddingsMock = vi.fn();
const rerankMock = vi.fn();
const findByChunkIdMock = vi.fn(() => []);
const linkCreateMock = vi.fn(() => "l1");

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/db", () => ({
  ChunkDao: class {
    query = queryMock;
    findById = findByIdMock;
    update = chunkUpdateMock;
  },
  ProjectChunkDao: class {
    findBy = projectFindByMock;
  },
}));
vi.mock("@/main/core/services/ai/vector.service", () => ({
  vectorService: {
    findBlockEmbeddingByBlockId: (...a: unknown[]) =>
      findBlockEmbeddingMock(...a),
    searchBlockEmbeddings: (...a: unknown[]) => searchBlockEmbeddingsMock(...a),
  },
}));
vi.mock("@/main/core/db/semanticLink.dao", () => ({
  semanticLinkDao: {
    findByChunkId: (...a: unknown[]) => findByChunkIdMock(...a),
    create: (...a: unknown[]) => linkCreateMock(...a),
  },
}));
vi.mock("@/main/core/model-gateway/local-gateway", () => ({
  localGateway: { rerank: (...a: unknown[]) => rerankMock(...a) },
}));
vi.mock("@/main/core/smart-tasks/progress.manager", () => ({
  progressManager: { update: vi.fn(), completeTask: vi.fn() },
}));

import {
  SemanticLinkExecutor,
  SEMANTIC_LINK_CONCURRENCY,
} from "@/main/core/smart-tasks/executors/semantic-link.executor";

describe("SemanticLinkExecutor 有界并发", () => {
  beforeEach(() => {
    queryMock.mockReset();
    findByIdMock
      .mockReset()
      .mockReturnValue({ id: "other", content: "c", ai_summary: "s" });
    chunkUpdateMock.mockReset();
    projectFindByMock.mockReset().mockReturnValue([]);
    findBlockEmbeddingMock.mockReset();
    searchBlockEmbeddingsMock.mockReset();
    rerankMock.mockReset().mockReturnValue([{ index: 0, score: 0.9 }]);
    findByChunkIdMock.mockReset().mockReturnValue([]);
    linkCreateMock.mockReset();
  });

  it("并发上限为 SEMANTIC_LINK_CONCURRENCY 且每块都写库", async () => {
    queryMock.mockReturnValue(
      Array.from({ length: 8 }, (_, i) => ({
        id: `b${i}`,
        content: "text",
        ai_summary: "summary",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      })),
    );
    searchBlockEmbeddingsMock.mockResolvedValue([
      { item: { block_id: "other" } },
    ]);

    let active = 0;
    let maxObserved = 0;
    findBlockEmbeddingMock.mockImplementation(async () => {
      active++;
      maxObserved = Math.max(maxObserved, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      return [{ embedding: [0.1, 0.2] }];
    });

    const executor = new SemanticLinkExecutor();
    const result = await executor.run({
      executionId: "e1",
      processedUntil: null,
      cancelSignal: { cancelled: false },
      pauseSignal: { paused: false },
    });

    expect(result.success).toBe(true);
    expect(result.processedCount).toBe(8);
    expect(maxObserved).toBe(SEMANTIC_LINK_CONCURRENCY);
    expect(chunkUpdateMock).toHaveBeenCalledTimes(8);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/unit/main/semantic-link-concurrency.test.ts`
Expected: FAIL —— `SEMANTIC_LINK_CONCURRENCY` 未导出 / `maxObserved` 为 1。

- [ ] **Step 3: 改为有界并发**

在 `src/main/core/smart-tasks/executors/semantic-link.executor.ts` 顶部 import 区追加：

```ts
import { mapWithConcurrency } from "../concurrency";

/**
 * 语义链接的并发上限：瓶颈是「LanceDB ANN（I/O）→ reranker（CPU）」交替，
 * 适度并发即可让 I/O 与 CPU 重叠；更高只会让 reranker 在线程内排队。
 */
export const SEMANTIC_LINK_CONCURRENCY = 3;

const ANN_TOP_K = 20;
const RERANK_TOP_K = 5;
```

把 `run()` 方法替换为：

```ts
  public async run(context: TaskContext): Promise<TaskResult> {
    const blocks = this.getVectorizedBlocks(context.processedUntil);
    const total = blocks.length;

    if (total === 0) {
      return { taskName: this.name, success: true, processedCount: 0 };
    }

    let processed = 0;

    await mapWithConcurrency(
      blocks,
      SEMANTIC_LINK_CONCURRENCY,
      async (block) => {
        try {
          const summary = block.ai_summary || block.content;

          // Step 1: 查询 block 的向量
          const blockEmbeddings = await vectorService.findBlockEmbeddingByBlockId(block.id);
          if (!blockEmbeddings || blockEmbeddings.length === 0) return;

          // Step 2: LanceDB ANN 检索
          // 语义块若归属某作品，则把检索限制在同一作品内 —— 否则会跨作品建立
          // semantic_links（数据污染；一旦有消费方就变成信息泄漏）。
          // 未归属作品的块（如日记）保持原有全局行为。
          const projectLinks = this.projectChunkDao.findBy("chunk_id", block.id);
          const projectId = projectLinks[0]?.project_id;

          const annResults = await vectorService.searchBlockEmbeddings({
            vector: blockEmbeddings[0].embedding,
            topK: ANN_TOP_K,
            ...(projectId ? { projectId } : {}),
          });

          const candidates = annResults
            .filter((r) => r.item.block_id !== block.id)
            .slice(0, ANN_TOP_K);

          if (candidates.length === 0) return;

          // Step 3: reranker 排序
          const candidateBlocks = candidates.map((c) =>
            this.chunkDao.findById(c.item.block_id),
          ).filter(Boolean) as Chunk[];

          const candidateContents = candidateBlocks.map((b) => b.ai_summary || b.content);
          const rerankResults = await localGateway.rerank(summary, candidateContents);

          // Step 4: 取 Top-N 写入 semantic_links
          const topLinks = rerankResults.slice(0, RERANK_TOP_K);
          const existingLinks = semanticLinkDao.findByChunkId(block.id);
          const existingTargetIds = new Set(existingLinks.map((l) => l.target_chunk_id));

          for (const rr of topLinks) {
            const target = candidateBlocks[rr.index];
            if (!target || existingTargetIds.has(target.id)) continue;

            const create: SemanticLinkCreate = {
              source_chunk_id: block.id,
              target_chunk_id: target.id,
              link_type: "semantic",
              similarity: rr.score,
            };

            try {
              semanticLinkDao.create(create);
            } catch {
              // 可能已存在，忽略
            }
          }

          // 方案 C：链接建立后顺带写入初始时间热度分（以块 created_at 为基准），
          // 后续随时间衰减由定时任务滚动重算。
          const update: ChunkUpdate = {
            last_smart_processed_at: new Date().toISOString(),
            temporal_score: TimeUtil.temporalScore(
              block.created_at,
              new Date(),
              DEFAULT_TEMPORAL_SCORE_CONFIG.halfLifeDays,
            ),
          };
          this.chunkDao.update(block.id, update);

          processed++;
          progressManager.update(this.name, processed, total);
        } catch (error) {
          Logger.error("[SemanticLinkExecutor] 处理失败", { blockId: block.id, error: String(error) });
          processed++;
        }
      },
      context.cancelSignal,
    );

    if (context.cancelSignal.cancelled) {
      return { taskName: this.name, success: false, processedCount: processed, error: "已取消" };
    }
    return { taskName: this.name, success: true, processedCount: processed };
  }
```

（注意：原方法内的 `ANN_TOP_K` / `RERANK_TOP_K` 局部变量已提升为模块常量，`run()` 中不再重复声明。）

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/unit/main/semantic-link-concurrency.test.ts tests/unit/main/semantic-link-project-scope.test.ts`
Expected: PASS（新测试 1 passed；既有 project-scope 测试保持 PASS）。

- [ ] **Step 5: Commit**

```bash
git add src/main/core/smart-tasks/executors/semantic-link.executor.ts tests/unit/main/semantic-link-concurrency.test.ts
git commit -m "perf(smart-tasks): bounded concurrency in semantic-link executor"
```

---

### Task 10: `embedBatch` 改为真批量推理

**Files:**

- Modify: `src/main/core/model-gateway/local-gateway/worker/embedding-handler.ts:43-59`
- Test: `tests/unit/main/embedding-handler-batch.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/main/embedding-handler-batch.test.ts`：

```ts
// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

const pipelineMock = vi.fn();
const extractMock = vi.fn();

vi.mock("@xenova/transformers", () => ({
  pipeline: (...args: unknown[]) => pipelineMock(...args),
  env: { allowRemoteModels: true, localModelPath: "" },
}));

import {
  load,
  embedBatch,
  unload,
} from "@/main/core/model-gateway/local-gateway/worker/embedding-handler";

describe("embedding-handler 真批量", () => {
  it("AC5：embedBatch 对一批文本仅调用一次推理并按序切分", async () => {
    pipelineMock.mockResolvedValue(extractMock);
    extractMock.mockResolvedValue({
      data: new Float32Array([1, 2, 3, 4, 5, 6]),
      dims: [2, 3],
    });
    await load({ modelName: "test-model" });

    const results = await embedBatch(["a", "b"]);

    expect(extractMock).toHaveBeenCalledTimes(1);
    expect(extractMock.mock.calls[0][0]).toEqual(["a", "b"]);
    expect(results).toHaveLength(2);
    expect(results[0].vector).toEqual([1, 2, 3]);
    expect(results[1].vector).toEqual([4, 5, 6]);
    expect(results[0].dimension).toBe(3);

    await unload();
  });

  it("空数组返回空结果且不调用推理", async () => {
    pipelineMock.mockResolvedValue(extractMock);
    await load({ modelName: "test-model" });
    extractMock.mockClear();

    const results = await embedBatch([]);

    expect(results).toEqual([]);
    expect(extractMock).not.toHaveBeenCalled();
    await unload();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/unit/main/embedding-handler-batch.test.ts`
Expected: FAIL —— 现状逐条调用 `extractMock`，`toHaveBeenCalledTimes(1)` 不成立。

- [ ] **Step 3: 改为真批量**

把 `src/main/core/model-gateway/local-gateway/worker/embedding-handler.ts` 的 `embedBatch` 替换为：

```ts
export async function embedBatch(
  texts: string[],
  pooling?: "mean" | "cls" | "none",
  normalize?: boolean,
): Promise<{ vector: number[]; dimension: number }[]> {
  if (!embeddingPipeline) throw new Error("嵌入模型未加载");
  if (texts.length === 0) return [];

  // 一次数组推理：transformers.js 对数组输入返回 [batch, dim] 的 Tensor
  const output = (await embeddingPipeline(texts, {
    pooling: pooling ?? "mean",
    normalize: normalize ?? true,
  })) as Tensor;

  const flat = output.data as Float32Array;
  const dims = output.dims;
  const dimension =
    dims.length > 1 ? dims[dims.length - 1] : flat.length / texts.length;

  const results: { vector: number[]; dimension: number }[] = [];
  for (let i = 0; i < texts.length; i++) {
    const start = i * dimension;
    results.push({
      vector: Array.from(flat.slice(start, start + dimension)),
      dimension,
    });
  }
  return results;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/unit/main/embedding-handler-batch.test.ts`
Expected: PASS（2 passed）。

- [ ] **Step 5: 类型检查**

Run: `pnpm typecheck`
Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add src/main/core/model-gateway/local-gateway/worker/embedding-handler.ts tests/unit/main/embedding-handler-batch.test.ts
git commit -m "perf(local-gateway): real batch embedding inference"
```

---

### Task 11: `rerank` 改为真批量推理

**Files:**

- Modify: `src/main/core/model-gateway/local-gateway/worker/rerank-handler.ts:33-46`
- Test: `tests/unit/main/rerank-handler-batch.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/main/rerank-handler-batch.test.ts`：

```ts
// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

const pipelineMock = vi.fn();
const classifyMock = vi.fn();

vi.mock("@xenova/transformers", () => ({
  pipeline: (...args: unknown[]) => pipelineMock(...args),
  env: { allowRemoteModels: true, localModelPath: "" },
}));

import {
  load,
  rerank,
  unload,
} from "@/main/core/model-gateway/local-gateway/worker/rerank-handler";

describe("rerank-handler 真批量", () => {
  it("rerank 对一批文档仅调用一次推理并按分数降序返回", async () => {
    pipelineMock.mockResolvedValue(classifyMock);
    classifyMock.mockResolvedValue([
      [{ label: "LABEL_0", score: 0.2 }],
      [{ label: "LABEL_0", score: 0.9 }],
    ]);
    await load({ modelName: "test-reranker" });

    const results = await rerank("q", ["doc-a", "doc-b"]);

    expect(classifyMock).toHaveBeenCalledTimes(1);
    expect(classifyMock.mock.calls[0][0]).toEqual([
      "q [SEP] doc-a",
      "q [SEP] doc-b",
    ]);
    expect(results).toEqual([
      { index: 1, score: 0.9 },
      { index: 0, score: 0.2 },
    ]);

    await unload();
  });

  it("空文档列表返回空结果且不调用推理", async () => {
    pipelineMock.mockResolvedValue(classifyMock);
    await load({ modelName: "test-reranker" });
    classifyMock.mockClear();

    const results = await rerank("q", []);

    expect(results).toEqual([]);
    expect(classifyMock).not.toHaveBeenCalled();
    await unload();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/unit/main/rerank-handler-batch.test.ts`
Expected: FAIL —— 现状逐文档调用 `classifyMock`，`toHaveBeenCalledTimes(1)` 不成立。

- [ ] **Step 3: 改为真批量**

把 `src/main/core/model-gateway/local-gateway/worker/rerank-handler.ts` 的 `rerank` 替换为：

```ts
export async function rerank(
  query: string,
  documents: string[],
): Promise<{ index: number; score: number }[]> {
  if (!rerankPipeline) throw new Error("重排序模型未加载");
  if (documents.length === 0) return [];

  const pairs = documents.map((doc) => `${query} [SEP] ${doc}`);
  // 一次数组推理；单标签模型批量输入返回 [batch, labels]（兼容 [batch] 形态）
  const raw = (await rerankPipeline(pairs)) as
    | TextClassificationSingle[]
    | TextClassificationSingle[][];

  const scores: { index: number; score: number }[] = documents.map((_, i) => {
    const entry = raw[i] as
      | TextClassificationSingle
      | TextClassificationSingle[]
      | undefined;
    const score = Array.isArray(entry)
      ? (entry[0]?.score ?? 0)
      : (entry?.score ?? 0);
    return { index: i, score };
  });
  scores.sort((a, b) => b.score - a.score);
  return scores;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/unit/main/rerank-handler-batch.test.ts`
Expected: PASS（2 passed）。

- [ ] **Step 5: 类型检查**

Run: `pnpm typecheck`
Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add src/main/core/model-gateway/local-gateway/worker/rerank-handler.ts tests/unit/main/rerank-handler-batch.test.ts
git commit -m "perf(local-gateway): real batch rerank inference"
```

---

## Phase C — 跨 family 并行 + 求和内存门控

### Task 12: 求和内存门控 `canLoadModelFamilies`

**Files:**

- Modify: `src/main/core/model-gateway/local-gateway/hardware.ts:43-46`（在 `canLoadModel` 后新增）
- Test: `tests/unit/main/hardware-family-gate.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/main/hardware-family-gate.test.ts`：

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const freeMemMock = vi.fn();

vi.mock("os", () => ({
  default: { freemem: () => freeMemMock() },
}));
vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  canLoadModelFamilies,
  canLoadModel,
} from "@/main/core/model-gateway/local-gateway/hardware";

const GB = 1024 ** 3;

describe("canLoadModelFamilies", () => {
  beforeEach(() => freeMemMock.mockReset());

  it("空集合恒为 true", () => {
    freeMemMock.mockReturnValue(0);
    expect(canLoadModelFamilies([])).toBe(true);
  });

  it("三 family 求和 9GB：可用 10GB 通过", () => {
    freeMemMock.mockReturnValue(10 * GB);
    expect(canLoadModelFamilies(["embedding", "reranker", "llm"])).toBe(true);
  });

  it("三 family 求和 9GB：可用 8GB 不通过", () => {
    freeMemMock.mockReturnValue(8 * GB);
    expect(canLoadModelFamilies(["embedding", "reranker", "llm"])).toBe(false);
  });

  it("单 family 与 canLoadModel 口径一致", () => {
    freeMemMock.mockReturnValue(5 * GB);
    expect(canLoadModelFamilies(["llm"])).toBe(canLoadModel(5));
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/unit/main/hardware-family-gate.test.ts`
Expected: FAIL —— `canLoadModelFamilies` 未导出。

- [ ] **Step 3: 实现**

在 `src/main/core/model-gateway/local-gateway/hardware.ts` 顶部 import 区追加：

```ts
import { getFamilyMinMemoryGB } from "./model-registry";
import type { ModelFamily } from "./model-registry";
```

在 `canLoadModel` 之后追加：

```ts
/**
 * 多个 family 能否同时驻留：按 minMemoryGB 求和与当前可用内存比较（保守口径）。
 * 例：embedding 2 + reranker 2 + llm 5 = 9GB，低于该值则不建议并行驻留、应回退串行。
 * 单模型场景请继续使用 canLoadModel。
 */
export function canLoadModelFamilies(families: ModelFamily[]): boolean {
  if (families.length === 0) return true;
  const requiredGB = families.reduce(
    (sum, family) => sum + getFamilyMinMemoryGB(family),
    0,
  );
  return canLoadModel(requiredGB);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/unit/main/hardware-family-gate.test.ts`
Expected: PASS（4 passed）。

- [ ] **Step 5: 类型检查**

Run: `pnpm typecheck`
Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add src/main/core/model-gateway/local-gateway/hardware.ts tests/unit/main/hardware-family-gate.test.ts
git commit -m "feat(local-gateway): sum-based memory gate for multi-family residency"
```

---

### Task 13: 同层门控并行 + 层末统一释放

**Files:**

- Modify: `src/main/core/smart-tasks/task-dag.ts`（新增 `collectLayerFamilies`、`selectReleasableFamilies`）
- Modify: `src/main/core/smart-tasks/scheduler.ts:5-11`、`:131-223`（层循环重构 + 新增 `runGroup`）
- Test: `tests/unit/main/scheduler-layer-families.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/main/scheduler-layer-families.test.ts`：

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  collectLayerFamilies,
  selectReleasableFamilies,
} from "@/main/core/smart-tasks/task-dag";

describe("collectLayerFamilies", () => {
  it("收集层内 family，去重并按固定执行顺序排列", () => {
    expect(
      collectLayerFamilies([
        "semantic-link",
        "concept-extract",
        "chunk-summary",
      ]),
    ).toEqual(["reranker", "llm"]);
  });

  it("无模型任务不产生 family", () => {
    expect(collectLayerFamilies(["topic-detection"])).toEqual([]);
  });

  it("同一层三类 family 全出现时按 embedding → reranker → llm", () => {
    expect(
      collectLayerFamilies([
        "chunk-summary",
        "chunk-vectorize",
        "semantic-link",
      ]),
    ).toEqual(["embedding", "reranker", "llm"]);
  });
});

describe("selectReleasableFamilies", () => {
  it("剩余任务不再需要该 family 时可释放", () => {
    expect(selectReleasableFamilies(["llm"], ["chunk-vectorize"])).toEqual([
      "llm",
    ]);
  });

  it("剩余任务仍需要该 family 时不释放", () => {
    expect(selectReleasableFamilies(["llm"], ["topic-summary"])).toEqual([]);
  });

  it("保持传入顺序", () => {
    expect(
      selectReleasableFamilies(
        ["embedding", "reranker", "llm"],
        ["topic-detection"],
      ),
    ).toEqual(["embedding", "reranker", "llm"]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/unit/main/scheduler-layer-families.test.ts`
Expected: FAIL —— 两个函数未导出。

- [ ] **Step 3: 在 `task-dag.ts` 增加两个纯函数**

在 `groupTasksByModelFamily` 之后追加：

```ts
/** 收集一层内出现的模型 family（去重，按 MODEL_FAMILY_EXECUTION_ORDER 排列） */
export function collectLayerFamilies(taskNames: string[]): ModelFamily[] {
  const present = new Set<ModelFamily>();
  for (const name of taskNames) {
    const family = TASK_MODEL_FAMILY[name];
    if (family) present.add(family);
  }
  return MODEL_FAMILY_EXECUTION_ORDER.filter((family) => present.has(family));
}

/**
 * 从本层涉及的 family 中选出可立即释放的 family：
 * 本层已全部结束，且剩余任务（后续层）都不再需要该 family。
 */
export function selectReleasableFamilies(
  layerFamilies: ModelFamily[],
  remainingTaskNames: string[],
): ModelFamily[] {
  return layerFamilies.filter(
    (family) => !isModelFamilyNeeded(family, remainingTaskNames),
  );
}
```

- [ ] **Step 4: 更新 `scheduler.ts` 的 import**

把 `src/main/core/smart-tasks/scheduler.ts:5` 替换为：

```ts
import {
  getTaskLayers,
  groupTasksByModelFamily,
  collectLayerFamilies,
  selectReleasableFamilies,
  resolveLocalFamilies,
} from "./task-dag";
```

（Task 3 引入的 `isModelFamilyNeeded` 不再被 scheduler 直接使用，从 import 中移除以免 `noUnusedLocals` 报错。）

把 `@/main/core/model-gateway/local-gateway` 的 import 替换为：

```ts
import {
  localAiManager,
  modelManager,
  getFamilyModelId,
  canLoadModelFamilies,
} from "@/main/core/model-gateway/local-gateway";
```

- [ ] **Step 5: 重构层循环（门控并行 + 层末统一释放）**

把 `src/main/core/smart-tasks/scheduler.ts` 中从 `try {`（`for (const layer of layers)` 所在的那个 `try`）到对应 `} finally { ... }` 的整段替换为：

```ts
try {
  for (const layer of layers) {
    if (this.cancelSignal.cancelled) break;

    // 等待暂停恢复
    while (this.pauseSignal.paused && !this.cancelSignal.cancelled) {
      await this.sleep(500);
    }
    if (this.cancelSignal.cancelled) break;

    Logger.info("[SmartTaskScheduler] 开始执行任务层", { tasks: layer });

    const groups = groupTasksByModelFamily(layer);
    const layerFamilies = collectLayerFamilies(layer);
    const snapshotBefore = getResourceSnapshot();

    // 阶段二：同层不同 family 组在内存允许时真并行（Step 0 后为独立线程）；
    // 内存不足则回退组间串行（D3），行为与改造前一致。
    const canRunParallel =
      layerFamilies.length > 1 && canLoadModelFamilies(layerFamilies);
    Logger.info("[SmartTaskScheduler] 层内执行模式", {
      layer,
      layerFamilies,
      canRunParallel,
      snapshotBefore,
    });

    if (canRunParallel) {
      await Promise.all(
        groups.map((group) =>
          this.runGroup(
            group,
            context,
            localFamilies,
            remainingTasks,
            results,
            usedFamilies,
          ),
        ),
      );
    } else {
      for (const group of groups) {
        if (this.cancelSignal.cancelled) break;
        await this.runGroup(
          group,
          context,
          localFamilies,
          remainingTasks,
          results,
          usedFamilies,
        );
      }
    }

    // 同层全部结束后，再按剩余任务统一判定并释放各 family：
    // 并行下若沿用「组跑完即释放」会抽掉仍被同层其他组使用的模型。
    for (const family of selectReleasableFamilies(
      layerFamilies,
      Array.from(remainingTasks),
    )) {
      if (this.cancelSignal.cancelled) break;
      if (handledFamilies.has(family)) continue;
      handledFamilies.add(family);
      await this.releaseFamilyWithStep(
        family,
        taskStepId(layer[layer.length - 1]),
        "after",
      );
    }

    if (canRunParallel) {
      Logger.info("[SmartTaskScheduler] 层并行完成", {
        layer,
        layerFamilies,
        snapshotAfter: getResourceSnapshot(),
      });
    }
  }
} finally {
  // 兜底：本次用过但尚未产生释放节点的 family 无论成功、失败还是取消都释放（幂等、失败不抛出）
  for (const family of usedFamilies) {
    if (handledFamilies.has(family)) continue;
    await this.releaseFamilyWithStep(family, STEP_DONE_ID);
  }
}
```

- [ ] **Step 6: 新增私有方法 `runGroup`**

在 `loadFamilyWithStep` 方法之前插入：

```ts
  /**
   * 执行同层内一个 family 组：按需预加载 → 并行跑组内任务 → 记录结果并更新剩余任务集合。
   * 组内任务彼此无依赖（同层），故用 Promise.all 并行。
   */
  private async runGroup(
    group: { family: ModelFamily | null; tasks: string[] },
    context: TaskContext,
    localFamilies: Set<ModelFamily>,
    remainingTasks: Set<string>,
    results: TaskResult[],
    usedFamilies: Set<ModelFamily>,
  ): Promise<void> {
    if (group.family) usedFamilies.add(group.family);

    // 本地 LLM 仅在路由判定为「走本地」时预加载，避免走云端时白占 3–4GB（G4）
    const needPreload =
      group.family !== null && (group.family !== "llm" || localFamilies.has("llm"));
    if (group.family && needPreload) {
      await this.loadFamilyWithStep(group.family, taskStepId(group.tasks[0]));
    }

    const groupResults = await Promise.all(
      group.tasks.map(async (taskName) => {
        const executor = this.executors.get(taskName);
        if (!executor) {
          Logger.error("[SmartTaskScheduler] 未知任务", { taskName });
          return null;
        }

        stepManager.setStepState(taskStepId(taskName), "running", {
          startedAt: Date.now(),
        });
        Logger.info("[SmartTaskScheduler] 开始执行任务", { taskName });
        let result: TaskResult;
        try {
          result = await executor.run(context);
        } catch (error) {
          Logger.error("[SmartTaskScheduler] 任务执行异常", { taskName, error: String(error) });
          result = {
            taskName,
            success: false,
            processedCount: 0,
            error: String(error),
          };
        }

        progressManager.completeTask(result);
        if (result.success) {
          Logger.info("[SmartTaskScheduler] 任务完成", { taskName, processed: result.processedCount });
        } else {
          Logger.error("[SmartTaskScheduler] 任务失败", { taskName, error: result.error });
          // 任务失败但继续执行后续层（非阻塞，与旧串行逻辑一致）
        }
        return result;
      }),
    );

    results.push(...groupResults.filter((r): r is TaskResult => r !== null));

    // 组内任务已执行，从待执行集合移除
    for (const taskName of group.tasks) {
      remainingTasks.delete(taskName);
    }
  }
```

- [ ] **Step 7: 跑测试确认通过**

Run: `npx vitest run tests/unit/main/scheduler-layer-families.test.ts tests/unit/main/scheduler-local-families.test.ts tests/unit/main/smart-task-dag-parallel.test.ts`
Expected: PASS（全部）。

- [ ] **Step 8: 全量验证**

Run: `pnpm typecheck; npx eslint src/main/core/smart-tasks src/main/core/model-gateway; npx vitest run tests/unit/main; npx vite build`
Expected: typecheck 无错误；eslint 无告警；单测全通过；build 产出 `dist-electron/local-ai-worker.js`。

- [ ] **Step 9: Commit**

```bash
git add src/main/core/smart-tasks/task-dag.ts src/main/core/smart-tasks/scheduler.ts tests/unit/main/scheduler-layer-families.test.ts
git commit -m "feat(smart-tasks): memory-gated cross-family parallel layer execution"
```

---

## 验收对照

| AC  | 覆盖任务                           | 验证方式                                                                                        |
| --- | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| AC1 | Task 2（路由）、Task 3（不预加载） | `model-router.test.ts` 首例 + 运行时观察日志无 `load-llm`                                       |
| AC2 | Task 2、Task 4                     | `model-router.test.ts` 覆盖/回退用例；设置页勾选后走本地                                        |
| AC3 | Task 2                             | `model-router.test.ts`「localLlmTasks 为空」用例                                                |
| AC4 | Task 5、6、7                       | `chunk-summary-concurrency.test.ts` 断言 maxObserved === context 池大小                         |
| AC5 | Task 10                            | `embedding-handler-batch.test.ts` 断言单次数组推理                                              |
| AC6 | Task 12、Task 13                   | `hardware-family-gate.test.ts` + `scheduler-layer-families.test.ts`；运行时观察层内执行模式日志 |
| AC7 | Task 7、8、9                       | `chunk-summary-concurrency.test.ts` 取消用例；写入计数断言无重复写入                            |
| AC8 | Task 13 Step 8                     | `pnpm typecheck` / `npx eslint` / `npx vite build` / `npx vitest run`                           |

**说明（与 spec 的偏差）**：spec §5.4.4 提到「层并行前后采集资源快照写入步骤明细」。由于 spec §1.3 明确「不改进度/步骤上报粒度」，且 `SmartTaskStepKind` 为固定枚举（新增 kind 会牵动渲染层），本计划改为把前后快照写入结构化日志 `[SmartTaskScheduler] 层内执行模式` / `层并行完成`，同样可诊断「门控为何回退」而不扩步骤种类。
