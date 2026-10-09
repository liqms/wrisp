import { ipcRenderer } from "electron";
import type { JournalAPI } from "../types/journal";
import type {
  JournalEntryCreatePayload,
  JournalEntryUpdatePayload,
  JournalEntryView,
  JournalDayView,
  JournalImportResult,
  Id,
  ApiResponse,
} from "@/shared/types";

export const journalModule: JournalAPI = {
  resetJournalTable: () =>
    ipcRenderer.invoke("journal:resetJournalTable") as Promise<
      ApiResponse<number>
    >,
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
