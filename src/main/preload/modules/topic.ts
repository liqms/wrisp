import { ipcRenderer } from "electron";
import type { TopicAPI } from "../types/topic";

export const topicModule: TopicAPI = {
  topic: {
    list: (params) => ipcRenderer.invoke("topic:list", params),
    detail: (id) => ipcRenderer.invoke("topic:detail", id),
  },
};