import { novelService } from '@/main/core/services/novel.service'
import { response } from '@/main/utils/response'
import { ErrorCode } from '@/shared/enums'
import type { ApiResponse } from '@/shared/types'
import {
  CreateNovelRequest,
  UpdateNovelRequest,
  NovelQueryRequest,
  NovelBaseInfo,
  NovelDetail,
  CreateChapterRequest,
  NovelChapterInfo,
  UpdateChapterRequest,
  ChapterQueryRequest,
  FolderAndFileList
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

async function queryNovels(request: NovelQueryRequest): Promise<ApiResponse<NovelBaseInfo[]>> {
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

async function createChapter(request: CreateChapterRequest): Promise<ApiResponse<NovelChapterInfo>> {
  try {
    if (!request.name || !request.name.trim()) {
      return response.error(ErrorCode.COMMON_INVALID_PARAMETER)
    }
    const chapter = novelService.createChapter(request)
    return response.success(chapter)
  } catch (error) {
    return response.error(ErrorCode.CHAPTER_CREATE_FAILED, error as Error)
  }
}

async function queryChapters(request: ChapterQueryRequest): Promise<ApiResponse<FolderAndFileList>> {
  try {
    const chapters = novelService.queryChapters(request)
    return response.success(chapters)
  } catch (error) {
    return response.error(ErrorCode.CHAPTER_GET_FAILED, error as Error)
  }
}

async function getChapterContent(id: number): Promise<ApiResponse<NovelChapterInfo>> {
  try {
    if (id <= 0) {
      return response.error(ErrorCode.COMMON_INVALID_PARAMETER)
    }
    const chapter = novelService.queryChapterContent(id)
    return response.success(chapter)
  } catch (error) {
    return response.error(ErrorCode.CHAPTER_GET_FAILED, error as Error)
  }
}

async function updateChapterContent(id: number, request: UpdateChapterRequest): Promise<ApiResponse<boolean>> {
  try {
    if (id <= 0) {
      return response.error(ErrorCode.COMMON_INVALID_PARAMETER)
    }
    const success = novelService.updateChapterContent(id, request)
    return response.success(success)
  } catch (error) {
    return response.error(ErrorCode.CHAPTER_UPDATE_FAILED, error as Error)
  }
}

async function deleteChapter(id: number): Promise<ApiResponse<boolean>> {
  try {
    if (id <= 0) {
      return response.error(ErrorCode.COMMON_INVALID_PARAMETER)
    }
    const success = novelService.deleteChapter(id)
    return response.success(success)
  } catch (error) {
    return response.error(ErrorCode.CHAPTER_DELETE_FAILED, error as Error)
  }
}

export {
  createNovel,
  getNovelInfo,
  queryNovels,
  updateNovel,
  deleteNovel,
  createChapter,
  queryChapters,
  getChapterContent,
  updateChapterContent,
  deleteChapter
}