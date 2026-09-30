# SQLite 数据库设计文档 (v2)

## 数据库概述

本数据库用于管理 PenTip 的核心索引数据，采用"文件优先，数据库索引"架构。用户数据以 Markdown 文件为唯一数据源，SQLite 仅存储文件的元数据索引和 AI 分析结果。

### 存储架构

- 用户数据来源：Markdown 文件（workspace 下的 .md 文件）
- AI 索引存储：SQLite（better-sqlite3，WAL 模式）
- 全文搜索：SQLite FTS5（索引 AI 摘要和块内容）
- 向量存储：LanceDB（独立向量数据库，见 `lancedb.md`）

### 语义块解析规则

语义块（semantic_chunks）通过 AI 语义分析从 Markdown 文件中拆分，而非固定的规则切分。AI 根据内容语义边界（主题转换、概念边界、内容连贯性）自动拆分内容片段。

### 核心关系

```
file_index (文件索引) ---1:N---> semantic_chunks (语义块索引) ---N:N---> AI 索引表
```

- file_index 记录每个 .md 文件的元信息（路径、哈希、修改时间）
- semantic_chunks 记录文件中按语义切分出的块的位置信息（行范围、标题等）和 AI 摘要
- 所有 AI 索引表（概念、主题、反思等）通过 semantic_chunks.id 引用语义块，不再直接存储原始内容

---

## 表结构设计

### 1. 文件索引表 (file_index)

记录 workspace 下所有 .md 文件的元信息，是"文件优先"架构的基础。文件内容本身存储在文件系统中，数据库中仅记录文件的元数据和同步状态。

| 字段名        | 类型    | 约束              | 说明                                                    |
| :------------ | :------ | :---------------- | :------------------------------------------------------ |
| `id`          | TEXT    | PRIMARY KEY       | 文件索引唯一标识（UUID）                                |
| `file_path`   | TEXT    | NOT NULL UNIQUE   | 文件相对路径（相对于 workspace）                        |
| `file_hash`   | TEXT    | NOT NULL          | 文件内容的 SHA-256 哈希（用于检测变更）                 |
| `file_size`   | INTEGER | DEFAULT 0         | 文件大小（字节）                                        |
| `date`        | TEXT    |                   | 日志日期（journal 文件：从 `YYYY-MM-DD.md` 文件名解析） |
| `name`        | TEXT    |                   | 文件名（journal 文件：如 `2026-08-16.md`）              |
| `last_synced` | TEXT    |                   | 上次同步时间（ISO 8601）                                |
| `sync_status` | TEXT    | DEFAULT 'pending' | 同步状态：pending / synced / conflicted / deleted       |
| `created_at`  | TEXT    | NOT NULL          | 首次索引时间（ISO 8601）                                |
| `updated_at`  | TEXT    | NOT NULL          | 最后更新时间（ISO 8601，journal 文件存修改时间）        |

**索引设计：**

```sql
CREATE INDEX idx_file_index_path ON file_index(file_path);
CREATE INDEX idx_file_index_status ON file_index(sync_status);
```

---

### 2. 语义块表 (semantic_chunks)

语义块是通过 AI 语义分析从 Markdown 文件中拆分出的内容片段的索引记录。`content` 字段缓存块内容，避免频繁读文件；`content_hash` 用于检测文件内容变更，实现增量同步。

| 字段名                    | 类型    | 约束                               | 说明                                                       |
| :------------------------ | :------ | :--------------------------------- | :--------------------------------------------------------- |
| `id`                      | TEXT    | PRIMARY KEY                        | 语义块唯一标识（UUID）                                     |
| `file_id`                 | TEXT    | NOT NULL REFERENCES file_index(id) | 所属文件索引 ID                                            |
| `file_path`               | TEXT    | NOT NULL                           | 文件相对路径（冗余字段，便于查询）                         |
| `start_line`              | INTEGER | NOT NULL                           | 起始行号（从 1 开始）                                      |
| `end_line`                | INTEGER | NOT NULL                           | 结束行号（包含）                                           |
| `section_title`           | TEXT    |                                    | 章节标题（如时间标记 `## HH:MM` 或章节名）                 |
| `content`                 | TEXT    | NOT NULL                           | 块内容（缓存，来源为 .md 文件，避免频繁读文件）            |
| `content_hash`            | TEXT    |                                    | 内容 SHA256 哈希（用于检测文件内容变更）                   |
| `chunk_type`              | TEXT    | DEFAULT 'journal'                  | 语义块来源类型：'journal'（日志） / 'project'（项目）      |
| `is_deleted`              | INTEGER | DEFAULT 0                          | 软删除标记（0=正常，1=已删除）                             |
| `ai_summary`              | TEXT    |                                    | AI 自动生成的摘要                                          |
| `word_count`              | INTEGER | DEFAULT 0                          | 字数统计                                                   |
| `temporal_score`          | REAL    | DEFAULT 0.0                        | 时间热度分数                                               |
| `last_smart_processed_at` | TEXT    |                                    | 智能任务（摘要/向量化/语义链接等）最后处理时间（ISO 8601） |
| `status`                  | TEXT    | DEFAULT 'active'                   | 状态：active / deleted（软删除）                           |
| `created_at`              | TEXT    | NOT NULL                           | 创建时间（ISO 8601）                                       |
| `updated_at`              | TEXT    | NOT NULL                           | 最后更新时间（ISO 8601）                                   |

**索引设计：**

```sql
CREATE INDEX idx_semantic_chunks_file ON semantic_chunks(file_id);
CREATE INDEX idx_semantic_chunks_path ON semantic_chunks(file_path);
CREATE INDEX idx_semantic_chunks_hash ON semantic_chunks(content_hash);
CREATE INDEX idx_semantic_chunks_type ON semantic_chunks(chunk_type);
```

---

### 3. 语义块全文索引表 (semantic_chunks_fts)

FTS5 全文索引，索引 content 和 ai_summary 字段，支持快速全文搜索。`content` 为块缓存内容，`ai_summary` 为 AI 生成摘要。

```sql
CREATE VIRTUAL TABLE semantic_chunks_fts USING fts5(
    content,
    ai_summary,
    content='semantic_chunks',
    content_rowid='rowid'
);
```

