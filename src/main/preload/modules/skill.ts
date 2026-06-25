import { ipcRenderer } from "electron";
import type { SkillAPI } from "../types/skill";

export const skillModule: SkillAPI = {
  getSkills: () => ipcRenderer.invoke("skill:getSkills"),
  getSkill: (id) => ipcRenderer.invoke("skill:getSkill", id),
  getSkillsByCategory: (category) => ipcRenderer.invoke("skill:getSkillsByCategory", category),
  getCategories: () => ipcRenderer.invoke("skill:getCategories"),
  execute: (skillId, inputs) => ipcRenderer.invoke("skill:execute", skillId, inputs),
  createCustomSkill: (definition) => ipcRenderer.invoke("skill:createCustomSkill", definition),
  updateCustomSkill: (id, definition) => ipcRenderer.invoke("skill:updateCustomSkill", id, definition),
  deleteCustomSkill: (id) => ipcRenderer.invoke("skill:deleteCustomSkill", id),
  setSkillEnabled: (id, enabled) => ipcRenderer.invoke("skill:setSkillEnabled", id, enabled),
  checkSkillUpdates: () => ipcRenderer.invoke("skill:checkSkillUpdates"),
  applySkillUpdates: () => ipcRenderer.invoke("skill:applySkillUpdates"),
  getSkillExecutions: (skillId, limit) => ipcRenderer.invoke("skill:getSkillExecutions", skillId, limit),
  getSkillExecutionStats: (skillId) => ipcRenderer.invoke("skill:getSkillExecutionStats", skillId),
};