import type { TaskType } from "@/shared/enums";

export type SkillSource = "built-in" | "custom" | "remote";

export type SkillParamUI = "dropdown" | "input" | "textarea" | "toggle" | "slider";

export type SkillPostProcessType = "trim" | "stripHtml" | "formatJson" | "wrapMarkdown";

export type SkillPreProcessType = "trim" | "stripHtml" | "extractSelection";

// ==================== 输入/输出定义（JSON Schema 格式） ====================

export interface SkillInputSchema {
  type: "object";
  properties: Record<string, SkillInputProperty>;
  required?: string[];
}

export interface SkillInputProperty {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
  default?: unknown;
}

export interface SkillOutputSchema {
  type: "text" | "json" | "markdown";
  schema?: Record<string, unknown>;
}

// ==================== 工具定义 ====================

export interface SkillToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export type ToolPermission = "read" | "write";

export interface RegisteredTool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  permission: ToolPermission;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

export interface ToolCallResult {
  toolCallId: string;
  name: string;
  result: string;
  error?: string;
}

// ==================== 预处理/后处理 ====================

export interface SkillPreProcess {
  type: SkillPreProcessType;
  options?: Record<string, unknown>;
}

export interface SkillPostProcess {
  type: SkillPostProcessType;
  options?: Record<string, unknown>;
}

// ==================== Workflow 集成 ====================

export interface SkillWorkflowConfig {
  nodeType: string;
  inputs: Record<string, string>;
  outputs: Record<string, string>;
}

// ==================== 参数定义（兼容旧格式） ====================

export interface SkillParameter {
  name: string;
  type: "string" | "number" | "boolean";
  enum?: string[];
  default: string | number | boolean;
  label: string;
  description: string;
  ui: SkillParamUI;
}

export interface SkillInputMapping {
  [paramName: string]: string;
}

export interface SkillExample {
  input: Record<string, unknown>;
  output: string;
}

// ==================== Skill 定义 ====================

export interface SkillDefinition {
  $schema?: string;
  id: string;
  name: string;
  description: string;
  icon: string;
  version: string;
  author: string;
  category: string[];
  tags?: string[];
  enabled: boolean;
  taskType?: TaskType;
  promptTemplate: string;
  systemPrompt?: string;
  /** 输入参数（JSON Schema 格式，优先于 parameters） */
  input?: SkillInputSchema;
  /** 输出类型定义 */
  output?: SkillOutputSchema;
  /** 工具定义（L2 能力） */
  tools?: SkillToolDefinition[];
  /** 最大工具调用轮数（L2，默认 5） */
  maxSteps?: number;
  /** 模型温度（0-2） */
  temperature?: number;
  /** 预处理规则 */
  preProcess?: SkillPreProcess[];
  /** Workflow 集成配置 */
  workflow?: SkillWorkflowConfig;
  /** 参数定义（兼容旧格式） */
  parameters?: SkillParameter[];
  inputMapping?: SkillInputMapping;
  postProcess?: SkillPostProcess;
  example?: SkillExample;
}

// ==================== Manifest ====================

export interface SkillManifestEntry {
  id: string;
  path: string;
  source: SkillSource;
  hash: string;
  version: string;
  installedAt: string;
}

export interface SkillManifestV2 {
  version: 2;
  lastUpdate: string;
  skills: Record<string, SkillManifestEntry>;
}

/** @deprecated 旧格式，保留用于迁移 */
export interface SkillManifestV1 {
  skills: SkillManifestEntryV1[];
  updatedAt: string;
}

/** @deprecated 旧格式 */
export interface SkillManifestEntryV1 {
  id: string;
  name: string;
  version: string;
  category: string[];
  icon: string;
  enabled: boolean;
  source: SkillSource;
}

export type SkillManifest = SkillManifestV2;

// ==================== Settings ====================

export interface SkillSettingsV2 {
  disabledSkills: string[];
  skillParams: Record<string, Record<string, unknown>>;
}

/** @deprecated 旧格式，保留用于迁移 */
export interface SkillSettingsV1 {
  skills: SkillSettingsEntryV1[];
}

/** @deprecated 旧格式 */
export interface SkillSettingsEntryV1 {
  id: string;
  enabled: boolean;
  parameterOverrides?: Record<string, string | number | boolean>;
}

export type SkillSettings = SkillSettingsV2;

// ==================== 列表项 ====================

export interface SkillListItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  version: string;
  author: string;
  category: string[];
  tags?: string[];
  enabled: boolean;
  source: SkillSource;
  level: "L1" | "L2";
  input?: SkillInputSchema;
  example?: SkillExample;
}

export interface CategoryNode {
  name: string;
  label: string;
  skills: SkillListItem[];
  children: CategoryNode[];
}

// ==================== 更新 ====================

export interface SkillUpdateItem {
  skillId: string;
  name: string;
  action: "add" | "update" | "remove";
  version: string;
}

export interface SkillUpdateManifest {
  skills: SkillUpdateItem[];
  remoteManifestUrl: string;
}

// ==================== 执行记录 ====================

export interface SkillExecutionRecord {
  id: string;
  skillId: string;
  input: string;
  output: string;
  level: "L1" | "L2";
  modelUsed: string;
  tokensUsed: number;
  executionTimeMs: number;
  steps?: number;
  status: "succeeded" | "failed";
  errorMessage?: string;
  createdAt: string;
}

export interface SkillExecuteResult {
  content: string;
  level: "L1" | "L2";
  steps: number;
  modelUsed: string;
  tokensUsed: number;
  executionTimeMs: number;
}