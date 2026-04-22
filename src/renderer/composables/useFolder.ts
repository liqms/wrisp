import { ref, computed, watch, onUnmounted } from 'vue'
import { useFolderStore } from '@/renderer/store/folder.store'
import type {
    CreateFolderRequest,
    UpdateFolderRequest,
    FolderQueryRequest,
    FolderTreeWithStats
} from '@/shared/types'
import { Folder, FolderStatus, File } from '@/main/types/db'
import { logger } from '@/renderer/utils/logger.utils'

/**
 * 文件夹管理组合式函数
 * 专注于文件夹导航、树形结构管理和文件夹操作
 */
export function useFolder() {
    const folderStore = useFolderStore()

    // 本地状态
    const selectedFolderId = ref<number | null>(null)
    const expandedFolderIds = ref<Set<number>>(new Set())
    const currentPath = ref<string>('')
    const breadcrumb = ref<Folder[]>([])

    // 从 store 同步的状态
    const folders = computed(() => folderStore.folders)
    const currentFolder = computed(() => folderStore.currentFolder)
    const folderTree = computed(() => folderStore.folderTree)
    const rootFolders = computed(() => folderStore.rootFolders)
    const loading = computed(() => folderStore.loading)
    const errorMessage = computed(() => folderStore.errorMessage)

    // 计算属性
    const hasSelectedFolder = computed(() => selectedFolderId.value !== null)
    const isFolderExpanded = computed(() => (folderId: number) => expandedFolderIds.value.has(folderId))
    const currentFolderFiles = computed(() => {
        if (currentFolder.value && 'files' in currentFolder.value) {
            return (currentFolder.value as Folder & { files: File[] }).files
        }
        return []
    })

    const activeFolderCount = computed(() => folders.value.filter(folder => folder.status === 1).length)
    const deletedFolderCount = computed(() => folders.value.filter(folder => folder.status === 0).length)
    const hiddenFolderCount = computed(() => folders.value.filter(folder => folder.status === 2).length)

    // 监听当前文件夹变化，更新面包屑
    watch(currentFolder, (newFolder) => {
        if (newFolder) {
            selectedFolderId.value = newFolder.id
            currentPath.value = newFolder.path
            updateBreadcrumb(newFolder)
        } else {
            selectedFolderId.value = null
            currentPath.value = ''
            breadcrumb.value = []
        }
    })

    // 文件夹操作方法

    /**
     * 选择文件夹并加载详情
     */
    const selectFolder = async (folderId: number): Promise<void> => {
        try {
            await folderStore.getFolderDetailById(folderId)
            logger.info(`选择文件夹: ${folderId}`)
        } catch (error) {
            logger.error('选择文件夹失败:', { error: String(error) })
        }
    }

    /**
     * 导航到指定路径的文件夹
     */
    const navigateToPath = async (path: string): Promise<void> => {
        try {
            await folderStore.getFolderDetailByPath(path)
            logger.info(`导航到路径: ${path}`)
        } catch (error) {
            logger.error('路径导航失败:', { error: String(error) })
        }
    }

    /**
     * 展开或折叠文件夹
     */
    const toggleFolder = (folderId: number): void => {
        if (expandedFolderIds.value.has(folderId)) {
            expandedFolderIds.value.delete(folderId)
        } else {
            expandedFolderIds.value.add(folderId)
        }
        logger.debug(`切换文件夹展开状态: ${folderId}`)
    }

    /**
     * 展开所有文件夹
     */
    const expandAll = (): void => {
        const allFolderIds = getAllFolderIds(folderTree.value)
        expandedFolderIds.value = new Set(allFolderIds)
        logger.debug('展开所有文件夹')
    }

    /**
     * 折叠所有文件夹
     */
    const collapseAll = (): void => {
        expandedFolderIds.value.clear()
        logger.debug('折叠所有文件夹')
    }

    /**
     * 创建新文件夹
     */
    const createFolder = async (request: CreateFolderRequest): Promise<Folder | null> => {
        const result = await folderStore.createFolder(request)
        if (result) {
            // 自动选择新创建的文件夹
            await selectFolder(result.id)
            logger.info(`创建文件夹成功: ${result.name}`)
        }
        return result
    }

    /**
     * 重命名文件夹
     */
    const renameFolder = async (newName: string): Promise<boolean> => {
        if (!selectedFolderId.value) return false

        try {
            const request: UpdateFolderRequest = {
                name: newName
            }
            const result = await folderStore.updateFolder(selectedFolderId.value, request)
            const success = result > 0
            if (success) {
                logger.info(`重命名文件夹成功: ${newName}`)
            }
            return success
        } catch (error) {
            logger.error('重命名文件夹失败:', { error: String(error) })
            return false
        }
    }

    /**
     * 移动文件夹
     */
    const moveFolder = async (targetParentId: number | null): Promise<boolean> => {
        if (!selectedFolderId.value) return false

        try {
            const request: UpdateFolderRequest = {
                parent_id: targetParentId
            }
            const result = await folderStore.updateFolder(selectedFolderId.value, request)
            const success = result > 0
            if (success) {
                logger.info(`移动文件夹成功，新父级ID: ${targetParentId}`)
            }
            return success
        } catch (error) {
            logger.error('移动文件夹失败:', { error: String(error) })
            return false
        }
    }

    /**
     * 删除文件夹（软删除）
     */
    const deleteFolder = async (): Promise<boolean> => {
        if (!selectedFolderId.value) return false

        try {
            const result = await folderStore.deleteFolder(selectedFolderId.value)
            const success = result > 0
            if (success) {
                // 清除当前文件夹状态
                selectedFolderId.value = null
                currentPath.value = ''
                breadcrumb.value = []
                logger.info('删除文件夹成功')
            }
            return success
        } catch (error) {
            logger.error('删除文件夹失败:', { error: String(error) })
            return false
        }
    }

    /**
     * 永久删除文件夹
     */
    const destroyFolder = async (): Promise<boolean> => {
        if (!selectedFolderId.value) return false

        try {
            const result = await folderStore.destroyFolder(selectedFolderId.value)
            const success = result > 0
            if (success) {
                // 清除当前文件夹状态
                selectedFolderId.value = null
                currentPath.value = ''
                breadcrumb.value = []
                logger.info('永久删除文件夹成功')
            }
            return success
        } catch (error) {
            logger.error('永久删除文件夹失败:', { error: String(error) })
            return false
        }
    }

    /**
     * 刷新文件夹树
     */
    const refreshFolderTree = async (parentId: number | null = null): Promise<FolderTreeWithStats[]> => {
        try {
            const result = await folderStore.getFolderTreeWithStats(parentId)
            logger.debug('刷新文件夹树成功')
            return result
        } catch (error) {
            logger.error('刷新文件夹树失败:', { error: String(error) })
            return []
        }
    }

    /**
     * 加载根文件夹
     */
    const loadRootFolders = async (): Promise<Folder[]> => {
        try {
            const result = await folderStore.fetchRootFolders()
            logger.debug('加载根文件夹成功')
            return result
        } catch (error) {
            logger.error('加载根文件夹失败:', { error: String(error) })
            return []
        }
    }

    /**
     * 查询文件夹列表
     */
    const searchFolders = async (request: FolderQueryRequest): Promise<Folder[]> => {
        try {
            const result = await folderStore.queryFolders(request)
            logger.debug(`查询文件夹列表，条件: ${JSON.stringify(request)}`)
            return result
        } catch (error) {
            logger.error('查询文件夹列表失败:', { error: String(error) })
            return []
        }
    }

    /**
     * 批量移动子文件夹
     */
    const batchMoveSubfolders = async (oldParentId: number, newParentId: number | null): Promise<boolean> => {
        try {
            const result = await folderStore.batchUpdateParentId(oldParentId, newParentId)
            const success = result > 0
            if (success) {
                logger.info(`批量移动子文件夹成功，从 ${oldParentId} 到 ${newParentId}`)
            }
            return success
        } catch (error) {
            logger.error('批量移动子文件夹失败:', { error: String(error) })
            return false
        }
    }

    // 工具方法

    /**
     * 更新面包屑导航
     */
    const updateBreadcrumb = (folder: Folder): void => {
        // 这里需要实现根据文件夹路径生成面包屑的逻辑
        // 暂时简化实现
        breadcrumb.value = [folder]
    }

    /**
     * 获取所有文件夹ID（用于展开所有）
     */
    const getAllFolderIds = (tree: FolderTreeWithStats[]): number[] => {
        const ids: number[] = []

        const traverse = (nodes: FolderTreeWithStats[]) => {
            nodes.forEach(node => {
                ids.push(node.id)
                if (node.children && node.children.length > 0) {
                    traverse(node.children)
                }
            })
        }

        traverse(tree)
        return ids
    }

    /**
     * 清除错误信息
     */
    const clearError = (): void => {
        folderStore.clearError()
    }

    /**
     * 重置状态
     */
    const reset = (): void => {
        selectedFolderId.value = null
        expandedFolderIds.value.clear()
        currentPath.value = ''
        breadcrumb.value = []
        folderStore.clearFolders()
    }

    /**
     * 清理资源
     */
    const cleanup = (): void => {
        // 目前没有需要清理的定时器或其他资源
    }

    // 组件卸载时自动清理
    onUnmounted(() => {
        cleanup()
    })

    return {
        // 状态
        selectedFolderId,
        expandedFolderIds,
        currentPath,
        breadcrumb,
        hasSelectedFolder,

        // 计算属性
        folders,
        currentFolder,
        folderTree,
        rootFolders,
        loading,
        errorMessage,
        isFolderExpanded,
        currentFolderFiles,
        activeFolderCount,
        deletedFolderCount,
        hiddenFolderCount,

        // 方法
        selectFolder,
        navigateToPath,
        toggleFolder,
        expandAll,
        collapseAll,
        createFolder,
        renameFolder,
        moveFolder,
        deleteFolder,
        destroyFolder,
        refreshFolderTree,
        loadRootFolders,
        searchFolders,
        batchMoveSubfolders,
        clearError,
        reset,
        cleanup
    }
}