# Wrisp 产品需求文档（PRD）

> 本文档为产品需求整体概述，各模块详细功能设计见独立功能文档。

---

## 一、产品概述

**产品名称**：Wrisp

**产品定位**：以 Markdown 文件为数据源，以 AI 为智能索引的认知工作台

**一句话描述**：让碎片知识自动结晶为体系，在创作中自然调用，在思考中持续演化。

**核心理念**：

#### 技术理念

| 理念                 | 说明                                                          |
| :------------------- | :------------------------------------------------------------ |
| **File First**       | Markdown 文件是真实数据源，用户拥有完整控制权                 |
| **AI Native**        | AI 不是插件，而是工作流本身——嵌入记录、整理、推演、创作全流程 |
| **Local First**      | 数据完全本地可控，隐私安全，离线可用                          |
| **Flow → Structure** | 日志流自然输入，知识体系自动生长                              |

#### 产品价值观

> 对齐 README，描述产品对用户的核心价值承诺。

| 原则 | 说明 |
|------|------|
| **AI 辅助，而非替代** | AI 提出关联建议、聚类候选、召回素材，用户确认或拒绝。知识进入大脑，而非只存在电脑里 |
| **Block First** | 最小单位是 Block，不是文档。碎片输入零组织压力，回车即存 |
| **决策可追溯** | 每个需求、每次砍需、每个方案选择的背后依据，通过语义链接随时召回 |
| **自动结晶** | 碎片输入自动聚类为主题，随时间累积成知识体系 |
| **反思流** | 持续发现思维模式与决策矛盾，做你思考的"辅助大脑" |

#### 功能模块与目标映射

> 对齐 README 的四大功能模块，与三大核心目标的对应关系：

| 功能模块 | 说明 | 对应目标 | 详细文档 |
|----------|------|----------|----------|
| **Journal 日志输入** | 碎片想法、会议纪要、竞品观察统一以 Block 形式零组织成本输入 | 目标1：自动整理 | [journal-features.md](journal-features.md) |
| **Wiki 智能整理** | AI 自动建立语义链接、聚类主题、可视化概念网络 | 目标1：自动整理 | [wiki-features.md](wiki-features.md) |
| **Project 结构化输出** | 撰写 PRD、报告、文章时，AI 召回历史素材，从组装开始 | 目标2：高质量创作 | [project-features.md](project-features.md) |
| **Reflection 反思流** | 自动发现思维模式、决策矛盾与兴趣漂移 | 目标3：自动推演 | [reflection-features.md](reflection-features.md) |

**用户核心交互**：记录 → 整理 → 推演 → 创作。用户只做这些事，其余由 AI 自动完成。

---

## 二、核心交互流程

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│   记录    │  →   │   整理   │  →   │   推演    │  →   │   创作   │
│  Record  │      │ Organize │      │  Evolve  │      │  Create  │
└────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                 │                 │
  Journal 视图    语义拆分 + 向量化     时间线追踪         项目作品编辑器
                  语义链接 + 概念      反思洞察           AI Skills
  .md 文件持久化      主题聚类          知识缺口识别       语义检索引用
     │                 │                 │                 │
     └─────────────────── AI 自动衔接 ──────────────────────┘
