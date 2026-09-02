import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { app } from "electron";
import { Logger } from "@/main/utils/logger";
import { skillSchemaValidator } from "./skill.schema.validator";
import { RESOURCES_DIR } from "@/main/constants/folder.constants";
import { configService } from "@/main/core/services/config.service";
import type {
  SkillDefinition,
  SkillManifest,
  SkillManifestEntry,
  SkillSettings,
  SkillListItem,
  CategoryNode,
  SkillSource,
} from "@/shared/types/skill.types";
import type { LocalizedText } from "@/shared/types/template.types";
import { TimeUtil } from "@/shared/utils/time";

const BUILT_IN = "built-in";
const CUSTOM = "custom";
const REMOTE = "remote";

/** 解析双语文本：按当前语言取值，兼容旧格式（string 直接透传） */
function resolveLocalized(
  value: LocalizedText | string | undefined,
  useEn: boolean,
): string {
  if (value === undefined) return "";
  const raw = value as string | LocalizedText;
  return typeof raw === "string" ? raw : useEn ? raw.en : raw.zh;
}

/** 旧格式（string）规范化为双语结构；新格式原样返回 */
function normalizeLocalized(
  value: string | LocalizedText,
): LocalizedText {
  return typeof value === "string" ? { zh: value, en: value } : value;
}

/**
 * 旧格式 skill 文件规范化为双语结构：
 * string 字段包装为 {zh, en}（两语言同值），旧 example 包装为双语分组。
 * 保证进入 schema 校验的数据均为新格式，旧自定义 skill 可正常加载。
 */
function normalizeSkillDefinition(raw: Record<string, unknown>): SkillDefinition {
  const skill = raw as unknown as SkillDefinition;
  skill.name = normalizeLocalized(skill.name as string | LocalizedText);
  skill.description = normalizeLocalized(
    skill.description as string | LocalizedText,
  );
  skill.promptTemplate = normalizeLocalized(
    skill.promptTemplate as string | LocalizedText,
  );
  if (skill.systemPrompt !== undefined) {
    skill.systemPrompt = normalizeLocalized(
      skill.systemPrompt as string | LocalizedText,
    );
  }
  if (Array.isArray(skill.tags)) {
    skill.tags = skill.tags.map((tag) =>
      normalizeLocalized(tag as string | LocalizedText),
    );
  }
  if (skill.input?.properties) {
    for (const prop of Object.values(skill.input.properties)) {
      if (prop.description !== undefined) {
        prop.description = normalizeLocalized(
          prop.description as string | LocalizedText,
        );
      }
    }
  }
  // 旧格式 example：{input, output} → {zh: {...}, en: {...}}（两语言同内容）
  const example = skill.example as unknown;
  if (
    example &&
    typeof example === "object" &&
    !("zh" in (example as Record<string, unknown>))
  ) {
    const legacy = example as { input: Record<string, unknown>; output: string };
    skill.example = { zh: legacy, en: legacy };
  }
  return skill;
}

/** 读取当前语言是否为英文（与渲染层 general.locale 配置一致） */
function isEnglishLocale(): boolean {
  try {
    return configService.getValue<string>("general.locale") === "enUS";
  } catch {
    return false;
  }
}

class SkillManager {
  private static instance: SkillManager | null = null;
  private skills: Map<string, SkillDefinition> = new Map();
  private manifest: SkillManifest | null = null;
  private settings: SkillSettings | null = null;
  private skillsDir: string = "";
  private changeCallbacks: Array<() => void> = [];
  private skillSources: Map<string, SkillSource> = new Map();

  private constructor() { }

  public static getInstance(): SkillManager {
    if (!SkillManager.instance) {
      SkillManager.instance = new SkillManager();
    }
    return SkillManager.instance;
  }

