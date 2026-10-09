import { Logger } from "@/main/utils/logger";
import { fileService } from "@/main/core/services/base/file.service";
import {
  JournalEntryCreatePayload,
  JournalEntryUpdatePayload,
  JournalEntryView,
  JournalDayView,
  JournalImportResult,
  Id,
} from "@/shared/types";
import {
  JOURNAL_ENTRY_SOURCE,
  JOURNAL_ENTRY_TYPE,
  type JournalEntrySource,
  type JournalEntryType,
} from "@/shared/enums";
import { ChunkDao, FileIndexDao, JournalEntryDao, ProjectDao } from "@/main/core/db";
import {
  FileIndexCreate,
  FileIndexUpdate,
  JournalEntryRowUpdate,
} from "@/main/types/db";
import { NodeCryptoUtil } from "@/main/utils";
import { TimeUtil } from "@/shared/utils";
import { JOURNAL_DIR } from "@/main/constants/folder.constants";
import { chunkIndexService } from "@/main/core/services/content/chunk-index.service";
import { chunkService } from "@/main/core/services/content/chunk.service";
import { parseEntryTokens } from "./journal/journal-entry.tokens";
import {
  renderJournalDay,
  parseJournalDayFile,
  isEntryOwnedJournalMarkdown,
} from "./journal/journal-render";
import { tagService } from "@/main/core/services/project/tag.service";
import { characterService } from "@/main/core/services/content/character.service";

/**
 * Journal 服务
 * 编排两层存储：
 *   1. `journal_entries` 表（唯一真源）
 *   2. 当日 md 文件（`journal/{date}.md`，真源的确定性渲染产物）+ 文件索引表（file_index）
 *
 * 条目化改造（spec §6）后**只有这一条写入路径**：整篇文档的旧写入路径
 * （create/update/delete/getRecentDays/checkTodayJournalExists/syncLocalFiles/scanJournalFiles）
 * 已随 Task 10 移除，文件级方法不再存在，任何"绕过条目直接改日文件"的写法都不再受支持。
 * `resetJournalTable` 只保留了 channel 名（设置页「重建索引」在用），实现已换成条目维度的 `resetEntries`。
 */
