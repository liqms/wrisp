import type { ApiResponse, SmartTaskSnapshot } from "@/shared/types";

export interface SmartTaskAPI {
  start(): Promise<ApiResponse<{ executionId: string }>>;
  cancel(): Promise<ApiResponse<void>>;
  pause(): Promise<ApiResponse<void>>;
  resume(): Promise<ApiResponse<void>>;
  getStatus(): Promise<ApiResponse<unknown>>;
  getHistory(): Promise<ApiResponse<unknown>>;
  /** 监听主进程推送的智能整理进度快照，返回取消订阅函数 */
  onSnapshot(callback: (snapshot: SmartTaskSnapshot) => void): () => void;
}