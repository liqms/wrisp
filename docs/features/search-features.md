# 全局搜索功能需求

> 全局搜索是 Wrisp 的跨模块检索能力，支持跨语义块、概念、主题、作品、页面的全域检索。
> 本文档从 [journal-features.md](journal-features.md) §1.5 拆分独立，并补充技术实现细节。

---

## 一、功能概述

全局搜索以**全局弹窗**形式存在（挂在 App.vue 根组件），不占用路由。用户在任何页面按下快捷键即可唤起搜索弹窗，输入关键词后同时检索五类数据源，结果按类型分组展示。

**设计目标**：
- **零上下文切换**：任意页面均可触发，不离开当前编辑环境
- **全域覆盖**：一次查询跨越 Journal 日志、Wiki 概念/主题、Project 作品、Page 页面
- **双策略**：向量语义搜索优先，FTS5 全文搜索兜底，兼顾语义理解和精确匹配

---

## 二、交互设计

### 2.1 搜索弹窗

```
┌─────────────────────────────────────────────────────┐
│  🔍  搜索语义块、概念、主题、作品、页面...    Ctrl+Shift+F │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─ 语义块 ──────────────────────────────────────┐  │
│  │  LanceDB  IVF-PQ 索引                         │  │
│  │  Journal · 2026-05-16 · #向量数据库            │  │
│  │  ...今天研究了 **LanceDB** 的 **IVF-PQ** 索引  │  │
│  └─────────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ 概念 ────────────────────────────────────────┐  │
│  │  📘 向量数据库                                 │  │
│  │  12 个语义块 · 演化摘要：用户从 5 月开始研究... │  │
│  └─────────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ 主题 ────────────────────────────────────────┐  │
│  │  📚 本地语义搜索方案选型                       │  │
│  │  8 语义块 · 3 概念 · 更新于 05-10              │  │
│  └─────────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ 作品 ────────────────────────────────────────┐  │
│  │  📄 向量数据库选型报告                         │  │
│  │  Project · 技术调研 · 更新于 05-12             │  │
│  └─────────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ 页面 ────────────────────────────────────────┐  │
│  │  📄 2026-05-16                                 │  │
│  │  Journal · 12 个块 · 3 个语义块                │  │
│  └─────────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 2.2 快捷键

| 项目 | 说明 |
|:-----|:-----|
| **默认快捷键** | `Ctrl+Shift+F` |
| **注册机制** | `shortcut.store.ts` 全局 keydown 捕获阶段分发，支持用户自定义重映射 |
| **弹窗状态** | `searchVisible` 寄存在 `shortcut.store.ts`，`openSearch()` / `closeSearch()` 控制 |

> **注意**：设计文档中曾标注 `Ctrl+K`，但实际实现为 `Ctrl+Shift+F`。`Ctrl+K` 在项目中用于编辑器 BubbleMenu 的"链接"功能。

### 2.3 功能清单

| 功能 | 说明 |
|:-----|:-----|
| **快捷键触发** | `Ctrl+Shift+F`，在任何页面均可唤起搜索弹窗 |
| **搜索范围** | 同时搜索语义块（FTS5 全文）、概念（名称+摘要）、主题（名称+摘要）、作品（名称+描述）、页面（文件名+标签） |
| **结果分组** | 按类型分组展示：语义块 / 概念 / 主题 / 作品 / 页面，每组显示对应元数据 |
| **范围筛选** | 按来源筛选：语义块 / 概念 / 主题 / 作品 / 页面 / 全部 |
| **标签筛选** | 输入 `#标签名` 按标签过滤 |
| **日期筛选** | 输入 `2026-05` 按年月过滤 |
| **回车跳转** | 选中结果后回车，跳转到对应位置（日志页 / 概念详情 / 主题 / 作品编辑器 / 页面） |

---

## 三、技术架构

### 3.1 调用链

```
┌─ 渲染进程 ─────────────────────────────────────────────────┐
│  Ctrl+Shift+F → shortcut.store.handleKeydown()            │
│    → searchVisible = true                                 │
│    → App.vue: <global-search v-model:visible="...">       │
│    → GlobalSearch.vue (n-modal 弹窗)                       │
│      └─ n-input (用户输入)                                 │
│      └─ useSearch() → window.search.search(keyword)        │
└────────────────────────────────────────────────────────────┘
                          ↓ IPC
┌─ 主进程 ──────────────────────────────────────────────────┐
│  search.ipc.ts: ipcMain.handle("search:search")            │
│    → search.api.ts: search(keyword, limit)                 │
│      → search.service.ts: searchService.search()           │
│        ├─ vectorSearch() → LanceDB ANN 向量搜索            │
│        └─ textSearch()   → FTS5 全文搜索（兜底）           │
└────────────────────────────────────────────────────────────┘
```