```

### 2.1 用户记录 Journal

用户打开应用，进入今日日志页，直接在页面中编辑 Markdown 内容。每条文本为一个块（Block），内容自动写入 `journal/YYYY-MM-DD.md` 文件。

AI 在后台自动处理：语义拆分 → 生成 embedding 向量 → 与历史语义块进行语义相似度匹配 → 建立语义链接 → 更新 FTS5 全文索引 → 更新概念演化摘要。

> 详细功能设计见 [journal-features.md](journal-features.md)。

### 2.2 AI 整理

AI 自动从用户所有语义块中提取概念实体，建立概念网络。当某个概念簇积累足够多的语义块时，AI 自动触发主题聚类，生成主题建议推送给用户确认。

用户可浏览 AI 自动生成的概念网络和主题聚类。

> 详细功能设计见 [wiki-features.md](wiki-features.md)。

### 2.3 AI 推演

基于长期积累的语义块数据，AI 自动追踪时间层记录，更新概念演化摘要，进行模式发现和周期性分析。

推演结果以反思（Reflection）形式主动推送给用户，帮助发现思维模式、观点矛盾、知识缺口和兴趣漂移。

> 详细功能设计见 [reflection-features.md](reflection-features.md)。

### 2.4 创作

用户选择一个主题或手动创建项目，设定目标结构，AI 辅助填充内容，最终导出结构化作品。

创作层与 Journal/Wiki 的核心区别：有明确的目标和结构。

```
Journal：自由输入，无结构约束
   ↓
Wiki：AI 自动发现结构（概念、主题）
   ↓
Project：用户定义结构，AI 辅助填充
```

> 详细功能设计见 [project-features.md](project-features.md)。

---

## 三、功能模块总览

| 模块 | 核心职责 | Phase | 详细文档 |
|------|----------|-------|----------|
| **Journal** | 碎片知识零组织成本输入，Block 编辑，AI 后台语义处理 | Phase 1 | [journal-features.md](journal-features.md) |
| **Wiki** | 概念网络可视化 + 主题聚类管理，知识自动结晶 | Phase 1 | [wiki-features.md](wiki-features.md) |
| **Project** | 结构化创作工作台，AI 大纲生成 + 续写 + 上下文召回 | Phase 1 | [project-features.md](project-features.md) |
| **Reflection** | 反思流：模式发现、矛盾检测、知识缺口、创作启发 | Phase 2 | [reflection-features.md](reflection-features.md) |
| **Settings** | 首次启动引导、模型管理、API 配置、升级 | Phase 1 | [settings-features.md](settings-features.md) |

---

## 四、数据流转全景

```
用户编辑 journal/YYYY-MM-DD.md
    │
    ▼
┌─────────────────────────────────────────────────┐
│                  Journal 层                      │
│                                                 │
│  文件变更检测 ← Markdown 文件保存               │
│                      │                          │
│                      ▼                          │
│  AI 语义拆分 → Embedding → FTS5 索引            │
│                      │                          │
└──────────────────────┼──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│                  整理层                          │
│                                                 │
│  Concept 提取 ← 语义块聚类                       │
│       │                                         │
│       ▼                                         │
│  Concept 演化（evolving_summary 更新）            │
│       │                                         │
│       ▼                                         │
│  Topic 聚类（高频概念簇 → 主题建议）              │
│       │                                         │
│       ▼                                         │
│  Reflection 生成（模式/矛盾/演化检测）  ← Phase 2│
│                                                 │
└──────────────────────┼──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│                  创造层                          │
│                                                 │
│  选择 Topic → 创建 Project（projects/ 目录）      │
│       │                                         │
│       ▼                                         │
│  AI 生成大纲（召回关联语义块）                    │
│       │                                         │
│       ▼                                         │
│  分章节编辑（AI 续写 / 润色 / 上下文召回）        │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 五、Phase 1 功能范围

> 完整版本路线图详见 [roadmap.md](../product/roadmap.md)。本节为 Phase 1（V0.1.0 ~ V1.0.0）功能范围摘要，详细设计见各模块功能文档。

### 5.1 功能摘要

| 模块 | P0 功能 | 详细文档 |
|------|---------|----------|
| **Journal** | 每日日志页、Block 编辑、语义拆分、标签/双链、全文搜索、输入模板、@提及、日历导航 | [journal-features.md](journal-features.md) §五 |
| **Wiki** | 自动语义链接、概念提取与列表、概念详情、主题聚类生成、主题编辑/删除 | [wiki-features.md](wiki-features.md) §三 |
| **Project** | 创建项目+关联主题、AI 生成大纲、分章节编辑+AI 上下文面板、AI 续写/润色、语义检索引用 | [project-features.md](project-features.md) §六 |
| **Settings** | 本地模型管理、云端 API 配置、模型切换、首次启动欢迎页、设置页面、Electron 打包 | [settings-features.md](settings-features.md) §四 |

