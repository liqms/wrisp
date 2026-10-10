# Journal 功能需求

> 本文档整合了 Journal 模块的核心设计（从 [prd.md](prd.md) §3.1 拆分）和 PM 场景扩展需求。
> Journal 是用户所有信息的**唯一入口**，承担"零组织成本输入"职责。

---

## 一、核心设计

### 1.1 每日日志页模式

Journal 采用 **每日日志页** 模式（参考 Logseq 的日志流），每天自动对应一个 `journal/YYYY-MM-DD.md` 文件。用户打开应用默认进入今日日志页，可在页面内自由编辑。

```
┌─────────────────────────────────────────────────────┐
│  Journal                              2026-05-16  ☰ │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─ 语义块 ──────────────────────────────────────┐  │
│  │                                                 │  │
│  │  - 今天研究了 LanceDB 的 IVF-PQ 索引...         │  │
│  │    #向量数据库 #索引优化                         │  │
│  │                                                 │  │
│  │  - 想到一个观点：本地优先不是技术选择，而是产品  │  │
│  │    理念                                         │  │
│  │    #产品理念                                    │  │
│  │                                                 │  │
│  └─────────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ 语义块 ──────────────────────────────────────┐  │
│  │                                                 │  │
│  │  - TODO 整理向量数据库选型对比表                 │  │
│  │    NOW 正在对比 LanceDB / FAISS / ChromaDB      │  │
│  │                                                 │  │
│  │  - [[向量数据库]] 的选型笔记已整理到 projects/   │  │
│  │                                                 │  │
│  │  - 引用一段话：                                  │  │
│  │    > 本地优先意味着用户数据完全可控              │  │
│  │                                                 │  │
│  └─────────────────────────────────────────────────┘  │
│                                                     │
│                                        2026-05-16.md │
└─────────────────────────────────────────────────────┘

> 页面底部显示当前编辑的文件名 `journal/2026-05-16.md`，用户可直接在页面任意位置添加内容，无需通过固定的输入框。
```

**核心设计**：Markdown 文件编辑模式，打开即进入 `journal/YYYY-MM-DD.md` 文件的直接编辑。每行为一个块（Block），支持大纲层级、标记语法和行内编辑，无需通过固定输入框创建内容。

### 1.2 语义块视觉区分

AI 自动将连续相关的块聚合为语义块。默认状态下，语义块与普通块外观一致，保持页面整洁。鼠标悬浮到语义块区域时，整块呈现浅色背景和卡片轮廓，帮助用户快速识别内容分组。

### 1.3 块（Block）编辑

Journal 的核心交互单元是**块**，每个块对应 Markdown 文件中的一行。

| 操作                | 行为                                                     |
| :------------------ | :------------------------------------------------------- |
| **点击块**          | 进入行内编辑模式，直接修改内容                           |
| **Enter**           | 在当前块下方创建同级新块                                 |
| **Tab / Shift+Tab** | 缩进/提升块层级，形成大纲结构                            |
| **上下方向键**      | 在块之间快速导航                                         |
| **选中多块**        | 批量操作：拖拽排序、复制、删除                           |
| **拖拽块左侧手柄**  | 拖动块到任意位置，调整顺序或层级                         |
| **输入 `#标签`**    | 自动补全已有标签，标记为标签                             |
| **输入 `[[页面]]`** | 自动补全已有页面/概念，创建双向链接                      |
| **输入 `- [ ]`**    | 自动识别为 TODO，支持循环切换：TODO → LATER → NOW → DONE |
| **输入 `>`**        | 自动识别为引用块                                         |
| **输入 `$$`**       | 行内 LaTeX 公式（未来）                                  |
| **粘贴链接**        | 自动抓取标题和摘要（可选）                               |
| **粘贴长文本**      | 自动按空行或语义边界拆分为多个块                         |
| **Ctrl+Z**          | 撤销到上一个操作状态                                     |

**TODO 状态循环**：

```
TODO  →  LATER  →  NOW  →  DONE  →  CANCELED
  ↑                                        │
  └────────────────────────────────────────┘
```

点击 TODO 标记循环切换状态，视觉上 DONE 自动添加删除线。

> **实现状态**：当前编辑器基于 Tiptap TaskItem 扩展实现 `- [ ]`/`- [x]` 二态勾选（见 [editor-features.md](editor-features.md) §3.10），5 态循环（TODO/LATER/NOW/DONE/CANCELED）为规划能力，尚未实现。

