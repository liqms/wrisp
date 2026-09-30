# Wrisp 文档目录索引

> 本文件是 `docs/` 目录的完整文件清单与说明。
> **维护规则**：每次新增或修改 `docs/` 下的文件时，须同步更新本索引。
> 维护规则已写入 [AGENTS.md](../AGENTS.md) §文档管理。

---

## 目录结构总览

```
docs/
├── INDEX.md                      # 本文件 — 文档目录索引
├── docs-reorganization-report.md # 文档重组报告（历史记录）
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
├── product/                      # 产品策略
│   ├── mrd.md                    # 产品战略文档（市场、用户、竞争）
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
│   └── ui-design.md              # UI 概要设计文档
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
| `storage/lancedb.md` | LanceDB 向量数据库设计 |
| `storage/userData.md` | 用户数据目录结构：应用数据 + 工作空间 |

### features/ — 功能设计

| 文件 | 说明 |
|------|------|
| `prd.md` | 产品功能设计文档（概述）：产品定位、交互流程、模块总览、Phase 1 范围 |
| `journal-features.md` | Journal 模块：每日日志页、块编辑、TODO 周期、AI 增强、PM 场景扩展、技术实现（架构/数据模型/IPC/状态管理/AI 流水线/编辑器集成/实现状态） |
| `wiki-features.md` | Wiki 模块：概念网络（气泡图）、主题聚类、生命周期管理 |
| `project-features.md` | Project 模块：结构化创作工作台、项目类型、创建流程、AI 辅助 |
| `reflection-features.md` | Reflection 模块：6 类 14 种反思、数据模型、UI 呈现、生成频率 |
| `settings-features.md` | 基础功能：首次引导、设置面板、升级机制 |
| `search-features.md` | 全局搜索：交互设计、搜索策略（向量优先+FTS5兜底）、FTS5 索引、向量搜索、素材搜索、实现状态 |
| `editor-features.md` | 编辑器功能文档：架构、11 个扩展、菜单、Slash 命令、自定义数据块 |
| `template-marketplace.md` | 模板市场设计：模板类型、分发、同步 |

### product/ — 产品策略

| 文件 | 说明 |
|------|------|
| `mrd.md` | 产品战略文档：市场分析、用户画像、竞争格局、需求优先级、商业模式 |
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

### superpowers/ — 开发计划与技术规格

| 子目录 | 说明 |
|--------|------|
| `plans/` | 开发计划（按日期命名，如 `2026-09-11-creation-session-and-gate.md`） |
| `reviews/` | 评审记录（如独立评审 brief 和 findings） |
| `specs/` | 技术规格设计（如 admonition block、drag reorder、creation agent） |

### 根目录文件

| 文件 | 说明 |
|------|------|
| `docs-reorganization-report.md` | 文档重组报告（历史记录） |

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