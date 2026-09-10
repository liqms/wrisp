import { ProjectDao } from "@/main/core/db";
import { workProfileStore } from "@/main/core/services/work-profile.store";
import { answersToWorkBrief } from "@/main/core/services/work-intake";
import { projectSkillStore } from "@/main/core/skills/project-skill.store";
import { skillManager } from "@/main/core/skills/skill.manager";
import { deriveWorkSkill } from "@/main/core/skills/work-skill.deriver";
import { Logger } from "@/main/utils/logger";
import type { ProjectType } from "@/shared/enums/project.enums";
import type { WorkBrief } from "@/shared/types";

/** 默认派生为作品技能的全局技能模板 */
const DEFAULT_TEMPLATE_SKILL_IDS = ["outline", "continue", "polish"];

/**
 * 作品创建收尾。
 *
 * 流程：写入作品简报 → 自动从全局技能派生作品技能。
 * **无确认门**：作品 skill 是"完成新建作品"的同步副作用（spec §5.1），
 * 不需要用户逐个过目；派生出的副本之后可独立编辑。
 */
class WorkCreationService {
  private static instance: WorkCreationService | null = null;
  private projectDao = new ProjectDao();

  public static getInstance(): WorkCreationService {
    if (!WorkCreationService.instance) {
      WorkCreationService.instance = new WorkCreationService();
    }
    return WorkCreationService.instance;
  }

  public finishCreation(
    projectId: string,
    answers: Record<string, string>,
  ): { brief: WorkBrief; derivedSkillIds: string[] } {
    const project = this.projectDao.findById(projectId);
    if (!project?.file_path) {
      throw new Error(`PROJECT_NOT_FOUND: ${projectId}`);
    }
    const projectFilePath = project.file_path;

    const brief = answersToWorkBrief(
      (project.type ?? "novel") as ProjectType,
      answers,
    );
    workProfileStore.merge(projectFilePath, { brief });

    const derivedSkillIds: string[] = [];
    for (const templateId of DEFAULT_TEMPLATE_SKILL_IDS) {
      const source = skillManager.getSkillDefinition(templateId);
      if (!source) continue; // 全局技能缺失时跳过，不阻断作品创建

      const targetId = `work-${templateId}`;
      try {
        projectSkillStore.write(
          projectFilePath,
          deriveWorkSkill(source, brief, targetId),
        );
        derivedSkillIds.push(targetId);
      } catch (error) {
        Logger.warn("[WorkCreationService] 作品技能写入失败，已跳过", {
          templateId,
          error: String(error),
        });
      }
    }

    return { brief, derivedSkillIds };
  }
}

export const workCreationService = WorkCreationService.getInstance();
