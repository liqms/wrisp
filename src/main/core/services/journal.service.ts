import { Logger } from "@/main/utils/logger";
import { fileService } from "@/main/core/services/base/file.service";
import {
  JournalFileInfo,
  JournalFileCreate,
  JournalFileUpdate,
  Id,
} from "@/shared/types";
import { FileIndexDao } from "@/main/core/db";
import { FileIndexCreate, FileIndexUpdate } from "@/main/types/db";
import { NodeCryptoUtil } from "@/main/utils";
import { TimeUtil } from "@/shared/utils";
import { JOURNAL_DIR } from "@/main/constants/folder.constants";

/**
 * Journal 服务
 * 编排两层存储：
 *   1. md 文件（fileService）
 *   2. 文件索引表（FileIndexDao, file_index 表）
 */
class JournalService {
  private static instance: JournalService;
  private fileIndexDao: FileIndexDao;

  private constructor() {
    this.fileIndexDao = new FileIndexDao();
  }
  /**
   * 获取日志服务实例
   */
  public static getInstance(): JournalService {
    if (!JournalService.instance) {
      JournalService.instance = new JournalService();
    }
    return JournalService.instance;
  }
  /**
   * 获取日志文件路径
   */
  private getJournalFilePath(date: string): string {
    return `${JOURNAL_DIR}/${date}.md`;
  }

  /**
   * 获取今日日期字符串（yyyy-MM-dd）
   */
  private getTodayDateString(): string {
    return TimeUtil.getLocalDateString();
  }

  /**
   * 校验当日是否存在日志文件
   * @param date - 日期字符串（yyyy-MM-dd），默认当天
   * @returns 存在返回 true，否则返回 false
   */
  public checkTodayJournalExists(date?: string): boolean {
    const targetDate = date || this.getTodayDateString();
    const filePath = this.getJournalFilePath(targetDate);
    return fileService.exists(filePath);
  }

  /**
   * 扫描 journal/ 目录下所有以日期格式命名的 .md 文件，构建文件索引数据
   * @returns 文件索引创建数据数组（目录不存在时返回空数组）
   */
  private scanJournalFiles(): FileIndexCreate[] {
    const journalDir = `${JOURNAL_DIR}/`;
    const datePattern = /^(\d{4}-\d{2}-\d{2})\.md$/;

    if (!fileService.exists(journalDir)) {
      Logger.debug("journal 文件夹不存在", { journalDir });
      return [];
    }

    const mdFiles = fileService.listFiles(journalDir, ".md");
    const result: FileIndexCreate[] = [];

    for (const rawPath of mdFiles) {
      const filePath = rawPath.replace(/\\/g, "/");
      const fileName = filePath.split("/").pop() || "";
      const match = fileName.match(datePattern);
      if (!match) continue;

      const fileInfo = fileService.getFileInfo(filePath);
      const now = new Date().toISOString();

      result.push({
        id: NodeCryptoUtil.generateUUID(),
        file_path: filePath,
        file_hash: fileInfo?.hash || "",
        file_size: fileInfo?.size || 0,
        date: match[1],
        name: fileName,
        updated_at: fileInfo?.modifiedAt || now,
        sync_status: "pending",
      });
    }

    return result;
  }

  /**
   * 同步本地日志文件夹中的文件到文件索引表
   * 扫描 journal/ 目录下所有以日期格式命名的 .md 文件，
   * 检查文件索引表中是否已有记录，缺失的自动创建。
   * @returns 新增的文件索引数量
   */
  public syncLocalFiles(): number {
    try {
      const allFiles = this.scanJournalFiles();
      if (allFiles.length === 0) return 0;

      // 过滤掉已存在的记录
      const newFileIndexes = allFiles.filter(
        (f) => !this.fileIndexDao.findByFilePath(f.file_path),
      );

      if (newFileIndexes.length > 0) {
        this.fileIndexDao.createBatch(newFileIndexes);
        Logger.info("本地日志文件同步完成", { count: newFileIndexes.length });
      } else {
        Logger.debug("本地日志文件已全部同步，无需更新");
      }

      return newFileIndexes.length;
    } catch (error) {
      Logger.error("同步本地日志文件失败", { error: String(error) });
      throw error;
    }
  }

