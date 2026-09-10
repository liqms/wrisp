# Wrisp 创作智能体 — 设计文档

| 字段 | 值 |
|---|---|
| 日期 | 2026-09-10 |
| 状态 | 设计待评审 |
| 范围 | 创作智能体（Creation Agent）：场景化嵌入作品/页面创作流程 |
| 相关子系统 | skills、project-domain、vector、smart-tasks、task-queue、model-gateway、editor、i18n |

---

## 1. 背景与目标

### 1.1 终极目标（C：全流程创作助手）

从一句话需求到成稿：智能体自主规划、分步创作、自我检查。

### 1.2 第一版目标

把智能体**场景化嵌入现有创作流程**，而不是做一个独立的对话入口：

1. **新建作品**：用户发起 → 向导逐步问答 → 用户回答确认 → 完成新建作品 → **同步生成作品级 skill**（无确认门）。
2. **新建页面**：按页面模板新建 → 结合作品信息与模板骨架 → 引导用户输入本页内容概述 → 询问是否自动生成大纲 → 需要则生成大纲 → 据大纲生成内容。
3. **每一步创作都与用户互动确认**（确认门）。
4. **记录用户写作偏好**（跨作品，用户级）与**作品风格**（单作品，作品级）。
5. 用户可**委托自动审核**；委托后按用户写作偏好完成确认/放行。

### 1.3 非目标（第一版明确不做）

- 多智能体分工（编排器 + 专职 agent）。留作后续演进方向。
- 全自动无人创作（用户完全不出现在回路中）。
- 跨作品素材混用——**明确禁止**，素材检索强制按作品隔离。

---

## 2. 现状与缺口

### 2.1 现有能力

