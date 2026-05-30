import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { Logger } from "@/main/utils/logger";
import { skillSchemaValidator } from "./skill.schema.validator";
import { compareVersions, VersionComparison } from "@/main/utils/version";
("@/main/utils/version");
import type {
  SkillDefinition,
  SkillManifest,
  SkillManifestEntry,
  SkillSettings,
  SkillSettingsEntry,
  SkillListItem,
  CategoryNode,
  SkillSource,
} from "@/shared/types/skill.types";

const BUILT_IN = "built-in";
const CUSTOM = "custom";
const REMOTE = "remote";

class SkillManager {
  private static instance: SkillManager | null = null;
  private skills: Map<string, SkillDefinition> = new Map();
  private manifest: SkillManifest | null = null;
  private settings: SkillSettings | null = null;
  private skillsDir: string = "";
  private changeCallbacks: Array<() => void> = [];
  private skillSources: Map<string, SkillSource> = new Map();

  private constructor() {}

  public static getInstance(): SkillManager {
    if (!SkillManager.instance) {
      SkillManager.instance = new SkillManager();
    }
    return SkillManager.instance;
  }

  public initialize(): void {
    try {
      const workspacePath: string = (globalThis as Record<string, unknown>)
        .__PENTIP_WORKSPACE_PATH__ as string;

      if (workspacePath && workspacePath.trim() !== "") {
        this.skillsDir = path.join(workspacePath, "skills");
      } else {
        this.skillsDir = path.join(app.getPath("userData"), "skills");
      }

      const exists = fs.existsSync(this.skillsDir);

      if (!exists) {
        Logger.info("Skills directory not found, creating...");
        fs.mkdirSync(path.join(this.skillsDir, BUILT_IN), { recursive: true });
        fs.mkdirSync(path.join(this.skillsDir, CUSTOM), { recursive: true });
        fs.mkdirSync(path.join(this.skillsDir, REMOTE), { recursive: true });

        this.copyBuiltInSkills();
      } else {
        this.syncBuiltInSkills();
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
      this.settings = { skills: [] };
    }

    const entry = this.settings.skills.find((e) => e.id === id);
    if (entry) {
      entry.enabled = enabled;
    } else {
      this.settings.skills.push({
        id,
        enabled,
        parameterOverrides: {},
      });
    }

    this.saveSettings();

    if (this.manifest) {
      const manifestEntry = this.manifest.skills.find((e) => e.id === id);
      if (manifestEntry) {
        manifestEntry.enabled = enabled;
        this.manifest.updatedAt = new Date().toISOString();
        this.saveManifest();
      }
    }

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
    this.updateManifestEntry(merged);
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
      this.manifest.skills = this.manifest.skills.filter((e) => e.id !== id);
      this.manifest.updatedAt = new Date().toISOString();
      this.saveManifest();
    }

    if (this.settings) {
      this.settings.skills = this.settings.skills.filter((e) => e.id !== id);
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
    const sourceDirs: { dir: string; source: SkillSource }[] = [
      {
        dir: path.join(this.skillsDir, BUILT_IN),
        source: BUILT_IN as SkillSource,
      },
      { dir: path.join(this.skillsDir, CUSTOM), source: CUSTOM as SkillSource },
      { dir: path.join(this.skillsDir, REMOTE), source: REMOTE as SkillSource },
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
          const skill: SkillDefinition = JSON.parse(content);
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
        this.manifest = JSON.parse(content) as SkillManifest;
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
    this.manifest.skills = this.manifest.skills.filter((e) =>
      currentIds.has(e.id),
    );

    for (const [id, skill] of this.skills) {
      const existing = this.manifest.skills.find((e) => e.id === id);
      if (existing) {
        existing.name = skill.name;
        existing.version = skill.version;
        existing.category = skill.category;
        existing.icon = skill.icon;
        existing.source = this.getSkillSource(id);
      } else {
        this.manifest.skills.push({
          id: skill.id,
          name: skill.name,
          version: skill.version,
          category: skill.category,
          icon: skill.icon,
          enabled: skill.enabled,
          source: this.getSkillSource(id),
        });
      }
    }

    this.manifest.updatedAt = new Date().toISOString();
  }

  private loadSettings(): void {
    const settingsPath = path.join(this.skillsDir, "settings.json");
    try {
      if (fs.existsSync(settingsPath)) {
        const content = fs.readFileSync(settingsPath, "utf-8");
        this.settings = JSON.parse(content) as SkillSettings;
        this.syncSettings();
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

  private syncSettings(): void {
    if (!this.settings) return;

    const currentIds = new Set(this.skills.keys());
    this.settings.skills = this.settings.skills.filter((e) =>
      currentIds.has(e.id),
    );

    for (const id of this.skills.keys()) {
      if (!this.settings.skills.find((e) => e.id === id)) {
        const skill = this.skills.get(id)!;
        this.settings.skills.push({
          id,
          enabled: skill.enabled,
          parameterOverrides: {},
        });
      }
    }
  }

  private applySettings(): void {
    if (!this.settings) return;

    for (const entry of this.settings.skills) {
      const skill = this.skills.get(entry.id);
      if (!skill) continue;

      skill.enabled = entry.enabled;

      if (entry.parameterOverrides && skill.parameters) {
        for (const param of skill.parameters) {
          const override = entry.parameterOverrides[param.name];
          if (override !== undefined) {
            param.default = override;
          }
        }
      }
    }
  }

  private buildManifestFromSkills(): SkillManifest {
    const entries: SkillManifestEntry[] = [];
    for (const [id, skill] of this.skills) {
      entries.push({
        id: skill.id,
        name: skill.name,
        version: skill.version,
        category: skill.category,
        icon: skill.icon,
        enabled: skill.enabled,
        source: this.getSkillSource(id),
      });
    }
    return { skills: entries, updatedAt: new Date().toISOString() };
  }

  private buildSettingsFromSkills(): SkillSettings {
    const entries: SkillSettingsEntry[] = [];
    for (const [id, skill] of this.skills) {
      entries.push({
        id,
        enabled: skill.enabled,
        parameterOverrides: {},
      });
    }
    return { skills: entries };
  }

  private addToManifest(skill: SkillDefinition): void {
    if (!this.manifest) {
      this.manifest = { skills: [], updatedAt: new Date().toISOString() };
    }

    this.manifest.skills.push({
      id: skill.id,
      name: skill.name,
      version: skill.version,
      category: skill.category,
      icon: skill.icon,
      enabled: skill.enabled,
      source: CUSTOM as SkillSource,
    });
    this.manifest.updatedAt = new Date().toISOString();
  }

  private addToSettings(id: string, enabled: boolean): void {
    if (!this.settings) {
      this.settings = { skills: [] };
    }

    this.settings.skills.push({
      id,
      enabled,
      parameterOverrides: {},
    });
  }

  private updateManifestEntry(skill: SkillDefinition): void {
    if (!this.manifest) return;

    const entry = this.manifest.skills.find((e) => e.id === skill.id);
    if (entry) {
      entry.name = skill.name;
      entry.version = skill.version;
      entry.category = skill.category;
      entry.icon = skill.icon;
      entry.enabled = skill.enabled;
      this.manifest.updatedAt = new Date().toISOString();
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

  private getSkillSource(id: string): SkillSource {
    return this.skillSources.get(id) || BUILT_IN;
  }

  private toListItem(skill: SkillDefinition): SkillListItem {
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      icon: skill.icon,
      version: skill.version,
      author: skill.author,
      category: skill.category,
      tags: skill.tags,
      enabled: skill.enabled,
      source: this.getSkillSource(skill.id),
      parameters: skill.parameters,
      example: skill.example,
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

  private getBuiltInSourceDir(): string {
    const isDev = !!process.env.VITE_DEV_SERVER_URL;
    if (isDev) {
      return path.join(app.getAppPath(), "resources", "skills", BUILT_IN);
    }
    return path.join(__dirname, "..", "resources", "skills", BUILT_IN);
  }

  private copyBuiltInSkills(): void {
    const sourceDir = this.getBuiltInSourceDir();
    if (!fs.existsSync(sourceDir)) {
      Logger.warn("Built-in skills source directory not found", { sourceDir });
      return;
    }

    const targetDir = path.join(this.skillsDir, BUILT_IN);
    try {
      const files = fs
        .readdirSync(sourceDir)
        .filter((f) => f.endsWith(".skill.json"));
      for (const file of files) {
        const srcPath = path.join(sourceDir, file);
        const destPath = path.join(targetDir, file);
        fs.copyFileSync(srcPath, destPath);
        Logger.info(`Copied built-in skill: ${file}`);
      }
    } catch (error) {
      Logger.error("Failed to copy built-in skills", { error: String(error) });
    }
  }

  private syncBuiltInSkills(): void {
    const sourceDir = this.getBuiltInSourceDir();
    if (!fs.existsSync(sourceDir)) {
      Logger.warn("Built-in skills source directory not found for sync", {
        sourceDir,
      });
      return;
    }

    const targetDir = path.join(this.skillsDir, BUILT_IN);
    try {
      const sourceFiles = fs
        .readdirSync(sourceDir)
        .filter((f) => f.endsWith(".skill.json"));

      for (const file of sourceFiles) {
        const srcPath = path.join(sourceDir, file);
        const destPath = path.join(targetDir, file);

        let sourceSkill: SkillDefinition;
        try {
          sourceSkill = JSON.parse(fs.readFileSync(srcPath, "utf-8"));
        } catch {
          Logger.warn(`Failed to parse source skill: ${file}`);
          continue;
        }

        if (fs.existsSync(destPath)) {
          let installedSkill: SkillDefinition;
          try {
            installedSkill = JSON.parse(fs.readFileSync(destPath, "utf-8"));
          } catch {
            fs.copyFileSync(srcPath, destPath);
            Logger.info(`Updated built-in skill (unreadable): ${file}`);
            continue;
          }

          if (
            compareVersions(installedSkill.version, sourceSkill.version) !==
            VersionComparison.EQUAL
          ) {
            fs.copyFileSync(srcPath, destPath);
            Logger.info(
              `Updated built-in skill: ${file} (${installedSkill.version} → ${sourceSkill.version})`,
            );
          }
        } else {
          fs.copyFileSync(srcPath, destPath);
          Logger.info(`Installed new built-in skill: ${file}`);
        }
      }
    } catch (error) {
      Logger.error("Failed to sync built-in skills", { error: String(error) });
    }
  }
}

export const skillManager = SkillManager.getInstance();
export default SkillManager;