### 1.4 AI 增强（后台自动）

Journal 的 AI 处理在后台无感知进行，不影响用户编辑体验：

1. 块写入 `journal/YYYY-MM-DD.md` 文件后，文件变更检测触发
2. AI 语义拆分 → 生成 embedding 向量
3. 与历史语义块进行语义相似度匹配，建立 semantic_links
4. 提取概念实体，更新 Concept 的 evolving_summary
5. 更新 FTS5 全文索引
6. 更新概念演化摘要

> **实现状态**：AI 增强通过后台任务队列异步执行，6 步 MVP 流水线为 `chunk-summary → chunk-vectorize → semantic-link → concept-extract → topic-detection → topic-summary`（详见 §6.5）。文件更新时触发 `inlineTokenSyncService` 同步行内 token（#标签、@人物）。

### 1.5 全局搜索

Journal 顶部提供全局搜索入口，支持跨语义块、概念、主题、作品、页面的全域检索。快捷键 `Ctrl+Shift+F` 触发。

> 全局搜索的交互设计、技术架构、FTS5 索引、向量搜索、素材搜索、实现状态等详细内容已独立文档化，见 [search-features.md](search-features.md)。

---

## 二、PM 场景扩展

> 输入来源：[product-manager.md](../user-research/product-manager.md)
> 抽象方法：遍历 PM 6 大工作流场景 + 12 类输出文档，提取 Journal 需承载的能力
> 以下功能基于 PM 场景补充，标注【既有】/【新增】

### 2.1 抽象方法

```
PM 场景动作                →  Journal 需要的能力
─────────────────────────────────────────────
口述需求/语音               →  多模态输入
粘贴竞品截图               →  图片块 + OCR
粘贴数据看板截图           →  图片块 + 数据识别
@张三 任务                 →  @提及 + 行动项识别
"决策：砍掉金卡"           →  决策块自动识别
"转化率8%"                 →  数据指标块
三个月前的关联             →  跨日期语义召回
按周出周报                 →  日期范围聚合
按竞品名查全部输入         →  标签/主题筛选
会议纪要结构化             →  模板块 + 字段抽取
```

### 2.2 功能清单总览

| 编号 | 功能                     | 类别 | 来源场景  | 状态           |
| :--- | :----------------------- | :--- | :-------- | :------------- |
| J-01 | 每日日志页               | 基础 | 全部      | 【既有】       |
| J-02 | Block 行内编辑           | 基础 | 全部      | 【既有】       |
| J-03 | 大纲层级                 | 基础 | 全部      | 【既有】       |
| J-04 | Markdown 语法            | 基础 | 全部      | 【既有】       |
| J-05 | 图片块                   | 输入 | 场景1/2/6 | 【既有】       |
| J-06 | 粘贴长文本自动拆块       | 输入 | 场景1     | 【既有】       |
| J-07 | 粘贴链接抓取摘要         | 输入 | 场景2     | 【既有】       |
| J-08 | 标签 `#`                 | 组织 | 全部      | 【既有】       |
| J-09 | 双链 `[[]]`              | 组织 | 全部      | 【既有】       |
| J-10 | TODO 状态循环            | 组织 | 场景5     | 【既有】       |
| J-11 | 语音输入                 | 输入 | 场景1     | 【新增】       |
| J-12 | 截图OCR识别              | 输入 | 场景1/2/6 | 【新增】       |
| J-13 | @提及人员                | 组织 | 场景5     | 【新增】       |
| J-14 | 决策块标记               | 组织 | 场景5     | 【新增】       |
| J-15 | 数据指标块               | 组织 | 场景6     | 【新增】       |
| J-16 | 引用块（@引用历史Block） | 组织 | 场景3     | 【新增】       |
| J-17 | 块模板/快速插入          | 输入 | 场景5     | 【新增】       |
| J-18 | 日期跳转/日历导航        | 导航 | 全部      | 【既有，增强】 |
| J-19 | 按日期范围筛选           | 导航 | 场景4/5   | 【新增】       |
| J-20 | 按标签/主题筛选          | 导航 | 场景2/4   | 【新增】       |
| J-21 | 按来源类型筛选           | 导航 | 全部      | 【新增】       |
| J-22 | 全局语义检索             | 检索 | 场景3     | 【既有】       |
| J-23 | AI 自动决策点提取        | AI   | 场景5     | 【新增】       |
| J-24 | AI 自动行动项提取        | AI   | 场景5     | 【新增】       |
| J-25 | AI 自动用户故事提取      | AI   | 场景3     | 【新增】       |
| J-26 | AI 跨日期语义关联提示    | AI   | 场景1/6   | 【新增】       |
| J-27 | AI 数据异常归因关联      | AI   | 场景6     | 【新增】       |
| J-28 | AI 周报草稿生成          | AI   | 场景5     | 【新增】       |
| J-29 | 语义块视觉聚合           | 视觉 | 全部      | 【既有】       |
| J-30 | 块内联 AI 对话           | AI   | 场景3     | 【新增】       |

