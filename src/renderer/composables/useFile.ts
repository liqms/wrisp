import { ref, computed, watch, onUnmounted } from 'vue'
import { useFileStore } from '@/renderer/store/file.store'
import type {
    CreateFileRequest,
    UpdateFileRequest,
} from '@/shared/types'
import { File } from '@/main/types/db'
import { logger } from '@/renderer/utils/logger.utils'

/**
 * 文件管理组合式函数
 * 专注于文件内容管理和操作，提供简洁的 API 接口
 */
export function useFile() {
    const fileStore = useFileStore()

    // 本地状态
    const selectedFileId = ref<number | null>(null)
    const fileContent = ref<string>('')
    const isEditing = ref(false)
    const autoSave = ref(false)
    const autoSaveInterval = ref<NodeJS.Timeout | null>(null)

    // 从 store 同步的状态
    const currentFile = computed(() => fileStore.currentFile)
    const currentFileWithContent = computed(() => fileStore.currentFileWithContent)
    const loading = computed(() => fileStore.loading)
    const errorMessage = computed(() => fileStore.errorMessage)

    // 计算属性
    const hasSelectedFile = computed(() => selectedFileId.value !== null)
    const isFileModified = computed(() => {
        if (!currentFileWithContent.value || !fileContent.value) return false
        return fileContent.value !== currentFileWithContent.value.content
    })

    const fileTags = computed(() => currentFile.value?.tags || [])
    const fileInfo = computed(() => {
        if (!currentFile.value) return null
        const { tags, ...fileData } = currentFile.value
        return fileData
    })

    // 监听当前文件变化，同步内容
    watch(currentFileWithContent, (newFile) => {
        if (newFile) {
            fileContent.value = newFile.content
            selectedFileId.value = newFile.id
        } else {
            fileContent.value = ''
            selectedFileId.value = null
        }
        isEditing.value = false
    })

    // 文件操作方法

    /**
     * 选择文件并加载内容
     */
    const selectFile = async (fileId: number): Promise<void> => {
        try {
            await fileStore.getFileContentById(fileId)
        } catch (error) {
            logger.error('选择文件失败:', { error: String(error) })
        }
    }

    /**
     * 创建新文件
     */
    const createFile = async (request: CreateFileRequest): Promise<File | null> => {
        const result = await fileStore.createFile(request)
        if (result) {
            // 自动选择新创建的文件
            await selectFile(result.id)
        }
        return result
    }

    /**
     * 更新文件内容
     */
    const updateFileContent = async (content: string): Promise<boolean> => {
        if (!selectedFileId.value) return false

        try {
            const request: UpdateFileRequest = {
                content
            }
            const result = await fileStore.updateFile(selectedFileId.value, request)
            return result > 0
        } catch (error) {
            logger.error('更新文件内容失败:', { error: String(error) })
            return false
        }
    }

    /**
     * 保存文件内容
     */
    const saveFile = async (): Promise<boolean> => {
        if (!isFileModified.value) return true

        const success = await updateFileContent(fileContent.value)
        if (success) {
            isEditing.value = false
        }
        return success
    }

    /**
     * 开始编辑文件
     */
    const startEditing = (): void => {
        isEditing.value = true
    }

    /**
     * 取消编辑
     */
    const cancelEditing = (): void => {
        if (currentFileWithContent.value) {
            fileContent.value = currentFileWithContent.value.content
        }
        isEditing.value = false
    }

    /**
     * 启用自动保存
     */
    const enableAutoSave = (interval: number = 30000): void => {
        autoSave.value = true
        if (autoSaveInterval.value) {
            clearInterval(autoSaveInterval.value)
        }
        autoSaveInterval.value = setInterval(async () => {
            if (isFileModified.value) {
                await saveFile()
            }
        }, interval)
    }

    /**
     * 禁用自动保存
     */
    const disableAutoSave = (): void => {
        autoSave.value = false
        if (autoSaveInterval.value) {
            clearInterval(autoSaveInterval.value)
            autoSaveInterval.value = null
        }
    }

    /**
     * 重命名文件
     */
    const renameFile = async (newName: string): Promise<boolean> => {
        if (!selectedFileId.value) return false

        try {
            const request: UpdateFileRequest = {
                name: newName
            }
            const result = await fileStore.updateFile(selectedFileId.value, request)
            return result > 0
        } catch (error) {
            logger.error('重命名文件失败:', { error: String(error) })
            return false
        }
    }

    /**
     * 移动文件
     */
    const moveFile = async (targetFolderId: number): Promise<boolean> => {
        if (!selectedFileId.value) return false

        try {
            const request: UpdateFileRequest = {
                folderId: targetFolderId
            }
            const result = await fileStore.updateFile(selectedFileId.value, request)
            return result > 0
        } catch (error) {
            logger.error('移动文件失败:', { error: String(error) })
            return false
        }
    }

    /**
     * 删除文件（软删除）
     */
    const deleteFile = async (): Promise<boolean> => {
        if (!selectedFileId.value) return false

        try {
            const result = await fileStore.deleteFile(selectedFileId.value)
            if (result > 0) {
                // 清除当前文件状态
                selectedFileId.value = null
                fileContent.value = ''
                isEditing.value = false
                return true
            }
            return false
        } catch (error) {
            logger.error('删除文件失败:', { error: String(error) })
            return false
        }
    }

    /**
     * 永久删除文件
     */
    const destroyFile = async (): Promise<boolean> => {
        if (!selectedFileId.value) return false

        try {
            const result = await fileStore.destroyFile(selectedFileId.value)
            if (result > 0) {
                // 清除当前文件状态
                selectedFileId.value = null
                fileContent.value = ''
                isEditing.value = false
                return true
            }
            return false
        } catch (error) {
            logger.error('永久删除文件失败:', { error: String(error) })
            return false
        }
    }

    // 标签管理方法

    /**
     * 为文件添加标签
     */
    const addTag = async (tagName: string): Promise<boolean> => {
        if (!selectedFileId.value) return false

        try {
            const result = await fileStore.addFileTag(selectedFileId.value, tagName)
            return result > 0
        } catch (error) {
            logger.error('添加标签失败:', { error: String(error) })
            return false
        }
    }

    /**
     * 移除文件标签
     */
    const removeTag = async (tagName: string): Promise<boolean> => {
        if (!selectedFileId.value) return false

        try {
            const result = await fileStore.removeFileTag(selectedFileId.value, tagName)
            return result > 0
        } catch (error) {
            logger.error('移除标签失败:', { error: String(error) })
            return false
        }
    }

    // 工具方法

    /**
     * 清除错误信息
     */
    const clearError = (): void => {
        fileStore.clearError()
    }

    /**
     * 重置状态
     */
    const reset = (): void => {
        selectedFileId.value = null
        fileContent.value = ''
        isEditing.value = false
        disableAutoSave()
        fileStore.clearFiles()
    }

    /**
     * 清理资源
     */
    const cleanup = (): void => {
        disableAutoSave()
    }

    // 组件卸载时自动清理
    onUnmounted(() => {
        cleanup()
    })

    return {
        // 状态
        selectedFileId,
        fileContent,
        isEditing,
        autoSave,
        hasSelectedFile,
        isFileModified,

        // 计算属性
        currentFile,
        currentFileWithContent,
        loading,
        errorMessage,
        fileTags,
        fileInfo,

        // 方法
        selectFile,
        createFile,
        updateFileContent,
        saveFile,
        startEditing,
        cancelEditing,
        enableAutoSave,
        disableAutoSave,
        renameFile,
        moveFile,
        deleteFile,
        destroyFile,
        addTag,
        removeTag,
        clearError,
        reset,
        cleanup
    }
}