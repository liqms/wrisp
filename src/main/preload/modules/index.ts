import { configModule } from "./config";
import { windowModule } from "./window";
import { systemModule } from "./system";
import { loggerModule } from "./logger";
import { webviewModule } from "./webview";
import { captureModule } from "./capture";
import { projectModule } from "./project";
import { aiModule } from "./ai";
import { skillModule } from "./skill";
import { modelModule } from "./model";
import { tagModule } from "./tag";
import { pageModule } from "./page";
import { thinkModule } from "./think";
import { smartTaskModule } from "./smart-task";
import { taskModule } from "./task";

export const modules = {
  config: configModule,
  window: windowModule,
  system: systemModule,
  logger: loggerModule,
  webview: webviewModule,
  capture: captureModule,
  project: projectModule,
  ai: aiModule,
  skill: skillModule,
  model: modelModule,
  tag: tagModule,
  page: pageModule,
  think: thinkModule,
  smartTask: smartTaskModule,
  task: taskModule,
};