### 2.3 功能详述

#### 输入能力

**J-05 图片块【既有，增强】**：支持粘贴/拖拽图片，存入 `<workspace>/assets/journal/YYYY-MM-DD/<hash>.png`。增强：图片块下方可附加文字说明，参与向量化。

**J-11 语音输入【新增】**：Journal 工具栏提供"语音输入"按钮，调用本地或云端 ASR，转写文本作为普通 Block 插入。优先级 P1。

**J-12 截图 OCR 识别【新增】**：图片块右键菜单"识别文字"，OCR 结果参与向量化。优先级 P2。

**J-17 块模板/快速插入【新增】**：输入 `/` 唤起模板菜单。仅保留碎片化输入型模板（用户需求 / 用户访谈 / 竞品观察 / 产品数据 / 会议纪要），长内容结构化输出模板归入 Project。优先级 P1。

| 模板           | 展开内容                                                                               |
| :------------- | :------------------------------------------------------------------------------------- |
| `/requirement` | `- 需求：{}\n- 用户故事：作为一名{角色}，我希望{功能}，以便{价值}\n- 优先级：P0/P1/P2` |
| `/interview`   | `## 用户访谈 - {对象}\n- 背景：\n- 原话：\n- 痛点：`                                   |
| `/competitor`  | `## 竞品观察 - {竞品名}\n- 动态：\n- 影响：`                                           |
| `/data`        | `- 指标：{} 数值：{} 同比：\n- 假设：\n- 验证：`                                       |
| `/meeting`     | `## 会议纪要 - {标题}\n- 时间：\n- 参会：\n- 决策：\n- 行动项：`                       |

#### 组织能力

**J-13 @提及人员【新增】**：输入 `@` 唤起人员补全，以 `@[[人员:张三]]` 持久化，建立人员维度索引。不集成第三方 IM。优先级 P1。

**J-14 决策块标记【新增】**：行首输入 `>! 决策：` 触发决策块标记，进入独立索引表 `decisions`，支持按主题查看决策时间线。优先级 P1。

**J-15 数据指标块【新增】**：行首输入 `#data` 触发数据块，字段含指标名/数值/时间/同比/环比，进入 `metrics` 索引表。优先级 P2。

**J-16 引用块【新增】**：输入 `((` 唤起历史 Block 语义搜索，选中后插入引用块并建立 `quoted_by` 反向链接。与 `[[]]` 区别：`[[]]` 链接页面，`(()` 链接具体 Block。优先级 P1。

#### 导航与检索

**J-18 日历导航【既有，增强】**：日历视图月视图，每日单元格显示 Block 数量、TODO 未完成（红点）、决策块（黄点）、数据块（蓝点）。优先级 P1。

**J-19 按日期范围筛选【新增】**：支持本周/本月/本季度/自定义快捷选项，结果按时间倒序展示。优先级 P1。

**J-20 按标签/主题筛选【新增】**：标签云 + 主题列表多选筛选，筛选状态可保存为"快捷视图"。优先级 P1。

**J-21 按来源类型筛选【新增】**：来源枚举：用户访谈/竞品观察/数据观察/会议/老板需求/自发思考/其他。优先级 P2。

#### AI 增强

**J-23 AI 自动决策点提取【新增】**：匹配决策模式关键词，提示标记为决策块。优先级 P1。

**J-24 AI 自动行动项提取【新增】**：识别含 `@人员` + 动词 + 时间的 Block，自动转换为 TODO，进入"待办中心"视图。优先级 P1。

**J-25 AI 自动用户故事提取【新增】**：对用户访谈 Block 提取 As-A 句式，存入 `user_stories` 表。优先级 P2。

