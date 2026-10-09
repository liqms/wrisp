import { Logger } from "@/main/utils/logger";
import { fileService } from "@/main/core/services/base/file.service";
import {
  JournalFileInfo,
  JournalFileCreate,
  JournalFileUpdate,
  JournalEntryCreatePayload,
  JournalEntryUpdatePayload,
  JournalEntryView,
  JournalDayView,
  JournalImportResult,
  Id,
} from "@/shared/types";
import { JOURNAL_ENTRY_SOURCE, JOURNAL_ENTRY_TYPE } from "@/shared/enums";
import { ChunkDao, FileIndexDao, JournalEntryDao, ProjectDao } from "@/main/core/db";
import {
  FileIndexCreate,
  FileIndexUpdate,
  JournalEntryRowUpdate,
} from "@/main/types/db";
import { NodeCryptoUtil } from "@/main/utils";
import { TimeUtil } from "@/shared/utils";
import { JOURNAL_DIR } from "@/main/constants/folder.constants";
import { inlineTokenSyncService } from "@/main/core/services/content/inline-token-sync.service";
import { chunkIndexService } from "@/main/core/services/content/chunk-index.service";
import { chunkService } from "@/main/core/services/content/chunk.service";
import { parseEntryTokens } from "./journal/journal-entry.tokens";
import { renderJournalDay, parseJournalDayFile } from "./journal/journal-render";
import { tagService } from "@/main/core/services/project/tag.service";
import { characterService } from "@/main/core/services/content/character.service";

/**
 * Journal 服务
 * 编排两层存储：
 *   1. md 文件（fileService）
 *   2. 文件索引表（FileIndexDao, file_index 表）
 *
 * 条目化改造（spec §6）后，`journal_entries` 表是唯一真源，md 文件是它的确定性渲染产物；
 * 文件级方法（create/update/delete/getRecentDays/syncLocalFiles/resetJournalTable）
 * 仍在为旧路径服务，Task 10 移除。
 */
class JournalService {
  private static instance: JournalService;
  private fileIndexDao: FileIndexDao;
  private chunkDao: ChunkDao;
  /**
   * 条目 DAO / 作品 DAO：条目路径与旧文件路径共存，延迟到首次使用才实例化
   * （与 ChunkIndexService 同一惯例，避免模块加载时强制所有 mock 了 `@/main/core/db`
   * 的既有用例补新桩）。
   */
  private journalEntryDaoInstance: JournalEntryDao | null = null;
  private projectDaoInstance: ProjectDao | null = null;

  private constructor() {
    this.fileIndexDao = new FileIndexDao();
    this.chunkDao = new ChunkDao();
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

  private get journalEntryDao(): JournalEntryDao {
    return (this.journalEntryDaoInstance ??= new JournalEntryDao());
  }

  private get projectDao(): ProjectDao {
    return (this.projectDaoInstance ??= new ProjectDao());
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
        const ids = this.fileIndexDao.createBatch(newFileIndexes);
        // 新增索引（含首次补齐的历史文件）逐个调度切分
        ids.forEach((id, i) => {
          chunkIndexService.schedule(id, newFileIndexes[i].file_hash || "");
        });
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
   * 2. 保存到文件索引表（file_index）
   * 3. 调度语义块切分（静默窗口合并，由任务队列异步执行）
   * @returns 文件索引 ID
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
      // 调度语义块切分（静默窗口合并，由任务队列异步执行）
      const fileIndexId = this.fileIndexDao.create(fileIndexCreate);
      // 以库中实际记录为准取 hash：路径已存在时 create 返回既有记录且不更新字段
      const stored = this.fileIndexDao.findById(fileIndexId);
      chunkIndexService.schedule(fileIndexId, stored?.file_hash || "");

      return fileIndexId;

    } catch (error) {
      Logger.error("创建日志失败", { error: String(error), journal });
      throw error;
    }
  }

