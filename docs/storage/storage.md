# Pentip 存储方案（v2）

---

## 一、核心理念

**"文件优先，数据库索引"** 是 Pentip 存储架构的根本原则。

- **用户数据 = Markdown 文件**（真实来源，用户可直接访问和管理）
- **智能能力 = 数据库 + 向量库**（AI 索引，由系统自动维护）

用户的所有创作内容、日志记录都以 Markdown 文件形式存储在文件系统中，数据库和向量库仅作为 AI 能力的索引层存在。文件系统是唯一的事实来源（source of truth），索引层可以随时从文件重建。

---

## 二、整体架构（三层）

```
用户交互层
    │
    ▼
文件系统层（真实数据源）
    │  journal/   projects/   assets/
    │
    ▼
SQLite 索引层（AI 处理结果）
    ├── 文件索引   (file_index)
    ├── 语义块     (semantic_chunks)
    ├── 知识图谱   (concepts, topics, semantic_links)
    └── LanceDB 向量库 (chunk_embeddings)
```

### 各层职责

| 层级          | 职责             | 说明                                   |
| :------------ | :--------------- | :------------------------------------- |
| 用户交互层    | 编辑、查看、搜索 | 用户直接操作的界面                     |
| 文件系统层    | 真实数据存储     | Markdown 文件即为用户数据的最终形态    |
| SQLite 索引层 | AI 索引与关联    | 记录文件元数据、语义块、知识图谱、向量 |

---

## 三、核心存储技术栈

| 功能     | 技术方案                 | 说明                             |
| :------- | :----------------------- | :------------------------------- |
| 主数据库 | SQLite（better-sqlite3） | WAL 模式，跨平台，零配置         |
| 全文搜索 | SQLite FTS5              | 内置，零配置                     |
| 向量存储 | LanceDB                  | 向量索引与语义搜索（本地嵌入式） |
| 知识图谱 | SQLite Graph Tables      | 语义链接关系                     |
| 文件存储 | Local File System        | Markdown 文件、附件、图片        |
| 模型缓存 | Local `models/` 目录     | GGUF 格式模型文件                |

---

## 四、文件系统目录结构

```
{workspace}/
├── journal/                      # 日志流（按天）
│   ├── 2026-06-27.md
│   └── 2026-06-26.md
├── projects/                     # 创作项目
│   ├── 项目A/
│   │   ├── index.md
│   │   ├── 01-背景.md
│   │   └── 02-方案对比.md
│   └── .../
└── assets/                       # 附件/图片
```

> **注**：工作空间仅包含用户可编辑的内容文件。SQLite 索引库、LanceDB 向量库等应用内部状态归属于全局应用数据目录（见 `userData.md`）。工作空间默认路径为用户 Documents 目录，用户可在设置中修改。

---

## 五、核心数据模型（SQLite 索引层）

> 完整的 SQLite 表结构设计请见 [`sqlite.md`](sqlite.md)。

| 表名                                         | 作用                                               | 关联                                 |
| :------------------------------------------- | :------------------------------------------------- | :----------------------------------- |
| `file_index`                                 | 文件索引，记录 .md 文件的 hash、修改时间、同步状态 | 核心入口                             |
| `semantic_chunks`                            | 语义块，AI 语义拆分的文件内容片段索引              | 关联 file_index                      |
| `semantic_chunks_fts`                        | FTS5 全文索引                                      | 索引 content + ai_summary            |
| `concepts_fts`                               | 概念 FTS5 全文索引                                 | 索引 title + evolving_summary        |
| `topics_fts`                                 | 主题 FTS5 全文索引                                 | 索引 title + summary                 |
| `projects_fts`                               | 作品 FTS5 全文索引                                 | 索引 name + description + ai_summary |
| `pages_fts`                                  | 页面 FTS5 全文索引                                 | 索引 title + ai_summary              |
| `tags` / `tagged_items`                      | 标签定义与多对多关联                               | 关联 chunk / project / file          |
| `semantic_links`                             | 语义块之间的关联关系                               | 引用 semantic_chunks                 |
| `concepts` / `concept_chunks`                | AI 概念提取                                        | 引用 semantic_chunks                 |
| `topics` / `topic_chunks` / `topic_concepts` | AI 主题聚类                                        | 引用 semantic_chunks + concepts      |
| `temporal_events`                            | 知识演化事件追踪                                   | 引用 semantic_chunks                 |
| `reflections` / `reflection_chunks`          | AI 反思洞察                                        | 引用 semantic_chunks                 |
| `projects` / `project_chunks`                | 创作项目管理                                       | 引用 semantic_chunks                 |
| `pages`                                      | 项目页面/章节索引                                  | 关联 projects, 关联 .md 文件         |
| `migrations_db`                              | 数据库版本迁移管理                                 | 独立表                               |