### 5.2 不做（Phase 1 范围外）

- 反思流 / 目标3 相关功能（Phase 2）→ 见 [reflection-features.md](reflection-features.md)
- 跨设备同步（Pro 功能，Phase 2）
- 概念网络可视化（力导向图，Phase 1 后期 P1）
- 团队协作
- 插件系统
- 移动端 App
- 多模态输入（图片、PDF 解析）
- 多格式导出（PDF / HTML / Word，Phase 3）

---

## 六、与竞品的交互对比

| 交互维度     | Obsidian                   | Notion                   | Logseq                | **Wrisp**                                   |
| :----------- | :------------------------- | :----------------------- | :-------------------- | :------------------------------------------ |
| **记录入口** | 新建文件 → 命名 → 选择位置 | 新建页面 → 选择 Database | 每日 Journal 自动打开 | **Markdown 文件编辑模式**                   |
| **组织方式** | 文件夹 + 双链（手动）      | Database + 属性（手动）  | 大纲 + 双链（手动）   | **AI 自动语义链接 + 概念提取**              |
| **知识发现** | 图谱（手动链接）           | 无                       | 图谱（手动链接）      | **AI 主动推送：概念网络 + 主题聚类 + 反思** |
| **创作输出** | 手动写作                   | 手动写作 + 有限 AI       | 手动写作              | **AI 辅助：大纲生成 + 上下文召回 + 续写**   |
| **学习曲线** | 陡峭（需学双链语法）       | 中等（需学 Database）    | 中等（需学大纲语法）  | **极低（输入即可，AI 处理其余）**           |

---

## 七、附录：参考文档

### 功能文档

| 文档 | 说明 |
|------|------|
| [journal-features.md](journal-features.md) | Journal 模块功能设计（核心设计 + PM 场景扩展） |
| [wiki-features.md](wiki-features.md) | Wiki 模块功能设计（概念网络 + 主题聚类） |
| [project-features.md](project-features.md) | Project 模块功能设计（结构化创作工作台） |
| [reflection-features.md](reflection-features.md) | Reflection 模块功能设计（反思流） |
| [settings-features.md](settings-features.md) | 基础功能设计（设置、引导、升级） |

### 其他文档

| 文档 | 说明 |
|------|------|
| [mrd.md](../product/mrd.md) | 产品战略文档（市场、用户、竞争、需求优先级） |
| [roadmap.md](../product/roadmap.md) | 版本路线图（4 Phase 框架） |
| [tech.md](../architecture/tech.md) | 技术方案总览（架构、前端、主进程、AI 层、存储层） |
| [model.md](../architecture/model/model.md) | AI 模型方案（硬件配置、模型列表、路由设计） |
| [storage.md](../architecture/storage/storage.md) | 存储方案总览（文件优先架构、三层数据模型） |
| [sqlite.md](../architecture/storage/sqlite.md) | SQLite 表结构设计 |
| [lancedb.md](../architecture/storage/lancedb.md) | LanceDB 向量数据库设计 |
| [userData.md](../architecture/storage/userData.md) | 用户数据目录结构（应用数据 + 工作空间） |
| [app.md](../architecture/config/app.md) | 应用配置文档（数据结构、默认值、管理方式） |
| [config-model.md](../architecture/config/model.md) | 模型配置文档（数据结构、API、Store） |
| [ui-design.md](../ui/ui-design.md) | UI 概要设计文档 |

### 用户研究

| 文档 | 说明 |
|------|------|
| [product-manager.md](../user-research/product-manager.md) | 产品经理（PM）使用场景与能力映射 |
