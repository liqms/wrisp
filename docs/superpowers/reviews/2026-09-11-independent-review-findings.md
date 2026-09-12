# 独立评审结论 — codex/creation-agent-material-retrieval

> 评审对象：git diff 590f8e1..HEAD（48 个提交，98 个文件）
> 评审方式：只读代码走查 + 全量测试复跑 + 针对性探针测试（探针已删除，工作区已恢复原状）
> 基线环境：node_modules 为 Node ABI(137)，pnpm test 可直接跑；未启动 Electron 应用

## 环境与回归证据

| 命令 | 结果 |
|---|---|
| pnpm test | 3 failed / 554 passed（93 个文件） |
| pnpm typecheck | 通过（exit 0） |

3 个失败与简报所列完全一致，均与本分支无关：template-installed.service.test.ts（快照缺 model-meta）、
resource-types.test.ts（断言 3 种资源类型）、slash-menu-render.test.ts（editor 桩缺 isActive）。

---

## Critical

### C1. 向量检索异常时的降级路径仍然跨作品召回（d0dd0c3 只修了一半）

- 位置：src/main/core/services/chunk.service.ts:382-392（searchByVector 的 catch）
- 情况：embed / vectorService.searchBlockEmbeddings / rerank 任一抛错时，直接
  chunkDao.searchFts(keyword, limit) 后 blocksToRecordList 返回，没有调用 filterByProject。
  同一文件里 runSearch 的两条降级路径（:302、:314）都已按作品过滤，唯独这条漏掉。
- 证据（我写的临时探针，已删除）：isLocalAvailable()=true + embed() reject + searchFts 返回 [c1,c2]
  + project_chunks(p1)=[c1]，实得 ["c1","c2"]，期望 ["c1"]。
- 影响：本地模型加载失败 / 向量表损坏 / LanceDB 抛错时，materialSearchService.search({projectId:"p1"})
  会把其它作品的语义块喂给当前作品（并进入大纲预取与 search_materials 工具）。
  违反 spec §6.6「隔离底线：绝不跨作品召回」。
- 为什么现有测试没抓到：tests/unit/main/chunk-search-fallback-scope.test.ts:34-36 只 mock 了
  isLocalAvailable()=false 这一条降级；chunk-search-project-scope.test.ts 让向量检索返回空数组后
  rerank 得空，永远不会走到 catch。

### C2. 计划要求的「兜底」未实现，存量向量对新用户永远不可见

- 位置：src/main/core/services/chunk.service.ts:328-381；src/main/core/vector/lancedb.ts:158-170
- 计划原文（docs/superpowers/plans/2026-09-10-material-retrieval-by-project.md:584）：
  「兜底：向量结果为空且 projectId 存在时，用 projectChunkDao 关联结果做二次过滤，
  保证历史向量（project_id 为 null）不会漏检。」——代码里没有这段：向量路径完全信赖
  .where(project_id = '...')，filterByProject 只用在 FTS 两条路径上。
- 后果：initVectorTables 用 addColumns 给存量行补 project_id，值恒为 null
  （lancedb.ts:161-169，无回填、无重嵌入任务），而 project_id = 'p1' 永远匹配不到 null。
  即「升级前就已存在的语义块」在语义检索里全部检不到（改归属、老作品尤其明显）。
  spec §7 I1 明确要求「历史向量需回填/重建索引」+「迁移期间退化为超额召回 + 后过滤」，两者都缺。
- 严重度说明：这是漏检（fail-closed），不是泄漏，但会让首版素材检索在老数据上表现为「什么都搜不到」，
  属于用户可见的功能失效，且计划文档「开放风险」把它写成「已由兜底保证不漏检」，与代码不符。

---

## Important

### I1. 向量里的 project_id 是「写入时快照」，改归属后不更新

- 位置：src/main/core/services/chunk.service.ts:92-112（syncProjectAssociation 只改 project_chunks）、
  src/main/core/smart-tasks/executors/chunk-vectorize.executor.ts:15-20,44-49（只在向量化时解析一次）、
  src/main/core/db/vector.dao.ts:158-181（检索只看向量行里的 project_id）
- 情况：vectorService.updateBlockEmbedding 在生产代码里没有任何调用方（全库 grep 只有定义）。
  于是把语义块从作品 A 改关联到作品 B 后，向量行仍写着 A：
  检索 A 会命中一个已不属于 A 的块（跨作品召回）；检索 B 则检不到它
  （project_chunks 与向量元数据不一致）。
