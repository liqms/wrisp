import fs from "fs";
import path from "path";
import { configService } from "@/main/core/services/config.service";
import {
  TEMPLATES_DIR,
  SLASH_TEMPLATES_DIR,
  SLASH_TEMPLATES_FILE,
} from "@/main/constants/folder.constants";
import type {
  CustomTemplate,
  SlashTemplateFile,
} from "@/shared/types/template.types";
import { PROFESSION } from "@/shared/enums";
import {
  DEFAULT_TEMPLATE_ICON,
  isTemplateIconName,
} from "@/shared/enums/template.enums";
import { Logger } from "@/main/utils/logger";

const DEFAULT_FILE: SlashTemplateFile = {
  customTemplates: [],
  disabledTemplateIds: [],
};

class TemplateService {
  private static instance: TemplateService | null = null;

  private constructor() { }

  public static getInstance(): TemplateService {
    if (!TemplateService.instance) {
      TemplateService.instance = new TemplateService();
    }
    return TemplateService.instance;
  }

  private getWorkspacePath(): string {
    const ws = (globalThis as Record<string, unknown>)
      .__WRISP_WORKSPACE_PATH__ as string | undefined;
    if (ws && ws.trim() !== "") return ws;
    return configService.getValue<string>("workspace") || "";
  }

  private getFilePath(): string {
    return path.join(
      this.getWorkspacePath(),
      TEMPLATES_DIR,
      SLASH_TEMPLATES_DIR,
      SLASH_TEMPLATES_FILE,
    );
  }

  /** 读取 slash 模板文件；文件缺失或损坏时返回默认值 */
  public getSlashTemplatesFile(): SlashTemplateFile {
    const filePath = this.getFilePath();
    try {
      if (!fs.existsSync(filePath)) return { ...DEFAULT_FILE };
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw) as SlashTemplateFile;
      return {
        customTemplates: Array.isArray(data.customTemplates)
          ? data.customTemplates.map((c) => ({
            ...c,
            // 读取时统一为 custom 职业：旧版本自定义模板可能存了其他职业，
            // 仅 custom 职业的模板具备编辑/删除入口，避免历史数据被锁死
            profession: PROFESSION.CUSTOM,
            // 旧版本自定义模板的 icon 可能是 emoji 或内联 HTML，
            // 现在统一为 @vicons/material 图标键，非法键回退到默认图标
            icon: isTemplateIconName(c.icon) ? c.icon : DEFAULT_TEMPLATE_ICON,
          }))
          : [],
        disabledTemplateIds: Array.isArray(data.disabledTemplateIds)
          ? data.disabledTemplateIds
          : [],
      };
    } catch (error) {
      Logger.error("读取 slash 模板文件失败", {
        error: String(error),
        filePath,
      });
      return { ...DEFAULT_FILE };
    }
  }

  /** 原子写入 slash 模板文件 */
  public saveSlashTemplatesFile(file: SlashTemplateFile): void {
    const filePath = this.getFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(file, null, 2), "utf-8");
  }

  /** 新增或按 id 更新自定义模板，返回最新文件 */
  public upsertCustomTemplate(tpl: CustomTemplate): SlashTemplateFile {
    const file = this.getSlashTemplatesFile();
    const idx = file.customTemplates.findIndex((c) => c.id === tpl.id);
    if (idx >= 0) file.customTemplates[idx] = tpl;
    else file.customTemplates.push(tpl);
    this.saveSlashTemplatesFile(file);
    return file;
  }

  /** 按 id 删除自定义模板，返回最新文件 */
  public deleteCustomTemplate(id: string): SlashTemplateFile {
    const file = this.getSlashTemplatesFile();
    file.customTemplates = file.customTemplates.filter((c) => c.id !== id);
    this.saveSlashTemplatesFile(file);
    return file;
  }

  /** 设置模板启用状态：内置走黑名单；自定义写 enabled 字段，返回最新文件 */
  public setTemplateEnabled(
    id: string,
    builtIn: boolean,
    enabled: boolean,
  ): SlashTemplateFile {
    const file = this.getSlashTemplatesFile();
    if (builtIn) {
      const disabled = new Set(file.disabledTemplateIds);
      if (enabled) disabled.delete(id);
      else disabled.add(id);
      file.disabledTemplateIds = [...disabled];
    } else {
      const target = file.customTemplates.find((c) => c.id === id);
      if (target) target.enabled = enabled;
    }
    this.saveSlashTemplatesFile(file);
    return file;
  }
}

export const templateService = TemplateService.getInstance();
