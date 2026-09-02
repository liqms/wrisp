# Agent: migration-agent

> Tier 2 · 领域 Agent · 按需加载
> 负责配置 / 数据库 / 模型三类的版本迁移逻辑。

---

## 元信息

| 字段 | 值 |
|---|---|
| 名称 | `migration-agent` |
| 层级 | Tier 2 |
| 依赖的 Tier 1 | `main-process-agent` |
| 常协同 | `dao-agent`(字段变更)、`shared-agent`(版本类型) |
| 参考文档 | [AGENTS.md](../../../AGENTS.md) |

---

## 加载时机

- 配置/数据库/模型版本升级
- 新增表字段需为已有库写迁移
- `getTargetVersion`/`getDatabaseVersion` 逻辑改造
- 修改 `src/main/core/migration/**` 或 `src/main/schemas/init.sql`

---

## 知识域

### 必备文件

```
src/main/core/migration/index.ts              ① 迁移入口
src/main/core/migration/config.migration.ts    ② 配置迁移
src/main/core/migration/database.migration.ts  ③ 数据库迁移
src/main/core/migration/model.migration.ts     ④ 模型迁移
src/main/core/db/migrationDb.dao.ts            ⑤ 迁移记录 DAO(extends BaseDao)
src/main/schemas/init.sql                       ⑥ 基线 schema
src/main/constants/config.constants.ts         ⑦ 配置默认值
```

### 三类迁移

- **config**:`<userData>/config/app.json` 升级(electron-store)
- **database**:`<workspace>/sqlite/main.db` schema 升级,应用 `schemas/init.sql`
- **model**:模型配置/列表升级

### 关键函数

- `getDatabaseVersion()`:返回当前已执行版本
- `getTargetVersion()`:返回目标版本——**已用当前版本作下界**:`let target = this.getDatabaseVersion() || "0.0.0"`,避免误报"当前版本高于目标"警告

---

## 职责

1. 新增字段时为已有库写 ALTER TABLE 迁移(新表写 init.sql 基线即可,无需迁移)
2. 维护 `migrations_db` 迁移记录
3. 保证 `getTargetVersion()` 下界逻辑不被破坏
4. config 默认值变更时同步 `config.constants.ts` + config 迁移

---

## 关键约束与陷阱

1. **`getTargetVersion()` 下界**:必须 `this.getDatabaseVersion() || "0.0.0"`,否则无 `migrations/` 目录 + 基线已执行时会默认 `0.0.0` → 触发"当前版本(0.1.0)高于目标版本(0.0.0)"误警
2. **`migrations/` 目录为空**:迁移逻辑由 `init.sql` + `migrationDb` 记录驱动,不依赖文件式迁移
3. **基线已执行**:首次启动已跑 `init.sql`,后续靠迁移记录判断
4. **schema 路径**:用 `__dirname` 解析(CJS),勿用 `import.meta.url`
5. **TS 严格**:strict tsconfig

---

## 必传上下文模板

```yaml
task: "<原始请求>"
migration_type: [config | database | model]
changes:
  - field: "<字段>"
    table: "<表>"
    sql: "<ALTER 语句>"
co_agents:
  - dao-agent: <若新表/新 DAO>
  - shared-agent: <若版本类型>
```

---

## 退出标准

- [ ] `getTargetVersion()` 下界逻辑保留(`getDatabaseVersion() || "0.0.0"`)
- [ ] 已有库字段变更含 ALTER TABLE 迁移
- [ ] 新表写 `init.sql` 基线(无需迁移)
- [ ] config 变更同步 `config.constants.ts`
- [ ] schema 路径用 `__dirname`
- [ ] (可选)`pnpm typecheck` 通过
