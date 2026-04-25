import type { AppConfig, ApiResponse } from '@/shared/types'

export interface ConfigAPI {
  get(): Promise<ApiResponse<AppConfig>>
  getValue(keyPath: string): Promise<ApiResponse<any>>
  setValue(keyPath: string, value: any): Promise<ApiResponse<void>>
  getStaticPath(type?: string): Promise<ApiResponse<string>>
  reset(): Promise<ApiResponse<void>>
}