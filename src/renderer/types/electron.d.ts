import type { AppConfig, ApiResponse, SystemInfo, NotificationLevel, NavigationState, WebContentViewOptions, CreateFolderRequest, UpdateFolderRequest, FolderQueryRequest, FolderTreeWithStats, CreateFileRequest, UpdateFileRequest, FileQueryRequest, NotificationMessage, FileAggregate, CreateNovelRequest, UpdateNovelRequest, QueryNovelRequest, NovelBaseInfo, NovelDetail, CreateNovelFileRequest, NovelFileInfo, UpdateNovelFileRequest, QueryNovelFileRequest, FoldersAndFilesList } from '@/shared/types'
import type { LogLevelEnum } from '@/shared/enums'
import type { LogContext } from '@/main/utils/logger'
import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import type { Folder, File, FileStatus, FolderStatus } from '@/main/types/db'

// 定义 IPC API 接口类型（与 preload.ts 保持一致）
export interface ElectronAPI {
  // 配置管理
  config: {
    get(): Promise<ApiResponse<AppConfig>>
    getValue(keyPath: string): Promise<ApiResponse<any>>
    setValue(keyPath: string, value: any): Promise<ApiResponse<void>>
    getStaticPath(type?: string): Promise<ApiResponse<string>>
    reset(): Promise<ApiResponse<void>>
  }

  // 窗口控制
  window: {
    minimize(): Promise<void>
    maximize(): Promise<void>
    close(): Promise<void>
    isMaximized(): Promise<boolean>
  }

  // 系统功能
  system: {
    getSystemInfo(): Promise<ApiResponse<SystemInfo>>
    showSystemNotification(level: NotificationLevel, title: string, body: string): Promise<ApiResponse<void>>
    openDialog(options: OpenDialogOptions): Promise<ApiResponse<OpenDialogReturnValue>>
  }

  // 日志管理
  logger: {
    error(message: string, context?: LogContext): Promise<ApiResponse<void>>
    warn(message: string, context?: LogContext): Promise<ApiResponse<void>>
    info(message: string, context?: LogContext): Promise<ApiResponse<void>>
    debug(message: string, context?: LogContext): Promise<ApiResponse<void>>
    log(level: LogLevelEnum, message: string, context?: LogContext): Promise<ApiResponse<void>>
  }

  // WebView 相关
  webview: {
    create(url: string, options?: WebContentViewOptions): Promise<ApiResponse<void>>
    reload(): Promise<ApiResponse<void>>
    destroy(): Promise<ApiResponse<void>>
    goBack(): Promise<ApiResponse<void>>
    goForward(): Promise<ApiResponse<void>>
    getNavigationState(): Promise<ApiResponse<NavigationState>>
  }

  // 文件夹管理
  folder: {
    create(request: CreateFolderRequest): Promise<ApiResponse<Folder>>
    getInfoById(id: number): Promise<ApiResponse<Folder>>
    query(request: FolderQueryRequest): Promise<ApiResponse<Folder[]>>
    getTreeWithStats(parentId: number): Promise<ApiResponse<FolderTreeWithStats>>
    getSubFoldersAndFiles(parentId: number): Promise<ApiResponse<FoldersAndFilesList>>
    update(id: number, request: UpdateFolderRequest): Promise<ApiResponse<number>>
    delete(id: number): Promise<ApiResponse<number>>
    batchMove(ids: number[], parentId: number): Promise<ApiResponse<number>>
  }

  // 小说管理
  novel: {
    create(request: CreateNovelRequest): Promise<ApiResponse<NovelBaseInfo>>
    getInfo(id: number): Promise<ApiResponse<NovelDetail>>
    query(request: QueryNovelRequest): Promise<ApiResponse<NovelBaseInfo[]>>
    update(id: number, request: UpdateNovelRequest): Promise<ApiResponse<boolean>>
    delete(id: number): Promise<ApiResponse<{
      worksDeleted: number
      foldersDeleted: number
      filesDeleted: number
      worksTagsDeleted: number
      fileVersionsDeleted: number
    }>>
    createFile(request: CreateNovelFileRequest): Promise<ApiResponse<NovelFileInfo>>
    queryFiles(request: QueryNovelFileRequest): Promise<ApiResponse<FolderAndFileList>>
    getFileContent(id: number): Promise<ApiResponse<NovelFileInfo>>
    updateFileContent(id: number, request: UpdateNovelFileRequest): Promise<ApiResponse<NovelFileInfo>>
    deleteFile(id: number): Promise<ApiResponse<boolean>>
    moveFiles(ids: number[], parentId: number): Promise<ApiResponse<number>>
  }

  // 通用 IPC 方法（保持向后兼容）
  send: (channel: string, data: any) => void
  on: (channel: string, callback: (data: any) => void) => void
  onNotification: (callback: (notification: NotificationMessage) => void) => void
  removeNotificationListener: () => void
}

// 扩展 Window 接口，将 electronAPI 添加到全局 window 对象
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

