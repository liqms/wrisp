import type {
  AppConfig,
  ApiResponse,
  SystemInfo,
  NotificationLevel,
  NavigationState,
  WebContentViewOptions,
  NotificationMessage,
  CaptureCreate,
  CaptureUpdate,
  CaptureQuery,
  CaptureListItem,
  CaptureDetail,
  CaptureDateListItem,
  Id,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  CostRecord,
  CostSummary,
} from "@/shared/types";
import type { LOG_LEVEL, SearchType } from "@/shared/enums";
import type { LogContext } from "@/main/utils/logger";
import type { OpenDialogOptions, OpenDialogReturnValue } from "electron";
import type { Project, ProjectCreate, ProjectUpdate, ProjectQuery, ProjectDetail } from "@/main/types/db";
import type { Tag, TagCreate, TagUpdate, TagQuery, TagDetail, TagId } from "@/shared/types";
import type { PaginationResult } from "@/shared/utils/pagination";
import type { ModelType } from "@/shared/types/model.types";

// 定义 IPC API 接口类型（与 preload.ts 保持一致）
export interface ElectronAPI {
  // 配置管理
  config: {
    get(): Promise<ApiResponse<AppConfig>>;
    getValue(keyPath: string): Promise<ApiResponse<any>>;
    setValue(keyPath: string, value: any): Promise<ApiResponse<void>>;
    reset(): Promise<ApiResponse<void>>;
    setWorkspace(workspacePath: string): Promise<ApiResponse<void>>;
  };

  // 窗口控制
  window: {
    minimize(): Promise<void>;
    maximize(): Promise<void>;
    close(): Promise<void>;
    isMaximized(): Promise<boolean>;
  };

  // 系统功能
  system: {
    getSystemInfo(): Promise<ApiResponse<SystemInfo>>;
    showSystemNotification(
      level: NotificationLevel,
      title: string,
      body: string,
    ): Promise<ApiResponse<void>>;
    openDialog(
      options: OpenDialogOptions,
    ): Promise<ApiResponse<OpenDialogReturnValue>>;
    openExternal(url: string): Promise<ApiResponse<void>>;
  };

  // 日志管理
  logger: {
    error(message: string, context?: LogContext): Promise<ApiResponse<void>>;
    warn(message: string, context?: LogContext): Promise<ApiResponse<void>>;
    info(message: string, context?: LogContext): Promise<ApiResponse<void>>;
    debug(message: string, context?: LogContext): Promise<ApiResponse<void>>;
    log(
      level: LOG_LEVEL,
      message: string,
      context?: LogContext,
    ): Promise<ApiResponse<void>>;
  };

