import { journalService } from "@/main/core/services/content/journal.service";
import { isJournalDate } from "@/main/core/services/content/journal/journal-render";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type {
  JournalEntryCreatePayload,
  JournalEntryUpdatePayload,
  JournalEntryView,
  JournalDayView,
  JournalImportResult,
  Id,
  ApiResponse,
} from "@/shared/types";
import { Logger } from "@/main/utils/logger";

/**
 * 重置日志条目（channel 名沿用 `journal:resetJournalTable`，语义已切到条目化真源）
 * 清空 journal_entries 及其标签 / 作品关联，并一并清掉日志语义块（含孤儿向量），
 * 取代条目化前的「按整篇文件重置 file_index」。
 * @returns 清除的条目数
 */
async function resetJournalTable(): Promise<ApiResponse<number>> {
  try {
    const count = journalService.resetEntries();
    return response.success(count);
  } catch (error) {
    Logger.error("重置日志条目失败", { error: String(error) });
    return response.error(ErrorCode.JOURNAL_QUERY_FAILED, error as Error);
  }
}

// ───── 条目化 channel（spec §6.1；journal_entries 为真源） ─────

/**
 * 追加一条日志条目
 * @param record 条目内容 / 时刻 / 来源 / 类型
 * @returns 条目 ID
 */
async function appendEntry(
  record: JournalEntryCreatePayload,
): Promise<ApiResponse<string>> {
  try {
    const id = journalService.appendEntry(record);
    return response.success(id);
  } catch (error) {
    Logger.error("追加日志条目失败", { error: String(error), record });
    return response.error(ErrorCode.JOURNAL_CREATE_FAILED, error as Error);
  }
}

/**
 * 更新一条日志条目（内容 / 时刻）
 * @param record 条目 ID + 待更新字段
 * @returns 是否真的改了行（false=并发删除致 0 行，success 仍为 true，store 侧按 no-op 自愈）
 */
async function updateEntry(
  record: JournalEntryUpdatePayload,
): Promise<ApiResponse<boolean>> {
  try {
    return response.success(journalService.updateEntry(record));
  } catch (error) {
    Logger.error("更新日志条目失败", { error: String(error), record });
    return response.error(ErrorCode.JOURNAL_UPDATE_FAILED, error as Error);
  }
}

/**
 * 软删除一条日志条目
 * @param id 条目 ID
 * @returns 是否真的删了行（false=已软删/不存在，success 仍为 true，store 侧按 no-op 自愈）
 */
async function deleteEntry(id: Id): Promise<ApiResponse<boolean>> {
  try {
    return response.success(journalService.deleteEntry(id));
  } catch (error) {
    Logger.error("删除日志条目失败", { error: String(error), id });
    return response.error(ErrorCode.JOURNAL_DELETE_FAILED, error as Error);
  }
}

// date 必须过 isJournalDate：它会拼进 journal/{date}.md（resolvePath 只防越出工作区）
const MAX_JOURNAL_TIMELINE_DAYS = 366;

/**
 * 当日未删除条目（含标签 / 作品关联）
 * @param date 日期（yyyy-MM-dd）
 * @returns 条目视图数组
 */
async function listEntries(date: string): Promise<ApiResponse<JournalEntryView[]>> {
  if (!isJournalDate(date)) {
    return response.error(ErrorCode.COMMON_INVALID_PARAMETER);
  }
  try {
    const entries = journalService.listEntries(date);
    return response.success(entries);
  } catch (error) {
    Logger.error("查询当日日志条目失败", { error: String(error), date });
    return response.error(ErrorCode.JOURNAL_GET_FAILED, error as Error);
  }
}

/**
 * 最近若干天的条目时间线（替代旧 getRecentDays，支撑无限滚动）
 * @param days 天数，默认 3
 * @param beforeDate 翻页游标（返回严格早于该日期的窗口）
 * @returns 按日期倒序的日视图数组
 */
async function listRecentDays(
  days?: number,
  beforeDate?: string,
): Promise<ApiResponse<JournalDayView[]>> {
  const daysValid =
    days === undefined || (Number.isInteger(days) && days >= 1 && days <= MAX_JOURNAL_TIMELINE_DAYS);
  if (!daysValid || (beforeDate !== undefined && !isJournalDate(beforeDate))) {
    return response.error(ErrorCode.COMMON_INVALID_PARAMETER);
  }
  try {
    const records = journalService.listRecentDays(days, beforeDate);
    return response.success(records);
  } catch (error) {
    Logger.error("查询最近日志条目失败", { error: String(error), days, beforeDate });
    return response.error(ErrorCode.JOURNAL_GET_FAILED, error as Error);
  }
}

/**
 * 显式导入当日旧版整篇 `.md`，拆成条目并接管该日
 * @param date 日期（yyyy-MM-dd）
 * @param overwrite 当日已有条目时是否仍按 id 合并
 * @returns 导入 / 更新 / 跳过计数
 */
async function importDayFile(
  date: string,
  overwrite?: boolean,
): Promise<ApiResponse<JournalImportResult>> {
  if (!isJournalDate(date)) {
    return response.error(ErrorCode.COMMON_INVALID_PARAMETER);
  }
  try {
    const result = journalService.importDayFile(date, overwrite);
    return response.success(result);
  } catch (error) {
    Logger.error("导入当日日志文件失败", { error: String(error), date, overwrite });
    return response.error(ErrorCode.JOURNAL_CREATE_FAILED, error as Error);
  }
}

export {
  resetJournalTable,
  appendEntry,
  updateEntry,
  deleteEntry,
  listEntries,
  listRecentDays,
  importDayFile,
};
