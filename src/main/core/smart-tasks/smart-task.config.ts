import { DEFAULT_SMART_TASK_CONFIG } from "@/shared/constants/smart-task.constants";
import type { SmartTaskConfig } from "@/shared/types";

/**
 * 智能整理配置的进程内快照。
 *
 * 执行器与调度器不反向依赖 configService（其单例在加载时调用 `app.getPath`，
 * 会把 node 环境的单测整套打挂），改由 API 层与启动流程推入 —— 与
 * `localAiManager.setGpuAccelerationEnabled` 同一套做法。
 */
let current: SmartTaskConfig = { ...DEFAULT_SMART_TASK_CONFIG };

/** 推入配置；传 undefined 或缺项时逐项回退默认值 */
export function setSmartTaskConfig(config?: Partial<SmartTaskConfig> | null): void {
  current = { ...DEFAULT_SMART_TASK_CONFIG, ...(config ?? {}) };
}

/** 读取当前生效的智能整理配置 */
export function getSmartTaskConfig(): SmartTaskConfig {
  return current;
}
