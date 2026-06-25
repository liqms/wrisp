import { ipcMain } from "electron";
import {
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
} from "@/main/core/apis/skill.api";
import type { ApiResponse } from "@/shared/types";
import type { SkillListItem, CategoryNode, SkillUpdateItem, SkillExecuteResult, SkillExecutionRecord } from "@/shared/types/skill.types";

export function registerSkillHandlers() {
  ipcMain.handle("skill:getSkills", async (): Promise<ApiResponse<SkillListItem[]>> => {
    return getSkills();
  });

  ipcMain.handle("skill:getSkill", async (_, id: string): Promise<ApiResponse<SkillListItem>> => {
    return getSkill(id);
  });

  ipcMain.handle(
    "skill:getSkillsByCategory",
    async (_, category: string): Promise<ApiResponse<SkillListItem[]>> => {
      return getSkillsByCategory(category);
    },
  );

  ipcMain.handle("skill:getCategories", async (): Promise<ApiResponse<CategoryNode[]>> => {
    return getCategories();
  });

  ipcMain.handle(
    "skill:execute",
    async (_, skillId: string, inputs: Record<string, unknown>): Promise<ApiResponse<SkillExecuteResult>> => {
      return executeSkill(skillId, inputs);
    },
  );

  ipcMain.handle(
    "skill:createCustomSkill",
    async (_, definition: Record<string, unknown>): Promise<ApiResponse<void>> => {
      return createCustomSkill(definition);
    },
  );

  ipcMain.handle(
    "skill:updateCustomSkill",
    async (_, id: string, definition: Record<string, unknown>): Promise<ApiResponse<void>> => {
      return updateCustomSkill(id, definition);
    },
  );

  ipcMain.handle(
    "skill:deleteCustomSkill",
    async (_, id: string): Promise<ApiResponse<void>> => {
      return deleteCustomSkill(id);
    },
  );

  ipcMain.handle(
    "skill:setSkillEnabled",
    async (_, id: string, enabled: boolean): Promise<ApiResponse<void>> => {
      return setSkillEnabled(id, enabled);
    },
  );

  ipcMain.handle("skill:checkSkillUpdates", async (): Promise<ApiResponse<SkillUpdateItem[]>> => {
    return checkSkillUpdates();
  });

  ipcMain.handle("skill:applySkillUpdates", async (): Promise<ApiResponse<void>> => {
    return applySkillUpdates();
  });

  ipcMain.handle(
    "skill:getSkillExecutions",
    async (_, skillId?: string, limit?: number): Promise<ApiResponse<SkillExecutionRecord[]>> => {
      return getSkillExecutions(skillId, limit);
    },
  );

  ipcMain.handle(
    "skill:getSkillExecutionStats",
    async (_, skillId?: string): Promise<ApiResponse<{ total: number; succeeded: number; failed: number; avgTimeMs: number }>> => {
      return getSkillExecutionStats(skillId);
    },
  );
}