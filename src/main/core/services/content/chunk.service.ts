import { Logger } from "@/main/utils/logger";
import {
  ChunkDao,
  PageDao,
  ProjectChunkDao,
  ConceptChunkDao,
  TopicChunkDao,
} from "@/main/core/db";
import {
  type ChunkInfo,
  type ChunkUpdate as SharedChunkUpdate,
  type ChunkQuery,
  type ChunkItem,
  type ChunkDateItem,
} from "@/shared/types/chunk.types";
import { Chunk, ChunkCreate, ChunkSyncResult, ChunkType, Page } from "@/main/types/db";
import { type SplitChunk } from "./chunk-splitter";
import { Id } from "@/shared/types";
import { vectorService } from "../ai/vector.service";
import { modelRouter } from "@/main/core/model-gateway/router";
import { SEARCH_TYPE, SearchType } from "@/shared/enums";
import { PaginationResult } from "@/shared/utils/pagination";
import { embed, rerank } from "@/main/core/model-gateway/local-gateway";

/** 重排候选上限：rerank 代价随文档数线性增长，不随调用方 limit 放大；返回条数同样封顶在此值 */
const RERANK_INPUT_MAX = 50;
/** ANN 召回相对 limit 的放大倍数：重叠去重会吃掉候选，1 倍凑不满 limit */
const ANN_CANDIDATE_RATIO = 4;
/** ANN 召回下限（历史上的固定值，小 limit 时不让召回变薄） */
const ANN_CANDIDATE_MIN = 50;
/** ANN 召回上限，含作品作用域的超额补偿路径 */
const ANN_CANDIDATE_MAX = 200;

/**
 * Chunk 服务（语义块服务）
 * 提供 semantic_chunks 表的完整 CRUD 操作、项目关联、搜索
 * 被 JournalService 和 ProjectService 等上层服务调用
 */
class ChunkService {
  private static instance: ChunkService;
  private chunkDao: ChunkDao;
  private pageDao: PageDao;
  private projectChunkDao: ProjectChunkDao;
  private conceptChunkDao: ConceptChunkDao;
  private topicChunkDao: TopicChunkDao;

  private constructor() {
    this.chunkDao = new ChunkDao();
    this.pageDao = new PageDao();
    this.projectChunkDao = new ProjectChunkDao();
    this.conceptChunkDao = new ConceptChunkDao();
    this.topicChunkDao = new TopicChunkDao();
  }

  public static getInstance(): ChunkService {
    if (!ChunkService.instance) {
      ChunkService.instance = new ChunkService();
    }
    return ChunkService.instance;
  }

  // ──────── 类型转换 ────────

  public blockToChunkInfo(block: Chunk): ChunkInfo {
    const conceptCount = this.conceptChunkDao.countBy("chunk_id", block.id);
    const topicCount = this.topicChunkDao.countBy("chunk_id", block.id);

    return {
      id: block.id,
      content: block.content,
      project_id: null,
      ai_summary: block.ai_summary,
      temporal_score: block.temporal_score,
      word_count: block.word_count,
      status: block.status,
      concept_count: conceptCount,
      topic_count: topicCount,
      created_at: block.created_at,
      updated_at: block.updated_at,
    };
  }

  public blockToChunkItem(block: Chunk): ChunkItem {
    return {
      id: block.id,
      content: block.content,
      temporal_score: block.temporal_score,
      word_count: block.word_count,
      status: block.status,
      created_at: block.created_at,
      updated_at: block.updated_at,
    };
  }

  private blocksToRecordList(
    blocks: Chunk[],
    sortFn: (a: Chunk, b: Chunk) => number,
  ): ChunkInfo[] {
    return [...blocks].sort(sortFn).map((block) => this.blockToChunkInfo(block));
  }

  // ──────── 项目关联 ────────

  public syncProjectAssociation(blockId: Id, projectId?: Id | null): void {
    if (projectId === undefined) {
      return;
    }

    const existingProjectChunks = this.projectChunkDao.findBy(
      "chunk_id",
      blockId,
    );

    if (existingProjectChunks.length > 0) {
      const existingProjectId = existingProjectChunks[0].project_id;
      if (existingProjectId !== projectId) {
        this.projectChunkDao.deleteBy("project_id", existingProjectId, blockId);
      }
    }

    if (projectId) {
      this.projectChunkDao.addChunksToProject(projectId, [blockId]);
    }
  }