- 同类问题：chunkService.addToProject（:519-539）是追加语义，一个块可以同时属于多个作品；
  而 resolveProjectId 只取 links[0]，其余作品就再也检索不到这个块。
  计划里的 project_chunks 二次过滤本来能同时修掉这两种情况，见 C2。

### I2. creation_sessions 在存量库上不会被创建

- 位置：src/main/schemas/init.sql:439-456（新增表）、src/main/core/migration/database.migration.ts:405-436
- 情况：init.sql 只在「数据库尚未初始化」（migrations_db 不存在 / 版本为空）时执行；
  存量库的 currentVersion(0.1.0 或 0.2.0) === targetVersion 时 executeDatabaseMigration 直接
  return false，CREATE TABLE IF NOT EXISTS creation_sessions 永远不会跑到。
  本分支也没有为它加迁移文件（对照既有先例 src/main/schemas/migrations/0.2.0_add_characters_table.sql
  ——建表 + INSERT OR IGNORE INTO migrations_db 自登记），也没有像
  ensureProjectPinnedColumn() / ensurePageTypeColumn() 那样加幂等补齐方法。
- 后果：老用户升级后 CreationSessionDao 的任意一次 query 都会抛 no such table: creation_sessions。
  当前因为接线未做（creationSessionService 无生产调用方）而处于潜伏状态，但第一个消费方接入即炸。
- 计划文档 docs/superpowers/plans/2026-09-11-creation-session-and-gate.md:7 断言
  「CREATE TABLE IF NOT EXISTS 对存量库同样生效」，这个前提在本仓库的迁移实现下不成立。

### I3. 作品技能缓存没有失效路径，写入后同进程内不可见

- 位置：src/main/core/skills/skill.manager.ts:203-227（invalidateProjectSkills）、
  src/main/core/services/work-creation.service.ts:48-66
- 情况：invalidateProjectSkills 在生产代码里没有任何调用方（只有测试调用）。
  getProjectSkillsCache 会把第一次解析的结果（很可能是空 Map）永久缓存；
  finishCreation 之后往 <作品>/skills/ 写了 work-outline 等派生技能，却没有失效缓存。
  若该 projectId 在写入前被解析过一次，本进程内后续 resolveSkillDefinition("work-outline", p1)
  仍回退全局，得到 SKILL_NOT_FOUND，直到重启。
- 建议：finishCreation 写完后调用 skillManager.invalidateProjectSkills(projectId)（未来作品技能编辑同理）。

### I4. 现有唯一的技能执行通道不传 projectId，作品技能不可达

- 位置：src/main/core/apis/skill.api.ts:51-75、src/main/preload/modules/skill.ts:11、
  src/main/ipcMain/skill.ipc.ts:42,49
- 情况：skillExecutor.execute/executeL1Stream 已支持 projectId，且 skill.api.ts 是唯一调用方，
  但它（以及 preload/IPC 全链路）没有 projectId 形参。按简报，四层接线是有意未做；
  这里按要求指出因缺接线而必然发生的问题：作品技能 id（work-outline 等）经这条通道
  只会按全局查找，SKILL_NOT_FOUND 是必然结果，而不是「暂时没接 UI」。
- 附带结论：resolveSkillDefinition 的生产调用方只有 skillExecutor 两处（已传）与
  work-creation.service.ts:50 的 getSkillDefinition（此处应当只查全局，正确）。

### I5. calibrated 没有任何数据来源，委托自动放行在当前代码下不可能发生

- 位置：src/main/core/skills/gate-policy.ts:42、src/main/core/services/review.service.ts:21,87、
  src/main/core/services/page-creation.service.ts:21,63
- 情况：全库只有这三处消费 calibrated，没有任何地方产出它（没有校准 / 执行历史存储）。
  按 decideGateOutcome 的规则，!calibrated 即回退人工，所以即使委托开关全开、
  Reviewer 高置信 approve，也永远回到人工：spec §6.1 的「委托 Reviewer 放行」路径实际不可达。
- 风险提示：calibrated 是唯一的「首次执行」防线。将来接线时若为了「让功能跑起来」直接传 true，
  就等于一次性绕过该防线；建议由 creation_sessions / 执行历史派生，而不是让调用方自由填写。

