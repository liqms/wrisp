import type {
  JournalEntryCreatePayload,
  JournalEntryUpdatePayload,
  JournalEntryView,
  JournalDayView,
  JournalImportResult,
  Id,
  ApiResponse,
} from "@/shared/types";

/**
 * 条目化后 Journal 的全部对外能力（spec §6.1）：整篇文档级接口已随 Task 10 移除。
 */
export interface JournalAPI {
  /**
   * 重置日志：channel 名沿用旧「重置 file_index 表」，
   * 条目化后语义为清空 journal_entries 条目（返回清除条目数）
   */
  resetJournalTable(): Promise<ApiResponse<number>>;
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