  /**
   * 将某文件的全部语义块归属到指定作品（用于作品页面内容的语义化归属）。
   * 页面切分完成后调用，使页面块参与作品内检索与语义链接的作品收敛。
   * @param fileId 文件索引 ID
   * @param projectId 作品 ID；为空时不做任何关联
   */
  public associateFileChunksWithProject(fileId: Id, projectId: Id | null): void {
    if (!projectId) return;
    try {
      const blocks = this.chunkDao.query(
        "SELECT * FROM semantic_chunks WHERE file_id = ?",
        [fileId],
      ) as Chunk[];
      for (const block of blocks) {
        this.syncProjectAssociation(block.id, projectId);
      }
      Logger.info("页面语义块作品归属完成", { fileId, projectId, count: blocks.length });
    } catch (error) {
      Logger.error("页面语义块作品归属失败", { error: String(error), fileId, projectId });
      throw error;
    }
  }

  // ──────── 切分结果落库 ────────

  /**
   * 让某文件的语义块与切分结果一致（按 `content_hash` 差异同步）。
   *
   * 切分本身不触发任何 AI 语义化；正文未变的块复用原 id，因此它的摘要、向量、
   * 作品归属不会被无谓作废。返回值里的 `removedIds` 交给 {@link dropVectorsByIds}
   * 清理向量层（LanceDB 无外键级联，不清理就累积孤儿向量）。
   *
   * @param fileId 文件索引 ID（file_index.id）
   * @param filePath 文件相对路径（写入 semantic_chunks.file_path）
   * @param chunks 切分结果
   * @param chunkType 语义块来源类型，调用方必须显式指定（日志条目化后不再有 journal 默认口径）
   */
  public replaceFileChunks(
    fileId: Id,
    filePath: string,
    chunks: SplitChunk[],
    chunkType: ChunkType,
  ): ChunkSyncResult {
    try {
      const records: ChunkCreate[] = chunks.map((chunk) => ({
        file_id: fileId,
        file_path: filePath,
        start_line: chunk.startLine,
        end_line: chunk.endLine,
        section_title: chunk.sectionTitle,
        content: chunk.content,
        content_hash: chunk.contentHash,
        chunk_type: chunkType,
        word_count: chunk.wordCount,
        status: "active",
      }));

      const result = this.chunkDao.syncByFile(fileId, records);
      Logger.info("语义块同步完成", {
        fileId,
        filePath,
        total: result.total,
        reused: result.reused,
        inserted: result.inserted,
        removed: result.removedIds.length,
      });
      return result;
    } catch (error) {
      Logger.error("同步语义块失败", { error: String(error), fileId, filePath });
      throw error;
    }
  }

  /**
   * 让某条日志条目的语义块与切分结果一致（entry 维度差异同步，spec §7）。
   *
   * 与 {@link replaceFileChunks} 对称，唯一差异是配对范围从 `file_id` 换成 `entry_id`：
   * 编辑单条日志只重切这一条，未变条目复用原块 id，摘要 / 向量 / 概念归属随 id 保留。
   * `file_id` / `file_path` 由调用方传入（当日渲染 .md 的索引行），行号为条目内部行号。
   *
   * @param entryId 日志条目 ID（journal_entries.id）
   * @param fileId 当日文件索引 ID（file_index.id）
   * @param filePath 当日文件相对路径（写入 semantic_chunks.file_path）
   * @param chunks 该条目的切分结果
   */
  public replaceEntryChunks(
    entryId: Id,
    fileId: Id,
    filePath: string,
    chunks: SplitChunk[],
  ): ChunkSyncResult {
    try {
      const records: ChunkCreate[] = chunks.map((chunk) => ({
        file_id: fileId,
        file_path: filePath,
        start_line: chunk.startLine,
        end_line: chunk.endLine,
        section_title: chunk.sectionTitle,
        content: chunk.content,
        content_hash: chunk.contentHash,
        chunk_type: "journal" as const,
        entry_id: entryId,
        word_count: chunk.wordCount,
        status: "active" as const,
      }));

      const result = this.chunkDao.syncByEntry(entryId, records);
      Logger.info("日志条目语义块同步完成", {
        entryId,
        fileId,
        filePath,
        total: result.total,
        reused: result.reused,
        inserted: result.inserted,
        removed: result.removedIds.length,
      });
      return result;
    } catch (error) {
      Logger.error("同步日志条目语义块失败", {
        error: String(error),
        entryId,
        fileId,
        filePath,
      });
      throw error;
    }
  }