### I6. semantic-link 后台任务仍做全库 ANN，与分支声明的隔离不变量冲突

- 位置：src/main/core/smart-tasks/executors/semantic-link.executor.ts:42-45
- 情况：调用 vectorService.searchBlockEmbeddings({ vector, topK })，不传 projectId，
  于是跨作品建立 semantic_links；该文件属既有文件（本分支未改），但 searchBlockEmbeddings
  在本分支被改造成「可选过滤」，且 tests/unit/main/search-block-embeddings-filter.test.ts:16-25
  专门固定了「不传 projectId 就不过滤」这一行为。
- 影响面：semantic_links 目前只被写入与 cleanup.service 清理，没有读取方（我做了全库 grep 确认），
  所以是数据污染 / 未来隐患，不是当下的信息泄漏。但一旦有消费方（图谱、相关块推荐）就会出现跨作品关联。
- 建议：给该执行器传块所属作品（project_chunks 已有索引 idx_project_chunks_chunk），
  并把低层 searchBlockEmbeddings / BlockVectorDao.search 的过滤参数改成必填 + 显式 searchAll，
  与上层 chunkService.search/searchAll 的强制策略保持一致。

---

## Minor

### M1. PageGateContext 与 GateContext 结构完全重复（第三处漂移点）

src/main/core/services/page-creation.service.ts:15-22 与 src/main/core/skills/gate-policy.ts:7-18
字段名、类型、注释语义完全一致。已知的两处重复（ReviewStrictness、MaterialSearchItem）已按
「单一来源 + 再导出」修好（我核对了声明处，全库各只有一份；gate-policy.ts:3-5 是再导出而非重定义），
但这里是同一形状的第三个复制品：任何一边新增字段（例如 factsConsistent）都会静默漂移。
建议直接 import type { GateContext } 复用，或让 PageGateContext = Pick<GateContext, ...>。

### M2. MaterialSearchFn.kinds 与 MaterialSearchParams.kinds 类型不匹配

src/main/core/services/outline-material.prefetch.ts:13-18 声明 kinds?: string[]，
而 materialSearchService.search 要求 MaterialKind[]（material-search.service.ts:10-16,50）。
方法声明的形参双变性让赋值在类型层通过，但传 kinds: ["Chunk"]（大小写错）不会报错、
也不会退回默认值，而是静默返回空数组。建议 MaterialSearchFn 直接引用 MaterialSearchParams。

### M3. resolveGate(id, "needs-user") 会把未开启的门置为 awaiting-confirm

src/main/core/services/creation-session.service.ts:72-87：needs-user 分支只改 status，
不校验该会话当前是否真的处于开门状态。对一次从未 openGate 的会话调用它，会得到一个
awaiting-confirm 但 pendingKind 为 null 的会话，恢复流程（listResumable）会把它当作待确认项。
影响很小，但状态机不该允许这种组合。

### M4. 测试质量：4 个「类型即断言」的测试

以下测试只验证「对象字面量能满足类型」，运行时断言恒真，行为回归时不会失败：

- tests/unit/shared/creation-session-types.test.ts
- tests/unit/main/skill-definition-source.test.ts
- tests/unit/main/block-embedding-project-id.test.ts
- tests/unit/shared/template-page-skill.test.ts

它们作为类型契约有价值，但不要计入行为覆盖。另：tests/unit/main/tool-registry.test.ts
把 material-search.service 整个 mock 掉后只断言「search_blocks 不在注册表里」，
对新增的 search_materials 是否真的可用没有任何断言，且 mock 掩盖了注册表到工具的 import 链
（真实断链只会在运行时暴露）。

---

## 逐项回答简报的四个重点

1）resolveSkillDefinition(skillId, projectId?) 的调用方

生产调用方共 3 处：skill.executor.ts:47（execute，传）、skill.executor.ts:155（executeL1Stream，传）、
work-creation.service.ts:50（用 getSkillDefinition，只查全局，符合「从全局模板派生」的语义）。
问题在上游通道（I4）：skill.api.ts 及 preload/IPC 没有 projectId 形参，作品技能拿不到作用域。

2）作品文件夹路径来源是否统一