  // WebView 相关
  webview: {
    create(
      url: string,
      options?: WebContentViewOptions,
    ): Promise<ApiResponse<void>>;
    reload(): Promise<ApiResponse<void>>;
    destroy(): Promise<ApiResponse<void>>;
    hide(): Promise<ApiResponse<void>>;
    resize(options: WebContentViewOptions): Promise<ApiResponse<void>>;
    goBack(): Promise<ApiResponse<void>>;
    goForward(): Promise<ApiResponse<void>>;
    getNavigationState(): Promise<ApiResponse<NavigationState>>;
  };
  // Capture 相关
  capture: {
    createCapture(
      record: CaptureCreate,
    ): Promise<ApiResponse<CaptureDetail | null>>;
    updateCapture(
      record: CaptureUpdate,
    ): Promise<ApiResponse<CaptureDetail | null>>;
    getRecentCaptures(limit?: number): Promise<ApiResponse<CaptureListItem[]>>;
    deleteCapture(id: Id): Promise<ApiResponse<null>>;
    searchCaptures(
      keyword: string,
      limit?: number,
      searchType?: SearchType,
      parent_record_id?: Id | null,
    ): Promise<ApiResponse<CaptureListItem[]>>;
    listCaptures(query?: CaptureQuery): Promise<ApiResponse<CaptureListItem[]>>;
    getCapturesByDateRange(
      startDate: string,
      endDate: string,
    ): Promise<ApiResponse<CaptureDateListItem[]>>;
  };
  // Project 相关
  project: {
    get(id: string): Promise<ApiResponse<ProjectDetail | null>>;
    paginate(params: {
      page?: number;
      pageSize?: number;
      orderBy?: string;
      orderDir?: "ASC" | "DESC";
      conditions?: ProjectQuery;
    }): Promise<ApiResponse<PaginationResult<ProjectDetail>>>;
    create(data: ProjectCreate): Promise<ApiResponse<string>>;
    update(id: string, data: ProjectUpdate): Promise<ApiResponse<number>>;
    delete(id: string): Promise<ApiResponse<number>>;
    checkNameExists(
      name: string,
      excludeId?: string,
    ): Promise<ApiResponse<boolean>>;
  };
  // Model 相关
  model: {
    getConfig(): Promise<ApiResponse<ModelConfig>>;
    getValue(keyPath: string): Promise<ApiResponse<any>>;
    setValue(keyPath: string, value: any): Promise<ApiResponse<void>>;
    resetConfig(): Promise<ApiResponse<void>>;
    downloadModel(type: ModelType): Promise<ApiResponse<string>>;
    checkModelExist(): Promise<ApiResponse<Record<string, boolean>>>;
    reDownloadModel(type: ModelType): Promise<ApiResponse<void>>;
    cancelDownload(groupId: string): Promise<ApiResponse<void>>;
  };

  // AI 网关相关
  ai: {
    chatCompletion(request: LLMRequest): Promise<ApiResponse<LLMResponse>>;
    chatCompletionStream(request: LLMRequest): Promise<ApiResponse<null>>;
    onChatStreamChunk(callback: (chunk: LLMStreamChunk) => void): () => void;
    onChatStreamDone(callback: () => void): () => void;
    onChatStreamError(callback: (error: string) => void): () => void;
    getCostSummary(): Promise<ApiResponse<CostSummary>>;
    getCostRecords(count?: number): Promise<ApiResponse<CostRecord[]>>;
    getProviders(): Promise<ApiResponse<Array<{ providerId: string; providerName: string; models: any[]; isHealthy: boolean; enabled: boolean }>>>;
    testProviderConnection(providerId: string): Promise<ApiResponse<boolean>>;
    refreshConfig(): Promise<ApiResponse<void>>;
    isLocalAvailable(): Promise<ApiResponse<boolean>>;
    isCloudAvailable(): Promise<ApiResponse<boolean>>;
    getRouteStatus(): Promise<ApiResponse<Record<string, unknown>>>;
  };

  // Tag 相关
  tag: {
    getDetailById(id: TagId): Promise<ApiResponse<TagDetail | null>>;
    findTags(name: string, options?: { exact?: boolean; limit?: number }): Promise<ApiResponse<Tag[]>>;
    getAllTags(entityType?: string): Promise<ApiResponse<TagDetail[]>>;
    paginateTags(params: {
      page?: number;
      pageSize?: number;
      orderBy?: string;
      orderDir?: "ASC" | "DESC";
      conditions?: TagQuery;
    }): Promise<ApiResponse<any>>;
    createTags(data: TagCreate | TagCreate[]): Promise<ApiResponse<string | string[]>>;
    updateTag(items: { id: TagId; data: TagUpdate } | { id: TagId; data: TagUpdate }[]): Promise<ApiResponse<number | number[]>>;
    deleteTag(ids: TagId | TagId[]): Promise<ApiResponse<number>>;
  };

  // 通用 IPC 方法（保持向后兼容）
  send: (channel: string, data: any) => void;
  on: (channel: string, callback: (data: any) => void) => void;
  off: (channel: string) => void;
  onNotification: (
    callback: (notification: NotificationMessage) => void,
  ) => () => void;
  removeNotificationListener: () => void;
}

// 扩展 Window 接口，将 electronAPI 添加到全局 window 对象
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }

  // Electron <webview> 标签类型声明
  interface HTMLElementTagNameMap {
    webview: Electron.WebviewTag;
  }
}
