# DAO 层开发指令

当处理 `src/main/core/db/` 中的 DAO 文件时，请遵循以下模式。

## BaseDao 抽象类

位置：`src/main/core/db/base.dao.ts`

```typescript
export abstract class BaseDao<T, C extends object, U extends object> {
  protected tableName: string;
  // ...
}
```

三个泛型参数：
- **T** — 实体类型（查询返回）
- **C** — 创建数据类型（插入参数）
- **U** — 更新数据类型（更新参数）

## 创建新 DAO 的步骤

### 1. 定义实体类型

在 `src/shared/types/` 中定义实体接口，包含 `id`、`created_at`、`updated_at` 等基础字段。

### 2. 定义创建/更新 DTO

- 创建类型：继承或 Pick 实体中的必填字段（不包含 `id`、`created_at`、`updated_at`）
- 更新类型：所有字段可选（Partial），同样不包含自动时间戳字段

### 3. 创建 DAO 类

位置：`src/main/core/db/<entity>.dao.ts`

```typescript
import { BaseDao } from "./base.dao";
import type { Entity, EntityCreate, EntityUpdate } from "@/shared/types";

export class EntityDao extends BaseDao<Entity, EntityCreate, EntityUpdate> {
  constructor() {
    super("table_name"); // 表名必须与数据库一致
  }

  // CRUD 方法...
}
```

### 4. 注册到 index.ts

在 `src/main/core/db/index.ts` 中导出新 DAO。

## 标准 CRUD 方法

BaseDao 提供了以下通用方法（如有需要可以重写）：

| 方法 | 说明 |
|------|------|
| `create(data: C): T` | 插入记录，返回完整实体 |
| `findById(id: string): T \| undefined` | 按 ID 查询 |
| `findAll(params?): T[]` | 查询所有记录 |
| `update(id: string, data: U): T \| undefined` | 更新记录 |
| `delete(id: string): boolean` | 删除记录 |
| `paginate(page, pageSize, where?): PaginatedResult<T>` | 分页查询 |

## 关键规则

- **自动时间戳**：默认启用，`created_at` 和 `updated_at` 由 BaseDao 自动管理。可通过构造函数禁用。
- **表名验证**：必须匹配 `/^[a-zA-Z_][a-zA-Z0-9_]*$/`（纯字母数字下划线）。
- **SQL 注入防护**：始终使用 `?` 参数化查询，不要拼接 SQL 字符串。
- **事务**：对外暴露的方法内不要开启事务；事务由调用方（service 层）控制。
- **日志**：使用 `Logger.debug()` 记录 SQL 执行，`Logger.error()` 记录错误。
- **数据库连接**：通过 `this.db` 获取（自动从 `getDatabase()` 获取当前连接）。
