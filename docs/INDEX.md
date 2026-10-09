# Wrisp 文档目录索引

> 本文件是 `docs/` 目录的完整文件清单与说明。
> **维护规则**：每次新增或修改 `docs/` 下的文件时，须同步更新本索引。
> 维护规则已写入 [AGENTS.md](../AGENTS.md) §文档管理。

---

## 目录结构总览

```
docs/
├── INDEX.md                      # 本文件 — 文档目录索引
├── architecture/                 # 技术设计
│   ├── tech.md                   # 技术方案总览
│   ├── structure.md              # 项目结构与代码架构
│   ├── agent-architecture.md     # Agent 架构设计
│   ├── config/                   # 应用配置设计
│   │   ├── app.md                # 应用配置（数据结构、默认值）
│   │   └── model.md              # 模型配置（数据结构、API、Store）
│   ├── model/                    # AI 模型方案
│   │   └── model.md              # 硬件配置、模型列表、路由设计
│   └── storage/                  # 存储方案
│       ├── storage.md            # 存储方案总览（文件优先架构）
│       ├── sqlite.md             # SQLite 表结构设计
│       ├── lancedb.md            # LanceDB 向量数据库设计
│       └── userData.md           # 用户数据目录结构
├── features/                     # 功能设计
│   ├── prd.md                    # 产品功能设计文档（概述）
│   ├── journal-features.md       # Journal 模块功能设计
│   ├── wiki-features.md          # Wiki 模块功能设计
│   ├── project-features.md       # Project 模块功能设计
│   ├── reflection-features.md    # Reflection 模块功能设计
│   ├── settings-features.md      # 基础功能设计（设置、引导、升级）
│   ├── search-features.md        # 全局搜索功能设计
│   ├── editor-features.md        # 编辑器功能文档
│   ├── template-marketplace.md   # 模板市场设计
│   └── TEMPLATE.md               # features/ 文档写作模板
├── product/                      # 产品策略
│   ├── mrd.md                    # 市场需求文档（MRD）·产品分析重组版
│   ├── mrd-visual.html           # MRD 可视化总览（单文件 HTML，研报式信息图）
│   ├── product-positioning-map.html  # 产品定位图（本地优先×AI自动整理）
│   ├── capability-roadmap.html       # 能力路线图（三阶段+证据门）
│   ├── roadmap.md                # 版本路线图（4 Phase 框架）
│   ├── phase1-free-mvp.md        # Phase 1：免费 MVP 详细设计
│   ├── phase2-pro-core.md        # Phase 2：Pro 核心功能详细设计
│   ├── phase3-platform.md        # Phase 3：平台生态详细设计
│   └── phase4-team.md            # Phase 4：团队版详细设计
├── user-research/                # 用户研究
│   └── product-manager.md        # 产品经理（PM）使用场景与能力映射
├── guides/                       # 使用指南
│   ├── change-log.md             # 变更日志
│   └── testing-guide.md          # 测试指南
├── ui/                           # UI 设计
│   ├── ui-design.md              # UI 概要设计文档
│   ├── ui.pen                    # UI 设计源文件
│   ├── image.png                 # 设计配图
│   └── pentip.png                # 提示块（admonition）视觉参考
├── decisions/                    # 决策记录（待填充）
├── discussions/                  # 讨论记录（待填充）
└── superpowers/                  # 开发计划与技术规格
    ├── plans/                    # 开发计划（按日期命名）
    ├── reviews/                  # 评审记录
    └── specs/                    # 技术规格设计
```

---

## 文件清单

### architecture/ — 技术设计

| 文件 | 说明 |
|------|------|
| `tech.md` | 技术方案总览：架构、前端、主进程、AI 认知层、存储层、调度器 |
| `structure.md` | 项目结构与代码架构：三源根、IPC 四层模式、DAO 模式 |
| `agent-architecture.md` | Agent 架构设计：三层渐进加载模型 |
| `config/app.md` | 应用配置：数据结构、默认值、管理方式、持久化路径 |
| `config/model.md` | 模型配置：数据结构、API、Store |
| `model/model.md` | AI 模型方案：硬件配置、模型列表、路由设计、加载策略 |
| `storage/storage.md` | 存储方案总览：文件优先架构、三层数据模型 |
| `storage/sqlite.md` | SQLite 表结构设计（22 张表） |
| `storage/lancedb.md` | LanceDB 向量数据库设计（chunk 级 + 页级向量表） |
| `storage/userData.md` | 用户数据目录结构：应用数据 + 工作空间 |

