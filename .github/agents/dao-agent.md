# Agent: dao-agent

> Tier 2 · 领域 Agent · 按需加载
> 负责数据库实体、DAO、schema、CRUD 与分页。

---

## 元信息

| 字段 | 值 |
|---|---|
| 名称 | `dao-agent` |
| 层级 | Tier 2 |
| 依赖的 Tier 1 | `main-process-agent` + `shared-agent` |
| 常协同 | `migration-agent`(字段变更)、`ipc-channel-agent`(暴露 CRUD) |
| 参考指令 | [.github/instructions/dao-pattern.instructions.md](../instructions/dao-pattern.instructions.md) |

---

## 加载时机

- 新增表/实体
- 新增字段(需联动 migration-agent)
- CRUD/分页/查询方法
- 修改 `src/main/core/db/**` 或 `src/main/schemas/init.sql`

---

## 知识域

### 必备文件清单

```
src/shared/types/<entity>.types.ts             ① 实体 + Create + Update 类型
src/shared/types/index.ts                      ② 类型导出
src/main/types/db/<entity>.types.ts             ③ 主进程 db 类型(若有)
src/main/core/db/<entity>.dao.ts                ④ DAO 类(extends BaseDao)
src/main/core/db/index.ts                       ⑤ DAO 导出
src/main/schemas/init.sql                       ⑥ 表 schema(基线)
src/main/core/migration/database.migration.ts   ⑦ 字段迁移(已有库)
```

### BaseDao 模式

```typescript
export abstract class BaseDao<T, C extends object, U extends object> {
  // T=实体, C=Create, U=Update
  // 通用方法:create / findById / findAll / update / delete / paginate
  // 自动时间戳(created_at/updated_at)
  // 表名验证: /^[a-zA-Z_][a-zA-Z0-9_]*$/
}
```

### 数据库连接

- 路径:`<workspace>/sqlite/main.db`(workspace 自 config 或 `globalThis.__WRISP_WORKSPACE_PATH__`)
- better-sqlite3,WAL 模式,外键 ON
- 通过 `this.db` 获取(自动 `getDatabase()`)

### 现有 DAO(20 + migrationDb)

base, chunk, concept, conceptChunk, connection, fileIndex, migrationDb, page, project, projectChunk, reflection, reflectionChunk, semanticLink, skill-execution, tag, taggedItem, task-execution, task, temporalEvent, topic, topicChunk, topicConcept, vector

---

## 职责

1. 定义实体 + Create/Update DTO(在 shared,联动 shared-agent)
2. 创建 DAO 类 `extends BaseDao<T,C,U>`,表名与 schema 一致
3. 实现自定义查询方法(参数化 `?`,不拼字符串)
4. 在 `db/index.ts` 导出
5. 字段变更联动 migration-agent(已有库迁移)
6. 新表加 `init.sql` 基线 schema

---

## 关键约束与陷阱(项目特有)

### 必须遵守

- ✅ **参数化查询**:一律 `?`,严禁拼接 SQL 字符串
- ✅ **表名验证**:纯字母数字下划线 `/^[a-zA-Z_][a-zA-Z0-9_]*$/`
- ✅ **自动时间戳**:默认启用,`created_at`/`updated_at` 由 BaseDao 管;勿在 C/U 类型含
- ✅ **事务**:DAO 方法内不开事务,由 service 层控制
- ✅ **日志**:`Logger.debug()` SQL 执行,`Logger.error()` 错误
- ✅ **Create 类型**:继承/Pick 实体必填字段,不含 `id`/时间戳
- ✅ **Update 类型**:全字段可选(Partial),不含时间戳

### v2 表专用(强制)

仅以下表存在,勿引用 v1:

- `semantic_chunks` / `concept_chunks` / `topic_chunks` / `concepts` / `topics` / `topic_concepts`
- v1 表(`blocks`/`concept_blocks`/`topic_blocks`)**不存在**

### `semantic_chunks` 字段禁令

该表 **禁含**:`content_type`、`source`、`language`、`metadata`、`parent_chunk_id`、`split_index`、`is_memo`

---

## 必传上下文模板

```yaml
task: "<原始请求>"
entity: "<实体名>"
table: "<表名>"
fields:
  - name: "<字段>"
    type: "<SQL 类型>"
    nullable: <true|false>
    default: "<默认值>"
mode: [new-table | new-field | new-method | refactor]
co_agents:
  - migration-agent: <若 new-field/new-table 影响已有库>
  - shared-agent: <实体/DTO 类型>
  - ipc-channel-agent: <若需暴露 CRUD>
```

---

## 退出标准

- [ ] 实体 + Create + Update 类型已加(在 shared,导出)
- [ ] DAO 类 `extends BaseDao<T,C,U>`,表名与 schema 一致
- [ ] 自定义查询用参数化 `?`
- [ ] `db/index.ts` 导出新 DAO
- [ ] `init.sql` 含新表基线(若新表)
- [ ] 字段迁移(若已有库)由 migration-agent 处理
- [ ] 不引用 v1 表(`blocks` 等)
- [ ] `semantic_chunks` 不含禁用字段(若触及)
- [ ] (可选)`pnpm typecheck` 通过