  /**
   * 更新日志
   * 1. 同步更新 md 文件和文件索引表
   * 2. 同步行内 token（#标签 / @人物）
   * 3. 调度语义块切分（静默窗口合并，由任务队列异步执行）
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

      // 调度语义块切分（静默窗口合并，由任务队列异步执行）
      chunkIndexService.schedule(fileIndex.id, fileIndexUpdate.file_hash || "");

      // 同步行内 token：#标签入标签表、@人物入人物表（失败不影响保存）
      inlineTokenSyncService.syncFromMarkdown(journal.content || "", {
        type: "contact",
      });

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
   * 注意：此操作仅作用于日志子集——清空 chunk_type = 'journal' 的语义块及其
   * 无级联外键关联（semantic_links / temporal_events），并删除 journal/ 下的
   * file_index 记录；作品页面等其它来源不受影响。事务提交后重新调度全部日志
   * 文件的切分，以重建日志语义块。
   *
   * 被删块的 LanceDB 向量行同样要清：向量层没有外键级联，不清就留下永远命中不到
   * 正文的孤儿向量，白占 ANN 召回名额。清理放在事务提交之后（回滚时块还在，向量
   * 不能跟着删），且异步不阻塞——向量层是可重建的派生数据，删除失败只记日志。
   *
   * @returns 重置后的记录数
   */
  public async resetJournalTable(): Promise<number> {
    try {
      const newFileIndexes = this.scanJournalFiles();

      // 仅作用于日志子集：file_index / semantic_chunks 同时承载日志与作品页面
      // （方案 A），重置时不得误删页面语义块及其文件索引
      const journalChunkIds = "SELECT id FROM semantic_chunks WHERE chunk_type = 'journal'";
      const createdIds: string[] = [];
      let staleChunkIds: string[] = [];
      this.fileIndexDao.transaction(() => {
        // 先清理引用日志语义块且未声明 ON DELETE CASCADE 的关联表，
        // 否则随后的删除会触发 FOREIGN KEY constraint failed
        this.fileIndexDao.execute(
          `DELETE FROM semantic_links WHERE source_chunk_id IN (${journalChunkIds}) OR target_chunk_id IN (${journalChunkIds})`,
        );
        this.fileIndexDao.execute(
          `DELETE FROM temporal_events WHERE chunk_id IN (${journalChunkIds})`,
        );
        // 记下要被删掉的块 id，供事务提交后清理向量
        staleChunkIds = (
          this.chunkDao.query(
            "SELECT id FROM semantic_chunks WHERE chunk_type = 'journal'",
          ) as Array<{ id: string }>
        ).map((row) => row.id);
        // 再删除日志语义块（外键引用 file_index）
        this.fileIndexDao.execute("DELETE FROM semantic_chunks WHERE chunk_type = 'journal'");
        // external-content FTS 不随主表自动同步，删除后需重建索引（含保留的页面块）
        this.chunkDao.rebuildFts();
        // 仅删除日志目录下的文件索引，保留作品页面等其他来源
        this.fileIndexDao.execute("DELETE FROM file_index WHERE file_path LIKE ?", [
          `${JOURNAL_DIR}/%`,
        ]);
        // 重新填充（记录实际生成的 id，供事务提交后调度切分）
        for (const item of newFileIndexes) {
          createdIds.push(this.fileIndexDao.create(item));
        }
      });

      await chunkService.dropVectorsByIds(staleChunkIds);

      // 事务提交后再调度切分：语义块已被清空，需重新切分才能回填；
      // 且 processFile 依赖已落库的 file_index 记录
      newFileIndexes.forEach((item, index) => {
        chunkIndexService.schedule(createdIds[index], item.file_hash || "");
      });

      Logger.info("file_index 表重置完成", {
        count: newFileIndexes.length,
        vectorsDropped: staleChunkIds.length,
      });
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

  // ──────────────────────────────────────────────────────────────
  // 条目化路径（spec §4~§7）：journal_entries 为真源，md 为渲染产物
  // ──────────────────────────────────────────────────────────────

  /**
   * 追加一条日志条目
   * 1. 正文写入即 trim（渲染产物与库内容逐字节一致）
   * 2. occurred_at 一律归一为带时区的 UTC ISO，date 由本地时区派生
   * 3. 后置管线：关联重建 → 当日重渲染 → 按日切块调度
   * @returns 条目 ID
   */
  public appendEntry(record: JournalEntryCreatePayload): string {
    const content = this.normalizeEntryContent(record.content);
    const occurredAt = this.normalizeOccurredAt(record.occurredAt);
    const date = TimeUtil.format(occurredAt, "YYYY-MM-DD");
    const now = new Date().toISOString();

    const id = this.journalEntryDao.create({
      date,
      occurred_at: occurredAt,
      source: record.source || JOURNAL_ENTRY_SOURCE.DESKTOP,
      type: record.type || JOURNAL_ENTRY_TYPE.TEXT,
      content,
      attachments: record.attachments ? JSON.stringify(record.attachments) : null,
      metadata: record.metadata ? JSON.stringify(record.metadata) : null,
      created_at: now,
      updated_at: now,
    });

    this.afterEntryWrite(id, content, date);
    return id;
  }

  /**
   * 更新一条日志条目（内容 / 时刻可任选其一或同时）
   * 改了 occurred_at 且跨日时，新旧两天的日文件都要重渲染、都要调度切块，
   * 否则旧日文件会一直留着这条目的陈旧副本。
   * @returns 条目存在并更新成功返回 true，条目不存在返回 false
   */
  public updateEntry(record: JournalEntryUpdatePayload): boolean {
    const row = this.journalEntryDao.findById(record.id);
    if (!row) return false;

    const updates: JournalEntryRowUpdate = {};
    let content = row.content;
    if (record.content !== undefined) {
      content = this.normalizeEntryContent(record.content);
      updates.content = content;
    }

    const oldDate = row.date;
    let newDate = oldDate;
    if (record.occurredAt !== undefined) {
      const occurredAt = this.normalizeOccurredAt(record.occurredAt);
      updates.occurred_at = occurredAt;
      newDate = TimeUtil.format(occurredAt, "YYYY-MM-DD");
      if (newDate !== oldDate) updates.date = newDate;
    }
    updates.updated_at = new Date().toISOString();

    this.journalEntryDao.update(record.id, updates);
    this.afterEntryWrite(record.id, content, oldDate, newDate);
    return true;
  }

  /**
   * 软删除一条日志条目（写 deleted_at 留 tombstone，导入不复活）
   * 关联即刻清空；该条目的语义块由按日切块任务收敛。
   * @returns 删除成功返回 true，条目不存在或已删除返回 false
   */
  public deleteEntry(id: Id): boolean {
    const row = this.journalEntryDao.findById(id);
    if (!row || row.deleted_at) return false;

    const now = new Date().toISOString();
    if (this.journalEntryDao.softDelete(id, now) === 0) return false;

    this.journalEntryDao.replaceAssociations(id, [], [], now);
    this.ensureDayFile(row.date);
    chunkIndexService.scheduleJournalDay(row.date);
    return true;
  }

  /**
   * 当日未删除条目（occurred_at 升序），标签 / 作品由后端 JOIN 带出
   */
  public listEntries(date: string): JournalEntryView[] {
    return this.journalEntryDao.assembleViews([date])[0]?.entries ?? [];
  }

  /**
   * 最近若干天的时间线视图（替代旧 getRecentDays，支撑无限滚动）
   * 取「有条目的日期 ∪ 待导入的旧文件日期 ∪ 今天」，按日期倒序截断后组装。
   * @param days 天数，默认 3
   * @param beforeDate 翻页游标（返回严格早于该日期的窗口）
   */
  public listRecentDays(days: number = 3, beforeDate?: string): JournalDayView[] {
    const limit = days + 1;
    const entryDates = this.journalEntryDao.listActiveDates(limit, beforeDate);
    const legacyDates = this.journalEntryDao
      .listLegacyDates(limit)
      .filter((date) => !beforeDate || date < beforeDate);

    const merged = new Set([...entryDates, ...legacyDates]);
    // 今天恒在首页（可能还没有条目，UI 需要这块空日容器承载录入口）；
    // 翻页时整个窗口在游标之下，不能再注入今天，否则无限滚动会把当天塞进历史页。
    if (!beforeDate) {
      merged.add(this.getTodayDateString());
    }

    const dates = [...merged].sort((a, b) => b.localeCompare(a)).slice(0, limit);
    return this.journalEntryDao.assembleViews(dates);
  }

  /**
   * 显式导入当日 `.md`（spec §5.3）：把旧版整篇日志拆成条目并接管该日。
   * 带注释条目按 id upsert（tombstone 优先、last-write-wins），
   * 裸时间戳条目走确定性 id，重复导入自然幂等。
   * 有任何插入/更新时走与 appendEntry 相同的后置管线（关联重建 + 渲染接管 + 调度）。
   * @param date 目标日期（YYYY-MM-DD）
   * @param overwrite 当日已有条目时是否仍按 id 合并（默认 false：整日跳过）
   */
  public importDayFile(date: string, overwrite: boolean = false): JournalImportResult {
    const result: JournalImportResult = { imported: 0, updated: 0, skipped: 0 };
    const filePath = this.getJournalFilePath(date);
    if (!fileService.exists(filePath)) return result;

    const parsed = parseJournalDayFile(date, fileService.readFile(filePath));
    const existingRows = this.journalEntryDao.listAllByDate(date);
    const existingActive = existingRows.filter((row) => !row.deleted_at);
    if (existingActive.length > 0 && !overwrite) {
      result.skipped = parsed.length;
      return result;
    }

    const byId = new Map(existingRows.map((row) => [row.id, row]));
    for (const item of parsed) {
      // 解析器已 trim 正文（且不会产出空正文），此处只做类型层面的兜底
      const content = (item.content || "").trim();
      const occurredAt = this.normalizeOccurredAt(item.occurred_at);
      const current = byId.get(item.id);
      if (!current) {
        const now = new Date().toISOString();
        this.journalEntryDao.create({
          id: item.id,
          date,
          occurred_at: occurredAt,
          source: item.source,
          type: item.type,
          content,
          attachments: item.attachments ? JSON.stringify(item.attachments) : null,
          metadata: item.metadata ? JSON.stringify(item.metadata) : null,
          created_at: now,
          // updated_at 列 NOT NULL：解析不出 u 的条目（旧格式）以当前时刻兜底
          updated_at: item.updated_at || now,
        });
        this.syncEntryAssociations(item.id, content);
        result.imported += 1;
      } else if (current.deleted_at) {
        // tombstone 优先：导入既不删除也不复活
        result.skipped += 1;
      } else if (item.updated_at && item.updated_at > current.updated_at) {
        this.journalEntryDao.update(item.id, {
          content,
          occurred_at: occurredAt,
          updated_at: item.updated_at,
        });
        this.syncEntryAssociations(item.id, content);
        result.updated += 1;
      } else if (!item.has_meta && content !== current.content) {
        // 推断条目内容变了（旧文件被手工编辑）：按确定性 id 收敛为一次更新
        this.journalEntryDao.update(item.id, { content });
        this.syncEntryAssociations(item.id, content);
        result.updated += 1;
      } else {
        result.skipped += 1;
      }
    }

    if (result.imported > 0 || result.updated > 0) {
      this.ensureDayFile(date);
      chunkIndexService.scheduleJournalDay(date);
    }
    return result;
  }

  /**
   * 重置日志条目：清空 journal_entries 及其 tagged_items / journal_entry_projects 关联，
   * 并一并清掉 journal 语义块（含其向量）。沿用 `journal:resetJournalTable` channel 名。
   * @returns 清除的条目数
   */
  public resetEntries(): number {
    try {
      // 只作用于日志子集：semantic_chunks 同时承载作品页面块
      const journalChunkIds = "SELECT id FROM semantic_chunks WHERE chunk_type = 'journal'";
      let staleChunkIds: string[] = [];
      let cleared = 0;

      this.journalEntryDao.transaction(() => {
        // 先清引用日志块且未声明 ON DELETE CASCADE 的关联表（concept/topic_chunks 有级联），
        // 否则删块会触发 FOREIGN KEY constraint failed
        this.journalEntryDao.execute(
          `DELETE FROM semantic_links WHERE source_chunk_id IN (${journalChunkIds}) OR target_chunk_id IN (${journalChunkIds})`,
        );
        this.journalEntryDao.execute(
          `DELETE FROM temporal_events WHERE chunk_id IN (${journalChunkIds})`,
        );
        // 记下要被删掉的块 id，供事务提交后清理向量
        staleChunkIds = (
          this.chunkDao.query(
            "SELECT id FROM semantic_chunks WHERE chunk_type = 'journal'",
          ) as unknown as Array<{ id: string }>
        ).map((row) => row.id);
        this.journalEntryDao.execute("DELETE FROM semantic_chunks WHERE chunk_type = 'journal'");
        // external-content FTS 不随主表自动同步，删除后需重建索引（含保留的页面块）
        this.chunkDao.rebuildFts();

        // tagged_items 是按 entity_type 多态的关联表，无外键指向条目，必须显式清
        this.journalEntryDao.execute("DELETE FROM tagged_items WHERE entity_type = 'journal_entry'");
        this.journalEntryDao.execute("DELETE FROM journal_entry_projects");

        const countRow = this.journalEntryDao.queryOne(
          "SELECT COUNT(*) AS n FROM journal_entries",
        ) as unknown as { n: number } | null;
        cleared = Number(countRow?.n ?? 0);
        this.journalEntryDao.execute("DELETE FROM journal_entries");
      });

      // 向量层没有外键级联，不清就留下命中不到正文的孤儿向量；
      // 放在事务提交之后：回滚时块还在，向量不能跟着删
      void chunkService.dropVectorsByIds(staleChunkIds).catch((error: unknown) => {
        Logger.error("清理日志条目向量失败", { error: String(error) });
      });

      Logger.info("日志条目重置完成", {
        cleared,
        vectorsDropped: staleChunkIds.length,
      });
      return cleared;
    } catch (error) {
      Logger.error("重置日志条目失败", { error: String(error) });
      throw error;
    }
  }

  /**
   * 条目写入后的统一后置管线：关联重建 → 涉及日期各自重渲染 + 调度切块。
   * 传入多个日期时（跨日改时刻）逐个处理，重复日期只处理一次。
   */
  private afterEntryWrite(entryId: Id, content: string, ...dates: string[]): void {
    this.syncEntryAssociations(entryId, content);
    for (const date of new Set(dates.filter((d) => d))) {
      this.ensureDayFile(date);
      chunkIndexService.scheduleJournalDay(date);
    }
  }

  /**
   * 按条目正文重建关联（spec §4.5）：#标签 → 建标签后解析 id；&作品 → 精确名后模糊兜底；
   * @人物 → contact 归属。失败只记日志，不阻断条目落库。
   */
  private syncEntryAssociations(entryId: string, content: string): void {
    try {
      const tokens = parseEntryTokens(content);
      const now = new Date().toISOString();

      if (tokens.tags.length > 0) {
        tagService.createTags(tokens.tags.map((name) => ({ name })));
      }
      const tagIds = this.journalEntryDao.findTagIdsByNames(tokens.tags).map((row) => row.id);
      const projectIds = this.resolveProjectIds(tokens.projects);
      if (tokens.characters.length > 0) {
        characterService.upsertByName(tokens.characters, { type: "contact" });
      }

      this.journalEntryDao.replaceAssociations(entryId, tagIds, projectIds, now);
    } catch (error) {
      Logger.error("同步日志条目关联失败", { error: String(error), entryId });
    }
  }

  /**
   * 作品名解析：先按精确名（DAO），未命中的再按名模糊检索取首个；
   * 仍未命中只提示不建关联（spec §4.5）。
   * 名称只去首尾空白、不裁剪标点——带空格/标点的作品请用 `&[作品 名]` 方括号形式。
   */
  private resolveProjectIds(names: string[]): string[] {
    if (names.length === 0) return [];
    const exact = new Map(
      this.journalEntryDao.findProjectIdsByNames(names).map((row) => [row.name, row.id]),
    );
    const ids: string[] = [];
    for (const name of names) {
      let id = exact.get(name);
      if (!id) {
        id = this.projectDao.findByNameLike(name)[0]?.id;
      }
      if (id && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }

  /**
   * 渲染并覆写当日 md（spec §5.1 渲染保护）：
   * 当日零条目、且文件已存在且非空（旧版整篇日志）时**绝不覆盖**——
   * 历史内容只能通过 journal:importDayFile 显式导入。
   * 写文件后维护 file_index 行（hash/size/日期/文件名）并置 pending，
   * 让既有的文件同步链路看见这次内容变化。
   */
  private ensureDayFile(date: string): void {
    const filePath = this.getJournalFilePath(date);
    const entries = this.journalEntryDao.listActiveByDate(date);

    if (entries.length === 0 && fileService.exists(filePath)) {
      const existing = fileService.readFile(filePath);
      if (existing && existing.trim() !== "") return; // 旧版整篇日志：绝不覆盖
    }

    const md = renderJournalDay(
      date,
      entries.map((row) => ({
        id: row.id,
        occurred_at: row.occurred_at,
        source: row.source,
        type: row.type,
        content: row.content,
        attachments: this.parseJsonColumn<string[]>(row.attachments),
        metadata: this.parseJsonColumn<Record<string, unknown>>(row.metadata),
        updated_at: row.updated_at,
      })),
    );
    fileService.writeFile(filePath, md);

    const info = fileService.getFileInfo(filePath);
    const now = new Date().toISOString();
    const index = this.fileIndexDao.findByFilePath(filePath);
    if (index) {
      const update: FileIndexUpdate = {
        file_hash: info?.hash || "",
        file_size: info?.size || 0,
        updated_at: info?.modifiedAt || now,
        sync_status: "pending",
      };
      this.fileIndexDao.update(index.id, update);
    } else {
      const create: FileIndexCreate = {
        id: NodeCryptoUtil.generateUUID(),
        file_path: filePath,
        file_hash: info?.hash || "",
        file_size: info?.size || 0,
        date,
        name: `${date}.md`,
        updated_at: info?.modifiedAt || now,
        sync_status: "pending",
      };
      this.fileIndexDao.create(create);
    }
  }

  /** 正文写入即 trim：渲染产物与库中正文逐字节一致，空正文一律拒绝 */
  private normalizeEntryContent(content: string | undefined): string {
    const trimmed = (content ?? "").trim();
    if (trimmed === "") {
      throw new Error("日志条目内容不能为空");
    }
    return trimmed;
  }

  /**
   * 条目时刻一律归一为带时区的 UTC ISO（spec §4.1）。
   * naive 串（无偏移，如解析器给的老格式 `2026-10-08T09:30:00`）按本地时区解释，
   * 否则 TimeUtil.format 与 new Date() 的时区口径会在 date 派生上分叉。
   */
  private normalizeOccurredAt(occurredAt?: string): string {
    const value = occurredAt || new Date().toISOString();
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`无法解析条目时间：${occurredAt}`);
    }
    return parsed.toISOString();
  }

  /** JSON TEXT 列反序列化（列的序列化/反序列化归 Service，DAO 只见 TEXT） */
  private parseJsonColumn<T>(raw: string | null): T | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      Logger.warn("日志条目 JSON 列解析失败，按空值处理", { error: String(error) });
      return null;
    }
  }
}

export default JournalService;

export const journalService = JournalService.getInstance();