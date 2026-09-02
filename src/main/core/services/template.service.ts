import fs from "fs";
import path from "path";
import { configService } from "@/main/core/services/config.service";
import {
  TEMPLATES_DIR,
  SLASH_TEMPLATES_DIR,
  SLASH_TEMPLATES_FILE,
  PAGE_TEMPLATES_DIR,
  PAGE_TEMPLATES_FILE,
  RESOURCES_DIR,
} from "@/main/constants/folder.constants";
import type {
  CustomTemplate,
  TemplateFile,
  TemplateResourceFile,
} from "@/shared/types/template.types";
import type { TemplateType } from "@/shared/enums/template.enums";
import type { Profession } from "@/shared/enums/profession.enums";
import { PROFESSION } from "@/shared/enums";
import {
  DEFAULT_TEMPLATE_ICON,
  isTemplateIconName,
  isTemplateType,
  TEMPLATE_TYPE,
} from "@/shared/enums/template.enums";
import { Logger } from "@/main/utils/logger";
import { templateSchemaValidator } from "./template.schema.validator";

const DEFAULT_FILE: TemplateFile = {
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

  /** 模板类型 → 子目录/文件名（slash 与 page 分文件存储，互不影响） */
  private getFilePath(type: TemplateType): string {
    const dir =
      type === TEMPLATE_TYPE.SLASH ? SLASH_TEMPLATES_DIR : PAGE_TEMPLATES_DIR;
    const fileName =
      type === TEMPLATE_TYPE.SLASH
        ? SLASH_TEMPLATES_FILE
        : PAGE_TEMPLATES_FILE;
    return path.join(this.getWorkspacePath(), TEMPLATES_DIR, dir, fileName);
  }

  /** IPC 入参不受类型系统保护，运行时校验防止非法值拼进文件路径 */
  private assertValidType(type: TemplateType): void {
    if (!isTemplateType(type)) {
      throw new Error(`非法模板类型: ${String(type)}`);
    }
  }

  /** 读取指定类型的模板文件；文件缺失或损坏时返回默认值 */
  public getTemplatesFile(type: TemplateType): TemplateFile {
    this.assertValidType(type);
    const filePath = this.getFilePath(type);
    try {
      if (!fs.existsSync(filePath)) return { ...DEFAULT_FILE };
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw) as TemplateFile;
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
      Logger.error("读取模板文件失败", {
        error: String(error),
        filePath,
        type,
      });
      return { ...DEFAULT_FILE };
    }
  }

  /**
   * 加载内置模板（从工作区 resources/{type}/ 目录扫描）。
   * 文件缺失或损坏时返回空数组。
   */
  public getBuiltInTemplates(type: TemplateType): TemplateResourceFile[] {
    this.assertValidType(type);
    const dir = type === TEMPLATE_TYPE.SLASH ? SLASH_TEMPLATES_DIR : PAGE_TEMPLATES_DIR;
    const resourcesDir = path.join(this.getWorkspacePath(), RESOURCES_DIR, dir);
    if (!fs.existsSync(resourcesDir)) return [];

    let files: string[];
    try {
      files = fs.readdirSync(resourcesDir).filter((f) => f.endsWith(".json"));
    } catch (err) {
      Logger.warn("读取内置模板目录失败", { dir: resourcesDir, error: String(err) });
      return [];
    }

    const result: TemplateResourceFile[] = [];
    for (const file of files) {
      try {
        const data = JSON.parse(
          fs.readFileSync(path.join(resourcesDir, file), "utf-8"),
        ) as Partial<TemplateResourceFile>;
        if (!data.id || typeof data.id !== "string") continue;
        const tpl: TemplateResourceFile = {
          id: data.id,
          version: typeof data.version === "string" ? data.version : "0.0.0",
          title: data.title ?? { zh: data.id, en: data.id },
          description: data.description ?? { zh: "", en: "" },
          icon: isTemplateIconName(data.icon) ? data.icon : DEFAULT_TEMPLATE_ICON,
          markdown: data.markdown ?? { zh: "", en: "" },
          profession: Array.isArray(data.profession)
            ? data.profession.filter(
                (p): p is Profession => typeof p === "string" && p !== PROFESSION.CUSTOM,
              )
            : [PROFESSION.GENERAL],
          tags: Array.isArray(data.tags) ? data.tags : [],
          enabled: data.enabled !== false,
        };
        // schema 校验失败的文件跳过加载（与 skill 加载行为一致），避免坏数据进入模板列表
        if (!templateSchemaValidator.validate(tpl)) {
          Logger.warn("内置模板文件 schema 校验失败，已跳过", {
            file,
            errors: templateSchemaValidator.getErrors(),
          });
          continue;
        }
        result.push(tpl);
      } catch (err) {
        Logger.warn("解析内置模板文件失败", { file, error: String(err) });
      }
    }
    return result;
  }

  /** 写入指定类型的模板文件 */
  private saveTemplatesFile(type: TemplateType, file: TemplateFile): void {
    const filePath = this.getFilePath(type);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(file, null, 2), "utf-8");
  }

  /** 新增或按 id 更新自定义模板，返回最新文件 */
  public upsertCustomTemplate(
    type: TemplateType,
    tpl: CustomTemplate,
  ): TemplateFile {
    const file = this.getTemplatesFile(type);
    const idx = file.customTemplates.findIndex((c) => c.id === tpl.id);
    if (idx >= 0) file.customTemplates[idx] = tpl;
    else file.customTemplates.push(tpl);
    this.saveTemplatesFile(type, file);
    return file;
  }

  /** 按 id 删除自定义模板，返回最新文件 */
  public deleteCustomTemplate(type: TemplateType, id: string): TemplateFile {
    const file = this.getTemplatesFile(type);
    file.customTemplates = file.customTemplates.filter((c) => c.id !== id);
    this.saveTemplatesFile(type, file);
    return file;
  }

  /** 设置模板启用状态：内置走黑名单；自定义写 enabled 字段，返回最新文件 */
  public setTemplateEnabled(
    type: TemplateType,
    id: string,
    builtIn: boolean,
    enabled: boolean,
  ): TemplateFile {
    const file = this.getTemplatesFile(type);
    if (builtIn) {
      const disabled = new Set(file.disabledTemplateIds);
      if (enabled) disabled.delete(id);
      else disabled.add(id);
      file.disabledTemplateIds = [...disabled];
    } else {
      const target = file.customTemplates.find((c) => c.id === id);
      if (target) target.enabled = enabled;
    }
    this.saveTemplatesFile(type, file);
    return file;
  }
}

export const templateService = TemplateService.getInstance();
