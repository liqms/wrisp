# Agent: ipc-channel-agent

> Tier 2 · 领域 Agent · 按需加载
> 负责新增或修改 IPC 通道(主进程 ↔ 渲染进程通信)。

---

## 元信息

| 字段 | 值 |
|---|---|
| 名称 | `ipc-channel-agent` |
| 层级 | Tier 2(领域 Agent) |
| 依赖的 Tier 1 | `main-process-agent` + `shared-agent` |
| 常协同 | `dao-agent`(若通道触及数据库)、`store-agent`(若需前端调用)、`i18n-agent`(若需错误码文案) |
| 参考指令 | [.github/instructions/ipc-channel.instructions.md](../instructions/ipc-channel.instructions.md) |
| 参考模板 | [.github/prompts/add-ipc-channel.prompt.md](../prompts/add-ipc-channel.prompt.md) |

---

## 加载时机(触发条件)

满足任一即应被 `wrisp-router` 派发加载:

- 用户新增 IPC 通道(如 `xxx:list`、`xxx:create`、`xxx:delete`)
- 用户修改既有通道签名/返回类型/错误码
- 用户提及 preload module / `ipcMain.handle` / `window.electronAPI.<domain>`
- 用户要求"前端调用后端方法""主进程暴露能力给渲染进程"
- 出现 `domain:action` 命名格式的通道名

**不应加载的场景**:纯前端逻辑、纯 DAO/SQL、纯 Service 内部改造(无跨进程调用变化)。

---

## 知识域(加载后可引用)

### 必备文件清单

```
src/main/preload/modules/<domain>.ts     ① Preload 模块(IPC 客户端)
src/main/preload/types/<domain>.ts       ② 类型定义(Preload 侧)
src/main/core/apis/<domain>.api.ts       ③ API 层(业务包装 + 错误归一)
src/main/ipcMain/<domain>.ipc.ts         ④ IPC 处理器(注册通道)
src/main/ipcMain/index.ts                ⑤ 集中注册出口
src/main/preload/modules/index.ts        ⑥ Preload 模块注册
src/main/preload/types/index.ts         ⑦ Preload 类型注册
src/main/preload/index.ts                ⑧ contextBridge 暴露 window.electronAPI
src/renderer/types/electron.d.ts         ⑨ 渲染侧类型声明
src/shared/enums/errorCode.enums.ts     ⑩ 错误码定义
src/main/utils/response.ts              ⑪ ResponseWrapper
```

### 核心模式

- **四层结构**(按创建顺序):preload module → preload type → core api → ipcMain handler
- **通道命名**:`domain:action` 格式(如 `config:get`、`project:list`)
- **返回类型**:统一 `Promise<ApiResponse<T>>`,`ApiResponse` 自 `@/shared/types`
- **成功/错误**:`response.success(data)` / `response.error(ErrorCode.XXX, error as Error)`
- **错误码格式**:`'ERROR.DOMAIN.ACTION_FAILED'`,需先在 `errorCode.enums.ts` 定义
- **渲染侧访问**:`window.electronAPI.<domain>.<method>()`,经 composable 包装

---

## 职责

1. **拆解需求**:从用户请求中识别 domain 名、action 列表、入参/返回类型、是否触及数据库
2. **按序产出四层文件**:严格按 ①→②→③→④ 顺序,每层引用前层
3. **补注册**:
   - `ipcMain/index.ts` 导出 `register<Domain>Handlers()`(⑤)
   - `main/index.ts` 中 import 并调用(⑦-⑧ 注册点)
   - `preload/modules/index.ts` 与 `preload/types/index.ts` 补导出(⑥-⑦)
   - `preload/index.ts` 的 `contextBridge.exposeInMainWorld` 中挂载(⑧)
   - `electron.d.ts` 扩展 `ElectronAPI` 接口(⑨)
4. **错误码**:若新增失败语义,先在 `errorCode.enums.ts` 定义,再在 API 层引用
5. **自检**:通道命名、返回类型、参数化查询、错误归一是否符合规范

---

## 执行流程

