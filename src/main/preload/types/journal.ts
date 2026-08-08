import type {
  JournalFileCreate,
  JournalFileUpdate,
  JournalFileInfo,
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
}