class JournalService {
  private static instance: JournalService;
  private fileIndexDao: FileIndexDao;
  private chunkDao: ChunkDao;
  /**
   * 条目 DAO / 作品 DAO：延迟到首次使用才实例化
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

  // ──────────────────────────────────────────────────────────────
  // 条目化路径（spec §4~§7）：journal_entries 为真源，md 为渲染产物
  // ──────────────────────────────────────────────────────────────

  /**
   * 追加一条日志条目
   * 1. 正文写入即 trim（渲染产物与库内容逐字节一致）
   * 2. occurred_at 一律归一为带时区的 UTC ISO，date 由本地时区派生
   * 3. 载荷的 source/type 走取值域钳制——IPC 运行时不可信（T10-6）
   * 4. 当日第一条条目写入前先「接管即导入」（T10-3）
   * 5. 后置管线：关联重建 → 当日重渲染 → 按日切块调度
   * @returns 条目 ID
   */
  public appendEntry(record: JournalEntryCreatePayload): string {
    const content = this.normalizeEntryContent(record.content);
    const occurredAt = this.normalizeOccurredAt(record.occurredAt);
    const date = TimeUtil.format(occurredAt, "YYYY-MM-DD");
    const now = new Date().toISOString();

    this.takeoverLegacyDay(date);

    const id = this.journalEntryDao.create({
      date,
      occurred_at: occurredAt,
      source: this.clampEntrySource(record.source, JOURNAL_ENTRY_SOURCE.DESKTOP),
      type: this.clampEntryType(record.type, JOURNAL_ENTRY_TYPE.TEXT),
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
   * 接管即导入（T10-3，关的是**用户数据丢失**）：
   * 当日零活跃条目、磁盘上却留着旧版整篇 `.md` 时，直接追加会把渲染产物覆盖上去、
   * 旧正文从此无处可寻。所以在这里先对该日跑一次 §5.3 导入（复用 `importDayFile`
   * 同一算法与同一事务，绝不另起一套解析），把旧正文收为推断条目，再让本次追加落库。
   *
   * 判定口径与渲染保护（{@link ensureDayFile}）严格一致：首行带 `wrisp:journal` 标记的
   * 文件是本管线自己的产物，其中的内容已经躺在库里，不需要也不允许再导入。
   *
   * 仍然不做开机批量扫描：接管只在「该日真正要写第一条」时发生，保持 spec §5.1
   * 「导入是显式触发」的原意（用户主动点导入入口走 {@link importDayFile}）。
   */
  private takeoverLegacyDay(date: string): void {
    if (this.journalEntryDao.hasActiveEntries(date)) return;

    const filePath = this.getJournalFilePath(date);
    if (!fileService.exists(filePath)) return;
    const existing = fileService.readFile(filePath);
    if (!existing || existing.trim() === "") return;
    if (isEntryOwnedJournalMarkdown(existing)) return;

    this.importDayFile(date);
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

    // 与 deleteEntry 同理检查影响行数：读到行后、写之前被并发删除时 update 影响 0 行，
    // 此时不得报告成功，也不得重渲染/调度（旧内容已不属于本条目）
    if (this.journalEntryDao.update(record.id, updates) === 0) return false;
    this.afterEntryWrite(record.id, content, oldDate, newDate);
    return true;
  }

  /**
   * 软删除一条日志条目（写 deleted_at 留 tombstone，导入不复活）
   * 关联清空与语义块回收都**与软删除同处一个事务**（T10-5）：三步分开提交时，
   * 「墓碑已落库、清块抛错」会让该条目永久停在「库里已删、块仍可被检索命中」的 state，
   * 而后续任何路径都不会再重驱它（listDirtyByDate 只取活跃条目，processFile 对接管文件让位）。
   * 现在清块失败会整体回滚：条目仍然活跃，用户重试即重新走完整流程。
   *
   * 向量层（LanceDB）没有事务、也没有外键级联，只能留在事务外异步清理：
   * 代价是「块已删、向量删除失败」的窗口仍存在，但向量行按 chunk_id 命中不到正文的块，
   * 只是白占 ANN 名额，且删除入口幂等（重跑 reset / 下一次重切都会再清一次），
   * 相比把条目写坏在同一事务里回滚，这个代价是可接受的降级。
   *
   * @returns 删除成功返回 true，条目不存在或已删除返回 false
   */
  public deleteEntry(id: Id): boolean {
    const row = this.journalEntryDao.findById(id);
    if (!row || row.deleted_at) return false;

    const now = new Date().toISOString();
    const filePath = this.getJournalFilePath(row.date);

    const removedIds = this.journalEntryDao.transaction(() => {
      // 与 updateEntry 同理看影响行数：软删 0 行 = 已被并发删除，不报错但报告未删除
      if (this.journalEntryDao.softDelete(id, now) === 0) return null;
      this.journalEntryDao.replaceAssociations(id, [], [], now);

      // 条目维度清块：以当日 file_index 行为配对范围（entry 块携带 file_id），
      // 空切分结果 = 全删。当日无 file_index 行时跳过——条目块必挂 file_id，
      // 没有行就没有可配对的块。
      const fileIndex = this.fileIndexDao.findByFilePath(filePath);
      if (!fileIndex) {
        Logger.warn("删除日志条目：当日无 file_index 行，跳过条目级块清理", {
          entryId: id,
          filePath,
        });
        return [];
      }
      const { removedIds: ids } = chunkService.replaceEntryChunks(
        id,
        fileIndex.id,
        filePath,
        [],
      );
      return ids;
    });

    if (removedIds === null) return false;

    // 只有真正消失的块才删向量（空批不去敲向量层的门）
    if (removedIds.length > 0) {
      void chunkService.dropVectorsByIds(removedIds).catch((error: unknown) => {
        Logger.warn("清理已删日志条目向量失败", { error: String(error), entryId: id });
      });
    }

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
   * 有任何插入/更新时走与 appendEntry 相同的后置管线（关联重建 + 渲染接管 + 调度），
   * 并在接管时清掉该日遗留的**文件级**旧版块（{@link removeReplacedLegacyChunks}）。
   * @param date 目标日期（YYYY-MM-DD）
   * @param overwrite 当日已有条目时是否仍按 id 合并（默认 false：整日跳过）
   */
  public importDayFile(date: string, overwrite: boolean = false): JournalImportResult {
    const result: JournalImportResult = { imported: 0, updated: 0, skipped: 0 };
    const filePath = this.getJournalFilePath(date);
    if (!fileService.exists(filePath)) return result;

    const raw = fileService.readFile(filePath);
    const parsed = parseJournalDayFile(date, raw);
    // 本次是否真的在「接管一份旧版整篇」：无 wrisp:journal 标记且非空。
    // 已接管产物（本管线自己渲染的文件）里的内容早就在库里，重复导入它不属于接管。
    const tookOverLegacyFile =
      !!raw && raw.trim() !== "" && !isEntryOwnedJournalMarkdown(raw);

    const existingRows = this.journalEntryDao.listAllByDate(date);
    const existingActive = existingRows.filter((row) => !row.deleted_at);
    if (existingActive.length > 0 && !overwrite) {
      result.skipped = parsed.length;
      return result;
    }

    const byId = new Map(existingRows.map((row) => [row.id, row]));
    // 整天 upsert 包在一个事务里：normalizeOccurredAt 中途抛错、或伪造值仍被 CHECK 拒绝时，
    // 整天回滚而不是留下半日条目（后续渲染/调度也随之不执行，调用方重试即幂等）。
    this.journalEntryDao.transaction(() => {
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
            // 手工伪造的 src/type 降级为 import/text，避免撞 journal_entries CHECK 炸掉整日导入
            source: this.clampEntrySource(item.source, JOURNAL_ENTRY_SOURCE.IMPORT),
            type: this.clampEntryType(item.type, JOURNAL_ENTRY_TYPE.TEXT),
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
    });

    if (result.imported > 0 || result.updated > 0) {
      if (tookOverLegacyFile) this.removeReplacedLegacyChunks(date);
      this.ensureDayFile(date);
      chunkIndexService.scheduleJournalDay(date);
    }
    return result;
  }

  /**
   * 接管旧版整篇 .md 后，清掉该日文件下**文件级**的日志语义块（T10-3 的另一半）。
   *
   * 旧路径按整篇切出来的块以 `file_id` 为归属；条目接管后真源换成 `journal_entries`，
   * `processFile` 对接管文件让位、按日切块只碰 `entry_id` 维度的块，这批旧块因此
   * 永远无人重切，却仍然全文可检索、向量可命中——用户看到的是一条已被条目化的
   * 陈旧副本。DAO 侧的范围条件（`entry_id IS NULL`）是底线：条目块同样带 `file_id`，
   * 用 `syncByFile(fileId, [])` 会把它们一起销毁。
   *
   * 向量与块一体处理，模式同 resetEntries：块 id 在事务提交后交给向量层异步清。
   */
  private removeReplacedLegacyChunks(date: string): void {
    const filePath = this.getJournalFilePath(date);
    const fileIndex = this.fileIndexDao.findByFilePath(filePath);
    if (!fileIndex) return;

    const removedIds = this.chunkDao.removeFileLevelJournalChunks(fileIndex.id);
    if (removedIds.length === 0) return;

    Logger.info("日志接管：清理被取代的整篇语义块", { date, count: removedIds.length });
    void chunkService.dropVectorsByIds(removedIds).catch((error: unknown) => {
      Logger.warn("清理被取代的日志块向量失败", { error: String(error), date });
    });
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
   * 当日零条目、且文件已存在且非空、且**不是**条目接管文件（无 wrisp:journal 标记，
   * 即旧版整篇日志）时**绝不覆盖**。
   *
   * 与「接管即导入」（{@link takeoverLegacyDay}）的分工：追加路径已经把这种文件先导入成
   * 条目，走到这里时当日必有条目，本分支正常不再命中；保留它是**最后一道兜底**——
   * 覆盖「导入未产出任何条目」（文件里除了标题与空行什么都没有）却仍要渲染空日、
   * 以及任何新增的绕过追加路径的调用。删掉它等于把用户数据的安全网换成一条时序约定。
   *
   * 带标记的文件是本管线自己的渲染产物：当日最后一条条目被删除后必须重写为空日渲染，
   * 否则已删内容会永久滞留文件（真源是库，文件是产物）。
   * 写文件后维护 file_index 行（hash/size/日期/文件名）并置 synced：
   * 条目化日文件不做文件级切块（processFile 对它让位），pending 无人收敛，
   * synced 才是诚实的终态——按日切块由 recordChunked 水位线负责（失败时由
   * `processJournalDay` 改写为 failed，见 chunk-index.service）。
   */
  private ensureDayFile(date: string): void {
    const filePath = this.getJournalFilePath(date);
    const entries = this.journalEntryDao.listActiveByDate(date);

    if (entries.length === 0 && fileService.exists(filePath)) {
      const existing = fileService.readFile(filePath);
      if (existing && existing.trim() !== "" && !isEntryOwnedJournalMarkdown(existing)) {
        return; // 旧版整篇日志：绝不覆盖
      }
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
        sync_status: "synced",
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
        sync_status: "synced",
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
   * 条目的来源/类型取值域钳制（spec §4.1 CHECK）：非法值降级到**调用方的默认口径**，
   * 不整批失败。两个调用点的兜底值不同，都在这里显式传入，避免把钳制和某个
   * 入口的缺省值绑死：
   * · {@link appendEntry}：载荷来自 renderer（IPC 运行时不可信），非法值按「桌面新记录」算；
   * · {@link importDayFile}：值来自文件里的注释，非法值按「导入」算。
   */
  private clampEnumValue<T extends string>(
    value: string | undefined,
    allowed: readonly T[],
    fallback: T,
  ): T {
    return value !== undefined && (allowed as readonly string[]).includes(value)
      ? (value as T)
      : fallback;
  }

  private clampEntrySource(
    value: string | undefined,
    fallback: JournalEntrySource,
  ): JournalEntrySource {
    return this.clampEnumValue(value, Object.values(JOURNAL_ENTRY_SOURCE), fallback);
  }

  private clampEntryType(
    value: string | undefined,
    fallback: JournalEntryType,
  ): JournalEntryType {
    return this.clampEnumValue(value, Object.values(JOURNAL_ENTRY_TYPE), fallback);
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