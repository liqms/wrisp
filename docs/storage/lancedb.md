# LanceDB 向量数据库设计文档

## 概述

本文档定义 PenTip 的向量数据库设计，基于 LanceDB 构建，用于支持语义搜索、智能推荐和知识结晶功能。

**设计目标：**

- 高性能语义搜索（毫秒级响应）
- 支持增量更新和实时索引
- 低资源占用，适合本地部署
- 与 SQLite 主数据库协同工作

---

## 向量表设计

### 1. 语义块向量表 (chunk_embeddings)

存储所有语义块的向量表示，支持语义搜索和相似性匹配。

| 字段名      | 类型                         | 说明                                                      |
| :---------- | :--------------------------- | :-------------------------------------------------------- |
| `chunk_id`  | TEXT                         | 语义块唯一标识（UUID），与 SQLite semantic_chunks.id 关联 |
| `embedding` | fixed_size_list[float, 1536] | 1536 维向量（适配 jina-embeddings-v3 模型）               |

> 注意：LanceDB 仅存储检索必要字段（id + embedding），其他元数据仍由 SQLite 维护。

### 2. 概念向量表 (concept_embeddings)

存储从语义块中提取的概念向量，用于概念聚类和主题发现。

| 字段名       | 类型                         | 说明                                             |
| :----------- | :--------------------------- | :----------------------------------------------- |
| `concept_id` | TEXT                         | 概念唯一标识（UUID），与 SQLite concepts.id 关联 |
| `embedding`  | fixed_size_list[float, 1536] | 1536 维向量                                      |

> 注意：只保留概念 id 和 embedding，用于检索后从 SQLite 中加载完整概念信息。

---

### 3. 主题向量表 (topic_embeddings)

存储主题的向量表示，用于主题相似性搜索和推荐。

| 字段名      | 类型                         | 说明                                           |
| :---------- | :--------------------------- | :--------------------------------------------- |
| `topic_id`  | TEXT                         | 主题唯一标识（UUID），与 SQLite topics.id 关联 |
| `embedding` | fixed_size_list[float, 1536] | 1536 维向量                                    |

> 注意：主题向量通过聚合其关联的概念向量生成，用于主题级别的语义匹配。

---

## 索引配置

### IVF-PQ 索引参数

LanceDB 默认使用 HNSW 索引，对于大规模数据可配置 IVF-PQ 索引：

```typescript
import { Index, IvfPqOptions } from "@lancedb/lancedb";

// IVF-PQ 索引配置
const ivfPqOptions: IvfPqOptions = {
  numPartitions: 1024, // IVF 聚类数量 (nlist)
  numSubVectors: 8, // PQ 子向量维度 (m)
  numBits: 8, // 每个子向量的量化比特数 (nbits)
  distanceType: "cosine", // 相似度度量：cosine / l2 / dot
};

// 创建索引配置对象
const indexConfig = Index.ivfPq(ivfPqOptions);
```

**索引参数说明：**

| 参数            | 值     | 说明                                           |
| :-------------- | :----- | :--------------------------------------------- |
| `numPartitions` | 1024   | IVF 倒排索引的聚类中心数量，影响搜索速度和精度 |
| `numSubVectors` | 8      | PQ 量化的子向量数量，1536/8=192 维每子向量     |
| `numBits`       | 8      | 每个子向量的量化精度，8 bits = 256 种可能值    |
| `distanceType`  | cosine | 余弦相似度，适合文本语义匹配                   |

---

## API 操作示例

### 1. 初始化 LanceDB 连接

```typescript
import lancedb, { type Connection } from "@lancedb/lancedb";
import { join } from "path";
import fs from "fs";

// 获取向量存储路径（全局应用数据目录）
function getVectorDbPath(): string {
  const appDataPath = join(
    process.env.APPDATA || process.env.HOME || process.env.USERPROFILE || ".",
    "pentip",
    "vectors",
  );
  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
  }
  return appDataPath;
}

// 连接 LanceDB（异步）
async function connectLanceDB(): Promise<Connection> {
  const dbPath = getVectorDbPath();
  const db = await lancedb.connect(dbPath);
  return db;
}
```

