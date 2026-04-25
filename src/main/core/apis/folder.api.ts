import { folderService } from '@/main/core/services/folder.service'
import { response } from '@/main/utils/response'
import { ErrorCode } from '@/shared/enums'
import type { ApiResponse } from '@/shared/types'
import {
  CreateFolderRequest,
  UpdateFolderRequest,
  FolderQueryRequest,
  FolderTreeWithStats,
  FoldersAndFilesList
} from '@/shared/types'
import { Folder } from '@/main/types/db'

async function createFolder(request: CreateFolderRequest): Promise<ApiResponse<Folder>> {
  try {
    if (!request.name || !request.name.trim()) {
      return response.error(ErrorCode.COMMON_INVALID_PARAMETER)
    }
    const folder = folderService.create(request)
    return response.success(folder)
  } catch (error) {
    return response.error(ErrorCode.FOLDER_CREATE_FAILED, error as Error)
  }
}

async function getFolderInfo(id: number): Promise<ApiResponse<Folder>> {
  try {
    if (id <= 0) {
      return response.error(ErrorCode.COMMON_INVALID_PARAMETER)
    }
    const folder = folderService.getInfo(id)
    if (folder) {
      return response.success(folder)
    }
    return response.error(ErrorCode.FOLDER_NOT_FOUND)
  } catch (error) {
    return response.error(ErrorCode.FOLDER_GET_FAILED, error as Error)
  }
}


async function queryFolders(request: FolderQueryRequest): Promise<ApiResponse<Folder[]>> {
  try {
    const folders = folderService.query(request)
    return response.paginated(folders.data, folders.page, folders.pageSize, folders.total)
  } catch (error) {
    return response.error(ErrorCode.FOLDER_GET_FAILED, error as Error)
  }
}

async function getTreeWithStats(parentId: number): Promise<ApiResponse<FolderTreeWithStats[]>> {
  try {
    const tree = folderService.getTreeWithStats(parentId)
    return response.success(tree)
  } catch (error) {
    return response.error(ErrorCode.FOLDER_GET_FAILED, error as Error)
  }
}

async function getSubFoldersAndFiles(parentId: number): Promise<ApiResponse<FoldersAndFilesList>> {
  try {
    const foldersAndFiles = folderService.getSubFoldersAndFiles(parentId)
    return response.success(foldersAndFiles)
  } catch (error) {
    return response.error(ErrorCode.FOLDER_GET_FAILED, error as Error)
  }
}

async function updateFolder(id: number, request: UpdateFolderRequest): Promise<ApiResponse<number>> {
  try {
    if (id <= 0) {
      return response.error(ErrorCode.COMMON_INVALID_PARAMETER)
    }
    const changes = folderService.update(id, request)
    if (changes > 0) {
      return response.success(changes)
    }
    return response.error(ErrorCode.FOLDER_NOT_FOUND)
  } catch (error) {
    return response.error(ErrorCode.FOLDER_UPDATE_FAILED, error as Error)
  }
}

async function deleteFolder(id: number): Promise<ApiResponse<number>> {
  try {
    if (id <= 0) {
      return response.error(ErrorCode.COMMON_INVALID_PARAMETER)
    }
    const changes = folderService.delete(id)
    if (changes > 0) {
      return response.success(changes)
    }
    return response.error(ErrorCode.FOLDER_NOT_FOUND)
  } catch (error) {
    return response.error(ErrorCode.FOLDER_DELETE_FAILED, error as Error)
  }
}

async function batchMoveFolders(folderIds: number[], newParentId: number | null): Promise<ApiResponse<number>> {
  try {
    if (!folderIds || folderIds.length === 0) {
      return response.error(ErrorCode.COMMON_INVALID_PARAMETER)
    }
    const changes = folderService.batchMove(folderIds, newParentId)
    return response.success(changes)
  } catch (error) {
    return response.error(ErrorCode.FOLDER_UPDATE_FAILED, error as Error)
  }
}


export {
  createFolder,
  getFolderInfo,
  queryFolders,
  getTreeWithStats,
  getSubFoldersAndFiles,
  updateFolder,
  deleteFolder,
  batchMoveFolders
}