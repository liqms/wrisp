import type { ApiResponse, NavigationState, WebContentViewOptions } from '@/shared/types'

export interface WebviewAPI {
  create(url: string, options?: WebContentViewOptions): Promise<ApiResponse<void>>
  reload(): Promise<ApiResponse<void>>
  destroy(): Promise<ApiResponse<void>>
  hide(): Promise<ApiResponse<void>>
  resize(options: WebContentViewOptions): Promise<ApiResponse<void>>
  goBack(): Promise<ApiResponse<void>>
  goForward(): Promise<ApiResponse<void>>
  getNavigationState(): Promise<ApiResponse<NavigationState>>
}