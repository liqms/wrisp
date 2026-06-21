import type { TaskType } from "@/shared/enums";

export type SkillSource = "built-in" | "custom" | "remote";

export type SkillParamUI = "dropdown" | "input" | "textarea" | "toggle" | "slider";

export type SkillPostProcessType = "trim";

export interface SkillParameter {
  name: string;
  type: "string" | "number" | "boolean";
  enum?: string[];
  default: string | number | boolean;
  label: string;
  description: string;
  ui: SkillParamUI;
}

export interface SkillPostProcess {
  type: SkillPostProcessType;
}

export interface SkillExample {
  input: Record<string, unknown>;
  output: string;
}

export interface SkillInputMapping {
  [paramName: string]: string;
}

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
  parameters?: SkillParameter[];
  inputMapping?: SkillInputMapping;
  postProcess?: SkillPostProcess;
  example?: SkillExample;
}

export interface SkillManifestEntry {
  id: string;
  name: string;
  version: string;
  category: string[];
  icon: string;
  enabled: boolean;
  source: SkillSource;
}

export interface SkillManifest {
  skills: SkillManifestEntry[];
  updatedAt: string;
}

export interface SkillSettingsEntry {
  id: string;
  enabled: boolean;
  parameterOverrides?: Record<string, string | number | boolean>;
}

export interface SkillSettings {
  skills: SkillSettingsEntry[];
}

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
  parameters?: SkillParameter[];
  example?: SkillExample;
}

export interface CategoryNode {
  name: string;
  label: string;
  skills: SkillListItem[];
  children: CategoryNode[];
}

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