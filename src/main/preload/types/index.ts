import type { ConfigAPI } from "./config";
import type { WindowAPI } from "./window";
import type { SystemAPI } from "./system";
import type { LoggerAPI } from "./logger";
import type { WebviewAPI } from "./webview";
import type { JournalAPI } from "./journal";
import type { ProjectAPI } from "./project";
import type { AIAPI } from "./ai";
import type { SkillAPI } from "./skill";
import type { ModelAPI } from "./model";
import type { TagAPI } from "./tag";
import type { ConceptAPI } from "./concept";
import type { TopicAPI } from "./topic";
import type { ReflectionAPI } from "./reflection";
import type { SmartTaskAPI } from "./smart-task";
import type { TaskAPI } from "./task";
import type { SearchAPI } from "./search";
import type { PageAPI } from "./page";
import type { UpdateAPI } from "./update";
import type { TemplateAPI } from "./template";
import type { NotificationMessage } from "@/shared/types";

export interface ElectronAPI {
  config: ConfigAPI;
  window: WindowAPI;
  system: SystemAPI;
  logger: LoggerAPI;
  webview: WebviewAPI;
  journal: JournalAPI;
  project: ProjectAPI;
  ai: AIAPI;
  skill: SkillAPI;
  model: ModelAPI;
  tag: TagAPI;
  page: PageAPI;
  smartTask: SmartTaskAPI;
  task: TaskAPI;
  search: SearchAPI;
  update: UpdateAPI;
  template: TemplateAPI;

  // 通用 IPC 方法（保持向后兼容）
  send: (channel: string, data: unknown) => void;
  on: (channel: string, callback: (data: unknown) => void) => void;
  off: (channel: string) => void;

  // 通知监听器
  onNotification: (callback: (notification: NotificationMessage) => void) => () => void;
  removeNotificationListener: () => void;
}

export type {
  ConfigAPI,
  WindowAPI,
  SystemAPI,
  LoggerAPI,
  WebviewAPI,
  JournalAPI,
  ProjectAPI,
  AIAPI,
  SkillAPI,
  ModelAPI,
  TagAPI,
  ConceptAPI,
  TopicAPI,
  ReflectionAPI,
  SmartTaskAPI,
  TaskAPI,
  SearchAPI,
  PageAPI,
  UpdateAPI,
  TemplateAPI,
};