> 注意：FTS 内容不再通过触发器实时同步。应用层在创建/更新语义块时，应通过 `INSERT INTO semantic_chunks_fts(rowid, content, ai_summary) VALUES (...)` 手动同步。

### 4. 概念全文索引表 (concepts_fts)

FTS5 全文索引，索引 title 和 evolving_summary 字段，支持按关键词搜索概念。

```sql
CREATE VIRTUAL TABLE concepts_fts USING fts5(
    title,
    evolving_summary,
    content='concepts',
    content_rowid='rowid'
);
```

### 5. 主题全文索引表 (topics_fts)

FTS5 全文索引，索引 title 和 summary 字段，支持按关键词搜索主题。

```sql
CREATE VIRTUAL TABLE topics_fts USING fts5(
    title,
    summary,
    content='topics',
    content_rowid='rowid'
);
```

### 6. 作品全文索引表 (projects_fts)

FTS5 全文索引，索引 name、description 和 ai_summary 字段，支持按关键词搜索作品。

```sql
CREATE VIRTUAL TABLE projects_fts USING fts5(
    name,
    description,
    ai_summary,
    content='projects',
    content_rowid='rowid'
);
```

### 7. 页面全文索引表 (pages_fts)

FTS5 全文索引，索引 title 和 ai_summary 字段，支持按关键词搜索页面。

```sql
CREATE VIRTUAL TABLE pages_fts USING fts5(
    title,
    ai_summary,
    content='pages',
    content_rowid='rowid'
);
```

---

### 8. 标签表 (tags)

用于存储标签定义，支持为语义块、Project、File 等实体添加标签。

| 字段名        | 类型 | 约束            | 说明                     |
| :------------ | :--- | :-------------- | :----------------------- |
| `id`          | TEXT | PRIMARY KEY     | 标签唯一标识（UUID）     |
| `name`        | TEXT | NOT NULL UNIQUE | 标签名称（唯一）         |
| `description` | TEXT | DEFAULT ''      | 标签描述                 |
| `created_at`  | TEXT | NOT NULL        | 创建时间（ISO 8601）     |
| `updated_at`  | TEXT | NOT NULL        | 最后更新时间（ISO 8601） |

**索引设计：**

```sql
CREATE INDEX idx_tags_name ON tags(name);
```

---

### 9. 标签关联表 (tagged_items)

实现标签与各类实体的多对多关联关系，支持 semantic_chunks、Project、File 等实体。

| 字段名        | 类型 | 约束                         | 说明                                       |
| :------------ | :--- | :--------------------------- | :----------------------------------------- |
| `tag_id`      | TEXT | NOT NULL REFERENCES tags(id) | 标签 ID                                    |
| `entity_type` | TEXT | NOT NULL                     | 实体类型：semantic_chunks / project / file |
| `entity_id`   | TEXT | NOT NULL                     | 实体 ID                                    |
| `added_at`    | TEXT | NOT NULL                     | 添加时间（ISO 8601）                       |

**约束：**

- `PRIMARY KEY(tag_id, entity_type, entity_id)`

**索引设计：**

```sql
CREATE INDEX idx_tagged_items_tag ON tagged_items(tag_id);
CREATE INDEX idx_tagged_items_entity ON tagged_items(entity_type, entity_id);
```

---

### 10. 语义链接表 (semantic_links)

记录语义块之间的语义关联关系。

| 字段名            | 类型 | 约束                                    | 说明                                           |
| :---------------- | :--- | :-------------------------------------- | :--------------------------------------------- |
| `id`              | TEXT | PRIMARY KEY                             | 链接唯一标识（UUID）                           |
| `source_chunk_id` | TEXT | NOT NULL REFERENCES semantic_chunks(id) | 源语义块 ID                                    |
| `target_chunk_id` | TEXT | NOT NULL REFERENCES semantic_chunks(id) | 目标语义块 ID                                  |
| `link_type`       | TEXT | DEFAULT 'semantic'                      | 链接类型：semantic / reference / contradiction |
| `similarity`      | REAL | DEFAULT 0.0                             | 相似度分数（0-1）                              |
| `ai_explanation`  | TEXT |                                         | AI 解释为何关联                                |
| `created_at`      | TEXT | NOT NULL                                | 创建时间（ISO 8601）                           |
| `updated_at`      | TEXT | NOT NULL                                | 最后更新时间（ISO 8601）                       |

**约束：**

- `UNIQUE(source_chunk_id, target_chunk_id)`

**索引设计：**

```sql
CREATE INDEX idx_semantic_links_source ON semantic_links(source_chunk_id);
CREATE INDEX idx_semantic_links_target ON semantic_links(target_chunk_id);
CREATE INDEX idx_semantic_links_type ON semantic_links(link_type);
```

---

### 11. 概念表 (concepts)

存储从语义块中提取的概念实体。

| 字段名             | 类型 | 约束         | 说明                   |
| :----------------- | :--- | :----------- | :--------------------- |
| `id`               | TEXT | PRIMARY KEY  | 概念唯一标识（UUID）   |
| `title`            | TEXT | NOT NULL     | 概念标题               |
| `evolving_summary` | TEXT |              | 演化摘要（随时间更新） |
| `timeline`         | TEXT | DEFAULT '[]' | 时间线（JSON 数组）    |
| `relevance`        | REAL | DEFAULT 0.0  | 相关性分数             |
| `created_at`       | TEXT | NOT NULL     | 创建时间               |
| `updated_at`       | TEXT | NOT NULL     | 最后更新时间           |

**索引设计：**

```sql
CREATE INDEX idx_concepts_relevance ON concepts(relevance);
CREATE INDEX idx_concepts_title ON concepts(title);
```

---

### 12. 概念-语义块关联表 (concept_chunks)

实现 Concept 与 semantic_chunks 的多对多关联关系。

| 字段名            | 类型 | 约束                                    | 说明                                 |
| :---------------- | :--- | :-------------------------------------- | :----------------------------------- |
| `concept_id`      | TEXT | NOT NULL REFERENCES concepts(id)        | 概念 ID                              |
| `chunk_id`        | TEXT | NOT NULL REFERENCES semantic_chunks(id) | 语义块 ID                            |
| `relevance_score` | REAL | DEFAULT 0.0                             | AI 评估该语义块对概念的关联度（0-1） |
| `created_at`      | TEXT | NOT NULL                                | 创建时间（ISO 8601）                 |
| `updated_at`      | TEXT | NOT NULL                                | 最后更新时间（ISO 8601）             |

