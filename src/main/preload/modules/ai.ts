import { ipcRenderer, type IpcRendererEvent } from "electron";
import type { AIAPI } from "../types/ai";
import type { LLMStreamChunk } from "@/main/core/model-gateway/llm-gateway/types";

export const aiModule: AIAPI = {
  chatCompletion: (request) => ipcRenderer.invoke("ai:chatCompletion", request),
  chatCompletionStream: (request) => ipcRenderer.invoke("ai:chatCompletionStream", request),
  onChatStreamChunk: (callback) => {
    const handler = (_: IpcRendererEvent, chunk: unknown) => callback(chunk as LLMStreamChunk);
    ipcRenderer.on("ai:chatCompletionStream:chunk", handler);
    return () => ipcRenderer.removeListener("ai:chatCompletionStream:chunk", handler);
  },
  onChatStreamDone: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("ai:chatCompletionStream:done", handler);
    return () => ipcRenderer.removeListener("ai:chatCompletionStream:done", handler);
  },
  onChatStreamError: (callback) => {
    const handler = (_: IpcRendererEvent, error: string) => callback(error);
    ipcRenderer.on("ai:chatCompletionStream:error", handler);
    return () => ipcRenderer.removeListener("ai:chatCompletionStream:error", handler);
  },
  getCostSummary: () => ipcRenderer.invoke("ai:getCostSummary"),
  getCostRecords: (count?) => ipcRenderer.invoke("ai:getCostRecords", count),
  getProviders: () => ipcRenderer.invoke("ai:getProviders"),
  testProviderConnection: (providerId) => ipcRenderer.invoke("ai:testProviderConnection", providerId),
  refreshConfig: () => ipcRenderer.invoke("ai:refreshConfig"),
  isLocalAvailable: () => ipcRenderer.invoke("ai:localAvailable"),
  isCloudAvailable: () => ipcRenderer.invoke("ai:cloudAvailable"),
  getRouteStatus: () => ipcRenderer.invoke("ai:routeStatus"),
};