> **核心关系**：`file_index —1:N— semantic_chunks —N:N— AI 索引表（concepts/topics/reflections）`

### 语义块解析规则

语义块通过 AI 语义分析进行拆分，而非固定的规则切分：

- **Journal 文件**：AI 根据内容语义边界（主题转换、概念边界）自动拆分
- **Project 文件**：AI 根据章节语义和内容连贯性自动拆分

---

## 六、核心数据流

### 6.1 Journal 日志流

用户日常日志输入的核心流程：

```
用户输入 → 追加到今日 .md 文件 → 后台自动处理
                                      │
                           ┌──────────┴──────────┐
                           ▼                     ▼
                    文件变更检测            AI 语义拆分
                           │                     │
                           ▼                     ▼
                    对比 file_index hash   生成语义块（AI 语义拆分）
                           │                     │
                           ▼                     ▼
                    更新 file_index         向量化
                           │                     │
                           ▼                     ▼
                    记录同步状态           语义关联分析
```

流程说明：

1. 用户通过交互界面输入内容，系统直接追加到 `journal/YYYY-MM-DD.md` 文件
2. 文件完成写入后，后台监听进程检测到文件变更
3. 计算文件新 hash，与 `file_index` 中记录对比，确定变更范围
4. 仅针对新增或修改的内容，通过 AI 语义分析进行拆分
5. 生成 `semantic_chunks` 记录，每条包含块内容、摘要、向量引用
6. 向量化后将 embedding 写入 LanceDB
7. 后台执行语义关联分析，建立概念和主题关联

### 6.2 项目创作流

用户创作项目的完整流程：

```
用户创建项目 → projects/ 下创建目录和 .md 文件
    │
    ▼
用户编写内容 → Markdown 文件保存 → 后台同步
    │                              │
    │                              ▼
    │                        检测文件变更
    │                              │
    │                              ▼
    │                        增量更新索引
    │                              │
    ▼                              ▼
文件系统始终为真实来源        SQLite + LanceDB 同步更新
```

流程说明：

1. 用户创建项目时，系统在 `projects/` 下创建目录和初始 `.md` 文件
2. 用户直接编写 Markdown 内容（可使用任何兼容编辑器）
3. 文件保存后进行后台同步，与 Journal 流使用相同的同步机制
4. 索引层仅作为辅助，不影响用户对文件的直接操作

### 6.3 语义智能处理流

AI 对文件内容进行智能处理的流程：

```
触发时机：手动触发 / 自动触发（文件变更后）
    │
    ▼
增量检测：对比 file_index 中的 hash，仅处理变更文件
    │
    ▼
语义块解析：通过 AI 语义分析拆分文件内容，生成 semantic_chunks
    │
    ▼
本地智能处理：
    ├── 向量化：通过 embedding 模型生成块向量，存入 LanceDB
    ├── 语义关联：分析块间语义相似度，建立 semantic_links
    ├── 概念提取：识别高频/重要概念，写入 concepts 表
    └── 主题聚类：将相关概念和块聚类为 topics
```

---

## 七、同步机制

### 7.1 全量同步（首次启动）

应用首次启动或用户手动触发重建索引时执行：