  /**
   * 删除指定语义块在向量库中的行（只清正文已消失的块）。
   *
   * LanceDB 的向量行按 chunk_id 存储、没有外键级联，不清理会随每次重切分累积
   * 孤儿向量（命中后取不到正文，白占 ANN 召回名额）。删除失败只记日志：向量层是
   * 可重建的派生数据，不该让一次重切分因为 LanceDB 抖动而整体失败。
   */
  public async dropVectorsByIds(chunkIds: Id[]): Promise<void> {
    if (chunkIds.length === 0) return;
    try {
      await vectorService.deleteChunkEmbeddings(chunkIds);
    } catch (error) {
      Logger.warn("清理语义块向量失败（不影响切分）", {
        count: chunkIds.length,
        error: String(error),
      });
    }
  }

  // ──────── 查询详情 ────────

  public getById(id: Id): ChunkInfo | null {
    try {
      const block = this.chunkDao.findById(id);
      if (!block) {
        return null;
      }

      return this.blockToChunkInfo(block);
    } catch (error) {
      Logger.error("获取语义块详情失败", { error: String(error), id });
      throw error;
    }
  }

  // ──────── 更新语义块 ────────

  /**
   * 更新语义块
   * @returns 更新后的 block（可用于同步文件/索引表）
   */
  public update(journal: SharedChunkUpdate): Chunk | null {
    try {
      const existingBlock = this.chunkDao.findById(journal.id);
      if (!existingBlock) {
        return null;
      }

      const update: Partial<Chunk> = {};
      if (journal.content !== undefined) {
        update.content = journal.content;
      }
      this.chunkDao.update(existingBlock.id, update);
      this.syncProjectAssociation(existingBlock.id, journal.project_id);

      return this.chunkDao.findById(existingBlock.id);
    } catch (error) {
      Logger.error("更新语义块失败", { error: String(error), journal });
      return null;
    }
  }

  // ──────── 删除语义块 ────────

  /**
   * 删除语义块
   * @returns [是否成功, 被删除的 block（用于上层同步文件/索引表）]
   */
  public delete(id: Id): [boolean, Chunk | null] {
    try {
      const block = this.chunkDao.findById(id);
      if (!block) {
        return [false, null];
      }

      this.projectChunkDao.deleteBy("chunk_id", block.id);
      this.conceptChunkDao.deleteBy("chunk_id", block.id);
      this.topicChunkDao.deleteBy("chunk_id", block.id);
      const result = this.chunkDao.delete(block.id);
      return [result > 0, block];
    } catch (error) {
      Logger.error("删除语义块失败", { error: String(error), id });
      throw error;
    }
  }

  // ──────── 分页查询 ────────

  public list(query?: ChunkQuery): PaginationResult<ChunkItem> {
    try {
      const page = Math.max(1, query?.page ?? 1);
      const pageSize = Math.min(Math.max(1, query?.page_size ?? 50), 100);
      const offset = (page - 1) * pageSize;

      const conditions: string[] = [];
      const values: unknown[] = [];

      if (query?.temporal_score_min !== undefined) {
        conditions.push("temporal_score >= ?");
        values.push(query.temporal_score_min);
      }
      if (query?.temporal_score_max !== undefined) {
        conditions.push("temporal_score <= ?");
        values.push(query.temporal_score_max);
      }

      const whereClause = conditions.length > 0 ? conditions.join(" AND ") : "1=1";
      const countSql = `SELECT * FROM semantic_chunks WHERE ${whereClause}`;
      const total = this.chunkDao.count(countSql, values);

      const dataSql = `SELECT * FROM semantic_chunks WHERE ${whereClause} ORDER BY created_at ASC LIMIT ? OFFSET ?`;
      const dataValues = [...values, pageSize, offset];
      const blocks = this.chunkDao.query(dataSql, dataValues) as Chunk[];

      const totalPages = Math.ceil(total / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, total);

      return {
        data: blocks.map((block) => this.blockToChunkItem(block)),
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        startIndex,
        endIndex,
      };
    } catch (error) {
      Logger.error("分页查询语义块失败", { error: String(error), query });
      throw error;
    }
  }

  // ──────── 搜索 ────────

  /**
   * 按作品检索语义块。
   *
   * `projectId` **必填**——检索必须按作品隔离；需要全库检索请显式调用
   * `searchAll`。把隔离设为必填而非可选，是为了让"忘记传 projectId"
   * 变成编译期错误，而不是运行期的静默跨作品召回。
   */
  public async search(
    keyword: string,
    limit: number,
    searchType: SearchType,
    projectId: Id,
  ): Promise<ChunkInfo[]> {
    return this.runSearch(keyword, limit, searchType, projectId);
  }

