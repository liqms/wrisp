// =============================================
// Wrisp LanceDB 向量数据库初始化脚本
// 版本: 0.1.0
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
import { createRequire } from "node:module";
import { configService } from "@/main/core/services/system/config.service";
import { EMBEDDING_DIMENSION } from "@/main/core/model-gateway/local-gateway/model-registry";
import { Id } from "@/shared/types";
import {
  Schema,
  Field,
  Float32,
  Utf8,
  FixedSizeList,
} from "apache-arrow";

// 延迟导入 Electron，避免非 Electron 环境下的问题
// 主进程以 CJS 格式构建，`import.meta.url` 会被编译为 undefined，
// 因此使用 CJS 全局 `__filename` 作为 createRequire 的参数。
const requireModule = createRequire(__filename);
let app: typeof import("electron").app | null = null;
try {
  app = requireModule("electron").app;
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
    basePath = join(process.cwd(), ".wrisp");
  }

  const vectorPath = join(basePath, "vectors");

  if (!fs.existsSync(vectorPath)) {
    fs.mkdirSync(vectorPath, { recursive: true });
  }

  return vectorPath;
}

/**
 * Chunk 向量表 Schema 类型
 */
export interface ChunkEmbedding {
  [key: string]: unknown;
  chunk_id: Id;
  project_id?: Id | null;
  embedding: number[];
}

/**
 * 页面向量表 Schema 类型
 */
export interface PageEmbedding {
  [key: string]: unknown;
  page_id: Id;
  /** 与 pages.project_id 一致，可为空（页面可无归属作品） */
  project_id: Id | null;
  embedding: number[];
}

/** 当前 Chunk 向量表名 */
const CHUNK_TABLE = "chunk_embeddings";
/** 面向量表名 */
const PAGE_TABLE = "pages_embeddings";
/** v1 遗留的 Chunk 向量表名（存量工作区需改名） */
const LEGACY_CHUNK_TABLE = "block_embeddings";

/**
 * 索引配置参数（LanceDB IVF-PQ 配置）。
 *
 * 不写死 `numPartitions`：该值随行数缩放（LanceDB 默认取 sqrt(行数)）。
 * 历史上写死 1024，导致任何向量数 < 1024 的工作区在 k-means 训练阶段直接报
 * "KMeans cannot train 1024 centroids with N vectors"，索引永远建不出来。
 */
const ivfPqOptions: Omit<IvfPqOptions, "numPartitions"> = {
  numSubVectors: 8,
  numBits: 8,
  distanceType: "cosine",
};

/**
 * 建 ANN 索引的最小行数。
 * 该值是 LanceDB IVF-PQ 的硬性下限（训练 PQ 码本至少需要 256 行，
 * 否则报 "Not enough rows to train PQ. Requires 256 rows"）；
 * 低于它时全表扫描也更快，因此直接跳过，等数据长起来后在下次启动时补建。
 */
const MIN_ROWS_FOR_INDEX = 256;

/**
 * 存量工作区迁移（第一步）：把 v1 的 `block_embeddings.lance` 目录改名为 `chunk_embeddings.lance`。
 *
 * LanceDB JS SDK 无 `renameTable`，只能在 `connect()` **之前**直接改目录名，
 * 否则连接已缓存旧表名。幂等：目标目录已存在则跳过。
 */
function migrateChunkTableDirectory(): void {
  const vectorPath = getVectorDbPath();
  const legacyDir = join(vectorPath, `${LEGACY_CHUNK_TABLE}.lance`);
  const targetDir = join(vectorPath, `${CHUNK_TABLE}.lance`);

  if (fs.existsSync(legacyDir) && !fs.existsSync(targetDir)) {
    fs.renameSync(legacyDir, targetDir);
    console.log(`[LanceDB] 向量表目录改名: ${LEGACY_CHUNK_TABLE} → ${CHUNK_TABLE}`);
  }
}

/**
 * 存量工作区迁移（第二步）：把表内主键列 `block_id` 改名为 `chunk_id`。
 *
 * `Table.alterColumns([{ path, rename }])` 原地无损改列名，向量数据不动。
 * 幂等：目标列已存在或源列不存在则跳过。
 */
