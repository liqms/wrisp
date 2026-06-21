import { computed } from "vue";
import { useProjectStore } from "@/renderer/store/project.store";
import type {
  ProjectCreate,
  ProjectUpdate,
  ProjectQuery,
  ProjectDetail,
} from "@/main/types/db";
import { logger } from "@/renderer/utils/logger.utils";

export function useProject() {
  const store = useProjectStore();

  // 响应式状态
  const projects = computed(() => store.projects);
  const currentProject = computed(() => store.currentProject);
  const loading = computed(() => store.loading);
  const errorCode = computed(() => store.errorCode);
  const errorMessage = computed(() => store.errorMessage);
  const pagination = computed(() => store.pagination);
  const hasError = computed(() => store.hasError);
  const isReady = computed(() => store.isReady);


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
    try {
      await store.paginateProjects(params);
      logger.info("分页查询作品成功", {
        page: params.page,
        pageSize: params.pageSize,
        count: projects.value.length,
      });
    } catch (error) {
      logger.error("分页查询作品失败", { error, params });
    }
  };

  /**
   * 获取作品详情（含统计和标签）
   */
  const getProjectDetail = async (
    id: string,
  ): Promise<ProjectDetail | null> => {
    try {
      const result = await store.getProjectDetail(id);
      if (result) {
        logger.info("获取作品详情成功", { id });
      }
      return result;
    } catch (error) {
      logger.error("获取作品详情失败", { error, id });
      return null;
    }
  };

  /**
   * 创建作品
   */
  const createProject = async (data: ProjectCreate): Promise<string | null> => {
    try {
      const id = await store.createProject(data);
      if (id) {
        logger.info("创建作品成功", { id, name: data.name });
      }
      return id;
    } catch (error) {
      logger.error("创建作品失败", { error, data });
      return null;
    }
  };

  /**
   * 更新作品
   */
  const updateProject = async (
    id: string,
    data: ProjectUpdate,
  ): Promise<boolean> => {
    try {
      const success = await store.updateProject(id, data);
      if (success) {
        logger.info("更新作品成功", { id });
      }
      return success;
    } catch (error) {
      logger.error("更新作品失败", { error, id, data });
      return false;
    }
  };

  /**
   * 删除作品
   */
  const deleteProject = async (id: string): Promise<boolean> => {
    try {
      const success = await store.deleteProject(id);
      if (success) {
        logger.info("删除作品成功", { id });
      }
      return success;
    } catch (error) {
      logger.error("删除作品失败", { error, id });
      return false;
    }
  };

  /**
   * 检查作品名称是否已存在
   */
  const checkNameExists = async (
    name: string,
    excludeId?: string,
  ): Promise<boolean> => {
    try {
      const exists = await store.checkNameExists(name, excludeId);
      return exists;
    } catch (error) {
      logger.error("检查作品名称失败", { error, name });
      return false;
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
}