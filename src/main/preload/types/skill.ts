import type { ApiResponse } from "@/shared/types";
import type { SkillListItem, CategoryNode, SkillUpdateItem, SkillExecuteResult, SkillExecutionRecord } from "@/shared/types/skill.types";

export interface SkillAPI {
  getSkills(): Promise<ApiResponse<SkillListItem[]>>;
  getSkill(id: string): Promise<ApiResponse<SkillListItem>>;
  getSkillsByCategory(category: string): Promise<ApiResponse<SkillListItem[]>>;
  getCategories(): Promise<ApiResponse<CategoryNode[]>>;
  execute(skillId: string, inputs: Record<string, unknown>): Promise<ApiResponse<SkillExecuteResult>>;
  createCustomSkill(definition: Record<string, unknown>): Promise<ApiResponse<void>>;
  updateCustomSkill(id: string, definition: Record<string, unknown>): Promise<ApiResponse<void>>;
  deleteCustomSkill(id: string): Promise<ApiResponse<void>>;
  setSkillEnabled(id: string, enabled: boolean): Promise<ApiResponse<void>>;
  checkSkillUpdates(): Promise<ApiResponse<SkillUpdateItem[]>>;
  applySkillUpdates(): Promise<ApiResponse<void>>;
  getSkillExecutions(skillId?: string, limit?: number): Promise<ApiResponse<SkillExecutionRecord[]>>;
  getSkillExecutionStats(skillId?: string): Promise<ApiResponse<{ total: number; succeeded: number; failed: number; avgTimeMs: number }>>;
}