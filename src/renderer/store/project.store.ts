import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { ApiResponse } from "@/shared/types";
import type {
    ProjectCreate,
    ProjectUpdate,
    ProjectQuery,
    ProjectDetail,
} from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";
import { ErrorCode } from "@/shared/enums";
import { handleApiError } from "@/renderer/utils/error.utils";

export const useProjectStore = defineStore("project", () => {
    const projects = ref<ProjectDetail[]>([]);
    const currentProject = ref<ProjectDetail | null>(null);
    const loading = ref(false);
    const errorCode = ref<ErrorCode | null>(null);
    const errorMessage = ref<string | null>(null);
    const pagination = ref<{
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
        startIndex: number;
        endIndex: number;
    } | null>(null);

    const hasError = computed(() => errorCode.value !== null);
    const isReady = computed(() => !loading.value && !hasError.value);

    /**
     * 分页查询作品
     */
    const paginateProjects = async (params: {
        page?: number;
        pageSize?: number;
        orderBy?: string;
        orderDir?: "ASC" | "DESC";
        conditions?: ProjectQuery;
    }): Promise<void> => {
        loading.value = true;
        errorCode.value = null;
        errorMessage.value = null;

        try {
            const response = (await window.electronAPI.project.paginate(
                params,
            )) as ApiResponse<PaginationResult<ProjectDetail>>;

            if (response.success && response.data) {
                const result = response.data as PaginationResult<ProjectDetail>;
                projects.value = result.data;
                pagination.value = {
                    total: result.total,
                    page: result.page,
                    pageSize: result.pageSize,
                    totalPages: result.totalPages,
                    hasNext: result.hasNext,
                    hasPrev: result.hasPrev,
                    startIndex: result.startIndex,
                    endIndex: result.endIndex,
                };
            } else {
                errorCode.value = response.code;
                errorMessage.value = handleApiError(response);
            }
        } catch {
            errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
            errorMessage.value = handleApiError({
                success: false,
                code: errorCode.value,
            });
        } finally {
            loading.value = false;
        }
    };

    /**
     * 获取作品详情（含统计和标签）
     */
    const getProjectDetail = async (
        id: string,
    ): Promise<ProjectDetail | null> => {
        loading.value = true;
        errorCode.value = null;
        errorMessage.value = null;

        try {
            const response = (await window.electronAPI.project.get(
                id,
            )) as ApiResponse<ProjectDetail | null>;

            if (response.success && response.data) {
                currentProject.value = response.data as ProjectDetail;
                return currentProject.value;
            } else {
                errorCode.value = response.code;
                errorMessage.value = handleApiError(response);
                return null;
            }
        } catch {
            errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
            errorMessage.value = handleApiError({
                success: false,
                code: errorCode.value,
            });
            return null;
        } finally {
            loading.value = false;
        }
    };

    /**
     * 创建作品
     */
    const createProject = async (data: ProjectCreate): Promise<string | null> => {
        loading.value = true;
        errorCode.value = null;
        errorMessage.value = null;

        try {
            const response = (await window.electronAPI.project.create(
                data,
            )) as ApiResponse<string>;

            if (response.success && response.data) {
                return response.data as string;
            } else {
                errorCode.value = response.code;
                errorMessage.value = handleApiError(response);
                return null;
            }
        } catch {
            errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
            errorMessage.value = handleApiError({
                success: false,
                code: errorCode.value,
            });
            return null;
        } finally {
            loading.value = false;
        }
    };

    /**
     * 更新作品
     */
    const updateProject = async (
        id: string,
        data: ProjectUpdate,
    ): Promise<boolean> => {
        loading.value = true;
        errorCode.value = null;
        errorMessage.value = null;

        try {
            const response = (await window.electronAPI.project.update(
                id,
                data,
            )) as ApiResponse<number>;

            if (response.success && response.data && response.data as number > 0) {
                // 重新从后端获取完整的作品详情（含完整的 tag 对象）
                const detailResponse = await window.electronAPI.project.get(id) as ApiResponse<ProjectDetail | null>;
                if (detailResponse.success && detailResponse.data) {
                    const detail = detailResponse.data as ProjectDetail;
                    if (currentProject.value && currentProject.value.id === id) {
                        currentProject.value = detail;
                    }
                    projects.value = projects.value.map((p) =>
                        p.id === id ? detail : p,
                    );
                }
                return true;
            } else {
                errorCode.value = response.code;
                errorMessage.value = handleApiError(response);
                return false;
            }
        } catch {
            errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
            errorMessage.value = handleApiError({
                success: false,
                code: errorCode.value,
            });
            return false;
        } finally {
            loading.value = false;
        }
    };

    /**
     * 删除作品
     */
    const deleteProject = async (id: string): Promise<boolean> => {
        loading.value = true;
        errorCode.value = null;
        errorMessage.value = null;

        try {
            const response = (await window.electronAPI.project.delete(
                id,
            )) as ApiResponse<number>;

            if (response.success && response.data && response.data as number > 0) {
                // 同步更新本地状态
                projects.value = projects.value.filter((p) => p.id !== id);
                if (currentProject.value && currentProject.value.id === id) {
                    currentProject.value = null;
                }
                return true;
            } else {
                errorCode.value = response.code;
                errorMessage.value = handleApiError(response);
                return false;
            }
        } catch {
            errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
            errorMessage.value = handleApiError({
                success: false,
                code: errorCode.value,
            });
            return false;
        } finally {
            loading.value = false;
        }
    };

    /**
     * 检查作品名称是否已存在
     */
    const checkNameExists = async (
        name: string,
        excludeId?: string,
    ): Promise<boolean> => {
        loading.value = true;
        errorCode.value = null;
        errorMessage.value = null;

        try {
            const response = (await window.electronAPI.project.checkNameExists(
                name,
                excludeId,
            )) as ApiResponse<boolean>;

            if (response.success && response.data) {
                return response.data as boolean;
            }
            return false;
        } catch {
            errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
            errorMessage.value = handleApiError({
                success: false,
                code: errorCode.value,
            });
            return false;
        } finally {
            loading.value = false;
        }
    };

    return {
        // 状态
        projects,
        currentProject,
        loading,
        errorCode,
        errorMessage,
        pagination,
        // 计算属性
        hasError,
        isReady,
        // 方法
        paginateProjects,
        getProjectDetail,
        createProject,
        updateProject,
        deleteProject,
        checkNameExists,
    };
});