**J-26 AI 跨日期语义关联提示【新增】**：新 Block 写入后检索语义相似历史 Block，以折叠面板展示"相关历史"。优先级 P1（核心价值点）。

**J-27 AI 数据异常归因关联【新增】**：数据块数值超出历史基线时，自动检索同期相关事件 Block。优先级 P2。

**J-28 AI 周报草稿生成【新增】**：按主题聚合本周所有 Block，生成新 Project 草稿。优先级 P1。

**J-30 块内联 AI 对话【新增】**：选中 Block 后右键"AI 对话"，在 Block 下方展开对话框，对话历史不持久化。优先级 P2。

---

## 三、功能与场景映射矩阵

| 功能 \ 场景        | 1.需求收集 | 2.竞品分析 | 3.PRD撰写 | 4.版本规划 | 5.会议跟进 | 6.数据洞察 |
| :----------------- | :--------: | :--------: | :-------: | :--------: | :--------: | :--------: |
| J-05 图片块        |     ●      |     ●      |           |            |            |     ●      |
| J-11 语音输入      |     ●      |            |           |            |     ●      |            |
| J-12 截图OCR       |            |     ●      |           |            |            |     ●      |
| J-17 块模板        |     ●      |     ●      |           |            |     ●      |     ●      |
| J-13 @提及         |            |            |           |            |     ●      |            |
| J-14 决策块        |            |            |     ●     |     ●      |     ●      |            |
| J-15 数据指标块    |            |            |           |            |            |     ●      |
| J-16 引用历史Block |     ●      |            |     ●     |            |            |     ●      |
| J-18 日历导航      |     ●      |     ●      |           |     ●      |     ●      |     ●      |
| J-19 日期范围筛选  |            |            |           |     ●      |     ●      |            |
| J-20 标签/主题筛选 |            |     ●      |           |     ●      |            |            |
| J-21 来源类型筛选  |     ●      |     ●      |           |            |     ●      |            |
| J-22 全局语义检索  |     ●      |     ●      |     ●     |     ●      |     ●      |     ●      |
| J-23 决策点提取    |            |            |           |            |     ●      |            |
| J-24 行动项提取    |            |            |           |            |     ●      |            |
| J-25 用户故事提取  |     ●      |            |     ●     |            |            |            |
| J-26 跨日期关联    |     ●      |     ●      |           |            |            |     ●      |
| J-27 异常归因      |            |            |           |            |            |     ●      |
| J-28 周报生成      |            |            |           |            |     ●      |            |
| J-30 内联AI对话    |            |            |     ●     |            |            |            |

---

## 四、优先级与分期建议

### P0（MVP 必备，无此项场景不闭环）

- J-01~J-10 既有基础能力
- J-16 引用历史 Block（PRD 撰写素材召回的载体）
- J-22 全局语义检索（已有）
- J-26 跨日期语义关联提示（核心卖点"自动结晶"的显式呈现）

### P1（高价值，建议 MVP 后首版）

- J-17 块模板（降低结构化输入成本）
- J-13 @提及 + J-24 行动项提取（会议场景闭环）
- J-14 决策块 + J-23 决策点提取（决策可追溯）
- J-19/J-20 筛选导航（知识积累后必备）
- J-28 周报生成（高频输出）

### P2（增强体验，后续迭代）

- J-11 语音输入
- J-12 截图 OCR
- J-15 数据指标块 + J-27 异常归因（数据场景深化）
- J-21 来源类型筛选
- J-25 用户故事提取
- J-30 内联 AI 对话

---

## 五、Phase 1 功能范围

| 功能                  | 优先级 | 说明                             |
| :-------------------- | :----- | :------------------------------- |
| Journal 每日日志页    | P0     | 按天展示 journal/YYYY-MM-DD.md   |
| Markdown 文件编辑     | P0     | 直接在页面上编辑 .md 内容        |
| 块编辑（大纲层级）    | P0     | Tab 缩进、换行、TODO 标记        |
| 语义拆分（>300字）    | P0     | 长文本 AI 按语义边界拆分         |
| #标签 / [[页面]] 支持 | P0     | 自动补全与双向链接               |
| 全文搜索（FTS5）      | P0     | 关键词搜索历史内容               |
| 输入模板              | P0     | Slash 命令模板，快速插入预设格式 |
| @提及                 | P0     | 提及人/项目/概念，自动补全       |
| 日历导航              | P0     | 日历视图，按日期跳转 Journal     |