  public initialize(): void {
    try {
      const workspacePath: string = (globalThis as Record<string, unknown>)
        .__WRISP_WORKSPACE_PATH__ as string;

      if (workspacePath && workspacePath.trim() !== "") {
        this.skillsDir = path.join(workspacePath, "skills");
      } else {
        this.skillsDir = path.join(app.getPath("userData"), "skills");
      }

      if (!fs.existsSync(this.skillsDir)) {
        Logger.info("Skills directory not found, creating...");
        fs.mkdirSync(path.join(this.skillsDir, CUSTOM), { recursive: true });
      }

      // 兼容旧版本：废弃目录日志提示
      const legacyBuiltIn = path.join(this.skillsDir, BUILT_IN);
      if (fs.existsSync(legacyBuiltIn)) {
        Logger.warn("检测到废弃的 <skillsDir>/built-in/ 目录，已停止加载。新版本从 <workspace>/resources/skills/ 加载。", { legacyDir: legacyBuiltIn });
      }
      const legacyRemote = path.join(this.skillsDir, REMOTE);
      if (fs.existsSync(legacyRemote)) {
        Logger.warn("检测到废弃的 <skillsDir>/remote/ 目录，已停止加载。远程同步由 resource-sync 处理。", { legacyDir: legacyRemote });
      }

      this.loadSkills();
      Logger.info("SkillManager initialized", {
        skillsDir: this.skillsDir,
        skillCount: this.skills.size,
      });
    } catch (error) {
      Logger.error("SkillManager initialization failed", {
        error: String(error),
      });
    }
  }

  public getSkills(): SkillListItem[] {
    const result: SkillListItem[] = [];
    for (const skill of this.skills.values()) {
      if (skill.enabled) {
        result.push(this.toListItem(skill));
      }
    }
    return result;
  }

  public getSkill(id: string): SkillListItem | null {
    const skill = this.skills.get(id);
    if (!skill || !skill.enabled) return null;
    return this.toListItem(skill);
  }

  public getSkillDefinition(id: string): SkillDefinition | null {
    return this.skills.get(id) || null;
  }

  public getSkillsByCategory(category: string): SkillListItem[] {
    const result: SkillListItem[] = [];
    for (const skill of this.skills.values()) {
      if (!skill.enabled) continue;
      if (skill.category.length > 0 && skill.category[0] === category) {
        result.push(this.toListItem(skill));
      }
    }
    return result;
  }

  public getCategories(): CategoryNode[] {
    const root: CategoryNode[] = [];

    for (const skill of this.skills.values()) {
      if (!skill.enabled) continue;
      const listItem = this.toListItem(skill);

      let currentLevel = root;
      for (let i = 0; i < skill.category.length; i++) {
        const catName = skill.category[i];
        const isLast = i === skill.category.length - 1;

        let node = currentLevel.find((n) => n.name === catName);
        if (!node) {
          node = { name: catName, label: catName, skills: [], children: [] };
          currentLevel.push(node);
        }

        if (isLast) {
          node.skills.push(listItem);
        } else {
          currentLevel = node.children;
        }
      }
    }

    return root;
  }

  public onChange(callback: () => void): () => void {
    this.changeCallbacks.push(callback);
    return () => {
      const idx = this.changeCallbacks.indexOf(callback);
      if (idx !== -1) {
        this.changeCallbacks.splice(idx, 1);
      }
    };
  }

  public setSkillEnabled(id: string, enabled: boolean): void {
    const skill = this.skills.get(id);
    if (!skill) {
      Logger.warn(`Skill not found: ${id}`);
      return;
    }

    skill.enabled = enabled;

    if (!this.settings) {
      this.settings = { disabledSkills: [], skillParams: {} };
    }

    if (enabled) {
      this.settings.disabledSkills = this.settings.disabledSkills.filter((s: string) => s !== id);
    } else {
      if (!this.settings.disabledSkills.includes(id)) {
        this.settings.disabledSkills.push(id);
      }
    }

    this.saveSettings();
    this.notifyChange();
  }

