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

export interface JournalAPI {
  createJournal(record: JournalFileCreate): Promise<ApiResponse<string | null>>;
  updateJournal(record: JournalFileUpdate): Promise<ApiResponse<boolean>>;
  deleteJournal(id: Id): Promise<ApiResponse<boolean>>;
  getRecentDays(days?: number): Promise<ApiResponse<JournalFileInfo[]>>;
  checkTodayJournalExists(date?: string): Promise<ApiResponse<boolean>>;
  syncLocalFiles(): Promise<ApiResponse<number>>;
  /**
   * 重置日志：channel 名沿用旧「重置 file_index 表」，
   * 条目化后语义为清空 journal_entries 条目（返回清除条目数）
   */
  resetJournalTable(): Promise<ApiResponse<number>>;

  // ───── 条目化接口（spec §6.1） ─────
  appendEntry(record: JournalEntryCreatePayload): Promise<ApiResponse<string>>;
  updateEntry(record: JournalEntryUpdatePayload): Promise<ApiResponse<boolean>>;
  deleteEntry(id: Id): Promise<ApiResponse<boolean>>;
  listEntries(date: string): Promise<ApiResponse<JournalEntryView[]>>;
  listRecentDays(
    days?: number,
    beforeDate?: string,
  ): Promise<ApiResponse<JournalDayView[]>>;
  importDayFile(
    date: string,
    overwrite?: boolean,
  ): Promise<ApiResponse<JournalImportResult>>;
}
