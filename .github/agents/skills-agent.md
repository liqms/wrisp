# Agent: skills-agent

> Tier 2 · 领域 Agent · 按需加载
> 负责技能管理、执行器、schema 校验、更新器、工具注册表。

---

## 元信息

| 字段 | 值 |
|---|---|
| 名称 | `skills-agent` |
| 层级 | Tier 2 |
| 依赖的 Tier 1 | `main-process-agent` |
| 常协同 | `dao-agent`(skill-execution.dao)、`model-gateway-agent`(执行调 LLM) |
| 触源 | `src/main/core/skills/**` |

---

## 加载时机

- skill manager/executor/schema-validator/updater 改造
- tool registry 新增工具
- skill 执行流程调整
- skill-execution DAO 改造(联动 dao-agent)

---

## 知识域

### 文件清单

```
src/main/core/skills/skill.manager.ts          ① 管理
src/main/core/skills/skill.executor.ts         ② 执行
src/main/core/skills/skill.schema.validator.ts ③ schema 校验
src/main/core/skills/skill.updater.ts          ④ 更新
src/main/core/skills/tool.registry.ts          ⑤ 工具注册表
src/main/core/skills/tools/
  └ search-blocks.tool.ts                     ⑥ 搜索工具
src/main/core/db/skill-execution.dao.ts        ⑦ 执行记录 DAO
```

### 启动集成

- `main/index.ts` 启动时初始化 skill manager(在 IPC 注册前)

---

## 职责

1. skill 安装/更新/卸载流程
2. 执行器调 LLM + 工具
3. schema 校验(skill 定义格式)
4. 新增工具注册到 tool registry

---

## 关键约束与陷阱

1. **skill manager 初始化**:在 IPC 注册前,勿破坏顺序
2. **schema 校验**:skill 定义需通过 schema-validator,勿绕过
3. **工具注册**:新工具需实现统一接口并注册到 tool.registry
4. **TS 严格**:strict

---

## 必传上下文模板

```yaml
task: "<原始请求>"
scope: [manager | executor | schema | updater | tool]
tool: "<工具名>"
co_agents:
  - dao-agent: <若 skill-execution.dao>
  - model-gateway-agent: <若执行调 LLM>
```

---

## 退出标准

- [ ] 新工具实现统一接口并注册
- [ ] schema 校验未被绕过
- [ ] skill manager 初始化顺序未破坏
- [ ] (可选)`pnpm typecheck` 通过
