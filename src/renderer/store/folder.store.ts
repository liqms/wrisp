import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  CreateFolderRequest,
  UpdateFolderRequest,
  FolderQueryRequest,
  FolderTreeWithStats,
  ApiResponse 
} from '@/shared/types'
import { Folder, FolderStatus, File } from '@/main/types/db'
import { ErrorCode } from '@/shared/enums'
import { handleApiError } from '@/renderer/utils/error.utils'

export const useFolderStore = defineStore('folder', () => {
  // 状态
  const folders = ref<Folder[]>([])
  const currentFolder = ref<Folder | null>(null)
  const folderTree = ref<FolderTreeWithStats[]>([])
  const rootFolders = ref<Folder[]>([])
  const loading = ref(false)
  const errorCode = ref<ErrorCode | null>(null)
  const errorMessage = ref<string | null>(null)

  // 计算属性
  const getFolders = computed(() => folders.value)
  const getCurrentFolder = computed(() => currentFolder.value)
  const getFolderTree = computed(() => folderTree.value)
  const getRootFolders = computed(() => rootFolders.value)
  const isLoading = computed(() => loading.value)
  const getError = computed(() => errorMessage.value)
  const folderCount = computed(() => folders.value.length)
  const activeFolders = computed(() => folders.value.filter(folder => folder.status === 1))
  const deletedFolders = computed(() => folders.value.filter(folder => folder.status === 0))
  const hiddenFolders = computed(() => folders.value.filter(folder => folder.status === 2))

  // 方法
  
  /**
   * 创建文件夹
   */
  const createFolder = async (request: CreateFolderRequest): Promise<Folder | null> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.folder.create(request) as ApiResponse<Folder>
      if (response.success && response.data) {
        folders.value.push(response.data as Folder)
        return response.data as Folder
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return null
      }
    } catch (error) {
      errorCode.value = ErrorCode.FOLDER_CREATE_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 根据ID获取文件夹信息
   */
  const getFolderInfoById = async (id: number): Promise<Folder | null> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.folder.getInfoById(id) as ApiResponse<Folder>
      if (response.success && response.data) {
        currentFolder.value = response.data as Folder
        return response.data as Folder
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return null
      }
    } catch (error) {
      errorCode.value = ErrorCode.FOLDER_GET_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 根据路径获取文件夹信息
   */
  const getFolderInfoByPath = async (path: string): Promise<Folder | null> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.folder.getInfoByPath(path) as ApiResponse<Folder>
      if (response.success && response.data) {
        currentFolder.value = response.data as Folder
        return response.data as Folder
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return null
      }
    } catch (error) {
      errorCode.value = ErrorCode.FOLDER_GET_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 根据ID获取文件夹详情（包含文件列表）
   */
  const getFolderDetailById = async (id: number): Promise<(Folder & { files: File[] }) | null> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.folder.getDetailById(id) as ApiResponse<Folder & { files: File[] }>
      if (response.success && response.data) {
        currentFolder.value = response.data as Folder & { files: File[] }
        return response.data as Folder & { files: File[] }
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return null
      }
    } catch (error) {
      errorCode.value = ErrorCode.FOLDER_GET_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 根据路径获取文件夹详情（包含文件列表）
   */
  const getFolderDetailByPath = async (path: string): Promise<(Folder & { files: File[] }) | null> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.folder.getDetailByPath(path) as ApiResponse<Folder & { files: File[] }>
      if (response.success && response.data) {
        currentFolder.value = response.data as Folder & { files: File[] }
        return response.data as Folder & { files: File[] }
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return null
      }
    } catch (error) {
      errorCode.value = ErrorCode.FOLDER_GET_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 查询文件夹列表
   */
  const queryFolders = async (request: FolderQueryRequest): Promise<Folder[]> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.folder.query(request) as ApiResponse<Folder[]>
      if (response.success && response.data) {
        folders.value = response.data as Folder[]
        return response.data as Folder[]
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return []
      }
    } catch (error) {
      errorCode.value = ErrorCode.FOLDER_QUERY_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取根文件夹列表
   */
  const fetchRootFolders = async (): Promise<Folder[]> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.folder.getRootFolders() as ApiResponse<Folder[]>
      if (response.success && response.data) {
        rootFolders.value = response.data as Folder[]
        return response.data as Folder[]
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return []
      }
    } catch (error) {
      errorCode.value = ErrorCode.FOLDER_GET_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取文件夹树形结构（包含统计信息）
   */
  const getFolderTreeWithStats = async (parentId: number | null = null): Promise<FolderTreeWithStats[]> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.folder.getTreeWithStats(parentId) as ApiResponse<FolderTreeWithStats[]>
      if (response.success && response.data) {
        folderTree.value = response.data as FolderTreeWithStats[]
        return response.data as FolderTreeWithStats[]
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return []
      }
    } catch (error) {
      errorCode.value = ErrorCode.FOLDER_GET_TREE_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新文件夹
   */
  const updateFolder = async (id: number, request: UpdateFolderRequest): Promise<number> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.folder.update(id, request) as ApiResponse<number>
      if (response.success) {
        // 更新本地状态
        const index = folders.value.findIndex(folder => folder.id === id)
        if (index !== -1) {
          const updatedFolder = await getFolderInfoById(id)
          if (updatedFolder) {
            folders.value[index] = updatedFolder
          }
        }
        return response.data as number
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return 0
      }
    } catch (error) {
      errorCode.value = ErrorCode.FOLDER_UPDATE_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return 0
    } finally {
      loading.value = false
    }
  }

  /**
   * 软删除文件夹
   */
  const deleteFolder = async (id: number): Promise<number> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.folder.delete(id) as ApiResponse<number>
      if (response.success) {
        // 更新本地状态
        const index = folders.value.findIndex(folder => folder.id === id)
        if (index !== -1) {
          folders.value[index].status = 0
        }
        return response.data as number
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return 0
      }
    } catch (error) {
      errorCode.value = ErrorCode.FOLDER_DELETE_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return 0
    } finally {
      loading.value = false
    }
  }

  /**
   * 永久删除文件夹
   */
  const destroyFolder = async (id: number): Promise<number> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.folder.destroy(id) as ApiResponse<number>
      if (response.success) {
        // 从本地状态中移除
        folders.value = folders.value.filter(folder => folder.id !== id)
        return response.data as number
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return 0
      }
    } catch (error) {
      errorCode.value = ErrorCode.FOLDER_DESTROY_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return 0
    } finally {
      loading.value = false
    }
  }

  /**
   * 批量更新文件夹父级ID
   */
  const batchUpdateParentId = async (oldParentId: number, newParentId: number | null): Promise<number> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.folder.batchUpdateParentId(oldParentId, newParentId) as ApiResponse<number>
      if (response.success) {
        // 重新加载文件夹树
        await getFolderTreeWithStats()
        return response.data as number
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return 0
      }
    } catch (error) {
      errorCode.value = ErrorCode.FOLDER_BATCH_UPDATE_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return 0
    } finally {
      loading.value = false
    }
  }

  /**
   * 根据状态统计文件夹数量
   */
  const countByStatus = async (status: FolderStatus): Promise<number> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.folder.countByStatus(status) as ApiResponse<number>
      if (response.success) {
        return response.data as number
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return 0
      }
    } catch (error) {
      errorCode.value = ErrorCode.FOLDER_COUNT_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return 0
    } finally {
      loading.value = false
    }
  }

  /**
   * 清除错误信息
   */
  const clearError = (): void => {
    errorCode.value = null
    errorMessage.value = null
  }

  /**
   * 清空文件夹状态
   */
  const clearFolders = (): void => {
    folders.value = []
    currentFolder.value = null
    folderTree.value = []
    rootFolders.value = []
    errorCode.value = null
    errorMessage.value = null
    loading.value = false
  }

  return {
    // 状态
    folders,
    currentFolder,
    folderTree,
    rootFolders,
    loading,
    errorCode,
    errorMessage,

    // 计算属性
    getFolders,
    getCurrentFolder,
    getFolderTree,
    getRootFolders,
    isLoading,
    getError,
    folderCount,
    activeFolders,
    deletedFolders,
    hiddenFolders,

    // 方法
    createFolder,
    getFolderInfoById,
    getFolderInfoByPath,
    getFolderDetailById,
    getFolderDetailByPath,
    queryFolders,
    fetchRootFolders,
    getFolderTreeWithStats,
    updateFolder,
    deleteFolder,
    destroyFolder,
    batchUpdateParentId,
    countByStatus,
    clearError,
    clearFolders
  }
})