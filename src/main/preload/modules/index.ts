import { configModule } from "./config";
import { windowModule } from "./window";
import { systemModule } from "./system";
import { loggerModule } from "./logger";
import { webviewModule } from "./webview";
import { journalModule } from "./journal";
import { projectModule } from "./project";
import { aiModule } from "./ai";
import { skillModule } from "./skill";
import { modelModule } from "./model";
import { tagModule } from "./tag";
import { pageModule } from "./page";
import { conceptModule } from "./concept";
import { topicModule } from "./topic";
import { reflectionModule } from "./reflection";
import { smartTaskModule } from "./smart-task";
import { taskModule } from "./task";
import { searchModule } from "./search";

export const modules = {
  config: configModule,
  window: windowModule,
  system: systemModule,
  logger: loggerModule,
  webview: webviewModule,
  journal: journalModule,
  project: projectModule,
  ai: aiModule,
  skill: skillModule,
  model: modelModule,
  tag: tagModule,
  page: pageModule,
  concept: conceptModule,
  topic: topicModule,
  reflection: reflectionModule,
  smartTask: smartTaskModule,
  task: taskModule,
  search: searchModule,
};
