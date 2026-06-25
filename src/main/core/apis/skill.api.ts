import { skillManager } from "@/main/core/skills/skill.manager";
import { skillExecutor } from "@/main/core/skills/skill.executor";
import { skillUpdater } from "@/main/core/skills/skill.updater";
import { skillExecutionDao } from "@/main/core/db/skill-execution.dao";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import { Logger } from "@/main/utils/logger";
import type { ApiResponse } from "@/shared/types";
import type { SkillListItem, CategoryNode, SkillUpdateItem, SkillDefinition, SkillExecuteResult, SkillExecutionRecord } from "@/shared/types/skill.types";

async function getSkills(): Promise<ApiResponse<SkillListItem[]>> {
  try {
    const result = skillManager.getSkills();
    return response.success(result);
  } catch (error) {
    Logger.error("获取 Skills 列表失败", { error: String(error) });
    return response.error(ErrorCode.AI_REQUEST_FAILED, error as Error);
  }
}

async function getSkill(id: string): Promise<ApiResponse<SkillListItem | null>> {
  try {
    const result = skillManager.getSkill(id);
    return response.success(result);
  } catch (error) {
    Logger.error(`获取 Skill 失败: ${id}`, { error: String(error) });
    return response.error(ErrorCode.AI_REQUEST_FAILED, error as Error);
  }
}

async function getSkillsByCategory(category: string): Promise<ApiResponse<SkillListItem[]>> {
  try {
    const result = skillManager.getSkillsByCategory(category);
    return response.success(result);
  } catch (error) {
    Logger.error(`按分类获取 Skills 失败: ${category}`, { error: String(error) });
    return response.error(ErrorCode.AI_REQUEST_FAILED, error as Error);
  }
}

async function getCategories(): Promise<ApiResponse<CategoryNode[]>> {
  try {
    const result = skillManager.getCategories();
    return response.success(result);
  } catch (error) {
    Logger.error("获取 Skill 分类失败", { error: String(error) });
    return response.error(ErrorCode.AI_REQUEST_FAILED, error as Error);
  }
}

async function executeSkill(skillId: string, inputs: Record<string, unknown>): Promise<ApiResponse<SkillExecuteResult>> {
  try {
    const result = await skillExecutor.execute(skillId, inputs);
    return response.success(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.error(`执行 Skill 失败: ${skillId}`, { error: errorMessage });
    return response.error(ErrorCode.AI_REQUEST_FAILED, error as Error);
  }
}

async function createCustomSkill(definition: SkillDefinition): Promise<ApiResponse<void>> {
  try {
    skillManager.createCustomSkill(definition);
    return response.empty();
  } catch (error) {
    Logger.error("创建自定义 Skill 失败", { error: String(error) });
    return response.error(ErrorCode.CONFIG_UPDATE_FAILED, error as Error);
  }
}

async function updateCustomSkill(id: string, definition: Partial<SkillDefinition>): Promise<ApiResponse<void>> {
  try {
    skillManager.updateCustomSkill(id, definition);
    return response.empty();
  } catch (error) {
    Logger.error(`更新自定义 Skill 失败: ${id}`, { error: String(error) });
    return response.error(ErrorCode.CONFIG_UPDATE_FAILED, error as Error);
  }
}

async function deleteCustomSkill(id: string): Promise<ApiResponse<void>> {
  try {
    skillManager.deleteCustomSkill(id);
    return response.empty();
  } catch (error) {
    Logger.error(`删除自定义 Skill 失败: ${id}`, { error: String(error) });
    return response.error(ErrorCode.CONFIG_UPDATE_FAILED, error as Error);
  }
}

async function setSkillEnabled(id: string, enabled: boolean): Promise<ApiResponse<void>> {
  try {
    skillManager.setSkillEnabled(id, enabled);
    return response.empty();
  } catch (error) {
    Logger.error(`设置 Skill 启用状态失败: ${id}`, { error: String(error) });
    return response.error(ErrorCode.CONFIG_UPDATE_FAILED, error as Error);
  }
}

async function checkSkillUpdates(): Promise<ApiResponse<SkillUpdateItem[]>> {
  try {
    const result = await skillUpdater.checkForUpdates();
    return response.success(result);
  } catch (error) {
    Logger.error("检查 Skill 更新失败", { error: String(error) });
    return response.error(ErrorCode.AI_REQUEST_FAILED, error as Error);
  }
}

async function applySkillUpdates(): Promise<ApiResponse<void>> {
  try {
    await skillUpdater.applyUpdates();
    return response.empty();
  } catch (error) {
    Logger.error("应用 Skill 更新失败", { error: String(error) });
    return response.error(ErrorCode.AI_REQUEST_FAILED, error as Error);
  }
}

async function getSkillExecutions(skillId?: string, limit?: number): Promise<ApiResponse<SkillExecutionRecord[]>> {
  try {
    let result: SkillExecutionRecord[];
    if (skillId) {
      result = skillExecutionDao.getBySkillId(skillId, limit || 20);
    } else {
      result = skillExecutionDao.getRecent(limit || 20);
    }
    return response.success(result);
  } catch (error) {
    Logger.error("获取 Skill 执行历史失败", { error: String(error) });
    return response.error(ErrorCode.AI_REQUEST_FAILED, error as Error);
  }
}

async function getSkillExecutionStats(skillId?: string): Promise<ApiResponse<{ total: number; succeeded: number; failed: number; avgTimeMs: number }>> {
  try {
    const result = skillExecutionDao.getStats(skillId);
    return response.success(result);
  } catch (error) {
    Logger.error("获取 Skill 执行统计失败", { error: String(error) });
    return response.error(ErrorCode.AI_REQUEST_FAILED, error as Error);
  }
}

export {
  getSkills,
  getSkill,
  getSkillsByCategory,
  getCategories,
  executeSkill,
  createCustomSkill,
  updateCustomSkill,
  deleteCustomSkill,
  setSkillEnabled,
  checkSkillUpdates,
  applySkillUpdates,
  getSkillExecutions,
  getSkillExecutionStats,
};