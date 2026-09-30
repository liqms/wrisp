# Docs 目录重组报告

> 生成时间：2026-09-20
> 操作范围：`D:\Code\Github\Wrisp\docs\`

---

## 一、重组目标

对 docs 目录下 48 个文件进行合理分类和内容组织，解决以下结构问题：

1. 根级 4 个文件未归入子目录
2. `plan/` 目录混合了产品规划、技术架构、重构计划、功能方案四类不同文档
3. `writer/` 命名不清晰，实际内容为功能需求文档
4. `editor/` 仅含 1 个文件，可合并至 `features/`
5. 文件间交叉引用存在失效路径（绝对路径指向旧仓库 `GitCode/Wrisp`）

---

## 二、分类方案

| 新目录          | 用途             | 文件数 | 来源                                                                     |
| --------------- | ---------------- | ------ | ------------------------------------------------------------------------ |
| `guides/`       | 开发指南         | 3      | 根级 SOP.md, testing-guide.md, change-log.md                             |
| `architecture/` | 架构与技术设计   | 4      | 根级 agent-architecture.md + plan/ 下 tech.md, structure.md, refactor.md |
| `product/`      | 产品规划         | 4      | plan/ 下 mrd.md, prd.md, mvp.md, plan.md(→roadmap.md)                    |
| `features/`     | 功能规格与需求   | 5      | 原有 TEMPLATE.md + plan/ 下 template-marketplace.md + editor/ + writer/  |
| `config/`       | 配置文档         | 2      | 不动                                                                     |
| `model/`        | AI 模型方案      | 1      | 不动                                                                     |
| `storage/`      | 存储设计         | 4      | 不动                                                                     |
| `ui/`           | UI 设计          | 4      | 不动（含图片和 .pen 文件）                                               |
| `superpowers/`  | Agent 工作记录   | 24     | 不动（plans/18 + reviews/2 + specs/4）                                   |
| `decisions/`    | 决策记录（预留） | 0      | 不动（空目录）                                                           |
| `discussions/`  | 讨论记录（预留） | 0      | 不动（空目录）                                                           |

---

## 三、文件移动清单

### 3.1 根级文件 → guides/ 和 architecture/

| 原路径                       | 新路径                                    |
| ---------------------------- | ----------------------------------------- |
| `docs/SOP.md`                | `docs/guides/sop.md`                      |
| `docs/testing-guide.md`      | `docs/guides/testing-guide.md`            |
| `docs/change-log.md`         | `docs/guides/change-log.md`               |
| `docs/agent-architecture.md` | `docs/architecture/agent-architecture.md` |

### 3.2 plan/ 拆分 → architecture/、product/、features/

| 原路径                              | 新路径                                  | 说明                   |
| ----------------------------------- | --------------------------------------- | ---------------------- |
| `docs/plan/tech.md`                 | `docs/architecture/tech.md`             | 技术方案 v5            |
| `docs/plan/structure.md`            | `docs/architecture/structure.md`        | 项目结构 v2.0          |
| `docs/plan/refactor.md`             | `docs/architecture/refactor.md`         | 重构计划               |
| `docs/plan/mrd.md`                  | `docs/product/mrd.md`                   | 产品战略文档           |
| `docs/plan/prd.md`                  | `docs/product/prd.md`                   | 产品功能设计文档       |
| `docs/plan/mvp.md`                  | `docs/product/mvp.md`                   | MVP Sprint 计划        |
| `docs/plan/plan.md`                 | `docs/product/roadmap.md`               | 重命名：版本里程碑计划 |
| `docs/plan/template-marketplace.md` | `docs/features/template-marketplace.md` | 模板市场方案           |

### 3.3 editor/ 和 writer/ → features/

| 原路径                            | 新路径                              |
| --------------------------------- | ----------------------------------- |
| `docs/editor/custom-blocks.md`    | `docs/features/custom-blocks.md`    |
| `docs/writer/journal-features.md` | `docs/features/journal-features.md` |
| `docs/writer/product-manager.md`  | `docs/features/product-manager.md`  |

### 3.4 已删除的空目录

- `docs/plan/`
- `docs/editor/`
- `docs/writer/`

---

## 四、交叉引用更新

共更新 4 个文件中的 14 处引用：

### 4.1 `docs/product/prd.md`（9 处）

| 原引用                  | 新引用                      | 说明               |
| ----------------------- | --------------------------- | ------------------ |
| `(plan/mrd.md)`         | `(mrd.md)`                  | 同目录             |
| `(plan/mvp.md)`         | `(mvp.md)`                  | 同目录             |
| `(plan/tech.md)`        | `(../architecture/tech.md)` | 跨目录             |
| `(model/model.md)`      | `(../model/model.md)`       | 修正为正确相对路径 |
| `(storage/storage.md)`  | `(../storage/storage.md)`   | 修正为正确相对路径 |
| `(storage/sqlite.md)`   | `(../storage/sqlite.md)`    | 修正为正确相对路径 |
| `(storage/lancedb.md)`  | `(../storage/lancedb.md)`   | 修正为正确相对路径 |
| `(storage/userData.md)` | `(../storage/userData.md)`  | 修正为正确相对路径 |
| `(ui/ui-design.md)`     | `(../ui/ui-design.md)`      | 修正为正确相对路径 |

### 4.2 `docs/architecture/refactor.md`（1 处）

| 原引用      | 新引用                    |
| ----------- | ------------------------- |
| `(plan.md)` | `(../product/roadmap.md)` |

### 4.3 `docs/architecture/tech.md`（3 处）

| 原引用     | 新引用                |
| ---------- | --------------------- |
| `(prd.md)` | `(../product/prd.md)` |
| `(mrd.md)` | `(../product/mrd.md)` |
| `(mvp.md)` | `(../product/mvp.md)` |

### 4.4 `docs/features/journal-features.md`（2 处）

| 原引用                                                         | 新引用                 | 说明                            |
| -------------------------------------------------------------- | ---------------------- | ------------------------------- |
| `file:///d:/Code/GitCode/Wrisp/docs/writer/product-manager.md` | `(product-manager.md)` | 修正失效绝对路径→同目录相对路径 |
| `file:///d:/Code/GitCode/Wrisp/docs/plan/prd.md`               | `(../product/prd.md)`  | 修正失效绝对路径→跨目录相对路径 |