async function migrateChunkIdColumn(db: Connection): Promise<void> {
  if (!(await tableExists(db, CHUNK_TABLE))) {
    return;
  }
  const table = await db.openTable(CHUNK_TABLE);
  const schema = await table.schema();
  const hasChunkId = schema.fields.some((f) => f.name === "chunk_id");
  const hasBlockId = schema.fields.some((f) => f.name === "block_id");

  if (hasBlockId && !hasChunkId) {
    await table.alterColumns([{ path: "block_id", rename: "chunk_id" }]);
    console.log("[LanceDB] 向量表列改名: block_id → chunk_id");
  }
}

/**
 * 初始化 LanceDB 连接
 */
export async function initLanceDB(): Promise<Connection> {
  const dbPath = getVectorDbPath();
  console.log(`[LanceDB] 向量数据库路径: ${dbPath}`);

  // 目录改名必须在 connect 之前完成（连接会缓存表名）
  migrateChunkTableDirectory();

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
    // IndexConfig 的列字段是 `columns: string[]`（不是 `column`）；
    // 用错字段会让这里恒为 false，导致每次启动都重复训练并重建索引。
    return indexes.some(
      (idx) => Array.isArray(idx.columns) && idx.columns.includes(columnName),
    );
  } catch {
    return false;
  }
}

/** embedding 列的定长维度；非定长列表或字段缺失时返回 undefined */
function getEmbeddingListSize(schema: Schema): number | undefined {
  const field = schema.fields.find((f) => f.name === "embedding");
  const listSize = (field?.type as { listSize?: number } | undefined)?.listSize;
  return listSize;
}

/** embedding 字段定义（维度取自嵌入模型注册表） */
function buildEmbeddingField(): Field {
  return new Field(
    "embedding",
    new FixedSizeList(EMBEDDING_DIMENSION, new Field("item", new Float32(), false)),
    false,
  );
}

/**
 * 确保向量表存在且 embedding 列维度与当前嵌入模型一致。
 * 表不存在 → 按当前维度创建；表已存在但维度不符（历史库按旧模型建表）→ 删除重建：
 * 旧向量与当前模型不在同一向量空间，保留无意义。
 * @returns 已存在的表（供调用方补列）；刚创建或重建时为 null
 */
async function ensureEmbeddingTable(
  db: Connection,
  tableName: "chunk_embeddings" | "pages_embeddings",
  buildSchema: () => Schema,
): Promise<Table | null> {
  if (!(await tableExists(db, tableName))) {
    console.log(`[LanceDB] 创建向量表 ${tableName}（维度 ${EMBEDDING_DIMENSION}）...`);
    await db.createEmptyTable(tableName, buildSchema());
    return null;
  }

  const table = await db.openTable(tableName);
  const schema = await table.schema();
  const listSize = getEmbeddingListSize(schema);
  if (listSize !== undefined && listSize !== EMBEDDING_DIMENSION) {
    console.warn(
      `[LanceDB] 向量表 ${tableName} 维度不符（现有 ${listSize}，期望 ${EMBEDDING_DIMENSION}），删除并重建`,
    );
    await db.dropTable(tableName);
    await db.createEmptyTable(tableName, buildSchema());
    return null;
  }

  // 列可空性比对：pages_embeddings 曾把 project_id 声明为非空，与 pages.project_id 不符。
  // 该表历史上无写入方（恒空），drop+recreate 无损；比对只针对两侧同名的列，不影响其他字段。
  const expected = buildSchema();
  const nullabilityMismatch = expected.fields.some((expectedField) => {
    const actualField = schema.fields.find((f) => f.name === expectedField.name);
    return actualField !== undefined && actualField.nullable !== expectedField.nullable;
  });
  if (nullabilityMismatch) {
    console.warn(`[LanceDB] 向量表 ${tableName} 列可空性与当前 schema 不符，删除并重建`);
    await db.dropTable(tableName);
    await db.createEmptyTable(tableName, buildSchema());
    return null;
  }

  return table;
}

/**
 * 初始化所有向量表
 */