**约束：**

- `PRIMARY KEY(concept_id, chunk_id)`

**索引设计：**

```sql
CREATE INDEX idx_concept_chunks_concept ON concept_chunks(concept_id);
CREATE INDEX idx_concept_chunks_chunk ON concept_chunks(chunk_id);
```

---

### 13. 主题表 (topics)

存储 AI 自动结晶生成的主题。

| 字段名       | 类型 | 约束             | 说明                                             |
| :----------- | :--- | :--------------- | :----------------------------------------------- |
| `id`         | TEXT | PRIMARY KEY      | 主题唯一标识（UUID）                             |
| `title`      | TEXT | NOT NULL         | 主题标题                                         |
| `summary`    | TEXT |                  | AI 生成的主题摘要                                |
| `status`     | TEXT | DEFAULT 'active' | 状态枚举：`active`(正常主题) / `deleted`(软删除) |
| `created_at` | TEXT | NOT NULL         | 创建时间                                         |
| `updated_at` | TEXT | NOT NULL         | 最后更新时间                                     |

**索引设计：**

```sql
CREATE INDEX idx_topics_status ON topics(status);
CREATE INDEX idx_topics_title ON topics(title);
```

---

### 14. 主题-语义块关联表 (topic_chunks)

实现 Topic 与 semantic_chunks 的多对多关联关系。

| 字段名            | 类型 | 约束                                    | 说明                                 |
| :---------------- | :--- | :-------------------------------------- | :----------------------------------- |
| `topic_id`        | TEXT | NOT NULL REFERENCES topics(id)          | 主题 ID                              |
| `chunk_id`        | TEXT | NOT NULL REFERENCES semantic_chunks(id) | 语义块 ID                            |
| `relevance_score` | REAL | DEFAULT 0.0                             | AI 评估该语义块对主题的关联度（0-1） |
| `created_at`      | TEXT | NOT NULL                                | 创建时间（ISO 8601）                 |
| `updated_at`      | TEXT | NOT NULL                                | 最后更新时间（ISO 8601）             |

**约束：**

- `PRIMARY KEY(topic_id, chunk_id)`

**索引设计：**

```sql
CREATE INDEX idx_topic_chunks_topic ON topic_chunks(topic_id);
CREATE INDEX idx_topic_chunks_chunk ON topic_chunks(chunk_id);
```

---

### 15. 主题-概念关联表 (topic_concepts)

实现 Topic 与 Concept 的多对多关联关系。

| 字段名            | 类型 | 约束                             | 说明                                    |
| :---------------- | :--- | :------------------------------- | :-------------------------------------- |
| `topic_id`        | TEXT | NOT NULL REFERENCES topics(id)   | 主题 ID                                 |
| `concept_id`      | TEXT | NOT NULL REFERENCES concepts(id) | 概念 ID                                 |
| `relevance_score` | REAL | DEFAULT 0.0                      | AI 评估该 Concept 对主题的关联度（0-1） |
| `created_at`      | TEXT | NOT NULL                         | 创建时间（ISO 8601）                    |
| `updated_at`      | TEXT | NOT NULL                         | 最后更新时间（ISO 8601）                |

**约束：**

- `PRIMARY KEY(topic_id, concept_id)`

**索引设计：**

```sql
CREATE INDEX idx_topic_concepts_topic ON topic_concepts(topic_id);
CREATE INDEX idx_topic_concepts_concept ON topic_concepts(concept_id);
```

---

### 16. 时间事件表 (temporal_events)

记录知识随时间演化的事件。

| 字段名           | 类型 | 约束                                    | 说明                                                       |
| :--------------- | :--- | :-------------------------------------- | :--------------------------------------------------------- |
| `id`             | TEXT | PRIMARY KEY                             | 事件唯一标识（UUID）                                       |
| `chunk_id`       | TEXT | NOT NULL REFERENCES semantic_chunks(id) | 关联的语义块 ID                                            |
| `event_type`     | TEXT | NOT NULL                                | 事件类型：belief_change / interest_spike / topic_emergence |
| `event_data`     | TEXT | DEFAULT '{}'                            | 事件数据（JSON）                                           |
| `temporal_score` | REAL | DEFAULT 0.0                             | 时间分数                                                   |
| `created_at`     | TEXT | NOT NULL                                | 创建时间（ISO 8601）                                       |
| `updated_at`     | TEXT | NOT NULL                                | 最后更新时间（ISO 8601）                                   |

**索引设计：**

```sql
CREATE INDEX idx_temporal_events_chunk_id ON temporal_events(chunk_id);
CREATE INDEX idx_temporal_events_type ON temporal_events(event_type);
```

---

### 17. 反思表 (reflections)

存储 AI 检测到的反思洞察。

| 字段名           | 类型 | 约束              | 说明                                                             |
| :--------------- | :--- | :---------------- | :--------------------------------------------------------------- |
| `id`             | TEXT | PRIMARY KEY       | 反思唯一标识（UUID）                                             |
| `type`           | TEXT | NOT NULL          | 反思类型：pattern / contradiction / evolution / insight          |
| `title`          | TEXT | NOT NULL          | 反思标题                                                         |
| `content`        | TEXT | NOT NULL          | 反思内容                                                         |
| `ai_explanation` | TEXT |                   | AI 解释                                                          |
| `status`         | TEXT | DEFAULT 'pending' | 状态枚举：`pending`(待阅读) / `read`(已阅读) / `deleted`(已删除) |
| `created_at`     | TEXT | NOT NULL          | 创建时间（ISO 8601）                                             |
| `updated_at`     | TEXT | NOT NULL          | 最后更新时间（ISO 8601）                                         |

**索引设计：**

```sql
CREATE INDEX idx_reflections_type ON reflections(type);
CREATE INDEX idx_reflections_status ON reflections(status);
```

---

### 18. 反思-语义块关联表 (reflection_chunks)

实现 Reflection 与 semantic_chunks 的多对多关联关系。

