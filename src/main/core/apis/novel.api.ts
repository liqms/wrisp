import { novelService } from '@/main/core/services/novel.service'
import { response } from '@/main/utils/response'
import { ErrorCode } from '@/shared/enums'
import type { ApiResponse } from '@/shared/types'
import {
  CreateNovelRequest,
  UpdateNovelRequest,
  QueryNovelRequest,
  NovelBaseInfo,
  NovelDetail,
  CreateNovelFileRequest,
  NovelFileInfo,
  UpdateNovelFileRequest,
  QueryNovelFileRequest,
  FoldersAndFilesList
} from '@/shared/types'

async function createNovel(request: CreateNovelRequest): Promise<ApiResponse<NovelBaseInfo>> {
  try {
    if (!request.name || !request.name.trim()) {
      return response.error(ErrorCode.COMMON_INVALID_PARAMETER)
    }
    const novel = novelService.createNovel(request)
    return response.success(novel)
  } catch (error) {
    return response.error(ErrorCode.NOVEL_CREATE_FAILED, error as Error)
  }
}

async function getNovelInfo(id: number): Promise<ApiResponse<NovelDetail>> {
  try {
    if (id <= 0) {
      return response.error(ErrorCode.COMMON_INVALID_PARAMETER)
    }
    const novel = novelService.getNovelInfo(id)
    if (novel) {
      return response.success(novel)
    }
    return response.empty()
  } catch (error) {
    return response.error(ErrorCode.NOVEL_GET_FAILED, error as Error)
  }
}

async function queryNovels(request: QueryNovelRequest): Promise<ApiResponse<NovelBaseInfo[]>> {
  try {
    const novels = novelService.queryNovels(request)
    return response.paginated(novels.data, novels.page, novels.pageSize, novels.total)
  } catch (error) {
    return response.error(ErrorCode.NOVEL_GET_FAILED, error as Error)
  }
}

async function updateNovel(id: number, request: UpdateNovelRequest): Promise<ApiResponse<boolean>> {
  try {
    if (id <= 0) {
      return response.error(ErrorCode.COMMON_INVALID_PARAMETER)
    }
    const success = novelService.updateNovel(id, request)
    if (success) {
      return response.success(success)
    }
    return response.error(ErrorCode.NOVEL_NOT_FOUND)
  } catch (error) {
    return response.error(ErrorCode.NOVEL_UPDATE_FAILED, error as Error)
  }
}

async function deleteNovel(id: number): Promise<ApiResponse<{
  worksDeleted: number
  foldersDeleted: number
  filesDeleted: number
  worksTagsDeleted: number
  fileVersionsDeleted: number
}>> {
  try {
    if (id <= 0) {
      return response.error(ErrorCode.COMMON_INVALID_PARAMETER)
    }
    const result = novelService.deleteNovel(id)
    return response.success(result)
  } catch (error) {
    return response.error(ErrorCode.NOVEL_DELETE_FAILED, error as Error)
  }
}

async function createNovelFile(request: CreateNovelFileRequest): Promise<ApiResponse<NovelFileInfo>> {
  try {
    if (!request.name || !request.name.trim()) {
      return response.error(ErrorCode.COMMON_INVALID_PARAMETER)
    }
    const file = novelService.createNovelFile(request)
    return response.success(file)
  } catch (error) {
    return response.error(ErrorCode.FILE_CREATE_FAILED, error as Error)
  }
}

async function queryNovelFiles(request: QueryNovelFileRequest): Promise<ApiResponse<FoldersAndFilesList>> {
  try {
    const files = novelService.queryNovelFiles(request)
    return response.success(files)
  } catch (error) {
    return response.error(ErrorCode.FILE_GET_FAILED, error as Error)
  }
}

async function getNovelFileContent(id: number): Promise<ApiResponse<NovelFileInfo>> {
  try {
    if (id <= 0) {
      return response.error(ErrorCode.COMMON_INVALID_PARAMETER)
    }
    const file = novelService.getNovelFileContent(id)
    return response.success(file)
  } catch (error) {
    return response.error(ErrorCode.FILE_GET_FAILED, error as Error)
  }
}

async function updateNovelFileContent(id: number, request: UpdateNovelFileRequest): Promise<ApiResponse<NovelFileInfo>> {
  try {
    if (id <= 0) {
      return response.error(ErrorCode.COMMON_INVALID_PARAMETER)
    }
    const file = novelService.updateNovelFileContent(id, request)
    return response.success(file)
  } catch (error) {
    return response.error(ErrorCode.FILE_UPDATE_FAILED, error as Error)
  }
}

async function deleteNovelFile(id: number): Promise<ApiResponse<boolean>> {
  try {
    if (id <= 0) {
      return response.error(ErrorCode.COMMON_INVALID_PARAMETER)
    }
    const success = novelService.deleteNovelFile(id)
    return response.success(success)
  } catch (error) {
    return response.error(ErrorCode.FILE_DELETE_FAILED, error as Error)
  }
}

async function moveFiles(ids: number[], parentId: number): Promise<ApiResponse<number>> {
  try {
    const success = novelService.moveFiles(ids, parentId)
    return response.success(success)
  } catch (error) {
    return response.error(ErrorCode.FILE_MOVE_FAILED, error as Error)
  }
}

export {
  createNovel,
  getNovelInfo,
  queryNovels,
  updateNovel,
  deleteNovel,
  createNovelFile,
  queryNovelFiles,
  getNovelFileContent,
  updateNovelFileContent,
  deleteNovelFile,
  moveFiles
}