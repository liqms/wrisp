/**
 * Web视图接口层类型定义
 */
export interface NavigationState {
  canGoBack: boolean
  canGoForward: boolean
}

export interface WebContentViewOptions {
  x: number
  y: number
  width: number
  height: number
}
