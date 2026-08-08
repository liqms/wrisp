import { journalService } from "@/main/core/services/journal.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type {
  JournalFileInfo,
  JournalFileCreate,
  JournalFileUpdate,
  JournalFileQuery,
  Id,
  ApiResponse,
} from "@/shared/types";
import { Logger } from "@/main/utils/logger";

/**
 * 创建日志
 * @param record 创建日志参数
 * @returns 创建的日志 ID
 */
async function createJournal(
  record: JournalFileCreate,
): Promise<ApiResponse<string | null>> {
  try {
    const id = journalService.create(record);
    return response.success(id);
  } catch (error) {
    Logger.error("创建日志失败", { error: String(error), record });
    return response.error(ErrorCode.JOURNAL_CREATE_FAILED, error as Error);
  }
}

/**
 * 更新日志
 * @param record 更新日志参数
 * @returns 更新后的日志 ID
 */
async function updateJournal(
  record: JournalFileUpdate,
): Promise<ApiResponse<boolean>> {
  try {
    const result = journalService.update(record);
    if (!result) {
      return response.error(ErrorCode.JOURNAL_UPDATE_FAILED);
    }
    return response.success(result);
  } catch (error) {
    Logger.error("更新日志失败", { error: String(error), record });
    return response.error(ErrorCode.JOURNAL_UPDATE_FAILED, error as Error);
  }
}

/**
 * 删除日志
 * @param id 日志 ID
 * @returns 删除结果
 */
async function deleteJournal(id: Id): Promise<ApiResponse<boolean>> {
  try {
    const result = journalService.delete(id);
    if (!result) {
      return response.error(ErrorCode.JOURNAL_DELETE_FAILED);
    }
    return response.success(result);
  } catch (error) {
    Logger.error("删除日志失败", { error: String(error), id });
    return response.error(ErrorCode.JOURNAL_DELETE_FAILED, error as Error);
  }
}

/**
 * 获取最近 N 天有记录的日志
 * @param days 天数，默认为 3
 * @returns 日志列表
 */
async function getRecentDays(
  days?: number,
): Promise<ApiResponse<JournalFileInfo[]>> {
  try {
    const records = journalService.getRecentDays(days);
    return response.success(records);
  } catch (error) {
    Logger.error("获取最近日志失败", { error: String(error), days });
    return response.error(ErrorCode.JOURNAL_GET_FAILED, error as Error);
  }
}

/**
 * 校验当日是否存在日志文件
 * @param date - 日期字符串（yyyy-MM-dd），默认当天
 * @returns 存在返回 true，否则返回 false
 */
async function checkTodayJournalExists(
  date?: string,
): Promise<ApiResponse<boolean>> {
  try {
    const exists = journalService.checkTodayJournalExists(date);
    return response.success(exists);
  } catch (error) {
    Logger.error("校验当日日志是否存在失败", { error: String(error), date });
    return response.error(ErrorCode.JOURNAL_GET_FAILED, error as Error);
  }
}

/**
 * 同步本地日志文件夹中的文件到文件索引表
 * 扫描 journal/ 目录下所有以日期格式命名的 .md 文件，
 * 检查文件索引表中是否已有记录，缺失的自动创建。
 * @returns 新增的文件索引数量
 */
async function syncLocalFiles(): Promise<ApiResponse<number>> {
  try {
    const count = journalService.syncLocalFiles();
    return response.success(count);
  } catch (error) {
    Logger.error("同步本地日志文件失败", { error: String(error) });
    return response.error(ErrorCode.JOURNAL_QUERY_FAILED, error as Error);
  }
}

export {
  createJournal,
  updateJournal,
  deleteJournal,
  getRecentDays,
  checkTodayJournalExists,
  syncLocalFiles,
};
