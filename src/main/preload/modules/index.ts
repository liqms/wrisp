import { configModule } from './config'
import { windowModule } from './window'
import { systemModule } from './system'
import { loggerModule } from './logger'
import { webviewModule } from './webview'
import { folderModule } from './folder'
import { fileModule } from './file'
import { novelModule } from './novel'

export const modules = {
  config: configModule,
  window: windowModule,
  system: systemModule,
  logger: loggerModule,
  webview: webviewModule,
  folder: folderModule,
  file: fileModule,
  novel: novelModule
}