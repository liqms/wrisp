import { ipcMain } from "electron";
import {
  createJournal,
  updateJournal,
  deleteJournal,
  getRecentDays,
  checkTodayJournalExists,
  syncLocalFiles,
  resetJournalTable
} from "@/main/core/apis/journal.api";
import type {
  JournalFileCreate,
  JournalFileUpdate,
  JournalFileInfo,
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

  ipcMain.handle(
    "journal:resetJournalTable",
    async (): Promise<ApiResponse<number>> => {
      return resetJournalTable();
    },
  );
}
