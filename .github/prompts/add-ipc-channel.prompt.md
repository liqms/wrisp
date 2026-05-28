---
name: add-ipc-channel
description: "Use when: adding a new IPC channel domain to the project. Creates all four layers: preload module, preload types (optional), core API, and ipcMain handler, then registers in ipcMain/index.ts."
---

# 添加新 IPC 通道

为 PenTip 添加一个新的 IPC 通道域。

## 领域名称

<!-- 用户输入领域名称，如 "folder"、"note"、"tag" -->
领域名称：{{domainName}}

## 方法列表

<!-- 用户输入需要的方法，如 list, get, create, update, delete -->
需要的方法：{{methods}}

## 实体类型

<!-- 可选的实体类型名称，用于 API 响应类型 -->
实体类型（可选）：{{entityType}}

---

## 生成文件清单

请根据以上输入，创建以下 4 个文件：

### 1. Preload 类型定义

`src/main/preload/types/{{domainName}}.ts`

定义 `{{domainName}}Module` 的接口，每个方法返回 `Promise<ApiResponse<T>>`。

### 2. Preload 模块

`src/main/preload/modules/{{domainName}}.ts`

使用 `ipcRenderer.invoke()` 实现上述接口，导出 `{{domainName}}Module`。

### 3. Core API 层

`src/main/core/apis/{{domainName}}.api.ts`

每个方法用 try/catch 包裹，调用对应的 service 函数，返回 `response.success()` 或 `response.error()`。先检查 service 是否存在，如果不存在则创建临时的 stub。

### 4. IPC 处理器

`src/main/ipcMain/{{domainName}}.ipc.ts`

导出 `register{{PascalDomain}}Handlers()`，使用 `ipcMain.handle('{{domainName}}:method', handler)` 注册。

### 5. 注册

在 `src/main/ipcMain/index.ts` 中导入并调用 `register{{PascalDomain}}Handlers()`。

## 注意事项

- 遵循 `domain:action` 的 IPC 通道命名格式
- 所有 API 函数返回 `ApiResponse<T>` 类型
- 错误码使用 `'ERROR.{{DOMAIN}}.{{ACTION}}_FAILED'` 格式（需要先在 `src/shared/enums/errorCode.enums.ts` 中定义）
- Pinia store 和 composable 暂不生成（需要时单独创建）