---

## 六、技术实现

> 以下内容基于项目实际代码（2026-09-21 快照），描述 Journal 模块的实现架构、数据模型与当前状态。

### 6.1 架构分层

```
用户操作
  └─ JournalView.vue (视图层, 无限滚动)
       └─ JournalBlock.vue (单条日志编辑, 内嵌 TiptapEditor)
            └─ useJournal.ts (composable, 带日志)
                 └─ journal.store.ts (Pinia store, 乐观更新)
                      └─ window.electronAPI.journal.* (preload 桥接)
                           └─ journal.ipc.ts (IPC handler, 7 通道)
                                └─ journal.api.ts (API 包装层, ApiResponse)
                                     └─ journal.service.ts (核心服务, 单例)
                                          ├─ fileService → JOURNAL_DIR/{yyyy-MM-dd}.md (文件层)
                                          ├─ FileIndexDao → file_index 表 (索引层)
                                          └─ inlineTokenSyncService → #标签/@人物同步
```

### 6.2 核心文件

| 层         | 文件                                                         | 职责                                                                                                                   |
| :--------- | :----------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| 视图       | `src/renderer/views/JournalView.vue`                         | 日志主视图，n-scrollbar 可滚动列表，无限滚动加载更早 5 天日志；挂载时检查今日日志是否存在并自动创建，同步本地 .md 文件 |
| 组件       | `src/renderer/components/editor/containers/JournalBlock.vue` | 单条日志编辑块，内嵌 TiptapEditor，回车触发保存，emit updated/deleted                                                  |
| Composable | `src/renderer/composables/useJournal.ts`                     | 对 store 的封装层，带 logger 日志记录，支持 autoLoadRecent / recentDays 配置                                           |
| Store      | `src/renderer/store/journal.store.ts`                        | Pinia store，管理日志列表和加载状态，乐观更新                                                                          |
| 路由       | `src/renderer/router/index.ts`                               | `path: "journal", name: "Journal"`                                                                                     |
| IPC        | `src/main/ipcMain/journal.ipc.ts`                            | 7 个 IPC handler 注册                                                                                                  |
| API        | `src/main/core/apis/journal.api.ts`                          | 7 个异步函数，包装为 ApiResponse                                                                                       |
| Service    | `src/main/core/services/journal.service.ts`                  | 单例服务，编排文件存储 + 索引表 + token 同步                                                                           |
| DAO        | `src/main/core/db/fileIndex.dao.ts`                          | file_index 表数据访问（Journal 复用，无独立 DAO）                                                                      |
| 类型       | `src/shared/types/journal.types.ts`                          | JournalFileInfo / JournalFileCreate / JournalFileUpdate / JournalFileQuery                                             |

### 6.3 数据模型

Journal 没有独立的数据库表，复用 `file_index` 表作为文件索引，`semantic_chunks` 表存储语义块。

**file_index 表**（日志文件索引）

| 字段                    | 类型        | 说明                    |
| :---------------------- | :---------- | :---------------------- |
| id                      | TEXT PK     | UUID                    |
| file_path               | TEXT UNIQUE | `journal/2026-05-16.md` |
| file_hash               | TEXT        | 文件内容哈希            |
| file_size               | INTEGER     | 文件大小                |
| date                    | TEXT        | YYYY-MM-DD              |
| name                    | TEXT        | 文件名                  |
| last_synced             | TEXT        | 最后同步时间            |
| sync_status             | TEXT        | pending / synced        |
| created_at / updated_at | TEXT        | 时间戳                  |

**semantic_chunks 表**（语义块，chunk_type 默认 'journal'）

| 字段                      | 类型    | 说明                               |
| :------------------------ | :------ | :--------------------------------- |
| id                        | TEXT PK | UUID                               |
| file_id                   | TEXT FK | → file_index(id)                   |
| file_path                 | TEXT    | 冗余路径                           |
| start_line / end_line     | INTEGER | 行范围                             |
| content                   | TEXT    | 块文本内容                         |
| chunk_type                | TEXT    | 默认 'journal'                     |
| ai_summary                | TEXT    | AI 生成摘要                        |
| word_count                | INTEGER | 词数                               |
| temporal_score            | REAL    | 时间分数                           |
| last_smart_processed_at   | TEXT    | 「最后被任一智能任务触碰」的观测值 |
| last_summary_generated_at | TEXT    | 摘要阶段标记（增量选取）           |
| last_vectorized_at        | TEXT    | 向量化阶段标记（增量选取）         |
| last_concept_extracted_at | TEXT    | 概念抽取阶段标记                   |
| last_linked_at            | TEXT    | 语义链接阶段标记                   |
| status                    | TEXT    | active / deleted                   |