| 字段名            | 类型 | 约束                                    | 说明                                 |
| :---------------- | :--- | :-------------------------------------- | :----------------------------------- |
| `reflection_id`   | TEXT | NOT NULL REFERENCES reflections(id)     | 反思 ID                              |
| `chunk_id`        | TEXT | NOT NULL REFERENCES semantic_chunks(id) | 语义块 ID                            |
| `relevance_score` | REAL | DEFAULT 0.0                             | AI 评估该语义块对反思的关联度（0-1） |
| `created_at`      | TEXT | NOT NULL                                | 创建时间（ISO 8601）                 |
| `updated_at`      | TEXT | NOT NULL                                | 最后更新时间（ISO 8601）             |

**约束：**

- `PRIMARY KEY(reflection_id, chunk_id)`

**索引设计：**

```sql
CREATE INDEX idx_reflection_chunks_reflection ON reflection_chunks(reflection_id);
CREATE INDEX idx_reflection_chunks_chunk ON reflection_chunks(chunk_id);
```

---

### 19. 作品表 (projects)

用于管理作品（Project），Project 是 `projects/` 目录下的独立 `.md` 文件集合，AI 将其内容索引为语义块供检索和引用。

| 字段名        | 类型 | 约束             | 说明                                             |
| :------------ | :--- | :--------------- | :----------------------------------------------- |
| `id`          | TEXT | PRIMARY KEY      | 作品唯一标识（UUID）                             |
| `name`        | TEXT | NOT NULL         | 作品名称                                         |
| `file_path`   | TEXT | NOT NULL         | 作品文件夹相对路径（projects/{name}/）           |
| `description` | TEXT |                  | 作品描述                                         |
| `type`        | TEXT |                  | 作品类型：article / report / research / creative |
| `status`      | TEXT | DEFAULT 'active' | 状态枚举：`active`(正常) / `deleted`(软删除)     |
| `created_at`  | TEXT | NOT NULL         | 创建时间（ISO 8601）                             |
| `updated_at`  | TEXT | NOT NULL         | 最后更新时间（ISO 8601）                         |
| `ai_summary`  | TEXT |                  | AI 对当前作品进度的简要概括                      |
| `metadata`    | TEXT |                  | 作品元数据（JSON 格式）                          |
| `structure`   | TEXT |                  | AI 自动生成的结构（章节目录等，JSON）            |

**约束：**

- `CHECK (status IN ('active', 'deleted'))`

**索引设计：**

```sql
CREATE INDEX idx_projects_name ON projects(name);
CREATE INDEX idx_projects_type ON projects(type);
```

---

### 20. 作品-语义块关联表 (project_chunks)

实现 Project 与 semantic_chunks 的多对多关联关系。

| 字段名            | 类型 | 约束                                    | 说明                                 |
| :---------------- | :--- | :-------------------------------------- | :----------------------------------- |
| `project_id`      | TEXT | NOT NULL REFERENCES projects(id)        | 作品 ID                              |
| `chunk_id`        | TEXT | NOT NULL REFERENCES semantic_chunks(id) | 语义块 ID                            |
| `relevance_score` | REAL | DEFAULT 0.0                             | AI 评估该语义块对作品的关联度（0-1） |
| `created_at`      | TEXT | NOT NULL                                | 创建时间（ISO 8601）                 |
| `updated_at`      | TEXT | NOT NULL                                | 最后更新时间（ISO 8601）             |

**约束：**

- `PRIMARY KEY(project_id, chunk_id)`

**索引设计：**

```sql
CREATE INDEX idx_project_chunks_project ON project_chunks(project_id);
CREATE INDEX idx_project_chunks_chunk ON project_chunks(chunk_id);
```

**数据逻辑：**

- 语义块是唯一的数据源，不产生副本
- 作品（Project）是 `projects/` 目录下的独立 `.md` 文件集合，AI 将其内容索引为语义块供检索和引用

---

### 21. 页面表 (pages)

用于存储作品的页面/章节结构，页面内容存储在 `projects/{name}/*.md` 文件中。

| 字段名           | 类型    | 约束                    | 说明                                         |
| :--------------- | :------ | :---------------------- | :------------------------------------------- |
| `id`             | TEXT    | PRIMARY KEY             | 页面唯一标识（UUID）                         |
| `project_id`     | TEXT    | REFERENCES projects(id) | 关联作品ID                                   |
| `title`          | TEXT    | NOT NULL                | 页面标题                                     |
| `file_path`      | TEXT    | NOT NULL                | 对应的 .md 文件相对路径                      |
| `order_index`    | INTEGER | DEFAULT 0               | 页面顺序（章节目录排序）                     |
| `parent_page_id` | TEXT    | REFERENCES pages(id)    | 父页面 ID（用于嵌套章节）                    |
| `word_count`     | INTEGER | DEFAULT 0               | 字数统计                                     |
| `ai_summary`     | TEXT    |                         | AI 自动生成的摘要                            |
| `metadata`       | TEXT    | DEFAULT '{}'            | 扩展元数据（JSON）                           |
| `status`         | TEXT    | DEFAULT 'active'        | 状态枚举：`active`(活跃) / `deleted`(已删除) |
| `created_at`     | TEXT    | NOT NULL                | 创建时间（ISO 8601）                         |
| `updated_at`     | TEXT    | NOT NULL                | 最后修改时间（ISO 8601）                     |

**约束：**

- `CHECK (status IN ('active', 'deleted'))`

**索引设计：**

```sql
CREATE INDEX idx_pages_project ON pages(project_id);
CREATE INDEX idx_pages_order ON pages(project_id, order_index);
CREATE INDEX idx_pages_parent ON pages(parent_page_id);
CREATE INDEX idx_pages_summary ON pages(ai_summary);
```

---

### 22. 数据库版本表 (migrations_db)

用于数据库迁移校验和版本管理。

| 字段名           | 类型    | 约束              | 说明                                                                  |
| :--------------- | :------ | :---------------- | :-------------------------------------------------------------------- |
| `id`             | TEXT    | PRIMARY KEY       | 迁移记录唯一标识（UUID）                                              |
| `version`        | TEXT    | NOT NULL UNIQUE   | 版本号                                                                |
| `name`           | TEXT    | NOT NULL          | 迁移脚本名称                                                          |
| `description`    | TEXT    | DEFAULT ''        | 迁移内容详细描述                                                      |
| `sql_statement`  | TEXT    | NOT NULL          | 执行的 SQL 语句                                                       |
| `status`         | TEXT    | DEFAULT 'pending' | 状态枚举：`pending`(待执行) / `executed`(已执行) / `failed`(执行失败) |
| `executed_at`    | TEXT    | DEFAULT ''        | 执行时间（ISO 8601）                                                  |
| `execution_time` | INTEGER |                   | 执行耗时（毫秒）                                                      |
| `checksum`       | TEXT    | DEFAULT ''        | SQL 语句校验和                                                        |
| `error_message`  | TEXT    | DEFAULT ''        | 失败时的错误信息                                                      |
| `created_at`     | TEXT    | NOT NULL          | 创建时间（ISO 8601）                                                  |
| `updated_at`     | TEXT    | NOT NULL          | 最后更新时间（ISO 8601）                                              |

