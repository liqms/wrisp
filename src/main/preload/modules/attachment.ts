import { ipcRenderer } from 'electron'
import type { AttachmentAPI } from '../types/attachment'

export const attachmentModule: AttachmentAPI = {
  importImage: () => ipcRenderer.invoke('attachment:importImage'),
}
