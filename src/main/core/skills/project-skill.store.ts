import * as fs from "fs";
import * as path from "path";
import { Logger } from "@/main/utils/logger";
import { skillSchemaValidator } from "./skill.schema.validator";
import type { SkillDefinition } from "@/shared/types/skill.types";

/** 作品技能目录：<作品文件夹>/skills/ */
export function getProjectSkillsDir(projectFilePath: string): string {
  return path.join(projectFilePath, "skills");
}

function skillFilePath(projectFilePath: string, skillId: string): string {
  return path.join(
    getProjectSkillsDir(projectFilePath),
    `${skillId}.skill.json`,
  );
}

/**
 * 作品技能存储：读写 <作品文件夹>/skills/*.skill.json。
 * 写入前统一走 schema 校验，与全局技能一致，不绕过。
 */
class ProjectSkillStore {
  /** 列出该作品的全部作品技能；校验失败的文件被跳过 */
  public list(projectFilePath: string): SkillDefinition[] {
    const dir = getProjectSkillsDir(projectFilePath);
    if (!fs.existsSync(dir)) return [];

    let files: string[];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith(".skill.json"));
    } catch (error) {
      Logger.warn("[ProjectSkillStore] 读取作品技能目录失败", {
        dir,
        error: String(error),
      });
      return [];
    }

    const result: SkillDefinition[] = [];
    for (const file of files) {
      const parsed = this.readFile(path.join(dir, file));
      if (parsed) result.push(parsed);
    }
    return result;
  }

  /** 读取单个作品技能；不存在或校验失败返回 null */
  public read(
    projectFilePath: string,
    skillId: string,
  ): SkillDefinition | null {
    return this.readFile(skillFilePath(projectFilePath, skillId));
  }

  /** 写入作品技能；schema 校验失败时抛错（不落盘半成品） */
  public write(projectFilePath: string, skill: SkillDefinition): void {
    const validation = skillSchemaValidator.validate(skill);
    if (!validation.valid) {
      const errors = validation.errors
        .map((e) => `${e.field}: ${e.message}`)
        .join("; ");
      throw new Error(`INVALID_PROJECT_SKILL: ${skill.id} — ${errors}`);
    }
    const file = skillFilePath(projectFilePath, skill.id);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(skill, null, 2), "utf-8");
  }

  public remove(projectFilePath: string, skillId: string): void {
    const file = skillFilePath(projectFilePath, skillId);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  private readFile(file: string): SkillDefinition | null {
    try {
      if (!fs.existsSync(file)) return null;
      const skill = JSON.parse(
        fs.readFileSync(file, "utf-8"),
      ) as SkillDefinition;
      const validation = skillSchemaValidator.validate(skill);
      if (!validation.valid) {
        Logger.warn("[ProjectSkillStore] 作品技能校验失败，已跳过", { file });
        return null;
      }
      return skill;
    } catch (error) {
      Logger.warn("[ProjectSkillStore] 读取作品技能失败", {
        file,
        error: String(error),
      });
      return null;
    }
  }
}

export const projectSkillStore = new ProjectSkillStore();