---

### 23. 通用任务队列表 (tasks)

用于持久化异步任务队列（如 AI 智能任务、模型下载等），支持重试、分组与依赖关系。

| 字段名          | 类型    | 约束                       | 说明                                                     |
| :-------------- | :------ | :------------------------- | :------------------------------------------------------- |
| `id`            | TEXT    | PRIMARY KEY                | 任务唯一标识（UUID）                                     |
| `type`          | TEXT    | NOT NULL                   | 任务类型（如 model:download-file、chunk-summary 等）     |
| `status`        | TEXT    | NOT NULL DEFAULT 'pending' | 状态：pending / running / succeeded / failed / cancelled |
| `payload`       | TEXT    | NOT NULL DEFAULT '{}'      | 任务负载数据（JSON）                                     |
| `priority`      | INTEGER | DEFAULT 0                  | 优先级（数值越大越优先）                                 |
| `created_at`    | TEXT    | NOT NULL                   | 创建时间（ISO 8601）                                     |
| `updated_at`    | TEXT    | NOT NULL                   | 最后更新时间（ISO 8601）                                 |
| `started_at`    | TEXT    |                            | 开始执行时间（ISO 8601）                                 |
| `finished_at`   | TEXT    |                            | 完成时间（ISO 8601）                                     |
| `retry_count`   | INTEGER | DEFAULT 0                  | 已重试次数                                               |
| `max_retries`   | INTEGER | DEFAULT 3                  | 最大重试次数                                             |
| `error_message` | TEXT    |                            | 失败时的错误信息                                         |
| `result`        | TEXT    |                            | 任务结果（JSON）                                         |
| `group_id`      | TEXT    |                            | 任务分组 ID                                              |
| `depends_on`    | TEXT    |                            | 依赖的任务 ID                                            |

**约束：**

- `CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled'))`

**索引设计：**

```sql
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_group_id ON tasks(group_id);
CREATE INDEX idx_tasks_depends_on ON tasks(depends_on);
```

---

### 24. Skill 执行历史表 (skill_executions)

用于记录 Skill 技能的执行历史，包括调用模型、token 消耗、耗时等。

| 字段名              | 类型    | 约束                               | 说明                     |
| :------------------ | :------ | :--------------------------------- | :----------------------- |
| `id`                | TEXT    | PRIMARY KEY                        | 执行记录唯一标识（UUID） |
| `skill_id`          | TEXT    | NOT NULL                           | Skill 标识               |
| `input`             | TEXT    |                                    | 输入内容（JSON）         |
| `output`            | TEXT    |                                    | 输出内容（JSON）         |
| `level`             | TEXT    | NOT NULL DEFAULT 'L1'              | 执行级别（L1/L2/L3）     |
| `model_used`        | TEXT    |                                    | 使用的模型               |
| `tokens_used`       | INTEGER | DEFAULT 0                          | 消耗 token 数            |
| `execution_time_ms` | INTEGER | DEFAULT 0                          | 执行耗时（毫秒）         |
| `steps`             | INTEGER | DEFAULT 1                          | 执行步数                 |
| `status`            | TEXT    | NOT NULL DEFAULT 'succeeded'       | 执行状态                 |
| `error_message`     | TEXT    |                                    | 失败时的错误信息         |
| `created_at`        | TEXT    | NOT NULL DEFAULT (datetime('now')) | 创建时间                 |

**索引设计：**

```sql
CREATE INDEX idx_skill_executions_skill_id ON skill_executions(skill_id);
CREATE INDEX idx_skill_executions_created_at ON skill_executions(created_at);
```

---

## 同步机制

### 文件变更检测与同步

file_index 是连接文件系统与数据库索引的桥梁，其同步机制如下：

- **变更检测**：扫描 workspace 下所有 .md 文件，对比 file_index 中的 file_hash 与 updated_at（记录文件修改时间），判断文件是否新增、修改或删除
- **状态标记**：根据变更类型更新 sync_status 字段
  - `pending`：新文件待处理
  - `synced`：已同步完成
  - `conflicted`：文件内容与索引不一致（以文件系统为准）
  - `deleted`：文件已被删除
- **增量同步**：只处理 sync_status 为 pending 或 conflicted 的文件，避免全量扫描
- **冲突处理**：当文件内容与数据库索引不一致时，以文件系统为准，重新解析文件并重建相关索引记录

### 同步流程

```
文件变更（新增/修改/删除）
        |
        v
更新 file_index（对比 hash 和修改时间）
        |
        v
标记 sync_status = 'pending'
        |
        v
增量同步：AI 语义拆分文件内容
        |
        v
更新 semantic_chunks（行范围、摘要、预览）
        |
        v
更新相关 AI 索引表（概念、主题、反思等）
        |
        v
标记 sync_status = 'synced'
```

---

## ER 关系图

