import type { ApiResponse } from '@/shared/types'
import type { ModelConfig, ModelType } from '@/shared/types/model.types'

export interface ModelAPI {
  getConfig(): Promise<ApiResponse<ModelConfig>>
  getValue(keyPath: string): Promise<ApiResponse<any>>
  setValue(keyPath: string, value: any): Promise<ApiResponse<void>>
  resetConfig(): Promise<ApiResponse<void>>
  downloadModel(type: ModelType): Promise<ApiResponse<string>>
  checkModelExist(): Promise<ApiResponse<Record<string, boolean>>>
  reDownloadModel(type: ModelType): Promise<ApiResponse<void>>
  cancelDownload(groupId: string): Promise<ApiResponse<void>>
}