### 2. 创建向量表

```typescript
import { type Table } from "@lancedb/lancedb";

// 定义类型接口
interface ChunkEmbedding {
  chunk_id: string;
  embedding: number[];
}

interface ConceptEmbedding {
  concept_id: string;
  embedding: number[];
}

// 创建向量表
async function createVectorTables(db: Connection): Promise<void> {
  // 语义块向量表 Schema，仅保留检索必要字段
  const chunkSchema = {
    chunk_id: "string",
    embedding: "fixed_size_list<float32>[1536]",
  };

  // 创建表（如果不存在）
  const tables = await db.tableNames();
  if (!tables.includes("chunk_embeddings")) {
    await db.createEmptyTable("chunk_embeddings", chunkSchema);
  }

  // 获取表引用
  const chunkTable: Table = await db.openTable("chunk_embeddings");

  // 概念向量表 Schema，仅保留检索必要字段
  const conceptSchema = {
    concept_id: "string",
    embedding: "fixed_size_list<float32>[1536]",
  };

  if (!tables.includes("concept_embeddings")) {
    await db.createEmptyTable("concept_embeddings", conceptSchema);
  }

  const conceptTable: Table = await db.openTable("concept_embeddings");
}
```

### 3. 插入向量数据

```typescript
// 生成嵌入向量（实际使用 jina-embeddings-v3 模型）
function generateEmbedding(text: string): number[] {
  // 调用嵌入模型生成向量
  // const embedding = await embeddingModel.encode(text);
  // return embedding;

  // 示例：生成随机向量
  return Array.from({ length: 1536 }, () => Math.random());
}

// 插入单条记录
async function insertChunkEmbedding(
  table: Table,
  data: ChunkEmbedding,
): Promise<void> {
  await table.add([data]);
}

// 使用示例
async function exampleInsert(db: Connection): Promise<void> {
  const chunkTable = await db.openTable("chunk_embeddings");

  const record: ChunkEmbedding = {
    chunk_id: "uuid-12345",
    embedding: generateEmbedding("这是一段测试内容"),
  };

  await insertChunkEmbedding(chunkTable, record);
}
```

### 4. 语义搜索

```typescript
// 语义搜索函数
async function semanticSearch(
  table: Table,
  query: string,
  topK: number = 10,
): Promise<ChunkEmbedding[]> {
  // 1. 将查询文本转换为向量
  const queryEmbedding = generateEmbedding(query);

  // 2. LanceDB 近似最近邻搜索
  const results = await table.search(queryEmbedding).limit(topK).toArray();

  return results as ChunkEmbedding[];
}

// 使用示例
async function exampleSearch(db: Connection): Promise<void> {
  const chunkTable = await db.openTable("chunk_embeddings");
  const results = await semanticSearch(chunkTable, "人工智能", 10);
  console.log("搜索结果:", results);
}
```

### 5. 更新向量数据

```typescript
// 更新向量数据
async function updateChunkEmbedding(
  table: Table,
  chunkId: string,
  newEmbedding: number[],
): Promise<void> {
  // 删除旧记录
  await table.delete(`chunk_id = '${chunkId}'`);

  // 插入新记录
  const newRecord: ChunkEmbedding = {
    chunk_id: chunkId,
    embedding: newEmbedding,
  };
  await table.add([newRecord]);
}

// 使用示例
async function exampleUpdate(db: Connection): Promise<void> {
  const chunkTable = await db.openTable("chunk_embeddings");
  await updateChunkEmbedding(
    chunkTable,
    "uuid-12345",
    generateEmbedding("更新后的内容"),
  );
}
```

### 6. 删除向量数据

```typescript
// 删除向量数据
async function deleteChunkEmbedding(
  table: Table,
  chunkId: string,
): Promise<void> {
  // 删除指定 chunk_id 的向量
  await table.delete(`chunk_id = '${chunkId}'`);
}

// 使用示例
async function exampleDelete(db: Connection): Promise<void> {
  const chunkTable = await db.openTable("chunk_embeddings");

  // 删除单条记录
  await deleteChunkEmbedding(chunkTable, "uuid-12345");
}
```