### 3.2 搜索策略

采用**向量语义搜索优先 + FTS5 全文搜索兜底**的双层策略：

```
search(keyword)
  ├─ try: vectorSearch(keyword)   → 语义理解，召回相关但非精确匹配的内容
  └─ catch: textSearch(keyword)   → 精确关键词匹配，作为向量搜索失败时的兜底
```

### 3.3 架构分层

| 层 | 文件 | 职责 |
|:---|:-----|:-----|
| 组件 | `src/renderer/components/GlobalSearch.vue` | n-modal 弹窗 UI，搜索输入框 + 结果区域 |
| Composable | `src/renderer/composables/useSearch.ts` | 搜索状态封装（results / loading / error） |
| Store | `src/renderer/store/shortcut.store.ts` | 搜索弹窗可见性 + 快捷键分发（无独立 search store） |
| Preload | `src/main/preload/modules/search.ts` | IPC 桥接，暴露 `window.search.search()` |
| 类型 | `src/main/preload/types/search.ts` | `SearchAPI` 接口定义 |
| IPC | `src/main/ipcMain/search.ipc.ts` | `search:search` 通道注册 |
| API | `src/main/core/apis/search.api.ts` | 薄封装，包装为 `ApiResponse` |
| Service | `src/main/core/services/search.service.ts` | 搜索服务单例，编排向量搜索 + 全文搜索 |

---

## 四、FTS5 全文索引

数据库中已建 5 张 FTS5 虚拟表，覆盖全部数据源：

| FTS5 表 | 源表 | 索引字段 | 说明 |
|:--------|:-----|:---------|:-----|
| `semantic_chunks_fts` | `semantic_chunks` | content, ai_summary | 语义块全文索引 |
| `concepts_fts` | `concepts` | title, evolving_summary | 概念全文索引 |
| `topics_fts` | `topics` | title, summary | 主题全文索引 |
| `projects_fts` | `projects` | name, description, ai_summary | 作品全文索引 |
| `pages_fts` | `pages` | title, ai_summary | 页面全文索引 |

均使用 **contentless FTS5** 模式（`content='源表'`），通过 `rowid` 关联源表，避免数据冗余。

**已实现的 FTS5 查询**（`chunk.dao.ts`）：

```sql
SELECT b.* FROM semantic_chunks b
JOIN semantic_chunks_fts f ON b.rowid = f.rowid
WHERE f.content MATCH ? AND b.status = 'active'
ORDER BY b.created_at DESC LIMIT ?
```

---

## 五、向量搜索

基于 LanceDB 的 ANN（近似最近邻）向量搜索，使用 IVF-PQ 索引加速。

### 5.1 核心文件

| 文件 | 职责 |
|:-----|:-----|
| `src/main/core/vector/lancedb.ts` | LanceDB 连接初始化，存储路径 `{workspace}/vectors/`，支持 IVF-PQ 索引 |
| `src/main/core/vector/block-search.ts` | Block 向量搜索函数，支持 projectId 过滤 |
| `src/main/core/vector/project-filter.ts` | 构造 LanceDB WHERE 表达式，含输入校验防注入 |
| `src/main/core/vector/vector-payload.ts` | 组装向量写入载荷 |

### 5.2 搜索参数

```typescript
interface VectorSearchParams {
  queryVector: number[];    // embedding 向量
  topK?: number;            // 召回数量，默认 10
  projectId?: string;       // 按作品过滤
}
```

### 5.3 搜索类型枚举

```typescript
enum SEARCH_TYPE {
  KEYWORD = "keyword",    // 关键词搜索（FTS5）
  SEMANTIC = "semantic",  // 语义搜索（向量）
}
```

---

## 六、素材搜索（已实现）

素材搜索（`material-search.service.ts`）是面向创作 Agent 的检索能力，**已完整实现**，与全局搜索 UI 相互独立。

### 6.1 与全局搜索的区别

| 维度 | 全局搜索 | 素材搜索 |
|:-----|:---------|:---------|
| **面向** | 用户（UI 弹窗） | 创作 Agent（API 调用） |
| **隔离** | 全域，无隔离 | 强制按作品隔离（projectId 必填） |
| **类型** | 5 类（chunk/concept/topic/project/page） | 3 类（chunk/concept/topic） |
| **实现状态** | ⚠️ TODO 占位 | ✅ 已实现 |

### 6.2 接口

