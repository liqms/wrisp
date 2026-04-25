import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
    CreateNovelRequest,
    UpdateNovelRequest,
    QueryNovelRequest,
    NovelDetail,
    NovelBaseInfo,
    NovelFileInfo,
    CreateNovelFileRequest,
    UpdateNovelFileRequest,
    QueryNovelFileRequest,
    FoldersAndFilesList,
    ApiResponse,
    FolderBasicInfo,
    FileBasicInfo,
    CreateFolderRequest,
    UpdateFolderRequest,
    FolderQueryRequest,
    FolderTreeWithStats
} from '@/shared/types'
import { Work, Folder } from '@/main/types/db'
import { ErrorCode } from '@/shared/enums'
import { handleApiError } from '@/renderer/utils/error.utils'

export const useNovelStore = defineStore('novel', () => {
    // === 小说相关状态 ===
    const novels = ref<NovelBaseInfo[]>([])
    const folders = ref<FolderBasicInfo[]>([])
    const files = ref<FileBasicInfo[]>([])
    const currentNovel = ref<NovelDetail | null>(null)
    const currentFolder = ref<FolderBasicInfo | null>(null)
    const currentFile = ref<NovelFileInfo | null>(null)

    // === 文件夹相关状态 ===
    const folderList = ref<Folder[]>([])
    const folderTree = ref<FolderTreeWithStats[]>([])

    // === 通用状态 ===
    const loading = ref(false)
    const errorCode = ref<ErrorCode | null>(null)
    const errorMessage = ref<string | null>(null)

    // === 小说相关计算属性 ===
    const getNovels = computed(() => novels.value)
    const getFolders = computed(() => folders.value)
    const getFiles = computed(() => files.value)
    const getCurrentNovel = computed(() => currentNovel.value)
    const getCurrentFolder = computed(() => currentFolder.value)
    const getCurrentFile = computed(() => currentFile.value)
    const isLoading = computed(() => loading.value)
    const getError = computed(() => errorMessage.value)
    const novelCount = computed(() => novels.value.length)
    const activeNovels = computed(() => novels.value.filter(novel => novel.status === 1))
    const deletedNovels = computed(() => novels.value.filter(novel => novel.status === 0))

    // === 文件夹相关计算属性 ===
    const getFolderList = computed(() => folderList.value)
    const getFolderTree = computed(() => folderTree.value)
    const folderCount = computed(() => folderList.value.length)
    const activeFolders = computed(() => folderList.value.filter(folder => folder.status === 1))
    const deletedFolders = computed(() => folderList.value.filter(folder => folder.status === 0))
    const hiddenFolders = computed(() => folderList.value.filter(folder => folder.status === 2))

    // ========== 小说相关方法 ==========

    /**
     * 创建小说
     */
    const createNovel = async (request: CreateNovelRequest): Promise<Work | null> => {
        loading.value = true
        errorCode.value = null
        errorMessage.value = null

        try {
            const response = await window.electronAPI.novel.create(request) as ApiResponse<Work>
            if (response.success && response.data) {
                novels.value.push(response.data as Work)
                return response.data as Work
            } else {
                errorCode.value = response.code
                errorMessage.value = handleApiError(response)
                return null
            }
        } catch (error) {
            errorCode.value = ErrorCode.NOVEL_CREATE_FAILED
            errorMessage.value = handleApiError({ success: false, code: errorCode.value })
            return null
        } finally {
            loading.value = false
        }
    }

    /**
     * 根据ID获取小说详情
     */
    const getNovelById = async (id: number): Promise<NovelDetail | null> => {
        loading.value = true
        errorCode.value = null
        errorMessage.value = null

        try {
            const response = await window.electronAPI.novel.getInfo(id) as ApiResponse<NovelDetail>
            if (response.success && response.data) {
                currentNovel.value = response.data as NovelDetail
                return response.data as NovelDetail
            } else {
                errorCode.value = response.code
                errorMessage.value = handleApiError(response)
                return null
            }
        } catch (error) {
            errorCode.value = ErrorCode.NOVEL_GET_FAILED
            errorMessage.value = handleApiError({ success: false, code: errorCode.value })
            return null
        } finally {
            loading.value = false
        }
    }

    /**
     * 查询小说列表
     */
    const queryNovels = async (request: QueryNovelRequest): Promise<NovelBaseInfo[]> => {
        loading.value = true
        errorCode.value = null
        errorMessage.value = null

        try {
            const response = await window.electronAPI.novel.query(request) as ApiResponse<NovelBaseInfo[]>
            if (response.success && response.data) {
                novels.value = response.data as NovelBaseInfo[]
                return response.data as NovelBaseInfo[]
            } else {
                errorCode.value = response.code
                errorMessage.value = handleApiError(response)
                return []
            }
        } catch (error) {
            errorCode.value = ErrorCode.NOVEL_QUERY_FAILED
            errorMessage.value = handleApiError({ success: false, code: errorCode.value })
            return []
        } finally {
            loading.value = false
        }
    }

    /**
     * 更新小说信息
     */
    const updateNovel = async (id: number, request: UpdateNovelRequest): Promise<number> => {
        loading.value = true
        errorCode.value = null
        errorMessage.value = null

        try {
            const response = await window.electronAPI.novel.update(id, request) as ApiResponse<number>
            if (response.success) {
                const index = novels.value.findIndex(novel => novel.id === id)
                if (index !== -1) {
                    const updatedNovel = await getNovelById(id)
                    if (updatedNovel) {
                        novels.value[index] = updatedNovel.novel as NovelBaseInfo
                    }
                }
                return response.data as number
            } else {
                errorCode.value = response.code
                errorMessage.value = handleApiError(response)
                return 0
            }
        } catch (error) {
            errorCode.value = ErrorCode.NOVEL_UPDATE_FAILED
            errorMessage.value = handleApiError({ success: false, code: errorCode.value })
            return 0
        } finally {
            loading.value = false
        }
    }

    /**
     * 删除小说（软删除）
     */
    const deleteNovel = async (id: number): Promise<number> => {
        loading.value = true
        errorCode.value = null
        errorMessage.value = null

        try {
            const response = await window.electronAPI.novel.delete(id) as ApiResponse<number>
            if (response.success) {
                const index = novels.value.findIndex(novel => novel.id === id)
                if (index !== -1) {
                    novels.value[index].status = 0
                }
                return response.data as number
            } else {
                errorCode.value = response.code
                errorMessage.value = handleApiError(response)
                return 0
            }
        } catch (error) {
            errorCode.value = ErrorCode.NOVEL_DELETE_FAILED
            errorMessage.value = handleApiError({ success: false, code: errorCode.value })
            return 0
        } finally {
            loading.value = false
        }
    }

    /**
     * 获取小说的文件夹和文件列表
     */
    const getFoldersAndFilesList = async (parentId: number): Promise<FoldersAndFilesList | null> => {
        loading.value = true
        errorCode.value = null
        errorMessage.value = null

        try {
            const response = await window.electronAPI.folder.getSubFoldersAndFiles(parentId) as ApiResponse<FoldersAndFilesList>
            if (response.success && response.data) {
                const data = response.data as FoldersAndFilesList
                folders.value = data.folders
                files.value = data.files
                return data
            } else {
                errorCode.value = response.code
                errorMessage.value = handleApiError(response)
                return null
            }
        } catch (error) {
            errorCode.value = ErrorCode.FOLDER_QUERY_FAILED
            errorMessage.value = handleApiError({ success: false, code: errorCode.value })
            return null
        } finally {
            loading.value = false
        }
    }

    /**
     * 创建章节/知识库文件
     */
    const createNovelFile = async (request: CreateNovelFileRequest): Promise<NovelFileInfo | null> => {
        loading.value = true
        errorCode.value = null
        errorMessage.value = null

        try {
            const response = await window.electronAPI.novel.createFile(request) as ApiResponse<FileBasicInfo>
            if (response.success && response.data) {
                const data = response.data as FileBasicInfo
                files.value.push(data)
                currentFile.value = data
                return data
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
     * 根据ID获取文件内容
     */
    const getNovelFileById = async (id: number): Promise<NovelFileInfo | null> => {
        loading.value = true
        errorCode.value = null
        errorMessage.value = null

        try {
            const response = await window.electronAPI.novel.getFileContent(id) as ApiResponse<NovelFileInfo>
            if (response.success && response.data) {
                return response.data as NovelFileInfo
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
     * 更新文件内容
     */
    const updateNovelFile = async (id: number, request: UpdateNovelFileRequest): Promise<boolean> => {
        loading.value = true
        errorCode.value = null
        errorMessage.value = null

        try {
            const response = await window.electronAPI.novel.updateFileContent(id, request) as ApiResponse<NovelFileInfo>
            if (response.success && response.data) {
                const data = response.data as NovelFileInfo
                if (currentFile.value?.id === id) {
                    currentFile.value.content = data.content
                }
                return true
            } else {
                errorCode.value = response.code
                errorMessage.value = handleApiError(response)
                return false
            }
        } catch (error) {
            errorCode.value = ErrorCode.FILE_UPDATE_FAILED
            errorMessage.value = handleApiError({ success: false, code: errorCode.value })
            return false
        } finally {
            loading.value = false
        }
    }

    /**
     * 删除文件
     */
    const deleteNovelFile = async (id: number): Promise<boolean> => {
        loading.value = true
        errorCode.value = null
        errorMessage.value = null

        try {
            const response = await window.electronAPI.novel.deleteFile(id) as ApiResponse<number>
            if (response.success) {
                if (currentFile.value?.id === id) {
                    currentFile.value = null
                }
                return true
            } else {
                errorCode.value = response.code
                errorMessage.value = handleApiError(response)
                return false
            }
        } catch (error) {
            errorCode.value = ErrorCode.FILE_DELETE_FAILED
            errorMessage.value = handleApiError({ success: false, code: errorCode.value })
            return false
        } finally {
            loading.value = false
        }
    }

    /**
     * 查询文件列表
     */
    const queryFiles = async (request: QueryNovelFileRequest): Promise<NovelFileInfo[]> => {
        loading.value = true
        errorCode.value = null
        errorMessage.value = null

        try {
            const response = await window.electronAPI.novel.queryFiles(request) as ApiResponse<NovelFileInfo[]>
            if (response.success && response.data) {
                return response.data as NovelFileInfo[]
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
     * 批量移动章节到指定文件夹
     */
    const batchMoveChapters = async (chapterIds: number[], folderId: number): Promise<boolean> => {
        loading.value = true
        errorCode.value = null
        errorMessage.value = null

        try {
            const response = await window.electronAPI.novel.moveFiles(chapterIds, folderId)
            if (response.success) {
                return true
            } else {
                errorCode.value = response.code
                errorMessage.value = handleApiError(response)
                return false
            }
        } catch (error) {
            errorCode.value = ErrorCode.FILE_MOVE_FAILED
            errorMessage.value = handleApiError({ success: false, code: errorCode.value })
            return false
        } finally {
            loading.value = false
        }
    }

    // ========== 文件夹相关方法 ==========

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
                folderList.value.push(response.data as Folder)
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
     * 查询文件夹列表
     */
    const queryFolders = async (request: FolderQueryRequest): Promise<Folder[]> => {
        loading.value = true
        errorCode.value = null
        errorMessage.value = null

        try {
            const response = await window.electronAPI.folder.query(request) as ApiResponse<Folder[]>
            if (response.success && response.data) {
                folderList.value = response.data as Folder[]
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
     * 获取文件夹树形结构（包含统计信息）
     */
    const getFolderTreeWithStats = async (parentId: number): Promise<FolderTreeWithStats[]> => {
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
                const index = folderList.value.findIndex(folder => folder.id === id)
                if (index !== -1) {
                    const updatedFolder = await getFolderInfoById(id)
                    if (updatedFolder) {
                        folderList.value[index] = updatedFolder
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
     * 删除文件夹
     */
    const deleteFolder = async (id: number): Promise<number> => {
        loading.value = true
        errorCode.value = null
        errorMessage.value = null

        try {
            const response = await window.electronAPI.folder.delete(id) as ApiResponse<number>
            if (response.success) {
                const index = folderList.value.findIndex(folder => folder.id === id)
                if (index !== -1) {
                    folderList.value[index].status = 0
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
     * 批量移动文件夹
     */
    const batchMoveFolders = async (ids: number[], parentId: number): Promise<number> => {
        loading.value = true
        errorCode.value = null
        errorMessage.value = null

        try {
            const response = await window.electronAPI.folder.batchMove(ids, parentId) as ApiResponse<number>
            if (response.success) {
                await getFolderTreeWithStats(parentId)
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

    // ========== 通用方法 ==========

    /**
     * 清除错误信息
     */
    const clearError = (): void => {
        errorCode.value = null
        errorMessage.value = null
    }

    /**
     * 清空小说状态
     */
    const clearNovels = (): void => {
        novels.value = []
        folders.value = []
        files.value = []
        currentNovel.value = null
        currentFolder.value = null
        currentFile.value = null
        folderList.value = []
        folderTree.value = []
        errorCode.value = null
        errorMessage.value = null
        loading.value = false
    }

    /**
     * 清空文件夹状态
     */
    const clearFolders = (): void => {
        folderList.value = []
        currentFolder.value = null
        folderTree.value = []
        errorCode.value = null
        errorMessage.value = null
        loading.value = false
    }

    return {
        // === 状态 ===
        novels,
        folders,
        files,
        currentNovel,
        currentFolder,
        currentFile,
        folderList,
        folderTree,
        loading,
        errorCode,
        errorMessage,

        // === 计算属性 ===
        getNovels,
        getFolders,
        getFiles,
        getCurrentNovel,
        getCurrentFolder,
        getCurrentFile,
        getFolderList,
        getFolderTree,
        isLoading,
        getError,
        novelCount,
        activeNovels,
        deletedNovels,
        folderCount,
        activeFolders,
        deletedFolders,
        hiddenFolders,

        // === 小说相关方法 ===
        createNovel,
        getNovelById,
        queryNovels,
        updateNovel,
        deleteNovel,
        getFoldersAndFilesList,
        createNovelFile,
        getNovelFileById,
        updateNovelFile,
        deleteNovelFile,
        queryFiles,
        batchMoveChapters,

        // === 文件夹相关方法 ===
        createFolder,
        getFolderInfoById,
        queryFolders,
        getFolderTreeWithStats,
        updateFolder,
        deleteFolder,
        batchMoveFolders,

        // === 通用方法 ===
        clearError,
        clearNovels,
        clearFolders
    }
})