# IPC 通道开发指令

当处理 `src/main/preload/modules/`、`src/main/ipcMain/`、`src/main/core/apis/` 中的文件时，请遵循以下 IPC 四层模式。

## 四层结构

每个 IPC 通道需要以下 4 个文件（按创建顺序）：

```
src/main/preload/modules/<domain>.ts   ① Preload 模块（IPC 客户端）
src/main/preload/types/<domain>.ts     ② 类型定义（可选但推荐）
src/main/core/apis/<domain>.api.ts     ③ API 层（业务逻辑包装）
src/main/ipcMain/<domain>.ipc.ts       ④ IPC 处理器（注册通道）
```

然后在 `src/main/ipcMain/index.ts` 中注册。

## ① Preload 模块

位置：`src/main/preload/modules/<domain>.ts`

模式：
- 使用 `ipcRenderer.invoke()` 调用主进程
- 导出实现类型接口的对象
- 方法名与 IPC 通道名对齐

```typescript
import { ipcRenderer } from 'electron'
import type { DomainAPI } from '../types/domain'

export const domainModule: DomainAPI = {
  list: () => ipcRenderer.invoke('domain:list'),
  get: (id: string) => ipcRenderer.invoke('domain:get', id),
  create: (data) => ipcRenderer.invoke('domain:create', data),
  update: (id, data) => ipcRenderer.invoke('domain:update', id, data),
  delete: (id) => ipcRenderer.invoke('domain:delete', id),
}
```

## ② 类型定义（Preload 侧）

位置：`src/main/preload/types/<domain>.ts`

- 接口方法返回 `Promise<ApiResponse<T>>`
- `ApiResponse` 从 `@/shared/types` 导入

## ③ API 层

位置：`src/main/core/apis/<domain>.api.ts`

模式：
- 每个函数用 try/catch 包裹
- 成功返回 `response.success(data)`
- 错误返回 `response.error(ErrorCode.XXX, error as Error)`
- 用 `Logger.error()` 记录错误

```typescript
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { ApiResponse } from "@/shared/types";
import { Logger } from "@/main/utils/logger";

async function list(): Promise<ApiResponse<Entity[]>> {
  try {
    const data = service.list();
    return response.success(data);
  } catch (error) {
    Logger.error("列出失败", { error: String(error) });
    return response.error(ErrorCode.SOMETHING_FAILED, error as Error);
  }
}
```

## ④ IPC 处理器

位置：`src/main/ipcMain/<domain>.ipc.ts`

模式：
- 导出 `register<Domain>Handlers()` 函数
- 使用 `ipcMain.handle(channel, handler)` 注册
- 调用 `core/apis/` 中对应的函数

```typescript
import { ipcMain } from "electron";
import { list, get, create } from "@/main/core/apis/domain.api";
import type { ApiResponse } from "@/shared/types";

export function registerDomainHandlers() {
  ipcMain.handle("domain:list", async (): Promise<ApiResponse<Entity[]>> => {
    return list();
  });
  ipcMain.handle("domain:get", async (_, id: string): Promise<ApiResponse<Entity>> => {
    return get(id);
  });
}
```

## ⑤ 注册

在 `src/main/ipcMain/index.ts` 中导入并调用：

```typescript
import { registerDomainHandlers } from "./domain.ipc";

export function registerAllHandlers() {
  registerDomainHandlers();
}
```

## 渲染侧访问

组件中通过 composable 访问：

```typescript
const result = await window.electronAPI.domain.list();
if (result.success) {
  // 使用 result.data
} else {
  handleApiError(result, true); // 来自 src/renderer/utils/error.utils.ts
}
```

## 关键规则

- IPC 通道名使用 `domain:action` 格式（如 `config:get`、`capture:list`）
- 所有 API 函数返回 `ApiResponse<T>` 类型
- 不要直接暴露 `ipcRenderer` 给渲染进程——全部通过 preload 模块转发
- 错误码需先在 `src/shared/enums/errorCode.enums.ts` 中定义，格式为 `'ERROR.DOMAIN.ACTION_FAILED'`
