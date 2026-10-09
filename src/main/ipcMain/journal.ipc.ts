import { ipcMain } from "electron";
import {
  createJournal,
  updateJournal,
  deleteJournal,
  getRecentDays,
  checkTodayJournalExists,
  syncLocalFiles,
  resetJournalTable,
  appendEntry,
  updateEntry,
  deleteEntry,
  listEntries,
  listRecentDays,
  importDayFile
} from "@/main/core/apis/journal.api";
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

export function registerJournalHandlers(): void {
  ipcMain.handle(
    "journal:create",
    async (
      _,
      record: JournalFileCreate,
    ): Promise<ApiResponse<string | null>> => {
      return createJournal(record);
    },
  );

  ipcMain.handle(
    "journal:update",
    async (
      _,
      record: JournalFileUpdate,
    ): Promise<ApiResponse<boolean>> => {
      return updateJournal(record);
    },
  );

  ipcMain.handle(
    "journal:delete",
    async (_, id: Id): Promise<ApiResponse<boolean>> => {
      return deleteJournal(id);
    },
  );

  ipcMain.handle(
    "journal:getRecentDays",
    async (_, days?: number): Promise<ApiResponse<JournalFileInfo[]>> => {
      return getRecentDays(days);
    },
  );

  ipcMain.handle(
    "journal:checkTodayJournalExists",
    async (_, date?: string): Promise<ApiResponse<boolean>> => {
      return checkTodayJournalExists(date);
    },
  );

  ipcMain.handle(
    "journal:syncLocalFiles",
    async (): Promise<ApiResponse<number>> => {
      return syncLocalFiles();
    },
  );

  // channel 名沿用旧「重置 file_index 表」，语义已切到清空日志条目（返回清除条目数）
  ipcMain.handle(
    "journal:resetJournalTable",
    async (): Promise<ApiResponse<number>> => {
      return resetJournalTable();
    },
  );

  // ───── 条目化 channel（spec §6.1） ─────

  ipcMain.handle(
    "journal:appendEntry",
    async (
      _,
      record: JournalEntryCreatePayload,
    ): Promise<ApiResponse<string>> => {
      return appendEntry(record);
    },
  );

  ipcMain.handle(
    "journal:updateEntry",
    async (
      _,
      record: JournalEntryUpdatePayload,
    ): Promise<ApiResponse<boolean>> => {
      return updateEntry(record);
    },
  );

  ipcMain.handle(
    "journal:deleteEntry",
    async (_, id: Id): Promise<ApiResponse<boolean>> => {
      return deleteEntry(id);
    },
  );

  ipcMain.handle(
    "journal:listEntries",
    async (_, date: string): Promise<ApiResponse<JournalEntryView[]>> => {
      return listEntries(date);
    },
  );

  ipcMain.handle(
    "journal:listRecentDays",
    async (
      _,
      days?: number,
      beforeDate?: string,
    ): Promise<ApiResponse<JournalDayView[]>> => {
      return listRecentDays(days, beforeDate);
    },
  );

  ipcMain.handle(
    "journal:importDayFile",
    async (
      _,
      date: string,
      overwrite?: boolean,
    ): Promise<ApiResponse<JournalImportResult>> => {
      return importDayFile(date, overwrite);
    },
  );
}
