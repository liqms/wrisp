import type { ApiResponse } from "@/shared/types";
import type { SkillListItem, CategoryNode, SkillUpdateItem } from "@/shared/types/skill.types";

export interface SkillAPI {
  getSkills(): Promise<ApiResponse<SkillListItem[]>>;
  getSkill(id: string): Promise<ApiResponse<SkillListItem>>;
  getSkillsByCategory(category: string): Promise<ApiResponse<SkillListItem[]>>;
  getCategories(): Promise<ApiResponse<CategoryNode[]>>;
  execute(skillId: string, inputs: Record<string, unknown>): Promise<ApiResponse<string>>;
  createCustomSkill(definition: Record<string, unknown>): Promise<ApiResponse<void>>;
  updateCustomSkill(id: string, definition: Record<string, unknown>): Promise<ApiResponse<void>>;
  deleteCustomSkill(id: string): Promise<ApiResponse<void>>;
  setSkillEnabled(id: string, enabled: boolean): Promise<ApiResponse<void>>;
  checkSkillUpdates(): Promise<ApiResponse<SkillUpdateItem[]>>;
  applySkillUpdates(): Promise<ApiResponse<void>>;
}