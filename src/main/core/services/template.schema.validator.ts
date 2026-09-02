import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { ValidateFunction } from "ajv";
import { SCHEMAS_DIR } from "@/main/constants";
import { Logger } from "@/main/utils/logger";
import type { TemplateResourceFile } from "@/shared/types/template.types";

/**
 * 内置模板 JSON 的 schema 校验器（slash/page 通用）。
 * schema 文件随应用分发（resources/schemas/template.schema.json），
 * dev 从项目根读取，prod 从打包目录读取；文件缺失或编译失败时跳过校验（不阻断模板加载）。
 */
class TemplateSchemaValidator {
  private static instance: TemplateSchemaValidator | null = null;
  private validateFn: ValidateFunction | null = null;
  private lastErrors: string[] = [];

  private constructor() {
    this.init();
  }

  public static getInstance(): TemplateSchemaValidator {
    if (!TemplateSchemaValidator.instance) {
      TemplateSchemaValidator.instance = new TemplateSchemaValidator();
    }
    return TemplateSchemaValidator.instance;
  }

  private resolveSchemaPath(): string {
    const isDev = !!process.env.VITE_DEV_SERVER_URL;
    if (isDev) {
      return path.join(
        app.getAppPath(),
        "resources",
        SCHEMAS_DIR,
        "template.schema.json",
      );
    }
    return path.join(
      __dirname,
      "..",
      "resources",
      SCHEMAS_DIR,
      "template.schema.json",
    );
  }

  private init(): void {
    const schemaPath = this.resolveSchemaPath();
    if (!fs.existsSync(schemaPath)) {
      Logger.warn("模板 schema 文件不存在，校验将被跳过", { schemaPath });
      return;
    }
    try {
      const ajv = new Ajv({ allErrors: true });
      addFormats(ajv);
      this.validateFn = ajv.compile(
        JSON.parse(fs.readFileSync(schemaPath, "utf-8")),
      );
      Logger.info("模板 schema 已编译", { schemaPath });
    } catch (error) {
      Logger.error("编译模板 schema 失败，校验将被跳过", {
        error: String(error),
        schemaPath,
      });
    }
  }

  /**
   * 校验内置模板对象。
   * @returns 合法返回 true；不合法返回 false（错误明细可通过 getErrors 获取）。
   * 校验器未启用（schema 缺失/编译失败）时恒返回 true。
   */
  public validate(data: TemplateResourceFile): boolean {
    if (!this.validateFn) return true;
    const valid = this.validateFn(
      data as unknown as Record<string, unknown>,
    );
    this.lastErrors = valid
      ? []
      : (this.validateFn.errors ?? []).map(
          (e) => `${e.instancePath} ${e.message ?? ""}`.trim(),
        );
    return valid;
  }

  /** 最近一次 validate 失败的错误明细 */
  public getErrors(): string[] {
    return this.lastErrors;
  }
}

export const templateSchemaValidator = TemplateSchemaValidator.getInstance();
