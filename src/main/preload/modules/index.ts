import { configModule } from "./config";
import { windowModule } from "./window";
import { systemModule } from "./system";
import { loggerModule } from "./logger";
import { webviewModule } from "./webview";
import { captureModule } from "./capture";

export const modules = {
  config: configModule,
  window: windowModule,
  system: systemModule,
  logger: loggerModule,
  webview: webviewModule,
  capture: captureModule,
};