### features/ — 功能设计

| 文件 | 说明 |
|------|------|
| `prd.md` | 产品功能设计文档（概述）：产品定位、交互流程、模块总览、Phase 1 范围 |
| `journal-features.md` | Journal 模块：每日日志页、块编辑、TODO 周期、AI 增强、PM 场景扩展、技术实现（架构/数据模型/IPC/状态管理/AI 流水线/编辑器集成/实现状态） |
| `wiki-features.md` | Wiki 模块：概览页（知识统计+Top10）、概念页（卡片+网络视图）、主题页（卡片视图）、智能整理、技术实现 |
| `project-features.md` | Project 模块：结构化创作工作台、项目类型、创建流程、AI 辅助 |
| `reflection-features.md` | Reflection 模块：6 类 14 种反思、数据模型、UI 呈现、生成频率 |
| `settings-features.md` | 基础功能：首次引导、设置面板、升级机制 |
| `search-features.md` | 全局搜索：交互设计、搜索策略（向量优先+FTS5兜底）、FTS5 索引、向量搜索、素材搜索、实现状态 |
| `editor-features.md` | 编辑器功能文档：架构、11 个扩展、菜单、Slash 命令、自定义数据块 |
| `template-marketplace.md` | 模板市场设计：模板类型、分发、同步 |
| `TEMPLATE.md` | `features/` 下模块功能文档的写作模板（配合命名规范 `<module>-features.md`） |

### product/ — 产品策略

| 文件 | 说明 |
|------|------|
| `mrd.md` | 市场需求文档（MRD）·产品分析重组版：执行摘要、问题与机会、竞争机制对比、三阶段路线图、商业模式、成功指标与验证计划、风险假设、结论取舍、证据底稿（F-ID） |
| `mrd-visual.html` | MRD 可视化总览（单文件 HTML）：执行摘要、市场机会、定位图、竞争格局、三阶段路线图、商业模式、验证与风险、关键证据（配合 MRD 全篇） |
| `product-positioning-map.html` | 产品定位图（单文件 HTML）：整理自动化 × 数据控制两轴，定位 Wrisp 与竞品（配合 MRD §5.5） |
| `capability-roadmap.html` | 能力路线图（单文件 HTML）：用户问题 → 核心能力 → 三阶段结果与证据门（配合 MRD §7.5） |
| `roadmap.md` | 版本路线图：4 Phase 框架概述 |
| `phase1-free-mvp.md` | Phase 1：免费 MVP — 模板市场 + 核心功能闭环 |
| `phase2-pro-core.md` | Phase 2：Pro 核心功能 — 反思流 + 创作增强 |
| `phase3-platform.md` | Phase 3：平台生态 — 插件系统 + 多格式导出 |
| `phase4-team.md` | Phase 4：团队版 — 协作 + 共享 |

### user-research/ — 用户研究

| 文件 | 说明 |
|------|------|
| `product-manager.md` | 产品经理（PM）使用场景：工作流抽象、6 大场景、12 类输出文档、能力映射 |

### guides/ — 使用指南

| 文件 | 说明 |
|------|------|
| `change-log.md` | 变更日志 |
| `testing-guide.md` | 测试指南 |

### ui/ — UI 设计

| 文件 | 说明 |
|------|------|
| `ui-design.md` | UI 概要设计文档 |
| `ui.pen` | UI 设计源文件（矢量稿，非文档） |
| `image.png` / `pentip.png` | 设计配图与提示块视觉参考（资源文件，`ui-design.md` 未内嵌引用） |

### superpowers/ — 开发计划与技术规格

| 子目录 | 说明 |
|--------|------|
| `plans/` | 开发计划（按日期命名，如 `2026-09-11-creation-session-and-gate.md`） |
| `reviews/` | 评审记录（如独立评审 brief 和 findings） |
| `specs/` | 技术规格设计（如 admonition block、drag reorder、creation agent） |