```
file_index                  semantic_chunks              concepts
+-------------+            +----------------+           +---------+
| id (PK)     |<---+       | id (PK)        |           | id (PK) |
+-------------+    |       +----------------+           +---------+
| file_path   |    +-------| file_id (FK)   |           | title   |
| file_hash   |            | start_line     |           +---------+
| sync_status |            | end_line       |           | ...     |
+-------------+            | section_title  |           +---------+
                           | ai_summary     |                |
                           +----------------+                |
                                |    ^                      |
                                |    |                      |
                                |    +----------------------+
                                |           (concept_chunks)
                                |
                       semantic_links
                       +----------------+     topics
                       | id (PK)        |     +---------+
                       +----------------+     | id (PK) |
                       | source_chunk_id |---->+---------+
                       | target_chunk_id |     | title   |
                       +----------------+     +---------+
                                                   ^
                                                   |
                                              topic_chunks
                                              +---------------+
                                              | topic_id (PK) |
                                              | chunk_id (PK) |
                                              +---------------+
                                                   ^
                                                   |
                                              topic_concepts
                                              +---------------+
                                              | topic_id (PK) |
                                              | concept_id(PK)|
                                              +---------------+

temporal_events             reflections             reflection_chunks
+----------------+         +---------+             +-------------------+
| id (PK)        |         | id (PK) |             | reflection_id (PK)|
| chunk_id (FK)  |         +---------+             | chunk_id (PK)     |
| event_type     |         | type    |             +-------------------+
+----------------+         +---------+
                                ^
                                |
                          reflection_chunks (见上)

projects                    project_chunks
+---------+                 +----------------+
| id (PK) |<----------------| project_id (PK)|
+---------+                 | chunk_id (PK)  |
| name    |                 | relevance_score|
+---------+                 +----------------+
      ^                              ^
      |                              |
      +------------------------------+
      (多对多: 一个作品关联多个语义块,
       一个语义块可贡献给多个作品)
```

---

## 建表 SQL 语句

