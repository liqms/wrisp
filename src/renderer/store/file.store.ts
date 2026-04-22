import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  CreateFileRequest, 
  UpdateFileRequest, 
  FileQueryRequest, 
  FileAggregate,
  ApiResponse 
} from '@/shared/types'
import { ErrorCode } from '@/shared/enums'
import { File, FileStatus } from '@/main/types/db'
import { handleApiError } from '@/renderer/utils/error.utils'

export const useFileStore = defineStore('file', () => {
  // 状态
  const files = ref<File[]>([])
  const currentFile = ref<(File & { tags: string[] }) | null>(null)
  const currentFileWithContent = ref<(File & { tags: string[] } & { content: string }) | null>(null)
  const fileAggregate = ref<FileAggregate | null>(null)
  const duplicateFiles = ref<File[]>([])
  const loading = ref(false)
  const errorCode = ref<ErrorCode | null>(null)
  const errorMessage = ref<string | null>(null)

  // 计算属性
  const getFiles = computed(() => files.value)
  const getCurrentFile = computed(() => currentFile.value)
  const getCurrentFileWithContent = computed(() => currentFileWithContent.value)
  const getFileAggregate = computed(() => fileAggregate.value)
  const getDuplicateFiles = computed(() => duplicateFiles.value)
  const isLoading = computed(() => loading.value)
  const getError = computed(() => errorMessage.value)
  const fileCount = computed(() => files.value.length)
  const activeFiles = computed(() => files.value.filter(file => file.status === 1))
  const deletedFiles = computed(() => files.value.filter(file => file.status === 0))
  const hiddenFiles = computed(() => files.value.filter(file => file.status === 2))

  // 方法
  
  /**
   * 创建文件
   */
  const createFile = async (request: CreateFileRequest): Promise<File | null> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.file.create(request) as ApiResponse<File>
      if (response.success && response.data) {
        files.value.push(response.data as File)
        return response.data as File
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return null
      }
    } catch (error) {
      errorCode.value = ErrorCode.FILE_CREATE_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 根据ID获取文件信息（包含标签）
   */
  const getFileInfoById = async (id: number): Promise<(File & { tags: string[] }) | null> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.file.getInfoById(id) as ApiResponse<File & { tags: string[] }>
      if (response.success && response.data) {
        currentFile.value = response.data as File & { tags: string[] }
        return response.data as File & { tags: string[] }
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return null
      }
    } catch (error) {
      errorCode.value = ErrorCode.FILE_GET_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 根据路径获取文件信息（包含标签）
   */
  const getFileInfoByPath = async (path: string): Promise<(File & { tags: string[] }) | null> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.file.getInfoByPath(path) as ApiResponse<File & { tags: string[] }>
      if (response.success && response.data) {
        currentFile.value = response.data as File & { tags: string[] }
        return response.data as File & { tags: string[] }
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return null
      }
    } catch (error) {
      errorCode.value = ErrorCode.FILE_GET_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 根据ID获取文件内容（包含标签和内容）
   */
  const getFileContentById = async (id: number): Promise<(File & { tags: string[] } & { content: string }) | null> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.file.getContentById(id) as ApiResponse<File & { tags: string[] } & { content: string }>
      if (response.success && response.data) {
        currentFileWithContent.value = response.data as File & { tags: string[] } & { content: string }
        return response.data as File & { tags: string[] } & { content: string }
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return null
      }
    } catch (error) {
      errorCode.value = ErrorCode.FILE_GET_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 根据路径获取文件内容（包含标签和内容）
   */
  const getFileContentByPath = async (path: string): Promise<(File & { tags: string[] } & { content: string }) | null> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.file.getContentByPath(path) as ApiResponse<File & { tags: string[] } & { content: string }>
      if (response.success && response.data) {
        currentFileWithContent.value = response.data as File & { tags: string[] } & { content: string }
        return response.data as File & { tags: string[] } & { content: string }
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return null
      }
    } catch (error) {
      errorCode.value = ErrorCode.FILE_GET_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 查询文件列表
   */
  const queryFiles = async (request: FileQueryRequest): Promise<File[]> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.file.query(request) as ApiResponse<File[]>
      if (response.success && response.data) {
        files.value = response.data as File[]
        return response.data as File[]
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return []
      }
    } catch (error) {
      errorCode.value = ErrorCode.FILE_QUERY_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * 根据条件查询文件
   */
  const findFilesByConditions = async (conditions: Partial<{
    folderId: number
    extension: string
    type: string
    status: FileStatus
  }>): Promise<File[]> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.file.findByConditions(conditions) as ApiResponse<File[]>
      if (response.success && response.data) {
        files.value = response.data as File[]
        return response.data as File[]
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return []
      }
    } catch (error) {
      errorCode.value = ErrorCode.FILE_QUERY_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新文件
   */
  const updateFile = async (id: number, request: UpdateFileRequest): Promise<number> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.file.update(id, request) as ApiResponse<number>
      if (response.success) {
        // 更新本地状态
        const index = files.value.findIndex(file => file.id === id)
        if (index !== -1) {
          const updatedFile = await getFileInfoById(id)
          if (updatedFile) {
            files.value[index] = updatedFile
          }
        }
        return response.data as number
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return 0
      }
    } catch (error) {
      errorCode.value = ErrorCode.FILE_UPDATE_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return 0
    } finally {
      loading.value = false
    }
  }

  /**
   * 软删除文件
   */
  const deleteFile = async (id: number): Promise<number> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.file.delete(id) as ApiResponse<number>
      if (response.success) {
        // 更新本地状态
        const index = files.value.findIndex(file => file.id === id)
        if (index !== -1) {
          files.value[index].status = 0
        }
        return response.data as number
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return 0
      }
    } catch (error) {
      errorCode.value = ErrorCode.FILE_DELETE_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return 0
    } finally {
      loading.value = false
    }
  }

  /**
   * 永久删除文件
   */
  const destroyFile = async (id: number): Promise<number> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.file.destroy(id) as ApiResponse<number>
      if (response.success) {
        // 从本地状态中移除
        files.value = files.value.filter(file => file.id !== id)
        return response.data as number
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return 0
      }
    } catch (error) {
      errorCode.value = ErrorCode.FILE_DESTROY_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return 0
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取文件夹的文件统计信息
   */
  const getFileAggregateByFolder = async (folderId: number): Promise<FileAggregate | null> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.file.getAggregateByFolder(folderId) as ApiResponse<FileAggregate>
      if (response.success && response.data) {
        fileAggregate.value = response.data as FileAggregate
        return response.data as FileAggregate
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return null
      }
    } catch (error) {
      errorCode.value = ErrorCode.FILE_QUERY_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 查找重复文件
   */
  const findDuplicateFiles = async (): Promise<File[]> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.file.findDuplicates() as ApiResponse<File[]>
      if (response.success && response.data) {
        duplicateFiles.value = response.data as File[]
        return response.data as File[]
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return []
      }
    } catch (error) {
      errorCode.value = ErrorCode.FILE_QUERY_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * 为文件添加标签
   */
  const addFileTag = async (fileId: number, tagName: string): Promise<number> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.file.addTag(fileId, tagName) as ApiResponse<number>
      if (response.success) {
        // 更新当前文件标签
        if (currentFile.value && currentFile.value.id === fileId) {
          if (!currentFile.value.tags.includes(tagName)) {
            currentFile.value.tags.push(tagName)
          }
        }
        return response.data as number
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return 0
      }
    } catch (error) {
      errorCode.value = ErrorCode.FILE_ADD_TAG_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return 0
    } finally {
      loading.value = false
    }
  }

  /**
   * 移除文件标签
   */
  const removeFileTag = async (fileId: number, tagName: string): Promise<number> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null
    
    try {
      const response = await window.electronAPI.file.removeTag(fileId, tagName) as ApiResponse<number>
      if (response.success) {
        // 更新当前文件标签
        if (currentFile.value && currentFile.value.id === fileId) {
          currentFile.value.tags = currentFile.value.tags.filter(tag => tag !== tagName)
        }
        return response.data as number
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return 0
      }
    } catch (error) {
      errorCode.value = ErrorCode.FILE_REMOVE_TAG_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return 0
    } finally {
      loading.value = false
    }
  }

  /**
   * 清空错误信息
   */
  const clearError = (): void => {
    errorCode.value = null
    errorMessage.value = null
  }

  /**
   * 清空文件状态
   */
  const clearFiles = (): void => {
    files.value = []
    currentFile.value = null
    currentFileWithContent.value = null
    fileAggregate.value = null
    duplicateFiles.value = []
    errorCode.value = null
    errorMessage.value = null
    loading.value = false
  }

  return {
    // 状态
    files,
    currentFile,
    currentFileWithContent,
    fileAggregate,
    duplicateFiles,
    loading,
    errorCode,
    errorMessage,
    
    // 计算属性
    getFiles,
    getCurrentFile,
    getCurrentFileWithContent,
    getFileAggregate,
    getDuplicateFiles,
    isLoading,
    getError,
    fileCount,
    activeFiles,
    deletedFiles,
    hiddenFiles,
    
    // 方法
    createFile,
    getFileInfoById,
    getFileInfoByPath,
    getFileContentById,
    getFileContentByPath,
    queryFiles,
    findFilesByConditions,
    updateFile,
    deleteFile,
    destroyFile,
    getFileAggregateByFolder,
    findDuplicateFiles,
    addFileTag,
    removeFileTag,
    clearError,
    clearFiles
  }
})