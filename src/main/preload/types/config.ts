import type { AppConfig, ApiResponse } from '@/shared/types'

export interface ConfigAPI {
  get(): Promise<ApiResponse<AppConfig>>
  set(config: Partial<AppConfig>): Promise<ApiResponse<void>>
  getValue(keyPath: string): Promise<ApiResponse<any>>
  setValue(keyPath: string, value: any): Promise<ApiResponse<void>>
  getStaticPath(): Promise<ApiResponse<string>>
  reset(): Promise<ApiResponse<void>>
}