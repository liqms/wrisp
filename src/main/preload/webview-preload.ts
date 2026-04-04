import { contextBridge, ipcRenderer } from 'electron'

// 通过 contextBridge 暴露安全的 API 给嵌入的网页
contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (channel: string, data: any) => {
    // 只允许特定的通信通道，增强安全性
    const validChannels = ['to-main-process'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receiveMessage: (channel: string, callback: (data: any) => void) => {
    const validChannels = ['from-main-process'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event: any, data: any) => callback(data));
    }
  }
});