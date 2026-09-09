import { ipcRenderer, IpcRendererEvent } from "electron";
import type { SkillAPI } from "../types/skill";
import type { SkillStreamChunk } from "@/shared/types/skill.types";

export const skillModule: SkillAPI = {
  getSkills: () => ipcRenderer.invoke("skill:getSkills"),
  getSkill: (id) => ipcRenderer.invoke("skill:getSkill", id),
  getSkillsByCategory: (category) => ipcRenderer.invoke("skill:getSkillsByCategory", category),
  getCategories: () => ipcRenderer.invoke("skill:getCategories"),
  execute: (skillId, inputs) => ipcRenderer.invoke("skill:execute", skillId, inputs),
  executeSkillStream: (skillId, inputs) => ipcRenderer.invoke("skill:executeStream", skillId, inputs),
  onSkillStreamChunk: (callback) => {
    const handler = (_: IpcRendererEvent, chunk: unknown) => callback(chunk as SkillStreamChunk);
    ipcRenderer.on("skill:executeStream:chunk", handler);
    return () => ipcRenderer.removeListener("skill:executeStream:chunk", handler);
  },
  createCustomSkill: (definition) => ipcRenderer.invoke("skill:createCustomSkill", definition),
  updateCustomSkill: (id, definition) => ipcRenderer.invoke("skill:updateCustomSkill", id, definition),
  deleteCustomSkill: (id) => ipcRenderer.invoke("skill:deleteCustomSkill", id),
  setSkillEnabled: (id, enabled) => ipcRenderer.invoke("skill:setSkillEnabled", id, enabled),
  getSkillExecutions: (skillId, limit) => ipcRenderer.invoke("skill:getSkillExecutions", skillId, limit),
  getSkillExecutionStats: (skillId) => ipcRenderer.invoke("skill:getSkillExecutionStats", skillId),
};