**关联表**：`semantic_links`（块间关联）、`concepts` / `concept_chunks`（概念）、`temporal_events`（时间事件）、`reflections` / `reflection_chunks`（反思）

**FTS5 全文索引**：`semantic_chunks_fts`（content + ai_summary）、`concepts_fts`、`topics_fts`、`projects_fts`

### 6.4 IPC 接口

| 通道                              | 参数                | 返回值                           | 说明                                      |
| :-------------------------------- | :------------------ | :------------------------------- | :---------------------------------------- |
| `journal:create`                  | `JournalFileCreate` | `ApiResponse<string>`            | 创建日志（写 md + 建索引）                |
| `journal:update`                  | `JournalFileUpdate` | `ApiResponse<boolean>`           | 更新日志（写 md + 更新索引 + 同步 token） |
| `journal:delete`                  | `Id`                | `ApiResponse<boolean>`           | 删除日志（删 md + 删索引）                |
| `journal:getRecentDays`           | `days?: number`     | `ApiResponse<JournalFileInfo[]>` | 获取最近 N 天日志（默认 3）               |
| `journal:checkTodayJournalExists` | `date?: string`     | `ApiResponse<boolean>`           | 检查今日日志是否存在                      |
| `journal:syncLocalFiles`          | —                   | `ApiResponse<number>`            | 扫描 journal/ 目录，同步缺失 .md 到索引表 |
| `journal:resetJournalTable`       | —                   | `ApiResponse<number>`            | 清空索引 + 语义块后重建                   |

### 6.5 状态管理

**Pinia Store（journal.store.ts）**

| State                    | 类型                | 说明             |
| :----------------------- | :------------------ | :--------------- |
| recentJournals           | `JournalFileInfo[]` | 最近日志列表     |
| loading                  | `boolean`           | 主加载状态       |
| loadingMore              | `boolean`           | 加载更多状态     |
| hasMore                  | `boolean`           | 是否还有更早日志 |
| errorCode / errorMessage | `string`            | 错误信息         |

**关键行为**：

- **乐观更新**：`updateContentLocally(id, content)` 先更新本地列表，`updateJournal()` 后台静默保存
- **无限滚动**：`loadMore(days)` 累加加载更早日志，去重合并到列表头部
- **自动初始化**：JournalView 挂载时检查今日日志，不存在则自动创建；同时 `syncLocalFiles()` 同步外部修改的 .md 文件

### 6.6 AI 处理流水线

Journal 内容的 AI 处理通过后台任务队列异步执行，不影响用户编辑体验。

**任务 DAG（chunk 级 6 步 + 页级 2 步）**

```
chunk-summary → chunk-vectorize → semantic-link → concept-extract → topic-detection → topic-summary
                        └──────► page-summary → page-vectorize
```

| 步骤            | 任务类型        | 说明                                              |
| :-------------- | :-------------- | :------------------------------------------------ |
| chunk-summary   | `SUMMARY`       | 语义块 AI 摘要                                    |
| chunk-vectorize | —               | 生成 embedding 向量存入 LanceDB                   |
| semantic-link   | —               | 语义相似度匹配，建立 semantic_links               |
| concept-extract | —               | 提取概念实体，更新 concepts + concept_chunks      |
| topic-detection | —               | 主题检测与聚类                                    |
| topic-summary   | `TOPIC_SUMMARY` | 主题命名与摘要生成                                |
| page-summary    | `SUMMARY`       | 聚合各块摘要生成整页摘要（`pages.ai_summary`）    |
| page-vectorize  | —               | 页级向量写入 LanceDB `pages_embeddings`（粗召回） |

**调度架构**：

- `TaskDao` + `task-queue.ts`：基于 SQLite 的持久化任务队列，支持优先级、分组、依赖
- `task-executor.ts`：多 worker 并发执行，空闲超时 5s
- `task-dag.ts`：定义 8 个任务（chunk 级 6 + 页级 2）的拓扑排序
- `ai.service.ts`：LLM Gateway 封装，5 并发控制，按任务类型路由到本地/云端模型

