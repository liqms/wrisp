import { ipcRenderer } from "electron";
import type { TagAPI } from "../types/tag";
import type {
  Tag,
  TagCreate,
  TagUpdate,
  TagDetail,
  TagId,
  ApiResponse,
} from "@/shared/types";

export const tagModule: TagAPI = {
  getDetailById: (id: TagId) =>
    ipcRenderer.invoke("tag:getDetail", id) as Promise<
      ApiResponse<TagDetail | null>
    >,
  findTags: (
    name: string,
    options?: { exact?: boolean; limit?: number },
  ) =>
    ipcRenderer.invoke("tag:find", name, options) as Promise<
      ApiResponse<Tag[]>
    >,
  getAllTags: (entityType?: string) =>
    ipcRenderer.invoke("tag:getAll", entityType) as Promise<
      ApiResponse<TagDetail[]>
    >,
  paginateTags: (params) =>
    ipcRenderer.invoke("tag:paginate", params) as Promise<ApiResponse<unknown>>,
  createTags: (data: TagCreate | TagCreate[]) =>
    ipcRenderer.invoke("tag:create", data) as Promise<
      ApiResponse<string | string[]>
    >,
  updateTag: (
    items:
      | { id: TagId; data: TagUpdate }
      | { id: TagId; data: TagUpdate }[],
  ) =>
    ipcRenderer.invoke("tag:update", items) as Promise<
      ApiResponse<number | number[]>
    >,
  deleteTag: (ids: TagId | TagId[]) =>
    ipcRenderer.invoke("tag:delete", ids) as Promise<ApiResponse<number>>,
};