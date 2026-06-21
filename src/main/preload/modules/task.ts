import { ipcRenderer } from "electron";
import type { TaskAPI } from "../types/task";

export const taskModule: TaskAPI = {
  enqueue: (input) => ipcRenderer.invoke("task:enqueue", input),
  getTask: (taskId) => ipcRenderer.invoke("task:get", taskId),
  getTasksByGroup: (groupId) => ipcRenderer.invoke("task:getByGroup", groupId),
  cancel: (taskId) => ipcRenderer.invoke("task:cancel", taskId),
  getProgress: (groupId) => ipcRenderer.invoke("task:progress", groupId),
};