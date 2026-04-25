import { ref, computed, watch, onUnmounted } from 'vue'
import { useNovelStore } from '@/renderer/store/novel.store'
import type {
    CreateNovelRequest,
    UpdateNovelRequest,
    QueryNovelRequest,
    CreateNovelFileRequest,
    UpdateNovelFileRequest,
    QueryNovelFileRequest,
    CreateFolderRequest,
    UpdateFolderRequest,
    FolderQueryRequest,
    FolderTreeWithStats,
    NovelBaseInfo,
    NovelFileInfo,
} from '@/shared/types'
import { Folder } from '@/main/types/db'
import { logger } from '@/renderer/utils/logger.utils'

/**
 * 小说管理组合式函数
 * 专注于小说管理、章节操作和文件夹导航
 */
export function useNovel() {
    const novelStore = useNovelStore()

    // 本地状态
    const selectedNovelId = ref<number | null>(null)
    const selectedFolderId = ref<number | null>(null)
    const selectedFileId = ref<number | null>(null)
    const expandedFolderIds = ref<Set<number>>(new Set())

    // 从 store 同步的状态
    const novels = computed(() => novelStore.novels)
    const currentNovel = computed(() => novelStore.currentNovel)
    const currentFolder = computed(() => novelStore.currentFolder)
    const currentFile = computed(() => novelStore.currentFile)
    const folderTree = computed(() => novelStore.folderTree)
    const loading = computed(() => novelStore.loading)
    const errorMessage = computed(() => novelStore.errorMessage)

    // 计算属性
    const hasSelectedNovel = computed(() => selectedNovelId.value !== null)
    const hasSelectedFolder = computed(() => selectedFolderId.value !== null)
    const hasSelectedFile = computed(() => selectedFileId.value !== null)
    const isFolderExpanded = computed(() => (folderId: number) => expandedFolderIds.value.has(folderId))

    const activeNovelCount = computed(() => novels.value.filter(novel => novel.status === 1).length)
    const deletedNovelCount = computed(() => novels.value.filter(novel => novel.status === 0).length)

    // 监听当前小说变化
    watch(currentNovel, (newNovel) => {
        if (newNovel) {
            selectedNovelId.value = newNovel.novel.id
        } else {
            selectedNovelId.value = null
        }
    })

    // 监听当前文件夹变化，更新面包屑
    watch(currentFolder, (newFolder) => {
        if (newFolder) {
            selectedFolderId.value = newFolder.id
        } else {
            selectedFolderId.value = null
        }
    })

    // ========== 小说操作方法 ==========

    /**
     * 选择小说并加载详情
     */
    const selectNovel = async (novelId: number): Promise<void> => {
        try {
            await novelStore.getNovelById(novelId)
            logger.info(`选择小说: ${novelId}`)
        } catch (error) {
            logger.error('选择小说失败:', { error: String(error) })
        }
    }

    /**
     * 创建新小说
     */
    const createNovel = async (request: CreateNovelRequest): Promise<NovelBaseInfo | null> => {
        const result = await novelStore.createNovel(request)
        if (result) {
            logger.info(`创建小说成功: ${result.name}`)
        }
        return result
    }

    /**
     * 更新小说信息
     */
    const updateNovel = async (novelId: number, request: UpdateNovelRequest): Promise<number> => {
        try {
            const result = await novelStore.updateNovel(novelId, request)
            if (result > 0) {
                logger.info(`更新小说成功: ${novelId}`)
            }
            return result
        } catch (error) {
            logger.error('更新小说失败:', { error: String(error) })
            return 0
        }
    }

    /**
     * 删除小说（软删除）
     */
    const deleteNovel = async (novelId: number): Promise<number> => {
        try {
            const result = await novelStore.deleteNovel(novelId)
            if (result > 0) {
                if (selectedNovelId.value === novelId) {
                    selectedNovelId.value = null
                }
                logger.info('删除小说成功')
            }
            return result
        } catch (error) {
            logger.error('删除小说失败:', { error: String(error) })
            return 0
        }
    }

    /**
     * 查询小说列表
     */
    const searchNovels = async (request: QueryNovelRequest): Promise<NovelBaseInfo[]> => {
        try {
            const result = await novelStore.queryNovels(request)
            logger.debug(`查询小说列表，条件: ${JSON.stringify(request)}`)
            return result
        } catch (error) {
            logger.error('查询小说列表失败:', { error: String(error) })
            return []
        }
    }

    // ========== 文件夹操作方法 ==========

    /**
     * 选择文件夹
     */
    const selectFolder = async (folderId: number): Promise<void> => {
        try {
            await novelStore.getFolderInfoById(folderId)
            logger.info(`选择文件夹: ${folderId}`)
        } catch (error) {
            logger.error('选择文件夹失败:', { error: String(error) })
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
     * 创建文件夹
     */
    const createFolder = async (request: CreateFolderRequest): Promise<Folder | null> => {
        const result = await novelStore.createFolder(request)
        if (result) {
            logger.info(`创建文件夹成功: ${result.name}`)
        }
        return result
    }

    /**
     * 更新文件夹
     */
    const updateFolder = async (folderId: number, request: UpdateFolderRequest): Promise<number> => {
        try {
            const result = await novelStore.updateFolder(folderId, request)
            if (result > 0) {
                logger.info(`更新文件夹成功: ${folderId}`)
            }
            return result
        } catch (error) {
            logger.error('更新文件夹失败:', { error: String(error) })
            return 0
        }
    }

    /**
     * 删除文件夹
     */
    const deleteFolder = async (folderId: number): Promise<number> => {
        try {
            const result = await novelStore.deleteFolder(folderId)
            if (result > 0) {
                if (selectedFolderId.value === folderId) {
                    selectedFolderId.value = null
                }
                logger.info('删除文件夹成功')
            }
            return result
        } catch (error) {
            logger.error('删除文件夹失败:', { error: String(error) })
            return 0
        }
    }

    /**
     * 查询文件夹列表
     */
    const searchFolders = async (request: FolderQueryRequest): Promise<Folder[]> => {
        try {
            const result = await novelStore.queryFolders(request)
            logger.debug(`查询文件夹列表，条件: ${JSON.stringify(request)}`)
            return result
        } catch (error) {
            logger.error('查询文件夹列表失败:', { error: String(error) })
            return []
        }
    }

    /**
     * 获取文件夹树形结构
     */
    const getFolderTree = async (parentId: number): Promise<FolderTreeWithStats[]> => {
        try {
            const result = await novelStore.getFolderTreeWithStats(parentId)
            logger.debug('获取文件夹树成功')
            return result
        } catch (error) {
            logger.error('获取文件夹树失败:', { error: String(error) })
            return []
        }
    }

    /**
     * 批量移动文件夹
     */
    const batchMoveFolders = async (folderIds: number[], targetParentId: number): Promise<number> => {
        try {
            const result = await novelStore.batchMoveFolders(folderIds, targetParentId)
            if (result > 0) {
                logger.info(`批量移动文件夹成功，到 ${targetParentId}`)
            }
            return result
        } catch (error) {
            logger.error('批量移动文件夹失败:', { error: String(error) })
            return 0
        }
    }

    // ========== 文件（章节）操作方法 ==========

    /**
     * 选择文件（章节）
     */
    const selectFile = async (fileId: number): Promise<NovelFileInfo | null> => {
        try {
            const result = await novelStore.getNovelFileById(fileId)
            if (result) {
                selectedFileId.value = fileId
                logger.info(`选择文件: ${fileId}`)
            }
            return result
        } catch (error) {
            logger.error('选择文件失败:', { error: String(error) })
            return null
        }
    }

    /**
     * 创建文件（章节）
     */
    const createFile = async (request: CreateNovelFileRequest): Promise<NovelFileInfo | null> => {
        const result = await novelStore.createNovelFile(request)
        if (result) {
            logger.info(`创建文件成功: ${result.name}`)
        }
        return result
    }

    /**
     * 更新文件内容
     */
    const updateFile = async (fileId: number, request: UpdateNovelFileRequest): Promise<boolean> => {
        try {
            const result = await novelStore.updateNovelFile(fileId, request)
            if (result) {
                logger.info(`更新文件成功: ${fileId}`)
            }
            return result
        } catch (error) {
            logger.error('更新文件失败:', { error: String(error) })
            return false
        }
    }

    /**
     * 删除文件
     */
    const deleteFile = async (fileId: number): Promise<boolean> => {
        try {
            const result = await novelStore.deleteNovelFile(fileId)
            if (result) {
                if (selectedFileId.value === fileId) {
                    selectedFileId.value = null
                }
                logger.info('删除文件成功')
            }
            return result
        } catch (error) {
            logger.error('删除文件失败:', { error: String(error) })
            return false
        }
    }

    /**
     * 查询文件列表
     */
    const searchFiles = async (request: QueryNovelFileRequest): Promise<NovelFileInfo[]> => {
        try {
            const result = await novelStore.queryFiles(request)
            logger.debug(`查询文件列表，条件: ${JSON.stringify(request)}`)
            return result
        } catch (error) {
            logger.error('查询文件列表失败:', { error: String(error) })
            return []
        }
    }

    /**
     * 批量移动章节到指定文件夹
     */
    const batchMoveChapters = async (chapterIds: number[], folderId: number): Promise<boolean> => {
        try {
            const result = await novelStore.batchMoveChapters(chapterIds, folderId)
            if (result) {
                logger.info(`批量移动章节成功，到文件夹 ${folderId}`)
            }
            return result
        } catch (error) {
            logger.error('批量移动章节失败:', { error: String(error) })
            return false
        }
    }

    // ========== 工具方法 ==========

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
        novelStore.clearError()
    }

    /**
     * 重置状态
     */
    const reset = (): void => {
        selectedNovelId.value = null
        selectedFolderId.value = null
        selectedFileId.value = null
        expandedFolderIds.value.clear()
        novelStore.clearNovels()
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
        // === 状态 ===
        selectedNovelId,
        selectedFolderId,
        selectedFileId,
        expandedFolderIds,
        hasSelectedNovel,
        hasSelectedFolder,
        hasSelectedFile,

        // === 计算属性 ===
        novels,
        currentNovel,
        currentFolder,
        currentFile,
        folderTree,
        loading,
        errorMessage,
        isFolderExpanded,
        activeNovelCount,
        deletedNovelCount,

        // === 小说操作方法 ===
        selectNovel,
        createNovel,
        updateNovel,
        deleteNovel,
        searchNovels,

        // === 文件夹操作方法 ===
        selectFolder,
        toggleFolder,
        expandAll,
        collapseAll,
        createFolder,
        updateFolder,
        deleteFolder,
        searchFolders,
        getFolderTree,
        batchMoveFolders,

        // === 文件操作方法 ===
        selectFile,
        createFile,
        updateFile,
        deleteFile,
        searchFiles,
        batchMoveChapters,

        // === 通用方法 ===
        clearError,
        reset,
        cleanup
    }
}