---

## 五、未改动的目录

以下目录分类已合理，未做变动：

- `config/` — 应用配置与模型配置类型定义
- `model/` — AI 模型方案设计文档
- `storage/` — 存储架构设计（内部交叉引用自洽）
- `ui/` — UI 设计文档与素材
- `superpowers/` — Agent 工作记录（plans/reviews/specs 三级分类已合理）
- `decisions/` — 预留空目录
- `discussions/` — 预留空目录

---

## 六、验证结果

- ✅ `src/` 代码不引用 docs 路径，重组无副作用
- ✅ 无残留旧目录引用（`plan/`、`writer/`、`editor/`）
- ✅ 无失效绝对路径（`file:///d:/Code/GitCode/...`）
- ✅ 所有跨目录引用已更新为正确的相对路径
- ✅ `plan/plan.md` 重命名为 `product/roadmap.md`，语义更清晰

---

## 七、新目录结构

```
docs/
├── guides/                         # 开发指南
│   ├── sop.md                      # 工作流 SOP
│   ├── testing-guide.md            # 单元测试指南
│   └── change-log.md               # 更新记录
├── architecture/                   # 架构与技术设计
│   ├── tech.md                     # 技术方案 v5
│   ├── structure.md                # 项目结构 v2.0
│   ├── agent-architecture.md       # 智能体架构
│   └── refactor.md                 # 重构计划
├── product/                        # 产品规划
│   ├── mrd.md                      # 产品战略文档
│   ├── prd.md                      # 产品功能设计文档
│   ├── mvp.md                      # MVP Sprint 计划
│   └── roadmap.md                  # 版本里程碑计划
├── features/                       # 功能规格与需求
│   ├── TEMPLATE.md                 # Feature 规格模板
│   ├── custom-blocks.md            # 自定义块开发指南
│   ├── template-marketplace.md     # 模板市场方案
│   ├── journal-features.md         # Journal 功能需求
│   └── product-manager.md          # PM 使用场景
├── config/                         # 配置文档
│   ├── app.md                      # 应用配置
│   └── model.md                    # 模型配置
├── model/                          # AI 模型方案
│   └── model.md                    # AI 模型方案 v3.0
├── storage/                        # 存储设计
│   ├── storage.md                  # 存储方案 v2
│   ├── sqlite.md                   # SQLite 设计 v2
│   ├── lancedb.md                  # LanceDB 向量库设计
│   └── userData.md                 # 用户数据目录 v2
├── ui/                             # UI 设计
│   ├── ui-design.md                # UI 概要设计
│   ├── image.png                   # 设计素材
│   ├── Wrisp.png                  # 产品图标
│   └── ui.pen                      # Pen 设计文件
├── superpowers/                    # Agent 工作记录
│   ├── plans/                      # 18 个计划文档
│   ├── reviews/                    # 2 个评审文档
│   └── specs/                      # 4 个规格文档
├── decisions/.gitkeep              # 预留
├── discussions/.gitkeep            # 预留
└── docs-reorganization-report.md   # 本报告
```