  /**
   * 创建日志
   * 1. 写入 md 文件
   * 2. 保存到文件索引表（pages）
   * 3. 委托 chunkService 创建语义块
   * @returns 创建的 block ID
   */
  public create(journal: JournalFileCreate): string {
    const today = journal.date || this.getTodayDateString();
    const filePath = this.getJournalFilePath(today);

    try {
      // 1. 写入 md 文件
      fileService.writeFile(filePath, journal.content);

      // 2. 获取文件基本信息（大小、修改时间、哈希）
      const fileInfo = fileService.getFileInfo(filePath);
      const now = new Date().toISOString();

      // 3. 保存到文件索引表（file_index 表）
      const fileIndexCreate: FileIndexCreate = {
        id: NodeCryptoUtil.generateUUID(),
        file_path: filePath,
        file_hash: fileInfo?.hash || "",
        file_size: fileInfo?.size || 0,
        date: today,
        name: `${today}.md`,
        updated_at: fileInfo?.modifiedAt || now,
        sync_status: "pending",
      };
      this.fileIndexDao.create(fileIndexCreate);

      return fileIndexCreate.id || "";

    } catch (error) {
      Logger.error("创建日志失败", { error: String(error), journal });
      throw error;
    }
  }

  /**
   * 更新日志
   * 1. 委托 chunkService 更新语义块
   * 2. 同步更新 md 文件和文件索引表
   */
  public update(journal: JournalFileUpdate): boolean {
    try {
      const fileIndex = this.fileIndexDao.findById(journal.id);
      if (!fileIndex) {
        throw new Error(`日志不存在，ID: ${journal.id}`);
      }
      const date = fileIndex.date || this.getTodayDateString();
      const filePath = this.getJournalFilePath(date);
      // 更新 md 文件
      fileService.writeFile(filePath, journal.content || "");
      // 更新文件基本信息（大小、修改时间、哈希）
      const fileInfo = fileService.getFileInfo(filePath);

      // 更新文件索引表
      const fileIndexUpdate: FileIndexUpdate = {
        file_size: fileInfo?.size || 0,
        file_hash: fileInfo?.hash || "",
        updated_at: fileInfo?.modifiedAt || "",
        sync_status: "pending",
      };
      this.fileIndexDao.update(fileIndex.id, fileIndexUpdate);

      return true;
    } catch (error) {
      Logger.error("更新日志失败", { error: String(error), journal });
      return false;
    }
  }

  /**
   * 删除日志
   * 1. 检查日志是否存在
   * 2. 先删除本地 md 文件
   * 3. 再删除文件索引表记录
   */
  public delete(id: Id): boolean {
    try {
      const fileIndex = this.fileIndexDao.findById(id);
      if (!fileIndex) {
        throw new Error(`日志不存在，ID: ${id}`);
      }
      const date = fileIndex.date || this.getTodayDateString();
      const filePath = this.getJournalFilePath(date);
      // 先删除 md 文件
      if (fileService.exists(filePath)) {
        fileService.remove(filePath);
      }
      // 再删除文件索引表记录
      this.fileIndexDao.delete(fileIndex.id);
      return true;
    } catch (error) {
      Logger.error("删除日志失败", { error: String(error), id });
      return false;
    }
  }


  /**
   * 根据 journal 文件的实际文件重置 file_index 表
   * 扫描 journal/ 目录下的 .md 文件，清空 file_index 表后重新填充。
   * 注意：此操作会同时清空 semantic_chunks 表（外键引用 file_index）。
   * @returns 重置后的记录数
   */
  public resetJournalTable(): number {
    try {
      const newFileIndexes = this.scanJournalFiles();

      this.fileIndexDao.transaction(() => {
        // 先删除 semantic_chunks（外键引用 file_index）
        this.fileIndexDao.execute("DELETE FROM semantic_chunks");
        // 清空 file_index
        this.fileIndexDao.execute("DELETE FROM file_index");
        // 重新填充
        for (const item of newFileIndexes) {
          this.fileIndexDao.create(item);
        }
      });

      Logger.info("file_index 表重置完成", { count: newFileIndexes.length });
      return newFileIndexes.length;
    } catch (error) {
      Logger.error("重置 file_index 表失败", { error: String(error) });
      throw error;
    }
  }

  /**
   * 查询最近有记录 N 天的日志
   * 从 file_index 表按日期倒序取 N 个有记录的日期，从文件系统读取实际内容
   * @param days 天数，默认为 3
   */
  public getRecentDays(days: number = 3): JournalFileInfo[] {
    try {
      // 按日期倒序取 N 个有记录的日期
      const fileIndexes = this.fileIndexDao.query(
        "SELECT * FROM file_index ORDER BY date DESC LIMIT ?",
        [days],
      );

      const results: JournalFileInfo[] = [];

      for (const fileIndex of fileIndexes) {
        const dateStr = fileIndex.date || "";

        // 读取 md 文件内容
        const filePath = this.getJournalFilePath(dateStr);
        let content = "";
        if (fileService.exists(filePath)) {
          content = fileService.readFile(filePath);
        }

        results.push({
          id: fileIndex.id,
          date: dateStr,
          content,
          createdAt: fileIndex.created_at,
          updatedAt: fileIndex.updated_at,
        });
      }

      return results;
    } catch (error) {
      Logger.error("查询近 N 天日志失败", { error: String(error), days });
      throw error;
    }
  }
}

export default JournalService;

export const journalService = JournalService.getInstance();