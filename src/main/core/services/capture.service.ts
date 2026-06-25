import { Logger } from "@/main/utils/logger";
import {
  BlockDao,
  ProjectBlockDao,
  ConceptBlockDao,
  TopicBlockDao,
} from "@/main/core/db";
import {
  CaptureInfo,
  CaptureCreate,
  CaptureUpdate,
  CaptureQuery,
  CaptureListItem,
  CaptureDetail,
  CaptureDateListItem,
  Id,
} from "@/shared/types";
import { Block, BlockCreate, Language, BlockId } from "@/main/types/db";
import { configService } from "./config.service";
import { vectorService } from "./vector.service";
import { modelRouter } from "@/main/core/model-gateway/router";
import {
  CONTENT_TYPE,
  CAPTURE_SOURCE,
  SEARCH_TYPE,
  SearchType,
} from "@/shared/enums";
import { PaginationResult } from "@/shared/utils/pagination";
import { embed, rerank } from "@/main/core/model-gateway/local-gateway";

/**
 * Capture 服务
 * 提供捕获（Capture）的 CRUD 操作，将前端的 Capture 类型映射到后端的 Block 类型
 */
class CaptureService {
  private static instance: CaptureService;
  private blockDao: BlockDao;
  private projectBlockDao: ProjectBlockDao;
  private conceptBlockDao: ConceptBlockDao;
  private topicBlockDao: TopicBlockDao;
  private language: Language;
  private maxContentLength: number;

  /**
   * 私有构造函数
   * 防止外部实例化
   */
  private constructor() {
    this.blockDao = new BlockDao();
    this.projectBlockDao = new ProjectBlockDao();
    this.conceptBlockDao = new ConceptBlockDao();
    this.topicBlockDao = new TopicBlockDao();
    this.language = configService.getValue<string>("general.locale") || "enUS";
    this.maxContentLength = 300;
  }

  /**
   * 获取 CaptureService 的单例实例
   * @returns CaptureService 单例实例
   */
  public static getInstance(): CaptureService {
    if (!CaptureService.instance) {
      CaptureService.instance = new CaptureService();
    }
    return CaptureService.instance;
  }

  /**
   * 将 Block 对象转换为 CaptureInfo 对象
   * @param block Block 对象
   * @returns CaptureInfo 对象
   */
  private blockToCaptureInfo(block: Block): CaptureInfo {
    const childBlocks = this.blockDao.findByParentBlock(block.id);
    const conceptCount = this.conceptBlockDao.countBy("block_id", block.id);
    const topicCount = this.topicBlockDao.countBy("block_id", block.id);

    return {
      id: block.id,
      content: block.content,
      content_type: block.content_type,
      source: block.source,
      language: block.language,
      metadata: block.metadata,
      parent_record_id: block.parent_block_id,
      project_id: null,
      is_memo: block.is_memo,
      split_index: block.split_index,
      ai_summary: block.ai_summary,
      temporal_score: block.temporal_score,
      word_count: block.word_count,
      status: block.status,
      child_block_count: childBlocks.length,
      concept_count: conceptCount,
      topic_count: topicCount,
      created_at: block.created_at,
      updated_at: block.updated_at,
    };
  }

  /**
   * 将 Block 对象转换为 CaptureListItem 对象
   * @param block Block 对象
   * @returns CaptureListItem 对象
   */
  private blockToCaptureListItem(block: Block): CaptureListItem {
    return {
      id: block.id,
      content: block.content,
      content_type: block.content_type,
      is_memo: block.is_memo,
      temporal_score: block.temporal_score,
      word_count: block.word_count,
      status: block.status,
      created_at: block.created_at,
      updated_at: block.updated_at,
    };
  }

  /**
   * 如果内容长度超过最大长度，使用Phi模型进行语义拆分
   * @param content 内容字符串
   * @returns 拆分后的内容字符串数组
   */
  private splitContentByPhi(content: string): string[] {
    if (content.length <= this.maxContentLength) {
      return [content];
    }
    // 调用Phi模型进行语义拆分（暂未实现）
    // const splitResult = phiModel.splitContent(content, this.maxContentLength);
    // return splitResult;
    return [content];
  }

