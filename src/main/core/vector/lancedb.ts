// =============================================
// PenTip LanceDB 向量数据库初始化脚本
// 版本: 2.0.0
// 创建时间: 2026-05-12
// =============================================

import {
  connect,
  type Connection,
  type Table,
  Index,
  IvfPqOptions,
} from "@lancedb/lancedb";
import { join } from "path";
import fs from "fs";
import { configService } from "@/main/core/services/config.service";
import { Id } from "@/main/types";
import {
  Schema,
  Field,
  Float32,
  Utf8,
  FixedSizeList,
} from "apache-arrow";

// 延迟导入 Electron，避免非 Electron 环境下的问题
let app: typeof import("electron").app | null = null;
try {
  app = require("electron").app;
} catch {
  // 在非 Electron 环境中运行
}

/**
 * 获取向量数据库存储路径
 */
export function getVectorDbPath(): string {
  let basePath: string;

  if (app) {
    // Electron 环境
    basePath = configService.getValue("workspace") || "";
    if (!basePath) {
      throw new Error("workspace 配置未设置");
    }
  } else {
    // 非 Electron 环境（测试、CLI等）
    basePath = join(process.cwd(), ".pentip");
  }

  const vectorPath = join(basePath, "vectors");

  if (!fs.existsSync(vectorPath)) {
    fs.mkdirSync(vectorPath, { recursive: true });
  }

  return vectorPath;
}

/**
 * Block 向量表 Schema 类型
 */
export interface BlockEmbedding {
  [key: string]: unknown;
  block_id: Id;
  embedding: number[];
}

/**
 * 概念向量表 Schema 类型
 */
export interface ConceptEmbedding {
  [key: string]: unknown;
  concept_id: Id;
  embedding: number[];
}

/**
 * 页面向量表 Schema 类型
 */
export interface PageEmbedding {
  [key: string]: unknown;
  page_id: Id;
  project_id: Id;
  embedding: number[];
}

/**
 * 索引配置参数（LanceDB IVF-PQ 配置）
 */
const ivfPqOptions: IvfPqOptions = {
  numPartitions: 1024,
  numSubVectors: 8,
  numBits: 8,
  distanceType: "cosine",
};

/**
 * 初始化 LanceDB 连接
 */
export async function initLanceDB(): Promise<Connection> {
  const dbPath = getVectorDbPath();
  console.log(`[LanceDB] 向量数据库路径: ${dbPath}`);

  const db = await connect(dbPath);
  console.log("[LanceDB] 连接成功");

  return db;
}

/**
 * 检查表是否存在
 */
async function tableExists(
  db: Connection,
  tableName: string,
): Promise<boolean> {
  const tables = await db.tableNames();
  return tables.includes(tableName);
}

/**
 * 检查索引是否存在
 */
