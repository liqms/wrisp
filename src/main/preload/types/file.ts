import type { ApiResponse } from '@/shared/types'

export interface FileAPI {
  move(ids: number[], newFolderId: number): Promise<ApiResponse<number>>
}