```sql
-- 禁用外键检查（避免循环依赖问题）
PRAGMA foreign_keys = OFF;

-- ==================== 核心表 ====================

-- 创建文件索引表
CREATE TABLE IF NOT EXISTS file_index (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL UNIQUE,
    file_hash TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    date TEXT,
    name TEXT,
    last_synced TEXT,
    sync_status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 创建语义块表
CREATE TABLE IF NOT EXISTS semantic_chunks (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL REFERENCES file_index(id),
    file_path TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    section_title TEXT,
    content TEXT NOT NULL,             -- 块内容缓存
    content_hash TEXT,                 -- 内容 SHA256 哈希
    chunk_type TEXT DEFAULT 'journal',   -- 'journal' / 'project'
    is_deleted INTEGER DEFAULT 0,      -- 软删除标记（0/1）
    ai_summary TEXT,
    word_count INTEGER DEFAULT 0,
    temporal_score REAL DEFAULT 0.0,
    last_smart_processed_at TEXT,      -- 智能任务最后处理时间
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 创建语义块 FTS5 全文索引
CREATE VIRTUAL TABLE IF NOT EXISTS semantic_chunks_fts USING fts5(
    content,
    ai_summary,
    content='semantic_chunks',
    content_rowid='rowid'
);

-- 创建概念 FTS5 全文索引
CREATE VIRTUAL TABLE IF NOT EXISTS concepts_fts USING fts5(
    title,
    evolving_summary,
    content='concepts',
    content_rowid='rowid'
);

-- 创建主题 FTS5 全文索引
CREATE VIRTUAL TABLE IF NOT EXISTS topics_fts USING fts5(
    title,
    summary,
    content='topics',
    content_rowid='rowid'
);

-- 创建作品 FTS5 全文索引
CREATE VIRTUAL TABLE IF NOT EXISTS projects_fts USING fts5(
    name,
    description,
    ai_summary,
    content='projects',
    content_rowid='rowid'
);

-- 创建页面 FTS5 全文索引
CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
    title,
    ai_summary,
    content='pages',
    content_rowid='rowid'
);

-- 创建标签表
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 创建标签关联表
CREATE TABLE IF NOT EXISTS tagged_items (
    tag_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    added_at TEXT NOT NULL,
    PRIMARY KEY (tag_id, entity_type, entity_id),
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- 创建语义链接表
CREATE TABLE IF NOT EXISTS semantic_links (
    id TEXT PRIMARY KEY,
    source_chunk_id TEXT NOT NULL REFERENCES semantic_chunks(id),
    target_chunk_id TEXT NOT NULL REFERENCES semantic_chunks(id),
    link_type TEXT DEFAULT 'semantic',
    similarity REAL DEFAULT 0.0,
    ai_explanation TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(source_chunk_id, target_chunk_id)
);

-- 创建概念表
CREATE TABLE IF NOT EXISTS concepts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    evolving_summary TEXT,
    timeline TEXT DEFAULT '[]',
    relevance REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 创建概念-语义块关联表
CREATE TABLE IF NOT EXISTS concept_chunks (
    concept_id TEXT NOT NULL,
    chunk_id TEXT NOT NULL,
    relevance_score REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (concept_id, chunk_id),
    FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE CASCADE,
    FOREIGN KEY (chunk_id) REFERENCES semantic_chunks(id) ON DELETE CASCADE
);

-- 创建主题表
CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (status IN ('active', 'deleted'))
);

-- 创建主题-语义块关联表
CREATE TABLE IF NOT EXISTS topic_chunks (
    topic_id TEXT NOT NULL,
    chunk_id TEXT NOT NULL,
    relevance_score REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (topic_id, chunk_id),
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    FOREIGN KEY (chunk_id) REFERENCES semantic_chunks(id) ON DELETE CASCADE
);

-- 创建主题-概念关联表
CREATE TABLE IF NOT EXISTS topic_concepts (
    topic_id TEXT NOT NULL,
    concept_id TEXT NOT NULL,
    relevance_score REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (topic_id, concept_id),
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE CASCADE
);

-- 创建时间事件表
CREATE TABLE IF NOT EXISTS temporal_events (
    id TEXT PRIMARY KEY,
    chunk_id TEXT NOT NULL REFERENCES semantic_chunks(id),
    event_type TEXT NOT NULL,
    event_data TEXT DEFAULT '{}',
    temporal_score REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 创建反思表
CREATE TABLE IF NOT EXISTS reflections (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    ai_explanation TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (status IN ('pending', 'read', 'deleted'))
);

-- 创建反思-语义块关联表
CREATE TABLE IF NOT EXISTS reflection_chunks (
    reflection_id TEXT NOT NULL,
    chunk_id TEXT NOT NULL,
    relevance_score REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (reflection_id, chunk_id),
    FOREIGN KEY (reflection_id) REFERENCES reflections(id) ON DELETE CASCADE,
    FOREIGN KEY (chunk_id) REFERENCES semantic_chunks(id) ON DELETE CASCADE
);

-- ==================== 业务表 ====================

-- 创建作品表
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    ai_summary TEXT DEFAULT '',
    structure TEXT DEFAULT '',
    metadata TEXT DEFAULT '{}',
    CHECK (status IN ('active', 'deleted'))
);

-- 创建作品-语义块关联表
CREATE TABLE IF NOT EXISTS project_chunks (
    project_id TEXT NOT NULL,
    chunk_id TEXT NOT NULL,
    relevance_score REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (project_id, chunk_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (chunk_id) REFERENCES semantic_chunks(id) ON DELETE CASCADE
);

-- 创建页面表
CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    parent_page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
    word_count INTEGER DEFAULT 0,
    ai_summary TEXT,
    metadata TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (status IN ('active', 'deleted'))
);

-- 创建数据库版本表
CREATE TABLE IF NOT EXISTS migrations_db (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    sql_statement TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    executed_at TEXT DEFAULT '',
    execution_time INTEGER,
    checksum TEXT DEFAULT '',
    error_message TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (status IN ('pending', 'executed', 'failed'))
);

-- 创建通用任务队列表
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payload TEXT NOT NULL DEFAULT '{}',
    priority INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    result TEXT,
    group_id TEXT,
    depends_on TEXT,
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled'))
);

-- 创建 Skill 执行历史表
CREATE TABLE IF NOT EXISTS skill_executions (
    id TEXT PRIMARY KEY,
    skill_id TEXT NOT NULL,
    input TEXT,
    output TEXT,
    level TEXT NOT NULL DEFAULT 'L1',
    model_used TEXT,
    tokens_used INTEGER DEFAULT 0,
    execution_time_ms INTEGER DEFAULT 0,
    steps INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'succeeded',
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- ==================== 创建索引 ====================

-- 文件索引表索引
CREATE INDEX IF NOT EXISTS idx_file_index_path ON file_index(file_path);
CREATE INDEX IF NOT EXISTS idx_file_index_status ON file_index(sync_status);

-- 语义块索引
CREATE INDEX IF NOT EXISTS idx_semantic_chunks_file ON semantic_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_semantic_chunks_path ON semantic_chunks(file_path);
CREATE INDEX IF NOT EXISTS idx_semantic_chunks_hash ON semantic_chunks(content_hash);
CREATE INDEX IF NOT EXISTS idx_semantic_chunks_type ON semantic_chunks(chunk_type);

-- 标签索引
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- 标签关联索引
CREATE INDEX IF NOT EXISTS idx_tagged_items_tag ON tagged_items(tag_id);
CREATE INDEX IF NOT EXISTS idx_tagged_items_entity ON tagged_items(entity_type, entity_id);

-- 语义链接索引
CREATE INDEX IF NOT EXISTS idx_semantic_links_source ON semantic_links(source_chunk_id);
CREATE INDEX IF NOT EXISTS idx_semantic_links_target ON semantic_links(target_chunk_id);
CREATE INDEX IF NOT EXISTS idx_semantic_links_type ON semantic_links(link_type);

-- 概念索引
CREATE INDEX IF NOT EXISTS idx_concepts_relevance ON concepts(relevance);
CREATE INDEX IF NOT EXISTS idx_concepts_title ON concepts(title);

-- 概念-语义块关联表索引
CREATE INDEX IF NOT EXISTS idx_concept_chunks_concept ON concept_chunks(concept_id);
CREATE INDEX IF NOT EXISTS idx_concept_chunks_chunk ON concept_chunks(chunk_id);

-- 主题索引
CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status);
CREATE INDEX IF NOT EXISTS idx_topics_title ON topics(title);

-- 主题-语义块关联表索引
CREATE INDEX IF NOT EXISTS idx_topic_chunks_topic ON topic_chunks(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_chunks_chunk ON topic_chunks(chunk_id);

-- 主题-概念关联表索引
CREATE INDEX IF NOT EXISTS idx_topic_concepts_topic ON topic_concepts(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_concepts_concept ON topic_concepts(concept_id);

-- 时间事件索引
CREATE INDEX IF NOT EXISTS idx_temporal_events_chunk_id ON temporal_events(chunk_id);
CREATE INDEX IF NOT EXISTS idx_temporal_events_type ON temporal_events(event_type);

-- 反思索引
CREATE INDEX IF NOT EXISTS idx_reflections_type ON reflections(type);
CREATE INDEX IF NOT EXISTS idx_reflections_status ON reflections(status);

-- 反思-语义块关联表索引
CREATE INDEX IF NOT EXISTS idx_reflection_chunks_reflection ON reflection_chunks(reflection_id);
CREATE INDEX IF NOT EXISTS idx_reflection_chunks_chunk ON reflection_chunks(chunk_id);

-- 作品表索引
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);

-- 作品-语义块关联表索引
CREATE INDEX IF NOT EXISTS idx_project_chunks_project ON project_chunks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_chunks_chunk ON project_chunks(chunk_id);

-- 页面表索引
CREATE INDEX IF NOT EXISTS idx_pages_project ON pages(project_id);
CREATE INDEX IF NOT EXISTS idx_pages_order ON pages(project_id, order_index);
CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_page_id);
CREATE INDEX IF NOT EXISTS idx_pages_summary ON pages(ai_summary);

-- 迁移表索引
CREATE INDEX IF NOT EXISTS idx_migrations_db_version ON migrations_db(version);
CREATE INDEX IF NOT EXISTS idx_migrations_db_status ON migrations_db(status);

-- 任务队列索引
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_group_id ON tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_tasks_depends_on ON tasks(depends_on);

-- Skill 执行历史索引
CREATE INDEX IF NOT EXISTS idx_skill_executions_skill_id ON skill_executions(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_executions_created_at ON skill_executions(created_at);
```

> 注意：FTS 同步不再使用触发器。应用层在创建或更新对应实体后，应通过以下方式手动同步 FTS 索引：
>
> - `semantic_chunks_fts`：`INSERT INTO semantic_chunks_fts(rowid, content, ai_summary) VALUES (...)`
> - `concepts_fts`：`INSERT INTO concepts_fts(rowid, title, evolving_summary) VALUES (...)`
> - `topics_fts`：`INSERT INTO topics_fts(rowid, title, summary) VALUES (...)`
> - `projects_fts`：`INSERT INTO projects_fts(rowid, name, description, ai_summary) VALUES (...)`
> - `pages_fts`：`INSERT INTO pages_fts(rowid, title, ai_summary) VALUES (...)`

---

## 状态字段说明

### file_index.sync_status