  /**
   * 将父 block 列表展开为包含子 block 的完整列表，并转换为 CaptureListItem[]
   * @param blocks 父 block 列表（含子 block 和非拆分的单 block）
   * @param sortFn 排序函数，用于对展开后的 block 进行排序
   * @returns 排序后的 CaptureListItem 数组
   */
  private blocksToRecordListWithChildren(
    blocks: Block[],
    sortFn: (a: Block, b: Block) => number,
  ): CaptureInfo[] {
    const allBlocks: Block[] = [];

    // 批量获取所有父 block 的子 block，避免对每个父 block 单独查询
    const parentBlocks: Block[] = [];
    const childBlocksAll: Block[] = [];
    for (const block of blocks) {
      if (this.isChildBlock(block)) {
        childBlocksAll.push(block);
      } else {
        parentBlocks.push(block);
      }
    }

    if (parentBlocks.length > 0) {
      const parentIds = parentBlocks.map((b) => b.id);
      const children = this.blockDao.findByParentBlocks(parentIds);
      // 将 children 与原 blocks 合并，保留原顺序关系
      // 构建 parent -> children map
      const map = new Map<string, Block[]>();
      for (const c of children) {
        const arr = map.get(c.parent_block_id as string) || [];
        arr.push(c);
        map.set(c.parent_block_id as string, arr);
      }

      for (const block of blocks) {
        if (this.isChildBlock(block)) {
          allBlocks.push(block);
        } else {
          allBlocks.push(block);
          const arr = map.get(block.id);
          if (arr && arr.length) {
            allBlocks.push(...arr);
          }
        }
      }
    } else {
      // 全部为 child blocks
      allBlocks.push(...blocks);
    }

    allBlocks.sort(sortFn);
    return allBlocks.map((block) => this.blockToCaptureInfo(block));
  }

  /**
   * 判断 block 是否为子 block
   * @param block Block 对象
   * @returns 如果是子 block 返回 true
   */
  private isChildBlock(block: Block): boolean {
    return block.parent_block_id !== null || block.split_index !== 0;
  }

  /**
   * 同步 block 的项目关联关系
   * 如果 projectId 为 undefined 则不操作；如果为 null 则移除关联；否则添加/更新关联
   * @param blockId block ID
   * @param projectId 项目 ID，undefined 表示不操作，null 表示移除关联
   */
  private syncProjectAssociation(blockId: Id, projectId?: Id | null): void {
    if (projectId === undefined) {
      return;
    }

    const existingProjectBlocks = this.projectBlockDao.findBy(
      "block_id",
      blockId,
    );

    if (existingProjectBlocks.length > 0) {
      const existingProjectId = existingProjectBlocks[0].project_id;
      if (existingProjectId !== projectId) {
        this.projectBlockDao.deleteBy("project_id", existingProjectId, blockId);
      }
    }

    if (projectId) {
      this.projectBlockDao.addBlocksToProject(projectId, [blockId]);
    }
  }

  /**
   * 创建记录
   * @param record 创建记录的参数
   * @returns 创建的记录 ID
   */
  public create(capture: CaptureCreate): string {
    const splitContent = this.splitContentByPhi(capture.content);
    try {
      let createdBlockId: BlockId;

      if (splitContent.length > 1) {
        // 创建父 block
        const parentBlockCreate: BlockCreate = {
          content: capture.content,
          content_type: capture.content_type || CONTENT_TYPE.INSIGHT,
          source: capture.source || CAPTURE_SOURCE.MANUAL,
          language: this.language,
          metadata: capture.metadata || {},
          parent_block_id: null,
          split_index: 0,
          is_memo: capture.is_memo || 0,
          status: "split",
        };
        createdBlockId = this.blockDao.create(parentBlockCreate);

        // 循环创建子 block
        for (let i = 1; i < splitContent.length; i++) {
          const childBlockCreate: BlockCreate = {
            content: splitContent[i],
            content_type: capture.content_type || CONTENT_TYPE.INSIGHT,
            source: capture.source || CAPTURE_SOURCE.MANUAL,
            language: this.language,
            parent_block_id: createdBlockId,
            split_index: i,
            status: "active",
          };
          this.blockDao.create(childBlockCreate);
        }
      } else {
        // 直接创建单个 block
        const blockCreate: BlockCreate = {
          content: capture.content,
          content_type: capture.content_type || CONTENT_TYPE.INSIGHT,
          source: capture.source || CAPTURE_SOURCE.MANUAL,
          language: this.language,
          metadata: capture.metadata || {},
          parent_block_id: null,
          split_index: 0,
          status: "active",
        };
        createdBlockId = this.blockDao.create(blockCreate);
      }

      if (createdBlockId && capture.project_id) {
        this.projectBlockDao.addBlocksToProject(capture.project_id, [
          createdBlockId,
        ]);
      }

      // 异步调用模型生成ai_summary，并生成向量（暂未实现）

      // 获取并返回创建的记录 ID
      return createdBlockId;
    } catch (error) {
      Logger.error("创建记录失败", { error: String(error), capture });
      throw error;
    }
  }