```typescript
interface MaterialSearchParams {
  projectId: string;               // 必填，作品隔离
  query: string;
  kinds?: MaterialKind[];          // 默认 ["chunk"]
  limit?: number;                  // 默认 5, 上限 20
}
```

### 6.3 实现逻辑

1. **chunk 检索**：`chunkService.search(query, limit, SEMANTIC, projectId)` → 向量语义搜索
2. **concept 检索**：`chunkService.getProjectChunkIds()` → `conceptChunkDao.findByChunkIds()` → `conceptDao.findByIds()`
3. **topic 检索**：同理通过 `topicChunkDao` → `topicDao` 关联查询

---

## 七、实现状态

### 7.1 分层状态

| 层级 | 文件 | 状态 | 说明 |
|:-----|:-----|:-----|:-----|
| Vue 组件 | `GlobalSearch.vue` | ⚠️ UI 空壳 | 弹窗框架已搭建，未调用搜索 API，始终显示"无结果" |
| Composable | `useSearch.ts` | ⚠️ TODO 占位 | `search()` 方法体为空，返回空数组 |
| Service | `search.service.ts` | ⚠️ TODO 占位 | `vectorSearch()` 和 `textSearch()` 均返回 `[]` |
| Service | `material-search.service.ts` | ✅ 已实现 | 素材检索，面向创作 Agent |
| DAO | `chunk.dao.ts` (`searchFts`) | ✅ 已实现 | FTS5 MATCH 查询 |
| DAO | `vector.dao.ts` (`search`) | ✅ 已实现 | LanceDB 向量搜索 |
| IPC | `search.ipc.ts` | ✅ 已实现 | `search:search` 通道 |
| API | `search.api.ts` | ✅ 已实现 | ApiResponse 包装 |
| Preload | `modules/search.ts` + `types/search.ts` | ✅ 已实现 | IPC 桥接 |
| FTS5 索引 | `init.sql`（5 张虚拟表） | ✅ 已实现 | contentless FTS5 模式 |
| 向量搜索 | `vector/`（4 个文件） | ✅ 已实现 | LanceDB IVF-PQ |
| Store | `shortcut.store.ts` | ✅ 已实现 | 弹窗状态 + 快捷键分发 |
| 快捷键 | `Ctrl+Shift+F` | ✅ 已实现 | 支持用户自定义重映射 |

### 7.2 关键结论

1. **"管道"已贯通但"引擎"未接入**：从 UI → IPC → API → Service 的调用链完整，但 `SearchService` 的两个子方法为 TODO 占位
2. **GlobalSearch.vue 未接入调用链**：组件内没有调用 `useSearch` 或 `window.search.search()`
3. **底层基础设施已就绪**：FTS5 全文索引（5 张表）、LanceDB 向量搜索、`chunk.dao.searchFts()`、`chunkService.search()` 均已完整实现
4. **素材搜索是唯一完整可用的搜索路径**，但服务于创作 Agent，而非用户面向的全局搜索 UI

### 7.3 待完成工作

| 优先级 | 工作项 | 说明 |
|:-------|:-------|:-----|
| P0 | `search.service.ts` 接入 `chunkService.search()` | 复用已实现的 FTS5 + 向量搜索能力 |
| P0 | `search.service.ts` 扩展至 5 类数据源 | 当前 chunkService 仅覆盖 semantic_chunks，需增加 concept/topic/project/page 搜索 |
| P0 | `GlobalSearch.vue` 接入 `useSearch` | 输入触发搜索，渲染分组结果 |
| P0 | `useSearch.ts` 实现 `search()` 方法 | 调用 `window.search.search()`，管理 loading/error 状态 |
| P1 | 搜索结果跳转 | 选中结果回车跳转到对应位置 |
| P1 | 范围/标签/日期筛选 | 筛选交互与后端过滤 |
| P2 | 搜索结果高亮 | 关键词高亮匹配片段 |

---

## 八、IPC 接口

| 通道 | 参数 | 返回值 | 说明 |
|:-----|:-----|:-------|:-----|
| `search:search` | `keyword: string, limit?: number` | `ApiResponse<unknown[]>` | 全局搜索（当前返回空数组） |

> **注意**：返回类型为 `unknown[]`，尚未定义具体的搜索结果类型。未来需要定义 `SearchResult` 联合类型，包含 chunk/concept/topic/project/page 五种结果的统一结构。

---

**文档来源**: 从 [journal-features.md](journal-features.md) §1.5 拆分 + 项目代码调研
**相关文档**: [journal-features.md](journal-features.md) | [wiki-features.md](wiki-features.md) | [project-features.md](project-features.md) | [sqlite.md](../architecture/storage/sqlite.md) | [lancedb.md](../architecture/storage/lancedb.md)