  /**
   * 全库检索（**不**按作品隔离）。
   * 仅用于明确的全局搜索场景；调用方需自行确认这是有意的。
   */
  public async searchAll(
    keyword: string,
    limit: number = 50,
    searchType?: SearchType,
  ): Promise<ChunkInfo[]> {
    return this.runSearch(keyword, limit, searchType);
  }

  private async runSearch(
    keyword: string,
    limit: number,
    searchType?: SearchType,
    projectId?: Id,
  ): Promise<ChunkInfo[]> {
    try {
      if (searchType === SEARCH_TYPE.KEYWORD) {
        const blocks = this.chunkDao.searchFts(keyword, limit);
        const list = this.blocksToRecordList(blocks, (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        // 全文检索同样受作品作用域约束：传了 projectId 就必须过滤，
        // 否则签名与行为不一致，会成为跨作品召回的隐患。
        return projectId ? this.filterByProject(list, projectId) : list;
      } else if (searchType === SEARCH_TYPE.SEMANTIC) {
        const canUseLocal = await modelRouter.isLocalAvailable();
        if (canUseLocal) {
          return this.searchByVector(keyword, limit, projectId);
        }
        const blocks = this.chunkDao.searchFts(keyword, limit);
        const fallback = this.blocksToRecordList(blocks, (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        // 本地模型不可用时降级为全文检索：这条路径同样必须按作品过滤，
        // 否则会跨作品召回（spec 非协商条款）。
        return projectId ? this.filterByProject(fallback, projectId) : fallback;
      }
      return [];
    } catch (error) {
      Logger.error("搜索语义块失败", {
        error: String(error),
        keyword,
        limit,
        searchType,
      });
      throw error;
    }
  }

  private async searchByVector(
    keyword: string,
    limit: number,
    projectId?: Id,
  ): Promise<ChunkInfo[]> {
    try {
      // 返回条数由调用方决定，不再硬截断为 10；上限是重排规模的天花板。
      const topK = Math.min(Math.max(Math.trunc(limit) || 1, 1), RERANK_INPUT_MAX);
      const annTopK = Math.min(
        Math.max(ANN_CANDIDATE_MIN, topK * ANN_CANDIDATE_RATIO),
        ANN_CANDIDATE_MAX,
      );

      const { vector } = await embed(keyword);

      const searchResults = await vectorService.searchChunkEmbeddings({
        vector,
        topK: annTopK,
        projectId,
      });

      // 向量行里的 project_id 是**写入时快照**，不可作为唯一依据：
      //   · 迁移前写入的历史行为 null → `.where` 永远匹配不到，表现为"什么都搜不到"（C2）；
      //   · 语义块改归属后向量行不更新 → 快照仍指向旧作品（I1）。
      // 因此以 `project_chunks` 的**实时归属**为准做一次过滤；
      // 若作用域检索为空（历史行被 `.where` 提前滤掉），退回不带过滤的
      // 超额召回再后置过滤，补偿召回损失（计划所述"迁移期间退化为超额召回 + 后过滤"）。
      let scoped = searchResults ?? [];
      if (projectId) {
        const projectPath = this.getProjectChunkIds(projectId);
        const allowed = new Set(projectPath);
        const liveFiltered = scoped.filter((r) => allowed.has(r.item.chunk_id));

        if (liveFiltered.length === 0) {
          const overFetched = await vectorService.searchChunkEmbeddings({
            vector,
            topK: Math.min(annTopK * ANN_CANDIDATE_RATIO, ANN_CANDIDATE_MAX),
          });
          scoped = overFetched.filter((r) => allowed.has(r.item.chunk_id));
        } else {
          scoped = liveFiltered;
        }
      }

      if (scoped.length === 0) {
        return [];
      }

      const candidateBlockIds = scoped.map((r) => r.item.chunk_id);
      const candidateBlocks = this.chunkDao.findByIds(candidateBlockIds);

      if (candidateBlocks.length === 0) {
        return [];
      }

      const blockMap = new Map(candidateBlocks.map((b) => [b.id, b]));
      const annOrdered: Chunk[] = [];
      for (const blockId of candidateBlockIds) {
        const block = blockMap.get(blockId);
        if (block) {
          annOrdered.push(block);
        }
      }

      // ANN 会把相邻语义块一起召回：L2 的重叠区让上下两块共享若干行，
      // 用户看到的结果是同一段文字连着出现两次。去重放在 rerank **之前**：
      // 交集判定只看行区间，谁先被保留由 ANN 顺序决定，rerank 的输入也因此少一半。
      const orderedBlocks = this.dropSpanOverlaps(annOrdered);
      // 重排规模不随 limit 增长：limit 放大换来的是召回变深，不是推理变重
      const rerankTargets = orderedBlocks.slice(0, RERANK_INPUT_MAX);

      const rerankResults = await rerank(
        keyword,
        rerankTargets.map((block) => block.content),
        { modelName: "Xenova/bge-reranker-v2-m3" },
      );

      const topKBlocks = rerankResults
        .slice(0, topK)
        .map((r) => rerankTargets[r.index])
        .filter(Boolean);

      // 直接按 rerank 顺序返回，**不能**走 blocksToRecordList：那条路径末尾按
      // created_at DESC 重排，会把重排好的相关性顺序抹掉（语义检索最要的排序）。
      const chunkResults = topKBlocks.map((block) => this.blockToChunkInfo(block));

      // 页级粗召回只叠加在**作品范围检索**上：「定位到哪一页」是作品内导航，
      // searchAll 是调用方显式声明的全库检索，不在此改变其语义。
      if (!projectId) {
        return chunkResults;
      }

      const pageResults = await this.searchPagesByVector(vector, topK, projectId);
      return [...pageResults, ...chunkResults];
    } catch (error) {
      Logger.error("向量语义搜索失败，回退到 SQL FTS", {
        error: String(error),
        keyword,
        limit,
      });
      const blocks = this.chunkDao.searchFts(keyword, limit);
      const fallback = this.blocksToRecordList(blocks, (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      // 异常降级同样必须按作品过滤：向量检索抛错时最容易忘记这条，
      // 而它正是"本地模型损坏/LanceDB 异常"时唯一会走到的路径。
      return projectId ? this.filterByProject(fallback, projectId) : fallback;
    }
  }

  /**
   * 作品范围内的**页级粗召回**：用页面向量先定位到「哪一页」，与 chunk 级精排互补。
   *
   * 页级是补充层，异常一律降级为「没有页级结果」——绝不把异常放大成跨作品召回
   * （向量行里的 project_id 是写入时快照，改归属后不更新，故以 pages 的实时归属为准再过滤一次）。
   */
  private async searchPagesByVector(
    vector: number[],
    topK: number,
    projectId: Id,
  ): Promise<ChunkInfo[]> {
    try {
      const results = await vectorService.searchPageEmbeddings({
        vector,
        topK,
        projectId,
      });
      const pageIds = (results ?? []).map((r) => r.item.page_id);
      if (pageIds.length === 0) return [];

      const pageMap = new Map(this.pageDao.findByIds(pageIds).map((p) => [p.id, p]));
      const ordered: ChunkInfo[] = [];
      for (const pageId of pageIds) {
        const page = pageMap.get(pageId);
        if (!page || page.project_id !== projectId) continue;
        ordered.push(this.pageToChunkInfo(page));
      }
      return ordered;
    } catch (error) {
      Logger.warn("页级粗召回失败，跳过页级结果", {
        error: String(error),
        projectId,
      });
      return [];
    }
  }

  private pageToChunkInfo(page: Page): ChunkInfo {
    return {
      id: page.id,
      content: page.ai_summary ?? page.title,
      project_id: page.project_id,
      ai_summary: page.ai_summary,
      temporal_score: 0,
      word_count: page.word_count,
      status: page.status,
      concept_count: 0,
      topic_count: 0,
      created_at: page.created_at,
      updated_at: page.updated_at,
      kind: "Page",
    };
  }

  /**
   * 丢弃与已保留块**行区间有交集**的候选（限同一文件）。
   *
   * 语义块是行区间，只要共享一行，正文就有肉眼可见的重复。入参顺序即优先级，
   * 越靠前越先保留——调用方负责按相关性排好序。跨文件的同区间不去重：
   * 它们是各自文档的独立出处。
   */
  private dropSpanOverlaps(blocks: Chunk[]): Chunk[] {
    const kept: Chunk[] = [];

    for (const block of blocks) {
      const overlaps = kept.some(
        (other) =>
          other.file_id === block.file_id &&
          other.start_line <= block.end_line &&
          block.start_line <= other.end_line,
      );
      if (!overlaps) {
        kept.push(block);
      }
    }

    return kept;
  }

  // ──────── 查询方法 ────────

  public getRecent(limit: number = 50): ChunkItem[] {
    try {
      const blocks = this.chunkDao.getRecentChunks(limit);
      return blocks.map((block) => this.blockToChunkItem(block));
    } catch (error) {
      Logger.error("获取最近语义块失败", { error: String(error), limit });
      throw error;
    }
  }

  public getWithTemporalScore(limit: number = 50): ChunkItem[] {
    try {
      const blocks = this.chunkDao.getChunksWithTemporalScore(limit);
      return this.blocksToRecordList(
        blocks,
        (a, b) => b.temporal_score - a.temporal_score,
      );
    } catch (error) {
      Logger.error("获取带时间衰减分数的语义块失败", {
        error: String(error),
        limit,
      });
      throw error;
    }
  }

  /** 获取作品关联的全部语义块 id（供素材检索按作品过滤） */
  public getProjectChunkIds(projectId: Id): string[] {
    return this.projectChunkDao
      .findBy("project_id", projectId)
      .map((row) => row.chunk_id);
  }

  /**
   * 按作品过滤语义块。
   * 用于降级路径（本地模型不可用时的全文检索）——那条路径没有向量层的
   * `.where()` 保护，必须在此显式过滤，否则会跨作品召回。
   */
  private filterByProject<T extends ChunkItem>(chunks: T[], projectId: Id): T[] {
    const allowed = new Set(this.getProjectChunkIds(projectId));
    return chunks.filter((c) => allowed.has(c.id));
  }

  public getByProjectId(projectId: Id): ChunkItem[] {
    try {
      const projectChunks = this.projectChunkDao.findBy(
        "project_id",
        projectId,
      );
      const blockIds = projectChunks.map((pb) => pb.chunk_id);

      if (blockIds.length === 0) {
        return [];
      }

      const blocks = this.chunkDao.findByIds(blockIds);
      return this.blocksToRecordList(blocks, (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    } catch (error) {
      Logger.error("获取项目关联语义块失败", {
        error: String(error),
        projectId,
      });
      throw error;
    }
  }

  public getByDateRange(
    startDate?: string,
    endDate?: string,
  ): ChunkDateItem[] {
    try {
      let blocks: Chunk[];

      if (startDate && endDate) {
        const normalizeStart = (d: string) =>
          /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00.000Z` : d;
        const normalizeEnd = (d: string) =>
          /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T23:59:59.999Z` : d;
        const s = normalizeStart(startDate);
        const e = normalizeEnd(endDate);

        blocks = this.chunkDao.findByDateRange(s, e, "active");
      } else {
        const sql = `SELECT * FROM semantic_chunks WHERE status = 'active' ORDER BY created_at DESC LIMIT 20`;
        blocks = this.chunkDao.query(sql) as Chunk[];
      }

      const items = this.blocksToRecordList(blocks, (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

      const dateMap = new Map<string, ChunkInfo[]>();
      for (const item of items) {
        const dateKey = item.created_at.slice(0, 10);
        const group = dateMap.get(dateKey);
        if (group) {
          group.push(item);
        } else {
          dateMap.set(dateKey, [item]);
        }
      }

      return Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dateKey, journals]) => ({
          date: dateKey,
          chunks: journals,
        }));
    } catch (error) {
      Logger.error("根据日期范围查询语义块失败", {
        error: String(error),
        startDate,
        endDate,
      });
      throw error;
    }
  }

  // ──────── 项目关联操作 ────────

  public addToProject(
    recordId: Id,
    projectId: Id,
    relevanceScore?: number,
  ): void {
    try {
      this.projectChunkDao.addChunksToProject(
        projectId,
        [recordId],
        relevanceScore ? [relevanceScore] : undefined,
      );
    } catch (error) {
      Logger.error("添加语义块到项目失败", {
        error: String(error),
        recordId,
        projectId,
        relevanceScore,
      });
      throw error;
    }
  }

  public removeFromProject(recordId: Id, projectId: Id): void {
    try {
      this.projectChunkDao.deleteBy("project_id", projectId, recordId);
    } catch (error) {
      Logger.error("从项目移除语义块失败", {
        error: String(error),
        recordId,
        projectId,
      });
      throw error;
    }
  }
}

export default ChunkService;
export { ChunkService };

export const chunkService = ChunkService.getInstance();