async function indexExists(table: Table, columnName: string): Promise<boolean> {
  try {
    const indexes = await table.listIndices();
    if (Array.isArray(indexes)) {
      return indexes.some(
        (idx: unknown) =>
          typeof idx === "object" &&
          idx !== null &&
          "column" in idx &&
          idx.column === columnName,
      );
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 初始化所有向量表
 */
export async function initVectorTables(db: Connection): Promise<void> {
  console.log("[LanceDB] 开始初始化向量表...");

  // ==================== Block 向量表 ====================
  if (!(await tableExists(db, "block_embeddings"))) {
    console.log("[LanceDB] 创建 Block 向量表...");
    const schema = new Schema([
      new Field("block_id", new Utf8(), false),
      new Field(
        "embedding",
        new FixedSizeList(1536, new Field("item", new Float32(), false)),
        false,
      ),
    ]);
    await db.createEmptyTable("block_embeddings", schema);
    console.log("[LanceDB] Block 向量表创建完成");
  } else {
    console.log("[LanceDB] Block 向量表已存在");
  }

  // ==================== 概念向量表 ====================
  if (!(await tableExists(db, "concept_embeddings"))) {
    console.log("[LanceDB] 创建概念向量表...");
    const schema = new Schema([
      new Field("concept_id", new Utf8(), false),
      new Field(
        "embedding",
        new FixedSizeList(1536, new Field("item", new Float32(), false)),
        false,
      ),
    ]);
    await db.createEmptyTable("concept_embeddings", schema);
    console.log("[LanceDB] 概念向量表创建完成");
  } else {
    console.log("[LanceDB] 概念向量表已存在");
  }

  // ==================== 页面向量表 ====================
  if (!(await tableExists(db, "pages_embeddings"))) {
    console.log("[LanceDB] 创建页面向量表...");
    const schema = new Schema([
      new Field("page_id", new Utf8(), false),
      new Field("project_id", new Utf8(), false),
      new Field(
        "embedding",
        new FixedSizeList(1536, new Field("item", new Float32(), false)),
        false,
      ),
    ]);
    await db.createEmptyTable("pages_embeddings", schema);
    console.log("[LanceDB] 页面向量表创建完成");
  } else {
    console.log("[LanceDB] 页面向量表已存在");
  }
}

/**
 * 创建向量索引
 */
export async function createIndexes(db: Connection): Promise<void> {
  console.log("[LanceDB] 开始创建向量索引...");

  // Block 向量表索引
  const blockTable = await db.openTable("block_embeddings");
  if (!(await indexExists(blockTable, "embedding"))) {
    console.log("[LanceDB] 为 Block 向量表创建索引...");
    try {
      await blockTable.createIndex("embedding", { config: Index.ivfPq(ivfPqOptions) });
      console.log("[LanceDB] Block 向量表索引创建完成");
    } catch (error) {
      console.warn("[LanceDB] Block 向量表索引创建失败（表可能为空，数据写入后会自动创建）:", error);
    }
  } else {
    console.log("[LanceDB] Block 向量表索引已存在");
  }

  // 概念向量表索引
  const conceptTable = await db.openTable("concept_embeddings");
  if (!(await indexExists(conceptTable, "embedding"))) {
    console.log("[LanceDB] 为概念向量表创建索引...");
    try {
      await conceptTable.createIndex("embedding", { config: Index.ivfPq(ivfPqOptions) });
      console.log("[LanceDB] 概念向量表索引创建完成");
    } catch (error) {
      console.warn("[LanceDB] 概念向量表索引创建失败（表可能为空，数据写入后会自动创建）:", error);
    }
  } else {
    console.log("[LanceDB] 概念向量表索引已存在");
  }

  // 页面向量表索引
  const pageTable = await db.openTable("pages_embeddings");
  if (!(await indexExists(pageTable, "embedding"))) {
    console.log("[LanceDB] 为页面向量表创建索引...");
    try {
      await pageTable.createIndex("embedding", { config: Index.ivfPq(ivfPqOptions) });
      console.log("[LanceDB] 页面向量表索引创建完成");
    } catch (error) {
      console.warn("[LanceDB] 页面向量表索引创建失败（表可能为空，数据写入后会自动创建）:", error);
    }
  } else {
    console.log("[LanceDB] 页面向量表索引已存在");
  }
}

/**
 * 获取 Block 向量表
 */
export async function getBlockEmbeddingTable(db: Connection): Promise<Table> {
  return await db.openTable("block_embeddings");
}

/**
 * 获取概念向量表
 */
export async function getConceptEmbeddingTable(db: Connection): Promise<Table> {
  return await db.openTable("concept_embeddings");
}

/**
 * 获取页面向量表
 */
export async function getPageEmbeddingTable(db: Connection): Promise<Table> {
  return await db.openTable("pages_embeddings");
}

// ==================== 数据操作方法 ====================

/**
 * 插入单个 Block 向量
 */
export async function insertBlockEmbedding(
  table: Table,
  data: BlockEmbedding,
): Promise<void> {
  await table.add([data]);
}

/**
 * 批量插入 Block 向量
 */
export async function insertBlockEmbeddings(
  table: Table,
  data: BlockEmbedding[],
): Promise<void> {
  await table.add(data);
}

/**
 * 更新 Block 向量
 */
export async function updateBlockEmbedding(
  table: Table,
  blockId: Id,
  data: Partial<BlockEmbedding>,
): Promise<void> {
  await table.delete(`block_id = '${blockId}'`);
  if (data) {
    await table.add([{ block_id: blockId, ...data } as BlockEmbedding]);
  }
}

/**
 * 删除 Block 向量
 */
export async function deleteBlockEmbedding(
  table: Table,
  blockId: string,
): Promise<void> {
  await table.delete(`block_id = '${blockId}'`);
}

/**
 * 语义搜索 Block
 */
export async function searchBlockEmbeddings(
  table: Table,
  queryVector: number[],
  topK: number = 10,
): Promise<BlockEmbedding[]> {
  const results = await table.search(queryVector).limit(topK).toArray();
  return results as BlockEmbedding[];
}

/**
 * 插入单个概念向量
 */
export async function insertConceptEmbedding(
  table: Table,
  data: ConceptEmbedding,
): Promise<void> {
  await table.add([data]);
}

/**
 * 更新概念向量
 */
export async function updateConceptEmbedding(
  table: Table,
  conceptId: string,
  data: Partial<ConceptEmbedding>,
): Promise<void> {
  await table.delete(`concept_id = '${conceptId}'`);
  if (data) {
    await table.add([{ concept_id: conceptId, ...data } as ConceptEmbedding]);
  }
}

/**
 * 搜索相似概念
 */
export async function searchConceptEmbeddings(
  table: Table,
  queryVector: number[],
  topK: number = 10,
): Promise<ConceptEmbedding[]> {
  const results = await table.search(queryVector).limit(topK).toArray();
  return results as ConceptEmbedding[];
}

/**
 * 插入单个页面向量
 */
export async function insertPageEmbedding(
  table: Table,
  data: PageEmbedding,
): Promise<void> {
  await table.add([data]);
}

/**
 * 更新页面向量
 */
export async function updatePageEmbedding(
  table: Table,
  pageId: string,
  data: Partial<PageEmbedding>,
): Promise<void> {
  await table.delete(`page_id = '${pageId}'`);
  if (data) {
    await table.add([{ page_id: pageId, ...data } as PageEmbedding]);
  }
}

/**
 * 搜索相似页面
 */
export async function searchPageEmbeddings(
  table: Table,
  queryVector: number[],
  topK: number = 10,
): Promise<PageEmbedding[]> {
  const results = await table.search(queryVector).limit(topK).toArray();
  return results as PageEmbedding[];
}

/**
 * 执行完整的初始化流程
 */
export async function initializeLanceDB(): Promise<Connection> {
  console.log("=============================================");
  console.log("PenTip LanceDB 向量数据库初始化");
  console.log("=============================================");

  try {
    const db = await initLanceDB();
    await initVectorTables(db);
    await createIndexes(db);

    console.log("=============================================");
    console.log("LanceDB 初始化完成！");
    console.log("=============================================");

    return db;
  } catch (error) {
    console.error("[LanceDB] 初始化失败:", error);
    throw error;
  }
}

// 如果直接运行此文件（CommonJS 环境），执行初始化
if (typeof require !== "undefined" && require.main === module) {
  initializeLanceDB().catch(console.error);
}