| 模块 | 现状 | 位置 |
|---|---|---|
| 作品 | `PROJECT_TYPE`（novel/series/book/research/product），存 `projects.type`；双存储（项目文件夹 + `projects` 表） | `src/shared/enums/project.enums.ts`、`src/main/core/services/project.service.ts` |
| 页面 | `pages` 表含 `project_id`、`page_type`、`metadata`（`JsonMetadata`） | `src/main/schemas/init.sql`、`src/shared/types/page.types.ts` |
| 页面模板 | `resources/page/*.json` + 工作区自定义模板；`TemplateResourceFile` 含 `profession[]`/`tags[]` | `src/main/core/services/template.service.ts` |
| 技能 | 全局 `resources/skills/*.skill.json` + 工作区 `skills/custom/`；`SkillDefinition` 含 `category/tags/input/promptTemplate/tools` | `src/main/core/skills/skill.manager.ts` |
| 技能执行 | L1（纯 prompt）/ L2（带 tools）；支持流式（仅 L1） | `src/main/core/skills/skill.executor.ts` |
| 工具注册表 | 仅注册 1 个工具 `search_blocks` | `src/main/core/skills/tool.registry.ts` |
| 向量 | LanceDB；`BlockEmbedding = { block_id, embedding }`（**无 project_id**）；`PageEmbedding = { page_id, project_id, embedding }`（**已有 project_id**） | `src/main/core/vector/lancedb.ts` |
| 语义/概念/主题 | `semantic_chunks`、`concepts`、`topics` 及关联表 `concept_chunks`/`topic_chunks`/**`project_chunks`**；后三者**均无 project_id** | `src/main/schemas/init.sql` |
| 智能任务 | DAG + executors（chunk-summary/chunk-vectorize/concept-extract/semantic-link/topic-detection/topic-summary） | `src/main/core/smart-tasks/` |
| 任务队列 | 持久化、3 worker、启动恢复 | `src/main/core/task-queue/` |

### 2.2 缺口

1. **技能是全局的**：`SkillManager` 只加载 `resources/skills/` + `skills/custom/`，没有作品作用域与模板作用域。
2. **作品/模板与技能无任何关联**：模板 schema 是 `additionalProperties: false`，没有承载"页面级 skill"的字段。
3. **检索不按作品过滤**：`chunkService.search(keyword, limit, searchType)` 无 `projectId`；`search_blocks` 工具无 `projectId`；块向量表无 `project_id` 列。
4. **概念/主题无 project_id**：按作品过滤只能经 `concept_chunks`/`topic_chunks` → `project_chunks` 关联。
5. **search IPC 未接线**：`registerSearchHandlers` 未在 `main/index.ts` 注册（项目已知坑 #4）。
6. **无创作会话/确认门/记忆机制**：无运行态会话、无 Gate、无偏好/风格存储。

---

## 3. 总体架构

采用**思路 1：编排骨架 + 单规划智能体**（多智能体作为后续演进）。

```
┌───────────────────────────────────────────────────────┐
│ 交互层 HITL                                             │
│  作品创建向导 · 页面创建向导 · 确认面板 · 编辑器内联入口      │
└───────────────────────┬───────────────────────────────┘
                        │ 确认·反馈·委托
┌───────────────────────▼───────────────────────────────┐
│ 编排层 Agent Core                                       │
│  创作会话(Session) · 规划器(Planner) · 阶段状态机           │
│  确认门(Gate) · 委托策略(Delegation)                      │
└───────┬───────────────────────────────┬───────────────┘
        │ 调用能力                        │ 读写记忆
┌───────▼───────────────────────┐  ┌────▼──────────────────┐
│ 能力层 Capabilities            │  │ 记忆层 Memory          │
│  全局技能（运行时 + 模板来源）    │  │  用户写作偏好（用户级）  │
│  作品技能（派生副本，可编辑）     │  │  作品风格 / brief       │
│  页面技能（模板声明）           │  │  大纲 / 结构           │
│  技能执行器 · 模型网关          │  │  语义检索(向量/概念/主题) │
│  工具注册表 · 审核器(Reviewer)  │  └───────────────────────┘
└───────┬───────────────────────┘
        │ 长任务 / 多步流水线 / 审计
┌───────▼───────────────────────────────────────────────┐
│ 执行与持久层                                             │
│  task-queue（持久化·可恢复） · smart-tasks(DAG) · 执行记录  │
└───────────────────────────────────────────────────────┘
```

**关键职责边界**：

- **编排层只决定"下一步做什么"，不产生内容**。内容一律由能力层的技能/模型产出——这样"全局技能持续运营迭代"才有意义。
- **确认门是编排层的强制关卡**：产出默认必须过 Gate；放行者可以是用户本人或被委托的审核器。
- **记忆层分两级作用域**：写作偏好跨作品（用户级），作品风格/brief/大纲单作品（作品级/页面级）。

---

## 4. 数据与状态模型

### 4.1 作用域模型

| 作用域 | 含义 | 生命周期 |
|---|---|---|
| **user（用户级）** | 写作偏好，跨作品生效 | 长期，随用户积累 |
| **work（作品级）** | 作品简报、作品风格、作品级技能、作品结构 | 跟随作品 |
| **page（页面级）** | 页面简报、页面大纲、分节创作进度 | 跟随页面 |

### 4.2 技能三级作用域

| 作用域 | 来源 | 角色 |
|---|---|---|
| **全局** | `resources/skills/` | 智能体运行时技能 + 作品技能/页面技能的**模板来源**；随产品运营持续迭代 |
| **作品** | 作品文件夹 `skills/`，从全局派生 | 作品专属、可独立编辑 |
| **页面（模板级）** | 写在页面模板的 `skills` 字段 | 定义该模板下的页面动态逻辑 |

**查找顺序**：作品级 → 全局（作品可覆盖全局）。模板声明的页面级技能**引用**全局或作品技能的 id。

### 4.3 实体

```ts
interface CreationSession {
  id: string;
  scope: "work" | "page";
  projectId: string;
  pageId?: string;
  stage: CreationStage;
  status: "active" | "awaiting-confirm" | "paused" | "completed" | "aborted";
  pendingStep?: {
    kind: "brief" | "skill" | "outline" | "section" | "review";
    artifactRef: string;
    delegatable: boolean;
  };
  delegation: Partial<Record<"brief"|"skill"|"outline"|"section"|"review", boolean>>;
  createdAt: string;
  updatedAt: string;
}

interface WorkBrief {
  name: string; type: ProjectType;
  audience?: string; lengthTarget?: string;
  pov?: string; tone?: string;
  themes?: string[]; taboos?: string[]; references?: string[];
}

interface PageBrief {
  goal: string; templateId: string;
  keyPoints: string[]; lengthTarget?: string;
}

interface UserWritingPreference {
  sentenceStyle?: string; tone?: string; pov?: string; pacing?: string;
  vocabulary?: string[]; taboos?: string[];
  reviewStrictness?: "lenient" | "normal" | "strict";
}

interface WorkStyle {
  tone: string; pov: string;
  voiceByRole?: Record<string, string>;
  glossary?: Array<{ term: string; definition: string }>;
  constraints?: string[];
}

interface WorkSkill {
  skill: SkillDefinition;            // 复用全局技能结构
  sourceTemplateId: string;          // 来源全局技能 id
  sourceTemplateVersion: string;     // 派生时版本
  overriddenFields?: string[];       // 被改写字段，供"同步模板更新"做差量
}

interface TemplatePageSkill {
  id: string;                        // 步骤 id（模板内唯一）
  skillId: string;                   // 引用技能 id
  params?: Record<string, unknown>;
  requiresConfirm?: boolean;
}

interface OutlineNode {
  id: string; title: string; summary: string;
  status: "pending" | "confirmed" | "written";
  children?: OutlineNode[];
}
```

### 4.4 状态机

```
作品级： work.intake → work.skill_draft → (可选) work.structure → work.done
页面级： page.intake → page.outline_draft → page.outline_confirm
                   → page.write(逐节循环) → page.review → page.done
```

规则：

- **每个产出型阶段后必跟一个 Gate**（`*_draft → 确认`；`page.write` 每节一次）。
- **作品级无 skill 确认门**：作品 skill 是"完成新建作品"的同步副作用（见 §6.2）。
- `page.write` 可循环、可中断、可恢复。

### 4.5 存储落点

| 实体 | 落点 | 复用机制 |
|---|---|---|
| `CreationSession` | SQLite 新表 `creation_sessions` | 仿 `skill-execution.dao.ts` |
| `WorkBrief` / `WorkStyle` | 作品文件夹 `project.json`（现有双存储） | `project.service.ts` |
| `PageBrief` / `PageOutline` | `pages.metadata`（`JsonMetadata`，免改表） | `page.types.ts` |
| `UserWritingPreference` | electron-store `app.json` 新键 | `config.constants.ts` + `config.migration.ts` |
| `WorkSkill` | `<workspace>/projects/{…}/skills/*.skill.json` | 仿全局 `resources/skills/` |
| 确认/审核记录 | SQLite，仿 `skill_executions` | 审计与执行历史 |

> 备注：页面级状态先用 `pages.metadata`（零迁移）。若后续需要"跨页面按大纲状态查询"，再考虑结构化字段。

---

## 5. 主流程

### 5.1 作品级

```
[用户发起新建作品]
   │
   ▼
向导逐步问答 ──► 用户回答并确认
   │
   ▼
完成新建作品（写 projects 表 + 作品文件夹）
   │
   ▼
自动同步生成 WorkSkill（从全局模板派生，无确认门）
   │
   ▼
work.done
```

### 5.2 页面级（模板驱动，非固定流程）

```
[根据页面模板新建页面]
   │
   ▼
结合作品信息(WorkBrief/WorkStyle) + 页面模板骨架
   │
   ▼
引导用户输入"本页内容概述"
   │
   ▼
询问：是否自动生成内容大纲？
   ├─ 否 ──► 直接用概述生成内容
   └─ 是 ──► 生成大纲 ──► [大纲阶段：素材过目] ──► 据大纲生成内容
                                                       │
                                                每节 Gate：确认 / 打回 / 委托
```

**结构要点**：页面流程 = **通用外壳（取概述、问是否要大纲）+ 模板声明的页面级 skill pipeline**。其余步骤（怎么问、要不要中间确认、怎么生成）由模板里的页面级 skill 定义，使不同模板具备不同动态逻辑。

---

## 6. 关键机制

### 6.1 确认门与委托

**Gate 契约**：输出三选一 `approve` / `reject(issues[])` / `needs-user`。
 放行者优先级：**用户显式操作 > 委托 Reviewer > 默认阻塞**。

**委托粒度**：**按步骤类型逐项开关**（`brief`/`skill`/`outline`/`section`/`review`），存于 `session.delegation`。

**Reviewer 保守回退**（命中任一即 `needs-user`，交回人工）：

- 置信度低于阈值
- 命中硬约束：`taboos` / `WorkStyle.constraints` / `glossary` 专有名词 / 事实一致性
- 产出与 brief 或 WorkStyle 明显偏离
- 该类步骤尚无历史校准（首次执行）

**`reviewStrictness` 映射**：

| 档位 | 行为 |
|---|---|
| `strict` | 几乎全部回退人工，Reviewer 只做预筛 |
| `normal`（默认） | 仅放行"高置信 + 无硬约束命中" |
| `lenient` | 放宽阈值，但**硬约束回退永不免除** |

**打回可逆**：`reject` 携带的具体问题作为"局部修正指令"注入重写。

### 6.2 技能派生与模板同步

- **派生（方案 B）**：新建作品完成 → 按作品类型选一组全局技能作模板 → **复制**为 `WorkSkill`，记录 `sourceTemplateId` + `sourceTemplateVersion`，用 `WorkBrief` 特化参数。
- **可编辑**：作品技能是独立实体，agent 可在交互中改写，不影响他作。
- **同步**：全局模板版本 > 派生时版本 → 提示"有更新可用" → 用户点同步 → 差量合并，冲突处提示。
- **不自动回灌**：全局迭代不影响已派生作品，需用户显式同步。
- **页面级技能（方案 A）**：模板只声明"引用哪个技能 id + 参数 + 是否确认"，技能本体在全局维护——保证单一维护点。

### 6.3 记忆写入与注入

| 时机 | 行为 |
|---|---|
| 生成时 | 注入 `UserWritingPreference` + `WorkStyle` + `WorkBrief` 到技能上下文 |
| 审核时 | 偏好（`reviewStrictness` + `taboos`）作为 Reviewer 判定标准 |
| 反馈时 | 用户的确认/编辑/打回 → 提取信号 → 生成"**偏好更新建议**" → 用户确认后落库 |

反馈写入坚持"**先建议、后确认**"，不静默修改用户画像；并做去重，避免同一偏好反复写入。

### 6.4 中断与恢复

- `CreationSession` 每步落库；**Gate 前必持久化**。
- 重启后扫描 `active` / `awaiting-confirm` 会话 → 提示"继续上次创作"（复用 task-queue resume-on-start 交互范式）。
- **幂等**：恢复时用 `pendingStep.artifactRef` 定位已产出草稿，避免重复调用模型。

### 6.5 模板驱动的页面 pipeline 执行

执行器读取模板的 `skills[]`（有序步骤）：

- **技能查找顺序**：作品级 → 全局。
- **参数合并**：模板 `params` 为基础，运行时上下文（概述/大纲/作品信息）覆盖。
- **Gate 触发**：`requiresConfirm: true` 的步骤产出后开 Gate；否则直接继续。
- **失败降级**：`skillId` 找不到或执行失败 → 跳过并提示，**不阻塞整个页面流程**。

### 6.6 素材检索（按作品隔离）

**统一入口**：`materialSearchService.search({ projectId, query, kinds, limit })`，`projectId` **必填**。

**检索路径**：

- **语义块**：向量 ANN 超额召回 → 用 `project_chunks`（或向量 `where` 过滤）限定本项目 → rerank top-N。
- **概念/主题**：语义/标题召回 → 经 `concept_chunks`/`topic_chunks` → 再经 `project_chunks` 归入本项目。因其无 `project_id`，**这是唯一路径**。

**使用方式（方案 C，两者结合）**：

- **编排层预取**：生成某节前按大纲节点检索素材注入 prompt（可控、省 token、可解释）。
- **技能工具自主检索**：L2 技能在生成中按需追加检索。
- **素材过目**：**大纲阶段**让用户过目（可勾选/剔除），**逐节创作**时直接注入不打断。

**隔离底线**：绝不跨作品召回。

**利好**：`smart-tasks`（concept-extract / topic-detection / semantic-link）在后台持续从 chunk 产出概念与主题，素材库随写作自动积累。

---

## 7. 基础设施优化

| # | 优化项 | 内容 | 必要性 / 代价 |
|---|---|---|---|
| I1 | 块向量表加 `project_id` | 对照 `PageEmbedding` 范式加列；写入时带上；检索用 `.where()` 过滤 | 按作品检索的**根本前提**；历史向量需**回填/重建索引** |
| I2 | `chunkService.search` 增 `projectId` | 检索入口支持作品过滤 | 需改调用方 |
| I3 | 概念/主题按作品过滤 | 经 `concept_chunks`/`topic_chunks` → `project_chunks` join | **唯一路径**；需补索引保性能 |
| I4 | search IPC 接线 | 注册 `registerSearchHandlers`（项目坑 #4） | 大纲阶段展示素材需要 |
| I5 | 模板 schema 加 `skills` | `template.schema.json`（`additionalProperties:false`）+ `template.types.ts` + `getBuiltInTemplates` + `mergeTemplates` + `CustomTemplate` | 页面级技能载体；链路多需连贯改 |
| I6 | 新增 `creation_sessions` 表 | `init.sql` + migration | 会话可恢复 |
| I7 | config 新键 `UserWritingPreference` | 默认值 + config migration | 偏好存储 |
| I8 | 技能三级作用域 | `SkillManager` 加载 全局/作品/模板 + 查找顺序 | 作品/模板技能生效前提 |
| I9 | 作品技能目录 | 作品文件夹下 `skills/` | 方案 B 落点 |

> 约束提醒：`semantic_chunks` 不得新增 `content_type`/`source`/`language`/`metadata`/`parent_chunk_id`/`split_index`/`is_memo` 等字段（项目坑 #14）；v1 表 `blocks`/`concept_blocks`/`topic_blocks` 不存在。

---

## 8. 工具规划（tool registry）

**移除 `search_blocks`**：当前无任何引用，直接删除（`tools/search-blocks.tool.ts` + 注册表引用），由 `search_materials` 取代。

| 工具 | 权限 | 参数 | 用途 |
|---|---|---|---|
| `search_materials` | read | `projectId`(必填)、`query`、`kinds[chunk/concept/topic]`、`limit` | **核心**：按作品检索创作素材 |
| `read_work_context` | read | `projectId` | 取 WorkBrief + WorkStyle + 作品技能摘要 |
| `read_page` | read | `pageId` | 读页面内容 / 大纲 |
| `update_outline` | write | `pageId`、`outline` | 写大纲（**受 Gate 约束**） |
| `write_page_content` | write | `pageId`、`nodeId`、`content` | 写回章节（**受 Gate 约束**） |
| `propose_preference` | write | `scope`、`suggestion` | 提交偏好/风格更新**建议**（落库前需用户确认） |

**规则**：所有 write 权限工具必须经 Gate 放行后执行；read 工具须带作用域参数（`projectId`/`pageId`）以强制隔离。

---

## 9. 交付顺序

> 子系统编号：**P1** 交互采集向导 · **P2** 作品级 Skill 生成与作用域 · **P3** 偏好与风格记忆 · **P4** 大纲与分步创作 · **P5** 审核与委托

```
阶段 0  地基：I1–I9 + 工具骨架
          → 打通"技能三级作用域 + 按作品素材检索"，是后续所有阶段的前提
阶段 1  P1 作品采集向导 + P2 作品 skill 派生（作品链路端到端）
阶段 2  P4a 模板驱动 pipeline + 大纲生成 + 素材过目（方案 C 大纲阶段）
阶段 3  P4b 逐节创作 + 确认门
阶段 4  P3 偏好/风格记忆写入回路
阶段 5  P5 审核与委托（保守回退）
```

**排序理由**：

- 阶段 0 是所有后续的地基。
- 阶段 1 先打通作品（页面必须挂在作品下）。
- 阶段 2/3 是第一版核心场景。
- 阶段 4 放在有了真实确认/打回样本之后，学习回路才有数据可学。
- 阶段 5 依赖阶段 4（审核标准要读偏好），故置最后。

---

## 10. 风险与开放问题

| 风险 | 说明 | 缓解 |
|---|---|---|
| 向量回填成本 | I1 需对历史块向量重建/回填 `project_id` | 首次启动后台迁移 + 迁移期间退化为"超额召回 + 后过滤" |
| 关联查询性能 | I3 概念/主题需多层 join | 为 `concept_chunks`/`topic_chunks`/`project_chunks` 补索引 |
| 模型未配置 | 自动执行依赖 `aiService` | auto 模式在无模型时降级为 `suggest`，不静默失败 |
| 保守回退的打断感 | Reviewer 保守 → 高频打断 | 用逐项委托粒度让用户自己放宽；`lenient` 档可用 |
| 模板 schema 破坏性 | I5 改动面广，漏改则字段被吞 | 按 §7 清单逐项贯通，加校验用例 |
| docs/ 不入库 | spec 位于 gitignore 的 `docs/` | 用户已知悉；如需入库需另选位置 |

**开放问题（已给建议默认值，待最终确认）**：

1. `search_materials` 向量过滤：**默认走 LanceDB `where`**（建表加标量列），以"超额召回 + 后过滤"兜底。
2. 作品技能"同步模板更新"冲突：**默认逐字段选择**（保留用户已改字段），非整份替换。
3. 页面级技能 `requiresConfirm` 默认值：**默认 `true`**（模板未显式声明时视为需要确认）。

---

## 11. 决策记录

| 决策 | 结论 |
|---|---|
| 总体架构 | 思路 1：编排骨架 + 单规划智能体；多智能体留作演进 |
| 作品级技能 | 方案 B：全局模板的**派生副本**，可独立编辑，不自动回灌 |
| 作品 skill 生成 | **无确认门**，是完成新建作品的同步副作用 |
| 页面级技能 | 方案 A：**模板做编排、技能本体在全局**（引用 id + 参数 + 是否确认） |
| 页面流程 | 模板驱动（通用外壳 + 模板声明的 pipeline），非固定阶段 |
| 委托粒度 | 方案 A：**按步骤类型逐项委托** |
| Reviewer 基调 | **保守回退**：不确定即交回人工；硬约束永不免除 |
| 素材过目 | 方案 C：**大纲阶段过目，逐节创作直接注入** |
| 素材检索 | **强制按作品隔离**（`projectId` 必填） |
| 会话存储 | 新表 `creation_sessions` |
| 页面级状态 | 先存 `pages.metadata`（零迁移） |
| 作品技能存储 | 作品文件夹下 `skills/` |
| `search_blocks` | **移除**（当前未使用），由 `search_materials` 取代 |
| spec 位置 | `docs/`（注意：`docs` 在 `.gitignore` 中，不入库） |
