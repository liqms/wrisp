import type { ProjectType } from "@/shared/enums/project.enums";

/** 作品简报：新建作品时由交互问答采集 */
export interface WorkBrief {
  name: string;
  type: ProjectType;
  audience?: string;
  lengthTarget?: string;
  pov?: string;
  tone?: string;
  themes?: string[];
  taboos?: string[];
  references?: string[];
}

/** 作品风格：单作品作用域 */
export interface WorkStyle {
  tone: string;
  pov: string;
  voiceByRole?: Record<string, string>;
  glossary?: Array<{ term: string; definition: string }>;
  constraints?: string[];
}

/** 作品档案（<作品文件夹>/work-profile.json） */
export interface WorkProfile {
  brief?: WorkBrief;
  style?: WorkStyle;
}