```
1. 扫描 workspace 下所有 .md 文件
2. 计算每个文件的 SHA256 hash
3. 写入 file_index（sync_status = synced）
4. 解析文件内容，生成 semantic_chunks
5. 向量化并写入 LanceDB
6. 执行语义关联分析
```

### 7.2 增量同步（日常运行）

应用日常运行时通过文件监听触发：

```
1. 监听文件变更事件（fs.watch / chokidar）
2. 计算变更文件的新 hash
3. 对比 file_index 中记录的 hash
   ├── hash 一致 → 跳过（无变更）
   └── hash 不一致 → 标记为待处理
4. 对变更文件重新解析
   ├── 删除该文件原有的 semantic_chunks
   ├── 重新解析并插入新 chunk
   ├── 更新 file_index 中的 hash 和修改时间
   └── 更新 LanceDB 中的向量
```

### 7.3 冲突处理原则

| 场景                           | 处理方式                                                               |
| :----------------------------- | :--------------------------------------------------------------------- |
| 文件内容被外部编辑器修改       | 以文件系统为准，重新计算 hash 并更新索引                               |
| 文件被用户删除                 | 标记 file_index 中 sync_status = deleted，软删除关联的 semantic_chunks |
| 文件内容与索引不一致           | 始终以文件系统为事实来源，索引可随时重建                               |
| 同时发生文件修改和 AI 处理请求 | 先完成文件写入，再执行 AI 处理，避免竞态                               |

### 7.4 文件删除处理

```
用户删除 .md 文件
    │
    ▼
文件监听触发删除事件
    │
    ▼
file_index 中标记 sync_status = 'deleted'
    │
    ▼
对应的 semantic_chunks 软删除（保留记录但标记为无效）
    │
    ▼
LanceDB 中对应向量删除
```

---

## 八、LanceDB 向量库

> 完整的向量库设计请见 [`lancedb.md`](lancedb.md)。

LanceDB 作为独立的嵌入式向量数据库，与 SQLite 协同工作：

```
 ┌─────────────┐         ┌─────────────┐
 │   SQLite    │         │   LanceDB   │
 │  (元数据)   │         │  (向量数据)  │
 └──────┬──────┘         └──────┬──────┘
        │                       │
        │  chunk_id (外键)      │  chunk_id (关联)
        └───────────┬───────────┘
                    │
          ┌─────────▼─────────┐
          │     业务层         │
          │  (语义搜索/推荐)    │
          └───────────────────┘
```

**协同工作模式：**

| 数据类型   | 存储位置         | 用途                  |
| :--------- | :--------------- | :-------------------- |
| 语义块向量 | LanceDB          | 语义搜索、相似性匹配  |
| 概念       | SQLite + LanceDB | AI 概念提取和向量索引 |
| 主题       | SQLite + LanceDB | AI 主题聚类和向量索引 |

LanceDB 向量表一览（详见 `lancedb.md`）：

| 向量表               | 关联 SQLite 表  | 用途                 |
| :------------------- | :-------------- | :------------------- |
| `chunk_embeddings`   | semantic_chunks | 语义块级语义搜索     |
| `concept_embeddings` | concepts        | 概念聚类与检索       |
| `topic_embeddings`   | topics          | 主题相似性搜索与推荐 |

---

## 九、架构定位

PenTip 的存储系统本质上是 **File-first, Database-index Architecture**：

- **文件系统** 是用户数据的真实来源（source of truth），用户可以直接用文本编辑器访问和编辑
- **SQLite 索引层** 负责文件元数据管理、全文搜索、知识图谱存储（详见 [`sqlite.md`](sqlite.md)）
- **LanceDB 向量库** 负责语义搜索和相似性匹配（详见 [`lancedb.md`](lancedb.md)）
- **AI 能力** 完全构建在索引层之上，不干扰用户数据的原始形态

> Pentip 的数据库不是 Note Database，而是 **AI Index Layer on Top of Markdown Files**。用户的数据永远在自己手中，索引可以随时重建，智能能力来自数据库而非锁定用户数据。
