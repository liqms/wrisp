import { ipcRenderer } from "electron";
import type { JournalAPI } from "../types/journal";
import type {
  JournalFileCreate,
  JournalFileUpdate,
  JournalFileInfo,
  Id,
  ApiResponse,
} from "@/shared/types";

export const journalModule: JournalAPI = {
  createJournal: (record: JournalFileCreate) =>
    ipcRenderer.invoke("journal:create", record) as Promise<
      ApiResponse<string | null>
    >,
  updateJournal: (record: JournalFileUpdate) =>
    ipcRenderer.invoke("journal:update", record) as Promise<
      ApiResponse<boolean>
    >,
  deleteJournal: (id: Id) =>
    ipcRenderer.invoke("journal:delete", id) as Promise<ApiResponse<boolean>>,
  getRecentDays: (days?: number) =>
    ipcRenderer.invoke("journal:getRecentDays", days) as Promise<
      ApiResponse<JournalFileInfo[]>
    >,
  checkTodayJournalExists: (date?: string) =>
    ipcRenderer.invoke("journal:checkTodayJournalExists", date) as Promise<
      ApiResponse<boolean>
    >,
  syncLocalFiles: () =>
    ipcRenderer.invoke("journal:syncLocalFiles") as Promise<
      ApiResponse<number>
    >,
  resetJournalTable: () =>
    ipcRenderer.invoke("journal:resetJournalTable") as Promise<
      ApiResponse<number>
    >,
};