**行内 token 同步**：文件更新时 `inlineTokenSyncService` 提取 `#标签`、`@人物` token，建立维度索引。

### 6.7 编辑器集成

Journal 内嵌 TiptapEditor，继承编辑器全部能力（详见 [editor-features.md](editor-features.md)）：

| 能力       | 编辑器扩展                  | Journal 中的表现                           |
| :--------- | :-------------------------- | :----------------------------------------- | ---------- |
| Slash 命令 | SlashMenu + 4 类命令组      | 输入 `/` 唤起模板/基础块/日期时间/指标卡片 |
| 任务项     | WrispTaskItem + marked 桥接 | `- [ ]`/`- [x]` 勾选，日期 chip            |
| 内联语义   | inline-semantic-decoration  | `[[双链]]`、`#标签`、`@人物` 药丸渲染      |
| @提及建议  | inline-semantic-suggest     | `@` 触发人物搜索，`#` 触发标签搜索         |
| 提示块     | Admonition                  | `:::note`/`:::tip`/`:::warning` 等         |
| 图片       | Image + ImageBubbleMenu     | 粘贴/拖拽图片，缩放 + 对齐                 |
| 拖拽排序   | DragReorder                 | 块级拖拽，DropLine 落点指示                |
| 数学公式   | Mathematics                 | `$...$` 行内、`$$...$$` 块级，KaTeX 渲染   |
| 表格       | WrispTable                  | GFM 管道表格，`                            | ` 转义修复 |
| 代码块     | CodeBlockLowlight           | 37 语言语法高亮                            |

### 6.8 实现状态总览

| 功能           | 设计编号 | 实现状态    | 说明                                               |
| :------------- | :------- | :---------- | :------------------------------------------------- |
| 每日日志页     | J-01     | ✅ 已实现   | JournalView + 自动创建今日日志                     |
| Block 行内编辑 | J-02     | ✅ 已实现   | TiptapEditor + JournalBlock                        |
| 大纲层级       | J-03     | ✅ 已实现   | Tiptap 内置列表缩进                                |
| Markdown 语法  | J-04     | ✅ 已实现   | Tipt(StarterKit + 自定义扩展)                      |
| 图片块         | J-05     | ✅ 已实现   | Image 扩展 + attachment IPC                        |
| 标签 `#`       | J-08     | ✅ 已实现   | inline-semantic-decoration 药丸渲染                |
| 双链 `[[]]`    | J-09     | ✅ 已实现   | inline-semantic-decoration 药丸渲染                |
| TODO 状态      | J-10     | ⚠️ 部分实现 | 二态 `- [ ]`/`- [x]`，5 态循环未实现               |
| @提及人员      | J-13     | ✅ 已实现   | inline-semantic-suggest + Electron API 查询        |
| 全局搜索       | J-22     | ⚠️ 部分实现 | FTS5 表已建，搜索服务为 TODO 占位                  |
| 语义块聚合     | J-29     | ⚠️ 部分实现 | semantic_chunks 表已建，视觉聚合未实现             |
| AI 自动整理    | —        | ⚠️ 部分实现 | 任务 DAG 已定义，调度器已实现，具体 handler 待接入 |
| 日历导航       | J-18     | ❌ 未实现   | —                                                  |
| 语音输入       | J-11     | ❌ 未实现   | —                                                  |
| 截图 OCR       | J-12     | ❌ 未实现   | —                                                  |
| 决策块         | J-14     | ❌ 未实现   | —                                                  |
| 数据指标块     | J-15     | ⚠️ 部分实现 | 编辑器有 metric 卡片块，无独立索引表               |
| 引用历史 Block | J-16     | ❌ 未实现   | —                                                  |
| 块模板         | J-17     | ✅ 已实现   | Slash 命令 + 职业模板系统                          |
| 日期范围筛选   | J-19     | ❌ 未实现   | —                                                  |
| 标签/主题筛选  | J-20     | ❌ 未实现   | —                                                  |

---

**文档来源**: 整合自 [prd.md](prd.md) §3.1 核心设计 + PM 场景扩展需求 + 项目代码调研
**相关文档**: [editor-features.md](editor-features.md) | [wiki-features.md](wiki-features.md) | [project-features.md](project-features.md) | [reflection-features.md](reflection-features.md) | [sqlite.md](../architecture/storage/sqlite.md)
