import { resourceSyncService } from "@/main/core/services/resource-sync.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { ApiResponse } from "@/shared/types";
import type { SyncStatus, SyncResult } from "@/shared/types/resource.types";
import { Logger } from "@/main/utils/logger";

async function getSyncStatus(): Promise<ApiResponse<SyncStatus>> {
  try {
    return response.success(resourceSyncService.getStatus());
  } catch (error) {
    Logger.error("获取资源同步状态失败", { error: String(error) });
    return response.error(ErrorCode.RESOURCE_SYNC_FAILED, error as Error);
  }
}

async function syncNow(): Promise<ApiResponse<SyncResult>> {
  try {
    return response.success(await resourceSyncService.checkAndSync());
  } catch (error) {
    Logger.error("手动触发资源同步失败", { error: String(error) });
    return response.error(ErrorCode.RESOURCE_SYNC_FAILED, error as Error);
  }
}

export { getSyncStatus, syncNow };
