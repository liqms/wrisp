import { fileService } from '@/main/core/services/file.service'
import { response } from '@/main/utils/response'
import { ErrorCode } from '@/shared/enums'
import type { ApiResponse } from '@/shared/types'

async function batchMoveFiles(ids: number[], newFolderId: number): Promise<ApiResponse<number>> {
  try {
    const changes = fileService.batchMove(ids, newFolderId)
    return response.success(changes)
  } catch (error) {
    return response.error(ErrorCode.FILE_MOVE_FAILED, error as Error)
  }
}

export {
  batchMoveFiles,  
}