  /**
   * 根据 ID 获取记录详情
   * @param id 记录 ID
   * @returns 记录详情，如果不存在返回 null
   */
  public getById(id: Id): CaptureDetail | null {
    try {
      const block = this.blockDao.findById(id);
      if (!block) {
        return null;
      }

      const CaptureInfo = this.blockToCaptureInfo(block);
      const CaptureDetail: CaptureDetail = {
        ...CaptureInfo,
      };

      if (block.parent_block_id) {
        const parentBlock = this.blockDao.findById(block.parent_block_id);
        if (parentBlock) {
          CaptureDetail.parent = this.blockToCaptureListItem(parentBlock);
        }
      }

      const childBlocks = this.blockDao.findByParentBlock(id);
      if (childBlocks.length > 0) {
        CaptureDetail.children = childBlocks.map((b) =>
          this.blockToCaptureListItem(b),
        );
      }

      return CaptureDetail;
    } catch (error) {
      Logger.error("获取记录详情失败", { error: String(error), id });
      throw error;
    }
  }

  /**
   * 更新记录
   * 支持对父 block（根 block）和子 block 进行更新
   * - 更新父 block：删除所有子 block，按新 content 重新拆分子 block
   * - 更新子 block：直接更新该子 block 的 content，不影响兄弟 block
   * @param capture 更新记录的参数
   * @returns 是否修改成功
   */
  public update(capture: CaptureUpdate): boolean {
    try {
      const existingBlock = this.blockDao.findById(capture.id);
      if (!existingBlock) {
        return false;
      }

      // 查找根 block（split_index = 0 的父 block）
      let rootBlock = existingBlock;
      if (existingBlock.parent_block_id) {
        const parentBlock = this.blockDao.findById(
          existingBlock.parent_block_id,
        );
        if (parentBlock) {
          rootBlock = parentBlock;
        }
      }

      // 判断是否是对子 block 进行更新
      const isChildBlockUpdate = this.isChildBlock(existingBlock);

      if (isChildBlockUpdate) {
        // 子 block 更新：直接更新该 block 的 content，不影响兄弟 block
        const childUpdate: Partial<Block> = {};
        if (capture.content !== undefined) {
          childUpdate.content = capture.content;
        }
        if (capture.metadata !== undefined) {
          childUpdate.metadata = capture.metadata;
        }
        this.blockDao.update(existingBlock.id, childUpdate);

        this.syncProjectAssociation(rootBlock.id, capture.project_id);
      } else {
        // 父 block（根 block）更新：删除旧的所有子 block，重新拆分内容
        const oldChildren = this.blockDao.findByParentBlock(rootBlock.id);
        const oldChildIds = oldChildren.map((c) => c.id);
        // 批量删除旧子块及其关联，减少多次 DB round-trip
        if (oldChildIds.length > 0) {
          this.blockDao.transaction(() => {
            const placeholders = oldChildIds.map(() => "?").join(", ");
            this.projectBlockDao.execute(
              `DELETE FROM project_blocks WHERE block_id IN (${placeholders})`,
              oldChildIds,
            );
            this.conceptBlockDao.execute(
              `DELETE FROM concept_blocks WHERE block_id IN (${placeholders})`,
              oldChildIds,
            );
            this.topicBlockDao.execute(
              `DELETE FROM topic_blocks WHERE block_id IN (${placeholders})`,
              oldChildIds,
            );
            this.blockDao.deleteByIds(oldChildIds);
          });
        }

        // 更新根 block
        const rootUpdate: Partial<Block> = {};
        if (capture.content !== undefined) {
          rootUpdate.content = capture.content;
        }
        if (capture.metadata !== undefined) {
          rootUpdate.metadata = capture.metadata;
        }
        this.blockDao.update(rootBlock.id, rootUpdate);

        // 重新拆分内容并创建子 block
        const splitContent = this.splitContentByPhi(
          capture.content || rootBlock.content,
        );
        if (splitContent.length > 1) {
          for (let i = 1; i < splitContent.length; i++) {
            const childBlockCreate: BlockCreate = {
              content: splitContent[i],
              content_type: rootBlock.content_type,
              source: rootBlock.source,
              language: rootBlock.language,
              metadata: rootBlock.metadata,
              parent_block_id: rootBlock.id,
              split_index: i,
            };
            this.blockDao.create(childBlockCreate);
          }
        }

        this.syncProjectAssociation(rootBlock.id, capture.project_id);
      }
      // 异步调用模型生成ai_summary，并生成向量（暂未实现）

      return true;
    } catch (error) {
      Logger.error("更新记录失败", { error: String(error), capture });
      return false;
    }
  }

