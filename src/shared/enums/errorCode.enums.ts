export enum ErrorCode {
  // ============ 通用错误============
  SUCCESS = 'SUCCESS',
  COMMON_UNKNOWN_ERROR = 'COMMON_UNKNOWN_ERROR',
  COMMON_INVALID_PARAMETER = 'COMMON_INVALID_PARAMETER',
  COMMON_ACTION_ERROR = 'COMMON_ACTION_ERROR',
  // ============ 配置错误 ============
  CONFIG_GET_FAILED = 'CONFIG_GET_FAILED',
  CONFIG_UPDATE_FAILED = 'CONFIG_UPDATE_FAILED',
  CONFIG_RESET_FAILED = 'CONFIG_RESET_FAILED',
  CONFIG_KEY_PATH_INVALID = 'CONFIG_KEY_PATH_INVALID',
  // ============ Webview 错误 ============
  WEBVIEW_CREATE_FAILED = 'WEBVIEW_CREATE_FAILED',
  WEBVIEW_LOAD_FAILED = 'WEBVIEW_LOAD_FAILED',
  WEBVIEW_RELOAD_FAILED = 'WEBVIEW_RELOAD_FAILED',
  WEBVIEW_DESTROY_FAILED = 'WEBVIEW_DESTROY_FAILED',
  WEBVIEW_GO_BACK_FAILED = 'WEBVIEW_GO_BACK_FAILED',
  WEBVIEW_GO_FORWARD_FAILED = 'WEBVIEW_GO_FORWARD_FAILED',
  WEBVIEW_GET_NAVIGATION_STATE_FAILED = 'WEBVIEW_GET_NAVIGATION_STATE_FAILED',
  WEBVIEW_URL_EMPTY = 'WEBVIEW_URL_EMPTY',
  WEBVIEW_FUNCTION_NOT_AVAILABLE = 'WEBVIEW_FUNCTION_NOT_AVAILABLE',

  // ============ 小说作品错误 ===========
  WORK_CREATE_FAILED = 'WORK_CREATE_FAILED',
  WORK_GET_FAILED = 'WORK_GET_FAILED',
  WORK_UPDATE_FAILED = 'WORK_UPDATE_FAILED',
  WORK_DELETE_FAILED = 'WORK_DELETE_FAILED',
  WORK_DESTROY_FAILED = 'WORK_DESTROY_FAILED',
  WORK_QUERY_FAILED = 'WORK_QUERY_FAILED',
  WORK_NOT_FOUND = 'WORK_NOT_FOUND',
  WORK_PATH_INVALID = 'WORK_PATH_INVALID',
  WORK_COUNT_FAILED = 'WORK_COUNT_FAILED',

  // ============ 文件夹错误 ===========
  FOLDER_CREATE_FAILED = 'FOLDER_CREATE_FAILED',
  FOLDER_GET_FAILED = 'FOLDER_GET_FAILED',
  FOLDER_UPDATE_FAILED = 'FOLDER_UPDATE_FAILED',
  FOLDER_DELETE_FAILED = 'FOLDER_DELETE_FAILED',
  FOLDER_DESTROY_FAILED = 'FOLDER_DESTROY_FAILED',
  FOLDER_QUERY_FAILED = 'FOLDER_QUERY_FAILED',
  FOLDER_GET_TREE_FAILED = 'FOLDER_GET_TREE_FAILED',
  FOLDER_BATCH_UPDATE_FAILED = 'FOLDER_BATCH_UPDATE_FAILED',
  FOLDER_NOT_FOUND = 'FOLDER_NOT_FOUND',
  FOLDER_PATH_INVALID = 'FOLDER_PATH_INVALID',
  FOLDER_COUNT_FAILED = 'FOLDER_COUNT_FAILED',

  // ============ 文件错误 ============
  FILE_CREATE_FAILED = 'FILE_CREATE_FAILED',
  FILE_GET_FAILED = 'FILE_GET_FAILED',
  FILE_UPDATE_FAILED = 'FILE_UPDATE_FAILED',
  FILE_DELETE_FAILED = 'FILE_DELETE_FAILED',
  FILE_DESTROY_FAILED = 'FILE_DESTROY_FAILED',
  FILE_QUERY_FAILED = 'FILE_QUERY_FAILED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_ADD_TAG_FAILED = 'FILE_ADD_TAG_FAILED',
  FILE_REMOVE_TAG_FAILED = 'FILE_REMOVE_TAG_FAILED',
  FILE_MOVE_FAILED = 'FILE_MOVE_FAILED',
  // ============ 小说错误 ============
  NOVEL_CREATE_FAILED = 'NOVEL_CREATE_FAILED',
  NOVEL_GET_FAILED = 'NOVEL_GET_FAILED',
  NOVEL_UPDATE_FAILED = 'NOVEL_UPDATE_FAILED',
  NOVEL_DELETE_FAILED = 'NOVEL_DELETE_FAILED',
  NOVEL_DESTROY_FAILED = 'NOVEL_DESTROY_FAILED',
  NOVEL_QUERY_FAILED = 'NOVEL_QUERY_FAILED',
  NOVEL_NOT_FOUND = 'NOVEL_NOT_FOUND',
  NOVEL_PATH_INVALID = 'NOVEL_PATH_INVALID',
  NOVEL_COUNT_FAILED = 'NOVEL_COUNT_FAILED',
  CHAPTER_CREATE_FAILED = 'CHAPTER_CREATE_FAILED',
  CHAPTER_GET_FAILED = 'CHAPTER_GET_FAILED',
  CHAPTER_UPDATE_FAILED = 'CHAPTER_UPDATE_FAILED',
  CHAPTER_DELETE_FAILED = 'CHAPTER_DELETE_FAILED',
  CHAPTER_DESTROY_FAILED = 'CHAPTER_DESTROY_FAILED',
  CHAPTER_QUERY_FAILED = 'CHAPTER_QUERY_FAILED',
  CHAPTER_NOT_FOUND = 'CHAPTER_NOT_FOUND',
  CHAPTER_PATH_INVALID = 'CHAPTER_PATH_INVALID',
  CHAPTER_COUNT_FAILED = 'CHAPTER_COUNT_FAILED',
  // ============ 其他错误 ============
  LOG_OPERATION_FAILED = 'LOG_OPERATION_FAILED',
  NOTIFICATION_ERROR = 'NOTIFICATION_ERROR',
  SYSTEM_INFO_ERROR = 'SYSTEM_INFO_ERROR',
  SYSTEM_OPEN_DIALOG_ERROR = 'SYSTEM_OPEN_DIALOG_ERROR',
}

