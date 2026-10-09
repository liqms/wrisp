import { ipcRenderer } from "electron";
import type { JournalAPI } from "../types/journal";
import type {
  JournalFileCreate,
  JournalFileUpdate,
  JournalFileInfo,
  JournalEntryCreatePayload,
  JournalEntryUpdatePayload,
  JournalEntryView,
  JournalDayView,
  JournalImportResult,
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

  // ───── 条目化接口（spec §6.1） ─────
  appendEntry: (record: JournalEntryCreatePayload) =>
    ipcRenderer.invoke("journal:appendEntry", record) as Promise<
      ApiResponse<string>
    >,
  updateEntry: (record: JournalEntryUpdatePayload) =>
    ipcRenderer.invoke("journal:updateEntry", record) as Promise<
      ApiResponse<boolean>
    >,
  deleteEntry: (id: Id) =>
    ipcRenderer.invoke("journal:deleteEntry", id) as Promise<
      ApiResponse<boolean>
    >,
  listEntries: (date: string) =>
    ipcRenderer.invoke("journal:listEntries", date) as Promise<
      ApiResponse<JournalEntryView[]>
    >,
  listRecentDays: (days?: number, beforeDate?: string) =>
    ipcRenderer.invoke("journal:listRecentDays", days, beforeDate) as Promise<
      ApiResponse<JournalDayView[]>
    >,
  importDayFile: (date: string, overwrite?: boolean) =>
    ipcRenderer.invoke("journal:importDayFile", date, overwrite) as Promise<
      ApiResponse<JournalImportResult>
    >,
};
