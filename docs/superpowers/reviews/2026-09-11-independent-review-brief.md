# 独立评审简报 — 创作智能体分支

> **用途**：把本文件内容交给一个**没有本次会话上下文**的评审者（新会话 / 另一个 agent / 同事）。
> 原执行者自带上下文，无法对自己做真正独立的评审；本简报的目的是让外部评审者不必复用任何既有结论。

## 评审对象

| 项 | 值 |
|---|---|
| 仓库 | `D:\Code\Github\Wrisp` |
| 分支 | `codex/creation-agent-material-retrieval` |
| 范围 | `git diff 590f8e1..HEAD`（44 个提交） |
| 设计文档 | `docs/superpowers/specs/2026-09-10-creation-agent-design.md` |
| 实施计划 | `docs/superpowers/plans/2026-09-10-material-retrieval-by-project.md` 与 `docs/superpowers/plans/2026-09-11-*.md`（共 8 份） |

## 评审者须知（先读）

- 本分支由 8 份计划、36 个任务按 TDD 执行而成；**计划里的复选框未被勾选**，进度请以 `git log` 为准，不要以计划文本为准。
- 计划文本与最终代码存在**已记录的偏离**，散落在各计划的"执行时的偏离/裁定"段落与 `.superpowers/sdd/2026-09-10-material-retrieval-by-project/progress.md` 账本中。请把"代码与计划不一致"与"代码本身有缺陷"分开评价。
- **接线层（IPC 四层 + 向导 UI）是有意未做的**，不要把它计为缺陷；但请指出"因为缺接线而产生的问题"（例如某个纯函数永远拿不到真实输入）。
- 工作区有两处**非本分支产物**，请忽略：`src/renderer/components/settings/template/TemplateSettings.vue` 的未提交改动、未跟踪的 `config/`（开发运行时状态）。

## 请重点检查（按优先级）

### 1. 正确性缺陷

关注这些新增模块：

- `src/main/core/skills/`：`project-skill.store.ts`、`gate-policy.ts`、`page-pipeline.ts`、`work-skill.deriver.ts`，以及被改动的 `skill.manager.ts` / `skill.executor.ts`
- `src/main/core/services/`：`material-search.service.ts`、`creation-session.service.ts`、`work-profile.store.ts`、`work-intake.ts`、`work-creation.service.ts`、`page-write-context.ts`、`outline.parser.ts`、`outline-material.prefetch.ts`、`page-creation.service.ts`、`preference-fragment.ts`、`preference-signals.ts`、`writing-preference.service.ts`、`review-criteria.ts`、`review-outcome.ts`、`hard-constraint.ts`、`revision-instruction.ts`、`review.service.ts`、`template-resource.parser.ts`
- `src/main/core/vector/`：`project-filter.ts`、`block-search.ts`、`vector-payload.ts`
- `src/main/core/db/creationSession.dao.ts`、`src/main/core/smart-tasks/executors/chunk-vectorize.executor.ts`
- `src/shared/types/`：`creation-session.types.ts`、`work-profile.types.ts`、`writing-preference.types.ts`、`outline.types.ts`、`skill.types.ts` 的改动

### 2. 跨计划接口一致性

- `skillManager.resolveSkillDefinition(skillId, projectId?)` 的**每一个调用方**是否在需要作品作用域时都传了 `projectId`？
- `projectSkillStore` / `workProfileStore` 的路径参数来源是否统一（作品文件夹路径是否都取自 `ProjectDao.findById().file_path`）？
- `materialSearchService.search({projectId, ...})` 与 `prefetchOutlineMaterials` 的 `MaterialSearchFn` 契约是否真的兼容？
- `decideGateOutcome` 的 `GateContext` 由 `pageCreationService.buildGateContext` 与 `reviewService` 两处构造，两处语义是否一致？

### 3. 安全底线（spec 明文规定，属 Critical）

- **素材检索必须按作品隔离**：是否存在任何一条路径可以在缺少 `projectId` 的情况下召回（包括兜底分支、失败降级分支）？
- **硬约束永不被自动放行**：`taboos` / `constraints` / `glossary` 命中时，是否在任何严格度档位、任何 Reviewer 判定下都可能被判为 `approve`？
- **偏好写入先建议后确认**：是否存在绕过用户确认直接落库的调用路径？

### 4. 重复/漂移的类型定义

已知已修复两处（`ReviewStrictness`、`MaterialSearchItem`），请确认**是否还有第三处**，以及修复方式是否真的消除了漂移（而非只是改了个名字）。

### 5. 测试质量

- 是否存在"断言不了行为"的测试（只测 mock、恒真、或只测了 happy path）？
- 是否有测试通过 mock 掩盖了真实缺陷？

## 输出要求

- 每条发现给出 **文件 + 行号 + 具体失败场景**，并按 Critical / Important / Minor 分级；不要只给结论。
- 每个类别若**没发现问题，请明说**，不要为凑数而报告。
- 不要对**没有实际读过**的文件发表意见。
- 最后单独列出：**你没能验证的部分**。

## 已知的既有问题（不必重复报告，但可确认）

- **`better-sqlite3` 原生模块 ABI 曾不匹配**（原为 `NODE_MODULE_VERSION 145`，Node v24 需要 `137`），压住了一批集成测试。已用 **`npm rebuild better-sqlite3`** 修复（针对当前 Node 重建）。
  - 注意：`pnpm rebuild`（= `electron-rebuild`）是**针对 Electron 的 ABI**，不解决 Node 下跑 vitest 的问题；两者在同一个 `node_modules` 里互斥。
  - **当前状态：模块为 Node ABI（137）**，因此**运行 Electron 应用前需要先执行 `pnpm rebuild` 切回 Electron ABI**。这是本仓库的一个真实约束，值得评审者留意。
- 修复后全量测试曾剩 3 项陈旧测试失败（资源类型数量未含 `model-meta` 两条、editor 桩缺 `isActive` 一条），均与本分支无关，**已一并修正**。
- **当前全量测试状态：93 个文件 / 557 个用例全部通过（0 失败）。**
- `tests/unit/main/skill-executor-l1-stream.test.ts` 曾在执行期间被本分支改动打破，已在提交 `8cc193a` 修复。

## 本分支执行期间由审查发现并修复的缺陷（供评审者复核，不必重新发现）

| 提交 | 缺陷 | 级别 |
|---|---|---|
| `d0dd0c3` | 语义检索降级到全文检索时未按作品过滤 → 跨作品召回 | Critical |
| `d37d6c4` | `resolveGate` 忽略 decision，`needs-user` 也被当作放行（fail-open）；`KEYWORD` 分支未过滤 | Critical |
| `676d8a0` | 作品隔离改为强制（`projectId` 必填 + 显式 `searchAll`）；技能解析不再静默降级为全局 | 根因修复 |
| `8cc193a` | 技能解析改动打破既有测试；消除两处重复类型定义 | 回归 |

**评审者请重点确认：这些修复是否真的到位，以及是否还有同类（fail-open / 跨作用域）的遗漏。**