---

## 向量更新策略

### 实时更新模式

| 操作 | 触发条件       | 更新方式               |
| :--- | :------------- | :--------------------- |
| 新增 | 语义块创建成功 | 立即插入向量           |
| 更新 | 语义块内容修改 | 删除旧向量，插入新向量 |
| 删除 | 语义块删除     | 删除对应向量           |

### 批量更新模式

对于大规模数据导入，使用批量插入提高性能：

```typescript
// 批量插入示例
async function batchInsertChunkEmbeddings(
  table: Table,
  records: ChunkEmbedding[],
): Promise<void> {
  // 分批插入，每批 100 条
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await table.add(batch);
  }
}

// 使用示例
async function exampleBatchInsert(db: Connection): Promise<void> {
  const chunkTable = await db.openTable("chunk_embeddings");

  const records: ChunkEmbedding[] = Array.from({ length: 1000 }, (_, i) => ({
    chunk_id: `uuid-${i}`,
    embedding: generateEmbedding(`内容${i}`),
  }));

  await batchInsertChunkEmbeddings(chunkTable, records);
}
```

---

## 性能优化建议

### 1. 索引优化

- **数据量 < 10k**：使用默认 HNSW 索引
- **数据量 10k-100k**：使用 IVF-PQ 索引，numPartitions=1024
- **数据量 > 100k**：使用 IVF-PQ 索引，numPartitions=4096

### 2. 查询优化

```typescript
// 设置搜索参数平衡速度与精度
async function optimizedSearch(
  table: Table,
  queryEmbedding: number[],
  topK: number = 10,
): Promise<ChunkEmbedding[]> {
  const results = await table
    .search(queryEmbedding)
    .limit(topK)
    .nprobes(32) // 查询时访问的聚类数量，越大越准确但越慢
    .refineFactor(10) // 重排序候选数量
    .toArray();

  return results as ChunkEmbedding[];
}
```

### 3. 内存管理

```typescript
// 配置内存映射（减少内存占用）
async function openTableWithMemoryMap(
  db: Connection,
  tableName: string,
): Promise<Table> {
  const table = await db.openTable(tableName);
  // LanceDB Node.js SDK 会自动处理内存映射
  return table;
}
```

---

## 与 SQLite 的协同流程

### 混合搜索流程

搜索采用**向量搜索优先，FTS5 全文索引兜底**的两阶段策略：

```
用户查询
    │
    ├─ 1. 生成查询向量 → LanceDB 向量搜索
    │      │
    │      ├─ 结果数 ≥ topK → 返回 chunk_ids → SQLite 查询详情
    │      │
    │      └─ 结果数 < topK → 进入阶段 2
    │
    └─ 2. FTS5 全文搜索（关键词匹配）
           │
           └─ 补充不足的结果 → 合并去重 → SQLite 查询详情 → 返回
```

**策略说明：**

| 阶段             | 方法              | 适用场景                       | 特点                             |
| :--------------- | :---------------- | :----------------------------- | :------------------------------- |
| **1. 向量搜索**  | LanceDB ANN 搜索  | 语义匹配，同义/近义表达        | 理解意图，但冷门术语可能召回不足 |
| **2. FTS5 兜底** | SQLite 关键词匹配 | 精确关键词、代码片段、专有名词 | 补充向量搜索漏掉的精确匹配结果   |

> 当向量搜索结果数量达到用户请求的 topK 时，直接返回，不触发 FTS5 兜底，保证搜索性能。

### 数据写入流程

```
创建语义块 → SQLite 写入 → 生成向量 → LanceDB 插入
```

### 数据删除流程

```
删除语义块 → SQLite 删除 → LanceDB 删除对应向量
```

---

> 关于整体存储架构与数据流，详见 [`storage.md`](storage.md)。
