export enum ErrorCode {
  // ============ 成功 ============
  SUCCESS = "ERROR.SUCCESS",
  // ============ 通用错误============
  COMMON_UNKNOWN = "ERROR.COMMON.UNKNOWN",
  COMMON_INVALID_PARAMETER = "ERROR.COMMON.INVALID_PARAMETER",
  COMMON_ACTION_ERROR = "ERROR.COMMON.ACTION_ERROR",
  // ============ 配置错误 ============
  CONFIG_GET_FAILED = "ERROR.CONFIG.GET_FAILED",
  CONFIG_UPDATE_FAILED = "ERROR.CONFIG.UPDATE_FAILED",
  CONFIG_RESET_FAILED = "ERROR.CONFIG.RESET_FAILED",
  CONFIG_KEY_PATH_INVALID = "ERROR.CONFIG.KEY_PATH_INVALID",
  // ============ Webview 错误 ============
  WEBVIEW_CREATE_FAILED = "ERROR.WEBVIEW.CREATE_FAILED",
  WEBVIEW_LOAD_FAILED = "ERROR.WEBVIEW.LOAD_FAILED",
  WEBVIEW_RELOAD_FAILED = "ERROR.WEBVIEW.RELOAD_FAILED",
  WEBVIEW_DESTROY_FAILED = "ERROR.WEBVIEW.DESTROY_FAILED",
  WEBVIEW_GO_BACK_FAILED = "ERROR.WEBVIEW.GO_BACK_FAILED",
  WEBVIEW_GO_FORWARD_FAILED = "ERROR.WEBVIEW.GO_FORWARD_FAILED",
  WEBVIEW_GET_NAVIGATION_STATE_FAILED = "ERROR.WEBVIEW.GET_NAVIGATION_STATE_FAILED",
  WEBVIEW_URL_EMPTY = "ERROR.WEBVIEW.URL_EMPTY",
  WEBVIEW_FUNCTION_NOT_AVAILABLE = "ERROR.WEBVIEW.FUNCTION_NOT_AVAILABLE",
  WEBVIEW_RESIZE_FAILED = "ERROR.WEBVIEW.RESIZE_FAILED",
  WEBVIEW_HIDE_FAILED = "ERROR.WEBVIEW.HIDE_FAILED",

  // ============ 记录错误 ===========
  CAPTURE_CREATE_FAILED = "ERROR.CAPTURE.CREATE_FAILED",
  CAPTURE_GET_FAILED = "ERROR.CAPTURE.GET_FAILED",
  CAPTURE_UPDATE_FAILED = "ERROR.CAPTURE.UPDATE_FAILED",
  CAPTURE_DELETE_FAILED = "ERROR.CAPTURE.DELETE_FAILED",
  CAPTURE_QUERY_FAILED = "ERROR.CAPTURE.QUERY_FAILED",
  CAPTURE_NOT_FOUND = "ERROR.CAPTURE.NOT_FOUND",
  CAPTURE_COUNT_FAILED = "ERROR.CAPTURE.COUNT_FAILED",

  // ============ 日志错误 ============
  LOG_CREATE_FAILED = "ERROR.LOG.CREATE_FAILED",

  // ============ 通知错误 ============
  NOTIFICATION_ADD_ERROR = "ERROR.NOTIFICATION.ADD_ERROR",
  // ============ 系统错误 ============
  SYSTEM_GET_INFO_FAILED = "ERROR.SYSTEM.GET_INFO_FAILED",
  SYSTEM_OPEN_DIALOG_ERROR = "ERROR.SYSTEM.OPEN_DIALOG_ERROR",
}

/**
 * 错误分类类型
 */
export type ErrorCategory =
  | "COMMON" // 通用错误
  | "CONFIG" // 配置错误
  | "WEBVIEW" // Webview 错误
  | "CAPTURE" // 记录错误
  | "LOG" // 日志错误
  | "NOTIFICATION" // 通知错误
  | "AGENT" // 智能体错误
  | "SYSTEM" // 系统错误
  | "UNKNOWN" // 未知分类
  | "SUCCESS"; // 成功分类

/**
 * 根据错误代码获取错误分类
 * @param errorCode - 错误代码
 * @returns 错误分类
 */
export function getErrorCategory(errorCode: ErrorCode): ErrorCategory {
  // 提取首个下划线前的字符串
  const category = errorCode.split("_")[0];

  // 根据分类字符串返回对应的错误分类
  switch (category) {
    case "COMMON":
      return "COMMON";
    case "CONFIG":
      return "CONFIG";
    case "WEBVIEW":
      return "WEBVIEW";
    case "CAPTURE":
      return "CAPTURE";
    case "LOG":
      return "LOG";
    case "NOTIFICATION":
      return "NOTIFICATION";
    case "SYSTEM":
      return "SYSTEM";
    case "AGENT":
      return "AGENT";
    case "SUCCESS":
      return "SUCCESS";
    default:
      return "UNKNOWN";
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
    CAPTURE: [],
    LOG: [],
    NOTIFICATION: [],
    AGENT: [],
    SYSTEM: [],
    UNKNOWN: [],
    SUCCESS: [],
  };

  // 遍历所有错误代码，按分类分组
  Object.values(ErrorCode).forEach((errorCode) => {
    const category = getErrorCategory(errorCode);
    categoryMap[category].push(errorCode);
  });

  return categoryMap;
}

/**
 * 获取指定分类的所有错误代码
 * @param category - 错误分类
 * @returns 该分类下的所有错误代码
 */
export function getErrorCodesByCategory(category: ErrorCategory): ErrorCode[] {
  const categoryMap = getErrorCategoryMap();
  return categoryMap[category] || [];
}

/**
 * 检查错误代码是否属于指定分类
 * @param errorCode - 错误代码
 * @param category - 错误分类
 * @returns 是否属于该分类
 */
export function isErrorCodeInCategory(
  errorCode: ErrorCode,
  category: ErrorCategory,
): boolean {
  return getErrorCategory(errorCode) === category;
}