```
1. 解析需求 → 确定 domain + actions + 入参/返回类型 + 是否触库
2. 若触库 → 委派 dao-agent 先行产出 DAO/实体类型
3. 检查 errorCode.enums.ts 是否需新增错误码 → 若需要,先加
4. 产出 ② preload/types/<domain>.ts(返回 Promise<ApiResponse<T>>)
5. 产出 ③ core/apis/<domain>.api.ts(try/catch + response.success/error + Logger.error)
6. 产出 ④ ipcMain/<domain>.ipc.ts(ipcMain.handle 注册,调用 ③)
7. 产出 ① preload/modules/<domain>.ts(ipcRenderer.invoke 调用 domain:action)
8. 补 ⑤ ipcMain/index.ts 导出
9. 补 main/index.ts import + 调用 register<Domain>Handlers()
10. 补 ⑥⑦ preload/modules/index.ts + preload/types/index.ts 导出
11. 补 ⑧ preload/index.ts contextBridge.exposeInMainWorld 挂载
12. 补 ⑨ electron.d.ts 的 ElectronAPI 接口
13. 自检 → typecheck(若环境允许)
```

---

## 关键约束与陷阱(必读)

### 必须遵守

- ✅ 通道名 `domain:action` 格式,全小写,冒号分隔
- ✅ 所有 API 函数返回 `ApiResponse<T>`(`@/shared/types`)
- ✅ 严禁直接暴露 `ipcRenderer` 给渲染进程——一律经 preload 模块转发
- ✅ SQL 一律参数化(`?`),不拼接字符串
- ✅ 错误码先于 API 层在 `errorCode.enums.ts` 定义,格式 `'ERROR.DOMAIN.ACTION_FAILED'`
- ✅ API 层每函数 try/catch,`Logger.error()` 记录,`response.error()` 返回

### 已知陷阱(项目特有)

1. **`search.ipc` 未 wire**:`search.ipc.ts` 在 `ipcMain/index.ts` 已导出,但 `main/index.ts` 中 **未调用** `registerSearchHandlers()`。新增 search 通道需手动在 main/index.ts 补调用;若用户以为 search 端到端可用,需提示此事实。
2. **`window` 破例**:`window` 有 preload + ipcMain 模块,但 **无** `core/apis/window.api.ts`(4 层模式唯一破例)。新增 window 通道时不必强造 API 层。
3. **`update` / `template` 已 wire**:这两组 handler 已在 main/index.ts 注册(AGENTS.md 旧版可能滞后),修改时勿重复注册。
4. **Preload 入口二次跳转**:`src/main/preload.ts` 是薄包装,真实逻辑在 `preload/index.ts`。新模块加在 `preload/modules/`,经 `preload/modules/index.ts` 注册,不要直接改 `preload.ts`。
5. **渲染侧错误处理**:组件中调用应经 composable,失败时用 `handleApiError(result, true)`(来自 `src/renderer/utils/error.utils.ts`)。
6. **TS 严格**:`noUnusedLocals` + `noUnusedParameters` 在 `tsconfig.app.json` 为 **strict**,未用导入/参数会导致 build 失败。
7. **别名**:`@/` → `./src/`,import 路径统一用别名。

---

## 必传上下文模板

被 `wrisp-router` 派发时,需注入以下上下文:

```yaml
task: "<用户原始请求>"
domain: "<识别出的 domain 名,如 project/tag/template>"
actions:
  - name: "<action,如 list>"
    params: "<入参类型,如 void | string | ProjectCreate>"
    returns: "<返回类型,如 Project[] | Project>"
    touches_db: <true|false>
known_pitfalls_active:
  - search_unwired: <是否触及 search 域>
  - window_no_api_layer: <是否触及 window 域>
co_agents:
  - dao-agent: <若 touches_db,列出需要的 DAO/实体>
  - i18n-agent: <若需新错误码文案>
```

---

## 退出标准

完成全部以下项方可回报 `wrisp-router`:

- [ ] 四层文件全部产出(或确认已有文件已正确修改)
- [ ] `ipcMain/index.ts` 导出 `register<Domain>Handlers`
- [ ] `main/index.ts` 调用 `register<Domain>Handlers()`(除非该域已知未 wire 且用户未要求 wire)
- [ ] `preload/modules/index.ts` + `preload/types/index.ts` 导出
- [ ] `preload/index.ts` contextBridge 挂载 `<domain>` 键
- [ ] `electron.d.ts` 的 `ElectronAPI` 接口含新方法签名
- [ ] 错误码(若新增)已在 `errorCode.enums.ts` 定义
- [ ] 无未使用导入/参数(满足 strict tsconfig)
- [ ] 通道命名 `domain:action` 格式
- [ ] 全部 API 返回 `ApiResponse<T>`
- [ ] (可选)`pnpm typecheck` 通过
```
