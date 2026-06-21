/**
 * 错误处理工具类
 * 提供统一的错误消息获取和错误处理功能
 */
import { ErrorCode, getErrorCategory } from "@/shared/enums";
import { i18n } from "@/renderer/plugins/i18n";
import {
  useFrontendNotification,
} from "@/renderer/composables/useNotification";

/**
 * 根据错误代码获取本地化错误消息
 * @param errorCode - 错误代码
 * @returns 本地化错误消息
 */
export function getErrorMessage(errorCode: ErrorCode | null): string {
  try {
    // 使用类型断言解决 i18n 实例的类型问题
    const t = i18n.global.t as (key: string) => string | string[];

    if (!errorCode) {
      const message = t("ERROR.COMMON_UNKNOWN");
      return Array.isArray(message) ? message[0] : message;
    }

    // 将 ErrorCode 转换为 i18n 键名
    const i18nKey = `${errorCode}`;
    const message = t(i18nKey);

    // 如果找不到对应的翻译，使用备用消息
    if (Array.isArray(message) ? message[0] !== i18nKey : message !== i18nKey) {
      return Array.isArray(message) ? message[0] : message;
    }
    const fallbackMessage = t("ERROR.COMMON_UNKNOWN");
    return Array.isArray(fallbackMessage)
      ? fallbackMessage[0]
      : fallbackMessage;
  } catch {
    // i18n 未初始化时返回默认英文消息
    if (!errorCode) {
      return "Unknown error";
    }
    return `Error: ${errorCode}`;
  }
}

/**
 * 处理 API 响应错误
 * @param response - API 响应对象
 * @param defaultMessage - 默认错误消息
 * @returns 错误消息
 */
export function handleApiError(
  response: { success: boolean; code?: ErrorCode },
  notification = false,
): string {
  let message = "";
  let category = "";
  const notify = useFrontendNotification({
    title: category,
    content: message,
  });
  if (!response.success) {
    if (response.code) {
      message = getErrorMessage(response.code);
      category = getErrorCategory(response.code);
      if (notification) {
        notify.error(category, message);
      }
      return message;
    }
    message = getErrorMessage(ErrorCode.COMMON_UNKNOWN);
    category = getErrorCategory(ErrorCode.COMMON_UNKNOWN);
    if (notification) {
      notify.error(category, message);
    }
    return message;
  }

  category = getErrorCategory(ErrorCode.SUCCESS);

  if (response.code) {
    message = getErrorMessage(response.code);
  } else {
    message = getErrorMessage(ErrorCode.SUCCESS);
  }

  if (notification) {
    notify.success(category, message);
  }
  return message;
}