/**
 * 错误分类类型
 */
export type ErrorCategory = 
  | 'COMMON'     // 通用错误
  | 'CONFIG'     // 配置错误
  | 'WEBVIEW'    // Webview 错误
  | 'FOLDER'     // 文件夹错误
  | 'FILE'       // 文件错误
  | 'LOG'        // 日志错误
  | 'NOTIFICATION' // 通知错误
  | 'SYSTEM'     // 系统错误
  | 'UNKNOWN'    // 未知分类

/**
 * 根据错误代码获取错误分类
 * @param errorCode - 错误代码
 * @returns 错误分类
 */
export function getErrorCategory(errorCode: ErrorCode): ErrorCategory {
  // 提取首个下划线前的字符串
  const category = errorCode.split('_')[0]
  
  // 根据分类字符串返回对应的错误分类
  switch (category) {
    case 'COMMON':
      return 'COMMON'
    case 'CONFIG':
      return 'CONFIG'
    case 'WEBVIEW':
      return 'WEBVIEW'
    case 'FOLDER':
      return 'FOLDER'
    case 'FILE':
      return 'FILE'
    case 'LOG':
      return 'LOG'
    case 'NOTIFICATION':
      return 'NOTIFICATION'
    case 'SYSTEM':
      return 'SYSTEM'
    case 'SUCCESS':
      return 'COMMON' // SUCCESS 归类为通用错误
    default:
      return 'UNKNOWN'
  }
}

/**
 * 获取所有错误分类的映射关系
 * @returns 错误分类到错误代码数组的映射
 */
export function getErrorCategoryMap(): Record<ErrorCategory, ErrorCode[]> {
  const categoryMap: Record<ErrorCategory, ErrorCode[]> = {
    COMMON: [],
    CONFIG: [],
    WEBVIEW: [],
    FOLDER: [],
    FILE: [],
    LOG: [],
    NOTIFICATION: [],
    SYSTEM: [],
    UNKNOWN: []
  }
  
  // 遍历所有错误代码，按分类分组
  Object.values(ErrorCode).forEach(errorCode => {
    const category = getErrorCategory(errorCode)
    categoryMap[category].push(errorCode)
  })
  
  return categoryMap
}

/**
 * 获取指定分类的所有错误代码
 * @param category - 错误分类
 * @returns 该分类下的所有错误代码
 */
export function getErrorCodesByCategory(category: ErrorCategory): ErrorCode[] {
  const categoryMap = getErrorCategoryMap()
  return categoryMap[category] || []
}

/**
 * 检查错误代码是否属于指定分类
 * @param errorCode - 错误代码
 * @param category - 错误分类
 * @returns 是否属于该分类
 */
export function isErrorCodeInCategory(errorCode: ErrorCode, category: ErrorCategory): boolean {
  return getErrorCategory(errorCode) === category
}