| 值         | 含义               |
| :--------- | :----------------- |
| pending    | 待处理             |
| synced     | 已同步             |
| conflicted | 冲突（以文件为准） |
| deleted    | 文件已删除         |

### semantic_chunks.chunk_type

| 值      | 含义                       |
| :------ | :------------------------- |
| journal | 日志（`journal/` 目录下）  |
| project | 项目（`projects/` 目录下） |

### semantic_chunks.status

| 值      | 含义   |
| :------ | :----- |
| active  | 活跃   |
| deleted | 软删除 |

### semantic_links.link_type

| 值            | 含义     |
| :------------ | :------- |
| semantic      | 语义相似 |
| reference     | 引用关系 |
| contradiction | 矛盾冲突 |

### topics.status

| 值      | 含义     |
| :------ | :------- |
| active  | 正常主题 |
| deleted | 软删除   |

### projects.status

| 值      | 含义     |
| :------ | :------- |
| active  | 正常作品 |
| deleted | 软删除   |

### temporal_events.event_type

| 值              | 含义     |
| :-------------- | :------- |
| belief_change   | 信念变化 |
| interest_spike  | 兴趣峰值 |
| topic_emergence | 主题涌现 |

### reflections.type

| 值            | 含义     |
| :------------ | :------- |
| pattern       | 模式发现 |
| contradiction | 矛盾发现 |
| evolution     | 演化追踪 |
| insight       | 洞察生成 |

---

## 常用查询示例

### 1. 查询语义块列表（按时间排序）

```sql
SELECT * FROM semantic_chunks ORDER BY created_at DESC LIMIT 50;
```

### 2. 全文搜索语义块

```sql
SELECT s.* FROM semantic_chunks s
JOIN semantic_chunks_fts f ON s.rowid = f.rowid
WHERE f.content MATCH ?
ORDER BY s.created_at DESC;
```

### 3. 全文搜索概念

```sql
SELECT c.* FROM concepts c
JOIN concepts_fts f ON c.rowid = f.rowid
WHERE f.title MATCH ? OR f.evolving_summary MATCH ?
ORDER BY c.relevance DESC;
```

### 4. 全文搜索主题

```sql
SELECT t.* FROM topics t
JOIN topics_fts f ON t.rowid = f.rowid
WHERE f.title MATCH ? OR f.summary MATCH ?
ORDER BY t.created_at DESC;
```

### 5. 全文搜索作品

```sql
SELECT p.* FROM projects p
JOIN projects_fts f ON p.rowid = f.rowid
WHERE f.name MATCH ? OR f.description MATCH ? OR f.ai_summary MATCH ?
ORDER BY p.updated_at DESC;
```

### 6. 全文搜索页面

```sql
SELECT p.* FROM pages p
JOIN pages_fts f ON p.rowid = f.rowid
WHERE f.title MATCH ? OR f.ai_summary MATCH ?
ORDER BY p.order_index ASC;
```

### 7. 查询某个语义块的语义链接

```sql
SELECT sl.*, source.file_path AS source_path, target.file_path AS target_path
FROM semantic_links sl
JOIN semantic_chunks source ON sl.source_chunk_id = source.id
JOIN semantic_chunks target ON sl.target_chunk_id = target.id
WHERE sl.source_chunk_id = ?
ORDER BY sl.similarity DESC;
```

### 8. 查询文件的所有语义块

```sql
SELECT * FROM semantic_chunks
WHERE file_id = ?
ORDER BY start_line ASC;
```

### 9. 查询主题详情

```sql
SELECT t.*, s.file_path, s.section_title, tc.relevance_score
FROM topics t
JOIN topic_chunks tc ON t.id = tc.topic_id
JOIN semantic_chunks s ON tc.chunk_id = s.id
WHERE t.id = ?
ORDER BY tc.relevance_score DESC;
```

### 6. 查询反思列表

```sql
SELECT * FROM reflections WHERE status = 'pending' ORDER BY created_at DESC;
```

### 7. 查询概念关联的语义块

```sql
SELECT c.*, s.file_path, s.section_title, cc.relevance_score
FROM concepts c
JOIN concept_chunks cc ON c.id = cc.concept_id
JOIN semantic_chunks s ON cc.chunk_id = s.id
WHERE c.id = ?
ORDER BY cc.relevance_score DESC;
```

### 8. 查询主题关联的概念

```sql
SELECT t.*, c.title, tc.relevance_score
FROM topics t
JOIN topic_concepts tc ON t.id = tc.topic_id
JOIN concepts c ON tc.concept_id = c.id
WHERE t.id = ?
ORDER BY tc.relevance_score DESC;
```

### 9. 查询反思关联的语义块

```sql
SELECT r.*, s.file_path, s.section_title, rc.relevance_score
FROM reflections r
JOIN reflection_chunks rc ON r.id = rc.reflection_id
JOIN semantic_chunks s ON rc.chunk_id = s.id
WHERE r.id = ?
ORDER BY rc.relevance_score DESC;
```

### 10. 查询作品的关联语义块

```sql
SELECT p.*, s.file_path, s.section_title, pc.relevance_score
FROM projects p
JOIN project_chunks pc ON p.id = pc.project_id
JOIN semantic_chunks s ON pc.chunk_id = s.id
WHERE p.id = ?
ORDER BY pc.relevance_score DESC;
```

### 11. 查询文件的同步状态

```sql
SELECT file_path, file_hash, sync_status, last_synced
FROM file_index
ORDER BY updated_at DESC;
```

---

## 设计说明

1. **文件优先架构**：用户数据以 Markdown 文件为唯一数据源，SQLite 仅存储文件元数据索引和 AI 分析结果，不重复存储原始内容
2. **向量存储分离**：embedding 由 LanceDB 独立管理，SQLite 仅存储元数据
3. **FTS5 全文搜索**：索引 content 和 ai_summary 字段，支持快速文本搜索（通过应用层手动同步）
4. **规范化关联关系**：所有多对多关系均使用关联表存储，支持外键约束和高效索引
5. **软删除支持**：相关表通过 status 字段实现软删除
6. **时间线追踪**：temporal_events 表记录知识演化过程
7. **迁移管理**：migrations_db 表实现数据库版本管理
8. **增量同步**：file_index 的 sync_status 支持高效的增量文件同步，避免全量扫描
