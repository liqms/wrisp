import type { ApiResponse } from "@/shared/types";
import type { SyncStatus, SyncResult } from "@/shared/types/resource.types";
import type { ResourceType } from "@/shared/enums/resource.enums";

export interface ResourceAPI {
  syncStatus: () => Promise<ApiResponse<SyncStatus>>;
  syncNow: () => Promise<ApiResponse<SyncResult>>;
  onUpdated: (callback: (changedTypes: ResourceType[]) => void) => () => void;
}
