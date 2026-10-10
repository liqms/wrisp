import type { ApiResponse } from '@/shared/types'
import type { DownloadProgress } from '@/main/types/download.types'
import type { GpuCapability, ModelConfig, ModelManifestEntry, ModelType, ThreadBudgetInfo } from '@/shared/types/model.types'

export interface ModelAPI {
  getConfig(): Promise<ApiResponse<ModelConfig>>
  getValue(keyPath: string): Promise<ApiResponse<unknown>>
  setValue(keyPath: string, value: unknown): Promise<ApiResponse<void>>
  resetConfig(): Promise<ApiResponse<void>>
  downloadModel(type: ModelType): Promise<ApiResponse<string>>
  checkModelExist(): Promise<ApiResponse<Record<string, boolean>>>
  reDownloadModel(type: ModelType): Promise<ApiResponse<void>>
  cancelDownload(groupId: string): Promise<ApiResponse<void>>
  /** 获取本地 LLM 的 GPU 能力快照（仅在开关打开时才探测显存） */
  getGpuCapability(): Promise<ApiResponse<GpuCapability>>
  /** 获取当前生效的推理线程预算（设置页展示实际值） */
  getThreadBudget(): Promise<ApiResponse<ThreadBudgetInfo>>
  /** 内置模型清单（默认变体的文件集与体积），渲染端据此按模型聚合下载进度 */
  getModelManifest(): Promise<ApiResponse<ModelManifestEntry[]>>
  /** 当前所有下载任务的状态快照，用于重开页面时补齐进度 */
  getDownloadTasks(): Promise<ApiResponse<DownloadProgress[]>>
}