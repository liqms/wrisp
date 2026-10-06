
import { ipcRenderer } from "electron";
import type { WikiAPI } from "../types/wiki";

export const wikiModule: WikiAPI = {
  onUpdated: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("wiki:updated", listener);
    return () => {
      ipcRenderer.removeListener("wiki:updated", listener);
    };
  },
  wiki: {
    overview: () => ipcRenderer.invoke("wiki:overview"),
    pendingCount: () => ipcRenderer.invoke("wiki:pendingCount"),
    conceptCards: (params) => ipcRenderer.invoke("wiki:conceptCards", params),
    topicCards: (params) => ipcRenderer.invoke("wiki:topicCards", params),
  },
  topic: {
    update: (id, data) => ipcRenderer.invoke("topic:update", id, data),
    delete: (id) => ipcRenderer.invoke("topic:delete", id),
  },
};