**待迭代 backlog**

| 文件 | 说明 |
|------|------|
| `plans/2026-10-06-chunk-splitting-followups.md` | 语义块四层切分（L1~L4）**未实现部分清单**：L4 延迟分块、L3 算法与阈值校准、切分层落库、存量重切入口、优先级建议（§3.1 摘要复用与 §3.3 检索去重已标注完成） |
| `plans/2026-10-06-chunk-splitting-optimization-plan.md` | 上条清单的**可执行优化方案**：迭代 0~8 的问题定位、改动文件与代码骨架、验收标准、风险回滚与落地节奏。迭代 0（集成测试 ABI）、迭代 1（写路径 upsert 化 + FTS 批量重建）、迭代 7.3/7.5/7.6/7.7（检索重叠块去重、按 rerank 相关性排序、Journal 重置的孤儿向量清理、接上入参 `limit`）**已于 2026-10-06 落地**，各节标注实测验收与与方案的出入，附录给出改动落点 |

**设计与规格（specs/）**

| 文件 | 说明 |
|------|------|
| `specs/2026-10-05-local-ai-parallel-and-routing-design.md` | 本地三类模型并行化（每 family 独立 worker、执行器有界并发、真批量推理）+ LLM 云端优先路由与按任务类型覆盖 + 跨 family 求和内存门控 |
| `plans/2026-10-05-local-ai-parallel-and-routing.md` | 上条设计的落地计划 |
| `specs/2026-10-06-smart-organize-quality-and-cpu-design.md` | **智能整理质量与资源治理**：概念抽取重设计（原文窗口输入 + 结构化输出 + 归一化/UNIQUE/upsert + 概念向量两级对齐）、新增 `concept-evolution` 任务实现按时间线递进的演化摘要与时间线、主题真实聚类与幂等、语义连接 CPU 两步治理（软调参 → 硬限 ONNX 线程）、增量标记与失败自愈、进度加权与增量可见。含 9 个迭代的落地顺序、AC1~AC9 验收、测试计划与风险回滚 |
| `specs/2026-10-09-journal-entry-based-design.md` | **Journal 条目化改造**：日志最小单元从"整日文档"改为 `journal_entries` 条目（SQLite 真源，`.md` 降级为带 `**HH:mm**` 条目头 + `wrisp:entry` 注释元数据的确定性渲染产物，封闭转义规则 + `journal:importDayFile` 按 id upsert 显式导入往返），块经 `entry_id` 锚回条目、每条目跑三层切分器，`#标签`（复用 `tagged_items`）/`&作品`（新表 `journal_entry_projects`）/`@人物` 在 composer 底部提示区解析并落关联表；schema 0.7.0 纯 DDL 迁移、不迁存量数据，同步字段（id/source/occurred_at/updated_at/软删）预留但不接网络。含 IPC 清单、UI 组件拆分、测试策略、影响文件清单与风险对策 |
| `plans/2026-10-09-journal-entry-based.md` | 上条设计的落地计划：10 个 TDD 任务（T1 schema 0.7.0 → T2 共享契约 → T3 DAO → T4 渲染/解析纯模块 → T5 条目化切分管线 → T6 服务+IPC → T7 作品名查询 → T8 renderer store → T9 UI 组件与 i18n → T10 旧通道清理+两步启动验证），含每任务测试代码骨架、接口签名、提交信息自检 |

---

## 目录职责约定

| 目录 | 职责 | 命名规范 |
|------|------|----------|
| `architecture/` | 技术设计文档 | 按技术领域命名 |
| `features/` | 功能设计文档（聚焦功能描述） | `<module>-features.md` |
| `product/` | 产品策略与规划文档 | 按文档类型命名 |
| `user-research/` | 用户研究文档（按用户类型） | `<user-type>.md` |
| `guides/` | 使用指南与操作手册 | 按指南类型命名 |
| `ui/` | UI 设计文档 | 按设计领域命名 |
| `decisions/` | 决策记录（ADR） | `YYYY-MM-DD-<topic>.md` |
| `discussions/` | 讨论记录 | `YYYY-MM-DD-<topic>.md` |
| `superpowers/` | 开发计划与技术规格 | `plans/reviews/specs/` 下按日期命名 |