统一。两处消费方都取自 ProjectDao.findById().file_path：skill.manager.ts:218-222 与
work-creation.service.ts:36-40；project.service.ts:402,419 保证 file_path 是磁盘上的作品目录
（「以磁盘实际文件夹为准」）。未发现传入工作区根或页面路径的调用。

3）materialSearchService.search 与 MaterialSearchFn 契约

功能上兼容（前者可被后者接收），但签名不严谨，见 M2；另外 prefetchOutlineMaterials 目前
没有任何生产调用方，参数来源尚未被真实验证。

4）GateContext 的两次构造是否语义一致

一致，但方式不同：reviewService.evaluateAndDecide（review.service.ts:55-96）先自己做
detectHardConstraintHit，命中就直接返回、构造时写 hitHardConstraint: false；
pageCreationService.buildGateContext 则把 reviewer.hitHardConstraint 原样透传。
两条路径最终都交给同一个 decideGateOutcome，硬约束在两条路径上都不会被放行。
隐患在于「谁来计算 hitHardConstraint」没有被接口强制：若将来接线方从 Reviewer 的 JSON 里取
这个布尔值（而不是调 detectHardConstraintHit），硬约束就会被 Reviewer 的自我评价绕过。
建议把硬约束判定收敛进 reviewService（单一入口），buildGateContext 不再接收该字段。

---

## 对简报所列 4 个已修缺陷的复核

| 提交 | 复核结论 |
|---|---|
| d0dd0c3 降级路径未按作品过滤 | 只修对了 isLocalAvailable()=false 那条；searchByVector 的异常降级仍在泄漏（C1） |
| d37d6c4 确认门不得向放行方向失败 | 到位：resolveGate 仅在 approve 时关门（creation-session.service.ts:72-87，有测试）；decideGateOutcome 全分支保守（gate-policy.ts:37-47）；KEYWORD 分支已过滤（chunk.service.ts:295-302） |
| 676d8a0 作品隔离改为强制 | 上层到位：MaterialSearchParams.projectId 必填 + 空值抛 PROJECT_ID_REQUIRED + 显式 searchAll + 技能解析不再静默降级为全局。未覆盖低层：searchBlockEmbeddings / BlockVectorDao.search 的 projectId 仍可选，I6 就是它的后果 |
| 8cc193a 回归修复与去重 | 到位：skill-executor-l1-stream.test.ts 改为委托同一 mock（未削弱断言），类型去重核对无残留 |

安全底线的三条结论：

- 素材检索按作品隔离：不成立，存在 C1（异常降级）与 I1（陈旧 project_id）两条跨作品召回路径。
- 硬约束永不被自动放行：成立。review.service.ts:61-69 命中即返回 needs-user，
  decideGateOutcome 在 hitHardConstraint 为真时也返回 needs-user（任何严格度档位都不免除）；
  未找到可绕过路径。唯一需要注意的是上面提到的「hitHardConstraint 由谁计算」尚未被接口强制。
- 偏好写入先建议后确认：分支内成立——唯一写入方法是 writingPreferenceService.applySuggestions
  （writing-preference.service.ts:78-87），extractPreferenceSignals 只产出建议、mergePreferences
  无副作用、reviewStrictness 不被反馈改写。但既有的通用通道 config:setValue（config.api.ts:47-58，
  无 key 白名单）允许任意写 writingPreference；这不是本分支引入的，且从设置界面发起的写入本身
  可视为用户确认，故仅记为提示：该「确认门」目前是约定而非强制。

---

## 我没能验证的部分

- 未启动 Electron 应用做端到端验证（当前 better-sqlite3 为 Node ABI，跑应用需先 pnpm rebuild）。
- 没有真实存量数据库 / LanceDB 数据集，C2、I1、I2 是从代码路径推导的，未做运行时复现；
  其中 C1 有可复现的探针证据。
- 未逐字读完 8 份计划文档与设计文档全文，只读了与本报告结论相关的段落（§6.1/§6.3/§6.5/§6.6、
  §7 I1、§9 决策表，以及 material-retrieval 计划的任务正文与开放风险）。
- 未验证 LanceDB where() 的实际过滤时机与 addColumns 在真实表上的行为（只读代码）。
- 未评估 findByChunkIds 的规模风险是否现实：idx_concept_chunks_chunk / idx_topic_chunks_chunk
  索引存在（init.sql:370,378），计划里「需确认索引」这一开放风险可以结掉；但单作品块数上限未做压测。