  /**
   * 删除记录
   * 支持删除父 block（根 block）和子 block
   * - 删除父 block：同时删除所有子 block 和关联数据
   * - 删除子 block：只删除该子 block 及其关联数据
   * @param id 记录 ID
   * @returns 删除是否成功
   */
  public delete(id: Id): boolean {
    try {
      const block = this.blockDao.findById(id);
      if (!block) {
        return false;
      }

      // 判断是否是对子 block 进行删除
      const isChildBlock = this.isChildBlock(block);

      if (isChildBlock) {
        // 子 block 删除：只删除该子 block 及其关联数据
        this.projectBlockDao.deleteBy("block_id", block.id);
        this.conceptBlockDao.deleteBy("block_id", block.id);
        this.topicBlockDao.deleteBy("block_id", block.id);
        const result = this.blockDao.delete(block.id);
        return result > 0;
      }

      // 父 block（根 block）删除：同时删除所有子 block 和关联数据
      const childBlocks = this.blockDao.findByParentBlock(block.id);
      const childIds = childBlocks.map((c) => c.id);

      // 在事务中批量删除子块及其关联，并删除根 block 的关联和根 block 本身
      const result = this.blockDao.transaction(() => {
        if (childIds.length > 0) {
          const placeholders = childIds.map(() => "?").join(", ");
          this.projectBlockDao.execute(
            `DELETE FROM project_blocks WHERE block_id IN (${placeholders})`,
            childIds,
          );
          this.conceptBlockDao.execute(
            `DELETE FROM concept_blocks WHERE block_id IN (${placeholders})`,
            childIds,
          );
          this.topicBlockDao.execute(
            `DELETE FROM topic_blocks WHERE block_id IN (${placeholders})`,
            childIds,
          );
          this.blockDao.deleteByIds(childIds);
        }

        // 删除根 block 的关联
        this.projectBlockDao.deleteBy("block_id", block.id);
        this.conceptBlockDao.deleteBy("block_id", block.id);
        this.topicBlockDao.deleteBy("block_id", block.id);

        // 删除根 block
        return this.blockDao.delete(block.id);
      });

      return result > 0;
    } catch (error) {
      Logger.error("删除记录失败", { error: String(error), id });
      throw error;
    }
  }