  public createCustomSkill(definition: SkillDefinition): void {
    const validation = skillSchemaValidator.validate(definition);
    if (!validation.valid) {
      const errorMsgs = validation.errors
        .map((e) => `${e.field}: ${e.message}`)
        .join("; ");
      Logger.error("Invalid skill definition", {
        id: definition.id,
        errors: errorMsgs,
      });
      return;
    }

    if (this.skills.has(definition.id)) {
      Logger.warn(`Skill already exists: ${definition.id}`);
      return;
    }

    const filePath = path.join(
      this.skillsDir,
      CUSTOM,
      `${definition.id}.skill.json`,
    );
    try {
      fs.writeFileSync(filePath, JSON.stringify(definition, null, 2), "utf-8");
    } catch (error) {
      Logger.error(`Failed to save custom skill ${definition.id}`, {
        error: String(error),
      });
      return;
    }

    definition.enabled = definition.enabled !== false;
    this.skills.set(definition.id, definition);
    this.skillSources.set(definition.id, CUSTOM);

    this.addToManifest(definition);
    this.addToSettings(definition.id, definition.enabled);
    this.saveManifest();
    this.saveSettings();

    this.notifyChange();
    Logger.info(`Custom skill created: ${definition.id}`);
  }

  public updateCustomSkill(
    id: string,
    partial: Partial<SkillDefinition>,
  ): void {
    const existing = this.skills.get(id);
    if (!existing) {
      Logger.warn(`Skill not found: ${id}`);
      return;
    }

    if (this.getSkillSource(id) !== CUSTOM) {
      Logger.warn(`Cannot update non-custom skill: ${id}`);
      return;
    }

    const merged: SkillDefinition = { ...existing, ...partial, id };

    const validation = skillSchemaValidator.validate(merged);
    if (!validation.valid) {
      const errorMsgs = validation.errors
        .map((e) => `${e.field}: ${e.message}`)
        .join("; ");
      Logger.error(`Invalid skill definition after merge: ${id}`, {
        errors: errorMsgs,
      });
      return;
    }

    const filePath = path.join(this.skillsDir, CUSTOM, `${id}.skill.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");
    } catch (error) {
      Logger.error(`Failed to save custom skill ${id}`, {
        error: String(error),
      });
      return;
    }

    this.skills.set(id, merged);
    this.saveManifest();
    this.notifyChange();
    Logger.info(`Custom skill updated: ${id}`);
  }

  public deleteCustomSkill(id: string): void {
    if (this.getSkillSource(id) !== CUSTOM) {
      Logger.warn(`Cannot delete non-custom skill: ${id}`);
      return;
    }

    const filePath = path.join(this.skillsDir, CUSTOM, `${id}.skill.json`);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      Logger.error(`Failed to delete custom skill file: ${id}`, {
        error: String(error),
      });
      return;
    }

    this.skills.delete(id);
    this.skillSources.delete(id);

    if (this.manifest) {
      delete this.manifest.skills[id];
      this.manifest.lastUpdate = TimeUtil.getLocalDateString();
      this.saveManifest();
    }

    if (this.settings) {
      this.settings.disabledSkills = this.settings.disabledSkills.filter((s: string) => s !== id);
      delete this.settings.skillParams[id];
      this.saveSettings();
    }

    this.notifyChange();
    Logger.info(`Custom skill deleted: ${id}`);
  }

  public reload(): void {
    Logger.info("Reloading skills...");
    this.skills.clear();
    this.skillSources.clear();
    this.manifest = null;
    this.settings = null;
    this.loadSkills();
    this.notifyChange();
    Logger.info("Skills reloaded", { skillCount: this.skills.size });
  }

  private loadSkills(): void {
    const workspacePath: string = (globalThis as Record<string, unknown>)
      .__WRISP_WORKSPACE_PATH__ as string;
    const builtinDir = workspacePath
      ? path.join(workspacePath, RESOURCES_DIR, "skills")
      : path.join(app.getPath("userData"), RESOURCES_DIR, "skills");
    const customDir = path.join(this.skillsDir, CUSTOM);

    const sourceDirs: { dir: string; source: SkillSource }[] = [
      { dir: builtinDir, source: BUILT_IN as SkillSource },
      { dir: customDir, source: CUSTOM as SkillSource },
    ];

    for (const { dir, source } of sourceDirs) {
      if (!fs.existsSync(dir)) continue;

      let files: string[];
      try {
        files = fs.readdirSync(dir).filter((f) => f.endsWith(".skill.json"));
      } catch {
        Logger.warn(`Failed to read directory: ${dir}`);
        continue;
      }

      for (const file of files) {
        const filePath = path.join(dir, file);
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const parsed: Record<string, unknown> = JSON.parse(content);
          // 旧格式规范化为双语结构后再校验，保证历史自定义 skill 可加载
          const skill = normalizeSkillDefinition(parsed);
          const validation = skillSchemaValidator.validate(skill);
          if (!validation.valid) {
            const errorMsgs = validation.errors
              .map((e) => `${e.field}: ${e.message}`)
              .join("; ");
            Logger.warn(`Skill file validation failed: ${filePath}`, {
              errors: errorMsgs,
            });
            continue;
          }
          this.skills.set(skill.id, skill);
          this.skillSources.set(skill.id, source);
        } catch (error) {
          Logger.warn(`Failed to load skill file: ${filePath}`, {
            error: String(error),
          });
        }
      }
    }

    this.loadManifest();
    this.loadSettings();
    this.applySettings();
  }

  private loadManifest(): void {
    const manifestPath = path.join(this.skillsDir, "manifest.json");
    try {
      if (fs.existsSync(manifestPath)) {
        const content = fs.readFileSync(manifestPath, "utf-8");
        const parsed = JSON.parse(content);

        // 解析 V2 格式
        if (parsed.version === 2 && parsed.skills && typeof parsed.skills === "object" && !Array.isArray(parsed.skills)) {
          this.manifest = parsed as SkillManifest;
        } else {
          this.manifest = this.buildManifestFromSkills();
        }
        this.syncManifest();
      } else {
        this.manifest = this.buildManifestFromSkills();
      }
      this.saveManifest();
    } catch (error) {
      Logger.error("Failed to load manifest", { error: String(error) });
      this.manifest = this.buildManifestFromSkills();
      this.saveManifest();
    }
  }

  private syncManifest(): void {
    if (!this.manifest) return;

    const currentIds = new Set(this.skills.keys());

    // 移除不存在的 skill
    for (const id of Object.keys(this.manifest.skills)) {
      if (!currentIds.has(id)) {
        delete this.manifest.skills[id];
      }
    }

    // 添加新的 skill
    for (const [id, skill] of this.skills) {
      if (!this.manifest.skills[id]) {
        const source = this.getSkillSource(id);
        this.manifest.skills[id] = {
          id,
          path: `${source}/${id}.skill.json`,
          source,
          hash: this.computeSkillHash(id),
          version: skill.version,
          installedAt: TimeUtil.getLocalDateString(),
        };
      }
    }
    this.manifest.lastUpdate = TimeUtil.getLocalDateString();
  }

  private loadSettings(): void {
    const settingsPath = path.join(this.skillsDir, "settings.json");
    try {
      if (fs.existsSync(settingsPath)) {
        const content = fs.readFileSync(settingsPath, "utf-8");
        const parsed = JSON.parse(content);

        // 解析 V2 格式
        if (parsed.disabledSkills !== undefined && Array.isArray(parsed.disabledSkills)) {
          this.settings = parsed as SkillSettings;
        } else {
          this.settings = this.buildSettingsFromSkills();
        }
      } else {
        this.settings = this.buildSettingsFromSkills();
      }
      this.saveSettings();
    } catch (error) {
      Logger.error("Failed to load settings", { error: String(error) });
      this.settings = this.buildSettingsFromSkills();
      this.saveSettings();
    }
  }

  private applySettings(): void {
    if (!this.settings) return;

    // 应用禁用列表
    for (const id of this.settings.disabledSkills) {
      const skill = this.skills.get(id);
      if (skill) {
        skill.enabled = false;
      }
    }

    // 默认启用所有未在禁用列表中的 skill
    for (const [id, skill] of this.skills) {
      if (!this.settings.disabledSkills.includes(id)) {
        skill.enabled = true;
      }
    }

    // 应用参数覆盖
    for (const [skillId, params] of Object.entries(this.settings.skillParams)) {
      const skill = this.skills.get(skillId);
      if (!skill?.input?.properties) continue;

      for (const [propName, propDef] of Object.entries(skill.input.properties)) {
        const override = params[propName];
        if (override !== undefined) {
          propDef.default = override;
        }
      }
    }
  }

  private buildManifestFromSkills(): SkillManifest {
    const skills: Record<string, SkillManifestEntry> = {};
    for (const [id, skill] of this.skills) {
      const source = this.getSkillSource(id);
      skills[id] = {
        id,
        path: `${source}/${id}.skill.json`,
        source,
        hash: this.computeSkillHash(id),
        version: skill.version,
        installedAt: new Date().toISOString(),
      };
    }
    return { version: 2, lastUpdate: new Date().toISOString(), skills };
  }

  private buildSettingsFromSkills(): SkillSettings {
    const disabledSkills: string[] = [];
    for (const [id, skill] of this.skills) {
      if (!skill.enabled) {
        disabledSkills.push(id);
      }
    }
    return { disabledSkills, skillParams: {} };
  }

  private addToManifest(skill: SkillDefinition): void {
    if (!this.manifest) {
      this.manifest = { version: 2, lastUpdate: new Date().toISOString(), skills: {} };
    }

    const source = CUSTOM as SkillSource;
    this.manifest.skills[skill.id] = {
      id: skill.id,
      path: `${source}/${skill.id}.skill.json`,
      source,
      hash: this.computeSkillHash(skill.id),
      version: skill.version,
      installedAt: new Date().toISOString(),
    };
    this.manifest.lastUpdate = new Date().toISOString();
  }

  private addToSettings(id: string, enabled: boolean): void {
    if (!this.settings) {
      this.settings = { disabledSkills: [], skillParams: {} };
    }

    if (!enabled && !this.settings.disabledSkills.includes(id)) {
      this.settings.disabledSkills.push(id);
    }
  }

  private saveManifest(): void {
    if (!this.manifest) return;
    const manifestPath = path.join(this.skillsDir, "manifest.json");
    try {
      fs.writeFileSync(
        manifestPath,
        JSON.stringify(this.manifest, null, 2),
        "utf-8",
      );
    } catch (error) {
      Logger.error("Failed to save manifest", { error: String(error) });
    }
  }

  private saveSettings(): void {
    if (!this.settings) return;
    const settingsPath = path.join(this.skillsDir, "settings.json");
    try {
      fs.writeFileSync(
        settingsPath,
        JSON.stringify(this.settings, null, 2),
        "utf-8",
      );
    } catch (error) {
      Logger.error("Failed to save settings", { error: String(error) });
    }
  }

  private computeSkillHash(id: string): string {
    const skill = this.skills.get(id);
    if (!skill) return "";
    const content = JSON.stringify(skill);
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  private getSkillSource(id: string): SkillSource {
    return this.skillSources.get(id) || BUILT_IN;
  }

  private toListItem(skill: SkillDefinition): SkillListItem {
    const useEn = isEnglishLocale();

    // 按当前语言解析 input 参数说明（浅拷贝，避免修改原始定义）
    const input: SkillListItem["input"] = skill.input
      ? {
          ...skill.input,
          properties: Object.fromEntries(
            Object.entries(skill.input.properties).map(([key, prop]) => [
              key,
              {
                ...prop,
                description: prop.description
                  ? resolveLocalized(prop.description, useEn)
                  : undefined,
              },
            ]),
          ),
        }
      : undefined;

    return {
      id: skill.id,
      name: resolveLocalized(skill.name, useEn),
      description: resolveLocalized(skill.description, useEn),
      icon: skill.icon,
      version: skill.version,
      author: skill.author,
      category: skill.category,
      tags: (skill.tags ?? []).map((tag) => resolveLocalized(tag, useEn)),
      enabled: skill.enabled,
      source: this.getSkillSource(skill.id),
      level: skill.tools && skill.tools.length > 0 ? "L2" : "L1",
      input,
      example: skill.example
        ? useEn
          ? skill.example.en
          : skill.example.zh
        : undefined,
    };
  }

  private notifyChange(): void {
    for (const callback of this.changeCallbacks) {
      try {
        callback();
      } catch (error) {
        Logger.error("SkillManager change callback error", {
          error: String(error),
        });
      }
    }
  }
}

export const skillManager = SkillManager.getInstance();
export default SkillManager;
