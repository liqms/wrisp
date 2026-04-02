import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import { notificationService } from '@/main/core/services/notification.service'
import { NotificationOptions } from '@/shared/types'
import type { ApiResponse } from "@/shared/types";

async function notificationInfo(message: string, options?: NotificationOptions): Promise<ApiResponse<void>> {
    try {
        notificationService.info(message, options)
        return response.empty();
    } catch (error) {
        return response.error(ErrorCode.NOTIFICATION_ERROR, error as Error);
    }

}

async function notificationError(message: string, options?: NotificationOptions): Promise<ApiResponse<void>> {
    try {
        notificationService.error(message, options)
        return response.empty();
    } catch (error) {
        return response.error(ErrorCode.NOTIFICATION_ERROR, error as Error);
    }
}

async function notificationSuccess(message: string, options?: NotificationOptions): Promise<ApiResponse<void>> {
    try {
        notificationService.success(message, options)
        return response.empty();
    } catch (error) {
        return response.error(ErrorCode.NOTIFICATION_ERROR, error as Error);
    }
}

async function notificationWarning(message: string, options?: NotificationOptions): Promise<ApiResponse<void>> {
    try {
        notificationService.warning(message, options)
        return response.empty();
    } catch (error) {
        return response.error(ErrorCode.NOTIFICATION_ERROR, error as Error);
    }
}

export { notificationInfo, notificationError, notificationSuccess, notificationWarning }