export async function initVectorTables(db: Connection): Promise<void> {
  console.log("[LanceDB] 开始初始化向量表...");

  // 存量工作区迁移（第二步）：block_id → chunk_id（目录改名已在 connect 前完成）
  await migrateChunkIdColumn(db);

  // ==================== Chunk 向量表 ====================
  const chunkTable = await ensureEmbeddingTable(db, CHUNK_TABLE, () =>
    new Schema([
      new Field("chunk_id", new Utf8(), false),
      new Field("project_id", new Utf8(), true),
      buildEmbeddingField(),
    ]),
  );
  if (chunkTable) {
    console.log("[LanceDB] Chunk 向量表已存在");
    const fields = await chunkTable.schema();
    const hasProjectId = fields.fields.some((f) => f.name === "project_id");
    if (!hasProjectId) {
      console.log("[LanceDB] 为 Chunk 向量表补充 project_id 列...");
      await chunkTable.addColumns(new Field("project_id", new Utf8(), true));
      console.log("[LanceDB] project_id 列补充完成（存量行为 null）");
    }
  } else {
    console.log("[LanceDB] Chunk 向量表创建完成");
  }

  // ==================== 页面向量表 ====================
  const pageTable = await ensureEmbeddingTable(db, PAGE_TABLE, () =>
    new Schema([
      new Field("page_id", new Utf8(), false),
      // 与 pages.project_id 对齐：页面可以没有归属作品
      new Field("project_id", new Utf8(), true),
      buildEmbeddingField(),
    ]),
  );
  if (pageTable) {
    console.log("[LanceDB] 页面向量表已存在");
  } else {
    console.log("[LanceDB] 页面向量表创建完成");
  }
}

/**
 * 为向量表的 embedding 列补齐 ANN 索引。
 * 已存在则跳过；行数不足则跳过——空表 / 小表训练 k-means 必然失败，跳过可避免噪音日志。
 */
async function ensureEmbeddingIndex(
  db: Connection,
  tableName: "chunk_embeddings" | "pages_embeddings",
): Promise<void> {
  const table = await db.openTable(tableName);

  if (await indexExists(table, "embedding")) {
    console.log(`[LanceDB] ${tableName} 向量索引已存在`);
    return;
  }

  const rowCount = await table.countRows();
  if (rowCount < MIN_ROWS_FOR_INDEX) {
    console.log(
      `[LanceDB] ${tableName} 当前 ${rowCount} 条向量（< ${MIN_ROWS_FOR_INDEX}），暂不建索引，检索走全表扫描`,
    );
    return;
  }

  const numPartitions = Math.floor(Math.sqrt(rowCount));
  try {
    await table.createIndex("embedding", {
      config: Index.ivfPq({ ...ivfPqOptions, numPartitions }),
    });
    console.log(
      `[LanceDB] ${tableName} 向量索引创建完成（${rowCount} 条，${numPartitions} 个分区）`,
    );
  } catch (error) {
    console.warn(`[LanceDB] ${tableName} 向量索引创建失败:`, error);
  }
}

/**
 * 创建向量索引
 */
export async function createIndexes(db: Connection): Promise<void> {
  console.log("[LanceDB] 开始创建向量索引...");

  await ensureEmbeddingIndex(db, CHUNK_TABLE);
  await ensureEmbeddingIndex(db, PAGE_TABLE);
}

/**
 * 获取 Chunk 向量表
 */
export async function getChunkEmbeddingTable(db: Connection): Promise<Table> {
  return await db.openTable(CHUNK_TABLE);
}

/**
 * 获取页面向量表
 */
export async function getPageEmbeddingTable(db: Connection): Promise<Table> {
  return await db.openTable(PAGE_TABLE);
}

// ==================== 数据操作方法 ====================

/**
 * 插入单个 Chunk 向量
 */
export async function insertChunkEmbedding(
  table: Table,
  data: ChunkEmbedding,
): Promise<void> {
  await table.add([data]);
}

/**
 * 批量插入 Chunk 向量
 */
export async function insertChunkEmbeddings(
  table: Table,
  data: ChunkEmbedding[],
): Promise<void> {
  await table.add(data);
}

/**
 * 更新 Chunk 向量
 */
export async function updateChunkEmbedding(
  table: Table,
  chunkId: Id,
  data: Partial<ChunkEmbedding>,
): Promise<void> {
  await table.delete(`chunk_id = '${chunkId}'`);
  if (data) {
    await table.add([{ chunk_id: chunkId, ...data } as ChunkEmbedding]);
  }
}

/**
 * 删除 Chunk 向量
 */
export async function deleteChunkEmbedding(
  table: Table,
  chunkId: string,
): Promise<void> {
  await table.delete(`chunk_id = '${chunkId}'`);
}

/**
 * 语义搜索 Chunk（实现移至 ./chunk-embedding-search，此处仅再导出以保持既有调用方不变）
 */
export { searchChunkEmbeddings } from "./chunk-embedding-search";

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
  console.log("Wrisp LanceDB 向量数据库初始化");
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
