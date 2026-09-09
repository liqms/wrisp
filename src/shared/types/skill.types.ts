import type { TaskType } from "@/shared/enums";
import type { LocalizedText } from "./template.types";

export type SkillSource = "built-in" | "custom";

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
  /** 参数说明（双语，展示层按当前语言解析） */
  description?: LocalizedText;
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

/** 单语言的示例数据（input 为参数名→示例值，output 为示例输出） */
export interface SkillExampleData {
  input: Record<string, unknown>;
  output: string;
}

/** 双语示例（按语言分组的完整示例数据） */
export interface SkillExample {
  zh: SkillExampleData;
  en: SkillExampleData;
}

// ==================== Skill 定义 ====================

export interface SkillDefinition {
  $schema?: string;
  id: string;
  /** 显示名称（双语，展示层按当前语言解析） */
  name: LocalizedText;
  /** 功能描述（双语，展示层按当前语言解析） */
  description: LocalizedText;
  icon: string;
  version: string;
  author: string;
  category: string[];
  /** 类型标签（双语，展示层按当前语言解析） */
  tags?: LocalizedText[];
  enabled: boolean;
  taskType?: TaskType;
  /** Prompt 模板（双语，执行时按当前语言选择），使用 {{变量名}} 进行参数插值 */
  promptTemplate: LocalizedText;
  systemPrompt?: LocalizedText;
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
  /** 使用示例（双语） */
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

/** 列表项的参数定义（description 已按当前语言解析为字符串） */
export interface SkillListItemInputProperty
  extends Omit<SkillInputProperty, "description"> {
  description?: string;
}

/** 列表项的输入定义（参数说明已按当前语言解析） */
export interface SkillListItemInputSchema {
  type: "object";
  properties: Record<string, SkillListItemInputProperty>;
  required?: string[];
}

/** 列表项：name/description/tags/input 描述/example 已按当前语言解析为字符串 */
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
  input?: SkillListItemInputSchema;
  /** 使用示例（已按当前语言解析） */
  example?: SkillExampleData;
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

/** L1 流式输出的单个 chunk（delta 为增量文本） */
export interface SkillStreamChunk {
  /** skill 执行 ID（同一次执行的多个 chunk 共享此 ID） */
  executionId: string;
  /** 增量文本内容 */
  delta: string;
  /** 当前累计内容（可选，便于前端直接渲染） */
  accumulated?: string;
  /** 是否结束（done=true 且 error 为空 = 正常结束） */
  done: boolean;
  /** 错误信息（done=true 且执行失败时） */
  error?: string;
}