  /**
   * 分页查询记录列表
   * 支持查询父 block 列表、所有子 block 列表、以及指定父 block 的子 block 列表
   * 结果按 created_at ASC, split_index ASC 排序
   * @param query 查询条件
   *   - parent_record_id 为 undefined：查询父 block（根记录）列表
   *   - parent_record_id 为 null：查询所有子 block 列表
   *   - parent_record_id 为具体 ID：查询该父 block 下的子 block 列表
   * @returns 分页的记录列表
   */
  public list(query?: CaptureQuery): PaginationResult<CaptureListItem> {
    try {
      const page = Math.max(1, query?.page ?? 1);
      const pageSize = Math.min(Math.max(1, query?.page_size ?? 50), 100);
      const offset = (page - 1) * pageSize;

      // 构建 WHERE 条件
      const conditions: string[] = [];
      const values: unknown[] = [];

      if (query?.source !== undefined) {
        conditions.push("source = ?");
        values.push(query.source);
      }
      if (query?.content_type !== undefined) {
        conditions.push("content_type = ?");
        values.push(query.content_type);
      }
      if (query?.temporal_score_min !== undefined) {
        conditions.push("temporal_score >= ?");
        values.push(query.temporal_score_min);
      }
      if (query?.temporal_score_max !== undefined) {
        conditions.push("temporal_score <= ?");
        values.push(query.temporal_score_max);
      }

      // 根据 parent_record_id 确定查询范围
      if (query?.parent_record_id !== undefined) {
        if (query.parent_record_id === null) {
          // 查询所有子 block（parent_block_id 不为空的记录）
          conditions.push("parent_block_id IS NOT NULL");
        } else {
          // 查询指定父 block 下的子 block
          conditions.push("parent_block_id = ?");
          values.push(query.parent_record_id);
        }
      } else {
        // 默认查询父 block（根记录）
        conditions.push("parent_block_id IS NULL");
      }

      const whereClause = conditions.join(" AND ");

      // 统计总数
      const countSql = `SELECT * FROM blocks WHERE ${whereClause}`;
      const total = this.blockDao.count(countSql, values);

      // 分页查询，按 created_at ASC, split_index ASC 排序
      const dataSql = `SELECT * FROM blocks WHERE ${whereClause} ORDER BY created_at ASC, split_index ASC LIMIT ? OFFSET ?`;
      const dataValues = [...values, pageSize, offset];
      const blocks = this.blockDao.query(dataSql, dataValues) as Block[];

      const totalPages = Math.ceil(total / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, total);

      return {
        data: blocks.map((block) => this.blockToCaptureListItem(block)),
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
      Logger.error("查询记录列表失败", { error: String(error), query });
      throw error;
    }
  }

  /**
   * 搜索记录
   * 支持搜索所有 block、所有子 block、或指定父 block 下的子 block
   * 搜索结果中父 block 将自动包含其子 block
   * @param keyword 搜索关键词
   * @param limit 返回数量限制
   * @param searchType 搜索类型
   * @param parent_record_id 可选的父记录 ID 过滤
   *   - undefined：搜索所有 block
   *   - null：搜索所有子 block
   *   - 具体 ID：搜索指定父 block 下的子 block
   * @returns 匹配的记录列表
   */
  public async search(
    keyword: string,
    limit: number = 50,
    searchType?: SearchType,
    parent_record_id?: Id | null,
  ): Promise<CaptureListItem[]> {
    try {
      if (searchType === SEARCH_TYPE.KEYWORD) {
        const blocks = this.blockDao.searchFts(
          keyword,
          limit,
          parent_record_id,
        );
        return this.blocksToRecordListWithChildren(blocks, (a, b) => {
          const timeCompare =
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          if (timeCompare !== 0) return timeCompare;
          return a.split_index - b.split_index;
        });
      } else if (searchType === SEARCH_TYPE.SEMANTIC) {
        const canUseLocal = await modelRouter.isLocalAvailable();
        if (canUseLocal) {
          return this.searchByVector(keyword, limit, parent_record_id);
        }
        // 未开启本地智能时，回退到 SQL FTS 搜索
        const blocks = this.blockDao.searchFts(
          keyword,
          limit,
          parent_record_id,
        );
        return this.blocksToRecordListWithChildren(blocks, (a, b) => {
          const timeCompare =
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          if (timeCompare !== 0) return timeCompare;
          return a.split_index - b.split_index;
        });
      }
      return [];
    } catch (error) {
      Logger.error("搜索记录失败", {
        error: String(error),
        keyword,
        limit,
        searchType,
      });
      throw error;
    }
  }

  /**
   * 向量语义搜索
   * 通过向量数据库搜索语义相似的 block，再映射为 CaptureListItem[]
   */
  private async searchByVector(
    keyword: string,
    limit: number,
    parent_record_id?: Id | null,
  ): Promise<CaptureListItem[]> {
    try {
      const ANN_TOP_K = 50;
      const RERANK_TOP_K = 10;

      // Step 1: 使用 jina-embeddings-v3 生成查询向量
      const { vector } = await embed(keyword, {
        modelName: "Xenova/jina-embeddings-v3",
      });

      // Step 2: LanceDB ANN 检索 Top-50
      const searchResults = await vectorService.searchBlockEmbeddings({
        vector,
        topK: ANN_TOP_K,
      });

      if (!searchResults || searchResults.length === 0) {
        return [];
      }

      // Step 3: 获取候选 block 的 content 文本
      const candidateBlockIds = searchResults.map((r) => r.item.block_id);
      const candidateBlocks = this.blockDao.findByIds(candidateBlockIds);

      if (candidateBlocks.length === 0) {
        return [];
      }

      // 构建 block_id -> Block 映射
      const blockMap = new Map(candidateBlocks.map((b) => [b.id, b]));
      const candidateContents: string[] = [];
      const orderedBlocks: Block[] = [];

      for (const blockId of candidateBlockIds) {
        const block = blockMap.get(blockId);
        if (block) {
          candidateContents.push(block.content);
          orderedBlocks.push(block);
        }
      }

      // Step 5: bge-reranker-v2-m3 对候选文档重排序
      const rerankResults = await rerank(keyword, candidateContents, {
        modelName: "Xenova/bge-reranker-v2-m3",
      });

      // Step 6: 取 Top-10 的 block，映射为 CaptureListItem[]
      const topKBlocks = rerankResults
        .slice(0, RERANK_TOP_K)
        .map((r) => orderedBlocks[r.index])
        .filter(Boolean);

      return this.blocksToRecordListWithChildren(topKBlocks, (a, b) => {
        const timeCompare =
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (timeCompare !== 0) return timeCompare;
        return a.split_index - b.split_index;
      });
    } catch (error) {
      Logger.error("向量语义搜索失败，回退到 SQL FTS", {
        error: String(error),
        keyword,
        limit,
      });
      // 向量搜索失败时回退到 SQL FTS
      const blocks = this.blockDao.searchFts(keyword, limit, parent_record_id);
      return this.blocksToRecordListWithChildren(blocks, (a, b) => {
        const timeCompare =
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (timeCompare !== 0) return timeCompare;
        return a.split_index - b.split_index;
      });
    }
  }

  /**
   * 获取最近的子 block 列表
   * 结果按 created_at ASC, split_index ASC 排序
   * @param limit 返回数量限制
   * @returns 最近的子 block 列表
   */
  public getRecent(limit: number = 50): CaptureListItem[] {
    try {
      const blocks = this.blockDao.getRecentBlocks(limit, null);
      return blocks.map((block) => this.blockToCaptureListItem(block));
    } catch (error) {
      Logger.error("获取最近记录失败", { error: String(error), limit });
      throw error;
    }
  }

  /**
   * 按时间衰减分数获取记录
   * 包含非拆分的父 block 以及拆分后的父 block + 子 block 列表
   * 结果按 temporal_score DESC, split_index ASC 排序
   * @param limit 返回数量限制
   * @returns 按时间衰减分数排序的记录列表
   */
  public getWithTemporalScore(limit: number = 50): CaptureListItem[] {
    try {
      const blocks = this.blockDao.getBlocksWithTemporalScore(limit);
      return this.blocksToRecordListWithChildren(blocks, (a, b) => {
        const scoreCompare = b.temporal_score - a.temporal_score;
        if (scoreCompare !== 0) return scoreCompare;
        return a.split_index - b.split_index;
      });
    } catch (error) {
      Logger.error("获取带时间衰减分数的记录失败", {
        error: String(error),
        limit,
      });
      throw error;
    }
  }

  /**
   * 获取项目关联的记录列表
   * 包含非拆分的父 block 以及拆分后的父 block + 子 block 列表
   * 结果按 created_at ASC, split_index ASC 排序
   * @param projectId 项目 ID
   * @returns 项目关联的记录列表
   */
  public getByProjectId(projectId: Id): CaptureListItem[] {
    try {
      const projectBlocks = this.projectBlockDao.findBy(
        "project_id",
        projectId,
      );
      const blockIds = projectBlocks.map((pb) => pb.block_id);

      if (blockIds.length === 0) {
        return [];
      }

      const blocks = this.blockDao.findByIds(blockIds);
      return this.blocksToRecordListWithChildren(blocks, (a, b) => {
        const timeCompare =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (timeCompare !== 0) return timeCompare;
        return a.split_index - b.split_index;
      });
    } catch (error) {
      Logger.error("获取项目关联记录失败", { error: String(error), projectId });
      throw error;
    }
  }

  /**
   * 根据日期范围查询记录列表
   * 包含非拆分的父 block 以及拆分后的父 block + 子 block 列表
   * 结果按 created_at ASC 排序
   * @param startDate 起始日期（ISO 8601 字符串），可选
   * @param endDate 结束日期（ISO 8601 字符串），可选
   * @returns 日期范围内的记录列表，或不传日期范围时返回最近 20 条
   */
  public getByDateRange(
    startDate?: string,
    endDate?: string,
  ): CaptureDateListItem[] {
    try {
      let blocks: Block[];

      if (startDate && endDate) {
        // 如果传入的是日期（YYYY-MM-DD），补全为当日开始/结束时间，保证按天范围查询包含整天记录
        const normalizeStart = (d: string) =>
          /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00.000Z` : d;
        const normalizeEnd = (d: string) =>
          /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T23:59:59.999Z` : d;
        const s = normalizeStart(startDate);
        const e = normalizeEnd(endDate);

        blocks = this.blockDao.findByDateRange(s, e, "active");
      } else {
        // 不传日期范围时，返回最近 20 条父 block
        const sql = `SELECT * FROM blocks WHERE parent_block_id IS NULL ORDER BY created_at DESC LIMIT 20`;
        blocks = this.blockDao.query(sql) as Block[];
      }

      const items = this.blocksToRecordListWithChildren(blocks, (a, b) => {
        const timeCompare =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (timeCompare !== 0) return timeCompare;
        return a.split_index - b.split_index;
      });

      const dateMap = new Map<string, CaptureInfo[]>();
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
        .map(([dateKey, captures]) => ({
          date: dateKey,
          captures,
        }));
    } catch (error) {
      Logger.error("根据日期范围查询记录失败", {
        error: String(error),
        startDate,
        endDate,
      });
      throw error;
    }
  }

  /**
   * 添加记录到项目
   * @param captureId 记录 ID
   * @param projectId 项目 ID
   * @param relevanceScore 相关度分数（可选）
   */
  public addToProject(
    recordId: Id,
    projectId: Id,
    relevanceScore?: number,
  ): void {
    try {
      this.projectBlockDao.addBlocksToProject(
        projectId,
        [recordId],
        relevanceScore ? [relevanceScore] : undefined,
      );
    } catch (error) {
      Logger.error("添加记录到项目失败", {
        error: String(error),
        recordId,
        projectId,
        relevanceScore,
      });
      throw error;
    }
  }

  /**
   * 从项目移除记录
   * @param recordId 记录 ID
   * @param projectId 项目 ID
   */
  public removeFromProject(recordId: Id, projectId: Id): void {
    try {
      this.projectBlockDao.deleteBy("project_id", projectId, recordId);
    } catch (error) {
      Logger.error("从项目移除记录失败", {
        error: String(error),
        recordId,
        projectId,
      });
      throw error;
    }
  }
}

export default CaptureService;

export const captureService = CaptureService.getInstance();
