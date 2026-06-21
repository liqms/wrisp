import type { ApiResponse } from "@/shared/types";

export interface SmartTaskAPI {
  start(): Promise<ApiResponse<{ executionId: string }>>;
  cancel(): Promise<ApiResponse<void>>;
  pause(): Promise<ApiResponse<void>>;
  resume(): Promise<ApiResponse<void>>;
  getStatus(): Promise<ApiResponse<unknown>>;
  getHistory(): Promise<ApiResponse<unknown>>;
}