import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { Logger } from "@/main/utils/logger";
import type { SkillDefinition } from "@/shared/types/skill.types";
import { SCHEMAS_DIR } from "@/main/constants";

interface SchemaValidationError {
  field: string;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
}

class SkillSchemaValidator {
  private static instance: SkillSchemaValidator | null = null;
  private ajv: Ajv | null = null;
  private validateFn: ((data: Record<string, unknown>) => boolean) | null =
    null;
  private schemaPath: string = "";
  private lastErrors: SchemaValidationError[] = [];

  private constructor() {
    this.resolveSchemaPath();
    this.initAjv();
  }

  public static getInstance(): SkillSchemaValidator {
    if (!SkillSchemaValidator.instance) {
      SkillSchemaValidator.instance = new SkillSchemaValidator();
    }
    return SkillSchemaValidator.instance;
  }

  private resolveSchemaPath(): void {
    const isDev = !!process.env.VITE_DEV_SERVER_URL;
    if (isDev) {
      this.schemaPath = path.join(
        app.getAppPath(),
        "resources",
        SCHEMAS_DIR,
        "skill.schema.json",
      );
    } else {
      this.schemaPath = path.join(
        __dirname,
        "..",
        "resources",
        SCHEMAS_DIR,
        "skill.schema.json",
      );
    }
  }

  private initAjv(): void {
    if (!fs.existsSync(this.schemaPath)) {
      Logger.warn("Skill schema file not found, validation will be skipped", {
        path: this.schemaPath,
      });
      return;
    }

    try {
      const schemaContent = fs.readFileSync(this.schemaPath, "utf-8");
      const schema = JSON.parse(schemaContent);

      this.ajv = new Ajv({
        allErrors: true,
        verbose: true,
      });
      addFormats(this.ajv);

      this.validateFn = this.ajv.compile(schema);
      Logger.info("Skill schema compiled with ajv", { path: this.schemaPath });
    } catch (error) {
      Logger.error("Failed to initialize ajv with skill schema", {
        error: String(error),
      });
    }
  }

  public validate(skill: SkillDefinition): ValidationResult {
    this.lastErrors = [];

    if (!this.validateFn) {
      return { valid: true, errors: [] };
    }

    const data = skill as unknown as Record<string, unknown>;
    const valid = this.validateFn(data);

    if (!valid && this.ajv?.errors) {
      this.lastErrors = this.ajv.errors.map((err) => {
        const field = err.instancePath
          ? err.instancePath.replace(/^\//, "").replace(/\//g, ".")
          : ((err.params as Record<string, unknown>)
              ?.missingProperty as string) || "";

        let message = err.message || "验证失败";

        if (err.keyword === "required") {
          const missingProp = (err.params as Record<string, unknown>)
            ?.missingProperty as string;
          return {
            field: missingProp,
            message: `缺少必填字段: ${missingProp}`,
          };
        }

        if (err.keyword === "additionalProperties") {
          const additionalProp = (err.params as Record<string, unknown>)
            ?.additionalProperty as string;
          return {
            field,
            message: `不允许的额外字段: ${additionalProp}`,
          };
        }

        if (err.keyword === "pattern") {
          const pattern = (err.params as Record<string, unknown>)
            ?.pattern as string;
          return {
            field: field || "value",
            message: `格式不匹配(正则: ${pattern})`,
          };
        }

        if (err.keyword === "enum") {
          const allowed = (err.params as Record<string, unknown>)
            ?.allowedValues as string[];
          return {
            field: field || "value",
            message: `值必须是 [${allowed.join(", ")}] 之一`,
          };
        }

        if (err.keyword === "minLength" || err.keyword === "maxLength") {
          const limit = (err.params as Record<string, unknown>)
            ?.limit as number;
          const label = err.keyword === "minLength" ? "最少" : "最多";
          return {
            field: field || "value",
            message: `${label} ${limit} 个字符`,
          };
        }

        if (err.keyword === "minItems" || err.keyword === "maxItems") {
          const limit = (err.params as Record<string, unknown>)
            ?.limit as number;
          const label = err.keyword === "minItems" ? "至少" : "最多";
          return {
            field: field || "array",
            message: `${label} ${limit} 项`,
          };
        }

        if (err.keyword === "oneOf") {
          return {
            field: field || "value",
            message: `类型不匹配，必须是 string/number/boolean 之一`,
          };
        }

        return {
          field:
            field ||
            (err.instancePath
              ? err.instancePath.replace(/^\//, "").replace(/\//g, ".")
              : "root"),
          message,
        };
      });
    }

    return {
      valid,
      errors: this.lastErrors,
    };
  }

  public getSchemaPath(): string {
    return this.schemaPath;
  }
}

export const skillSchemaValidator = SkillSchemaValidator.getInstance();
export { SkillSchemaValidator };
export type { ValidationResult, SchemaValidationError };
