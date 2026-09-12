# 重建索引支持重新加载项目数据 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 设置页"重建索引"按钮在重置日志索引（file_index）的同时，从磁盘 `project.json` / `pages.json` 重新加载项目数据（projects + pages 表），逻辑模式参考日志的 `resetJournalTable`。

**Architecture:** 参照日志的四层 IPC 模式：`project.service.ts` 新增 `resetProjectTable()`（扫描 `projects/*/project.json` + 同级 `pages.json` → 事务内清空并重放 projects/pages 表）→ `project.api.ts` 包装 `ApiResponse` → `project.ipc.ts` 注册 `project:resetProjectTable` → preload 暴露 → Pinia store / composable → `GeneralSettings.vue` 的 `rebuildIndex` 并行调用日志与项目两个重置。关键决策：**保留原 ID 与时间戳**（显式 INSERT 列清单，绕过 `BaseDao.create` 的时间戳覆写），页面按**拓扑顺序**插入以满足 `parent_page_id` 自引用外键。

**Tech Stack:** Electron IPC（4 层模式）、better-sqlite3（事务 + 外键）、Vue 3 + Pinia + vue-i18n、Vitest（node 环境 + :memory: SQLite）。

**约束（来自项目规则）：**
- `dev` 分支受保护，所有提交通过 PR；先切特性分支 `feature/rebuild-index-reload-projects`
- 数据库仅 v2 表；`pages.project_id` → `projects`（ON DELETE SET NULL）、`pages.parent_page_id` → `pages`（ON DELETE CASCADE）、`project_chunks` → 双外键 CASCADE
- zhCN/enUS i18n 键必须完全对称（`tests/unit/shared/locale-keys.test.ts` 强制校验）
- `tsconfig.app.json` 开启 `noUnusedLocals`/`noUnusedParameters`，禁止未使用导入

---

## 背景知识（零上下文工程师必读）

### 日志的参考模式（现状）

`src/main/core/services/journal.service.ts` 的 `resetJournalTable()`：
1. `scanJournalFiles()` 扫描 `journal/` 目录下日期命名的 `.md` 文件，构建 `FileIndexCreate[]`
2. 事务内：先删外键子表 `semantic_chunks` → 清空 `file_index` → 重新填充
3. 返回记录数

调用链：`GeneralSettings.vue rebuildIndex()` → `useJournal().resetJournalTable()` → `journal.store` → `window.electronAPI.journal.resetJournalTable()`（preload）→ `journal.ipc.ts` 的 `journal:resetJournalTable` → `journal.api.ts` → `journalService`。

### 项目数据的存储结构

- 磁盘：`workspace/projects/{unix秒时间戳}/` 文件夹，内含 `project.json`（projects 表整行镜像，由 `syncProjectJson` 在每次变更时写入）、`pages.json`（该作品全部 pages 表行镜像，由 `syncPagesJson` 写入）、`chapters/*.md`（正文）
- 数据库表：`projects`、`pages`、`project_chunks`（CASCADE）、`tagged_items`（多态，无外键，靠 `entity_type='project' AND entity_id` 关联）
- `pages.json` 中页面 `parent_page_id` 可指向同级其他页面 → 重放时必须父先子后

### 涉及表结构（src/main/schemas/init.sql）

```sql
projects(id, name, file_path, description, type, status, created_at, updated_at,
         ai_summary, structure, metadata, is_pinned)  -- status CHECK ('active','deleted')
pages(id, project_id REFERENCES projects(id) ON DELETE SET NULL, title, file_path,
      order_index, parent_page_id REFERENCES pages(id) ON DELETE CASCADE, word_count,
      ai_summary, page_type NOT NULL DEFAULT 'project_chapter', metadata, status,
      created_at, updated_at)
```

---

## 文件清单

| 操作 | 文件 | 职责 |
|---|---|---|
| 修改 | `src/main/types/db/project.types.ts` | 新增 `ProjectReloadResult` 共享类型 |
| 修改 | `src/main/core/services/project.service.ts` | 核心：`resetProjectTable()` + 扫描/解析/重放私有方法 |
| 新建 | `tests/integration/main/project.reset.test.ts` | 集成测试（:memory: SQLite + mock fileService） |
| 修改 | `src/shared/enums/errorCode.enums.ts` | 新增 `PROJECT_RESET_FAILED` |
| 修改 | `src/main/core/apis/project.api.ts` | API 层包装 |
| 修改 | `src/main/ipcMain/project.ipc.ts` | 注册 `project:resetProjectTable` |
| 修改 | `src/main/preload/types/project.ts` | preload 类型 |
| 修改 | `src/main/preload/modules/project.ts` | preload 实现 |
| 修改 | `src/renderer/types/electron.d.ts` | 渲染进程 `window.electronAPI` 声明 |
| 修改 | `src/renderer/store/project.store.ts` | Pinia action |
| 修改 | `src/renderer/composables/useProject.ts` | composable 包装 |
| 修改 | `src/renderer/components/settings/general/GeneralSettings.vue` | 重建索引按钮调用两个重置 |
| 修改 | `src/shared/i18n/locales/zhCN.ts` / `enUS.ts` | 文案 + 错误消息（两文件对称） |

---

### Task 1: 切分支 + 编写失败测试

**Files:**
- Test: `tests/integration/main/project.reset.test.ts`（新建）

- [ ] **Step 1: 从最新 dev 切特性分支**

```bash
git checkout dev
git pull
git checkout -b feature/rebuild-index-reload-projects
```

- [ ] **Step 2: 编写集成测试文件**

新建 `tests/integration/main/project.reset.test.ts`（脚手架复制自 `tests/integration/main/page.service.test.ts` 的 electron/logger/winston/connection mock 模式）：

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

vi.mock('electron', () => ({
  app: { getAppPath: vi.fn(() => '/tmp'), getPath: vi.fn(() => '/tmp'), getVersion: vi.fn(() => '1.0.0'), getName: vi.fn(() => 'Wrisp'), on: vi.fn() },
  BrowserWindow: vi.fn(),
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
}))
vi.mock('@/main/utils/logger', () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}))
vi.mock('winston', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  format: { combine: vi.fn(), timestamp: vi.fn(), printf: vi.fn(), colorize: vi.fn(), simple: vi.fn(), json: vi.fn() },
  transports: { Console: vi.fn(), File: vi.fn() },
  addColors: vi.fn(),
}))
vi.mock('winston-daily-rotate-file', () => ({ default: vi.fn() }))

// mock 文件服务：各用例通过 mockDiskData 注入磁盘上的 JSON 文件
const fileServiceMock = vi.hoisted(() => ({
  exists: vi.fn(() => true),
  readFile: vi.fn(() => ''),
  writeFile: vi.fn(),
  listFiles: vi.fn(() => [] as string[]),
  remove: vi.fn(),
}))
vi.mock('@/main/core/services/base/file.service', () => ({
  fileService: fileServiceMock,
}))

let memDb: Database.Database | null = null
function initMemDb(): Database.Database {
  memDb = new Database(':memory:')
  memDb.pragma('journal_mode = WAL')
  memDb.pragma('foreign_keys = ON')
  for (const schemaPath of [path.resolve(process.cwd(), 'src/main/schemas/init.sql')]) {
    if (fs.existsSync(schemaPath)) {
      memDb.exec(fs.readFileSync(schemaPath, 'utf-8'))
      break
    }
  }
  return memDb
}
vi.mock('@/main/core/db/connection', () => ({
  getDatabase: () => { if (!memDb) initMemDb(); return memDb! },
  initDatabase: () => { if (!memDb) initMemDb(); return memDb! },
  closeDatabase: () => { memDb?.close(); memDb = null },
  setWorkspacePath: vi.fn(),
  getDbPath: () => ':memory:',
  isDatabaseConnected: () => memDb !== null,
}))

import { ProjectDao, PageDao, TagDao } from '@/main/core/db'
import { getDatabase } from '@/main/core/db/connection'
import { projectService } from '@/main/core/services/project.service'

/** 模拟磁盘文件：key 为正斜杠相对路径，value 为文件内容 */
function mockDiskData(files: Record<string, string>) {
  fileServiceMock.listFiles.mockImplementation((_dir: string, ext: string) =>
    Object.keys(files)
      .filter((f) => f.endsWith(ext))
      // 模拟 Windows path.join 产生的反斜杠路径
      .map((f) => f.replace(/\//g, '\\')),
  )
  fileServiceMock.readFile.mockImplementation((p: string) => {
    const key = p.replace(/\\/g, '/')
    if (!(key in files)) throw new Error(`unexpected readFile: ${p}`)
    return files[key]
  })
  fileServiceMock.exists.mockImplementation((p: string) => p.replace(/\\/g, '/') in files)
}

const CREATED = '2025-01-01T00:00:00.000Z'
const UPDATED = '2025-01-02T00:00:00.000Z'

function makeProjectJson(id: string, name: string) {
  return JSON.stringify({
    id,
    name,
    file_path: 'projects/legacy-path/', // 故意与磁盘路径不同，验证以磁盘为准
    description: 'from disk',
    type: 'novel',
    status: 'active',
    created_at: CREATED,
    updated_at: UPDATED,
    ai_summary: '',
    structure: '',
    metadata: '{}',
    is_pinned: 1,
  })
}

function makePageJson(id: string, projectId: string, parentId: string | null, title: string) {
  return {
    id,
    project_id: projectId,
    title,
    file_path: `projects/1000000001/chapters/${id}.md`,
    order_index: 0,
    parent_page_id: parentId,
    word_count: 10,
    ai_summary: null,
    page_type: 'project_chapter',
    metadata: '{}',
    status: 'active',
    created_at: CREATED,
    updated_at: UPDATED,
  }
}

describe('ProjectService.resetProjectTable', () => {
  let projectDao: ProjectDao
  let pageDao: PageDao

  beforeEach(() => {
    const db = getDatabase()
    for (const t of ['pages', 'project_chunks', 'projects', 'tagged_items', 'tags']) {
      db.exec(`DELETE FROM ${t}`)
    }
    projectDao = new ProjectDao()
    pageDao = new PageDao()
    fileServiceMock.listFiles.mockReturnValue([])
    fileServiceMock.readFile.mockReturnValue('')
    fileServiceMock.exists.mockReturnValue(true)
  })

  it('从磁盘重载作品与页面，保留 ID/时间戳并删除磁盘上不存在的记录', () => {
    mockDiskData({
      'projects/1000000001/project.json': makeProjectJson('proj-disk', 'Disk Project'),
      'projects/1000000001/pages.json': JSON.stringify([
        makePageJson('page-parent', 'proj-disk', null, 'Parent'),
        makePageJson('page-child', 'proj-disk', 'page-parent', 'Child'),
      ]),
    })
    // 数据库中存在一个磁盘上没有的作品
    projectDao.create({ name: 'DB Only', type: 'novel', file_path: 'projects/999/' })

    const result = projectService.resetProjectTable()

    expect(result).toEqual({ projects: 1, pages: 2 })

    const project = projectDao.findById('proj-disk')!
    expect(project.name).toBe('Disk Project')
    // file_path 以磁盘实际文件夹为准
    expect(project.file_path).toBe('projects/1000000001/')
    // 时间戳保留（未被 BaseDao.create 覆写为当前时间）
    expect(project.created_at).toBe(CREATED)
    expect(project.updated_at).toBe(UPDATED)

    // 页面父子关系保留
    expect(pageDao.findById('page-child')!.parent_page_id).toBe('page-parent')

    // 磁盘上不存在的作品被删除
    const remaining = projectDao.findAll()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe('proj-disk')
  })

  it('子页面先于父页面出现在 pages.json 中也能正确插入（拓扑排序）', () => {
    mockDiskData({
      'projects/1000000001/project.json': makeProjectJson('proj-disk', 'Disk Project'),
      'projects/1000000001/pages.json': JSON.stringify([
        makePageJson('page-child', 'proj-disk', 'page-parent', 'Child'),
        makePageJson('page-parent', 'proj-disk', null, 'Parent'),
      ]),
    })

    const result = projectService.resetProjectTable()

    expect(result).toEqual({ projects: 1, pages: 2 })
    expect(pageDao.findById('page-child')!.parent_page_id).toBe('page-parent')
  })

  it('跳过缺少 project.json 的文件夹、缺必填字段的页面与父节点缺失的页面', () => {
    mockDiskData({
      // 只有 pages.json、没有 project.json 的文件夹被整体跳过
      'projects/1000000002/pages.json': JSON.stringify([
        makePageJson('page-orphan', 'proj-none', null, 'Orphan'),
      ]),
      'projects/1000000001/project.json': makeProjectJson('proj-disk', 'Disk Project'),
      'projects/1000000001/pages.json': JSON.stringify([
        makePageJson('page-valid', 'proj-disk', null, 'Valid'),
        // 缺少 title（空字符串）
        { ...makePageJson('', 'proj-disk', null, ''), id: 'page-no-title' },
        // 父节点不存在
        makePageJson('page-dangling', 'proj-disk', 'page-ghost', 'Dangling'),
        // project_id 不在已重放作品中
        makePageJson('page-foreign', 'proj-ghost', null, 'Foreign'),
      ]),
    })

    const result = projectService.resetProjectTable()

    expect(result).toEqual({ projects: 1, pages: 1 })
    expect(pageDao.findById('page-valid')).not.toBeNull()
    expect(pageDao.findById('page-no-title')).toBeNull()
    expect(pageDao.findById('page-dangling')).toBeNull()
    expect(pageDao.findById('page-foreign')).toBeNull()
  })

  it('清理已删除作品的孤儿标签关联，保留仍存在作品的关联', () => {
    mockDiskData({
      'projects/1000000001/project.json': makeProjectJson('proj-disk', 'Disk Project'),
    })

    const tagDao = new TagDao()
    const tagId = tagDao.create({ name: 'tag-1' })
    const db = getDatabase()
    const now = new Date().toISOString()
    db.prepare(
      "INSERT INTO tagged_items (tag_id, entity_type, entity_id, added_at) VALUES (?, 'project', 'proj-disk', ?)",
    ).run(tagId, now)
    db.prepare(
      "INSERT INTO tagged_items (tag_id, entity_type, entity_id, added_at) VALUES (?, 'project', 'proj-ghost', ?)",
    ).run(tagId, now)

    projectService.resetProjectTable()

    const rows = db.prepare(
      "SELECT entity_id FROM tagged_items WHERE entity_type = 'project'",
    ).all() as { entity_id: string }[]
    expect(rows).toEqual([{ entity_id: 'proj-disk' }])
  })
})
```

- [ ] **Step 3: 运行测试验证失败**

```bash
pnpm test tests/integration/main/project.reset.test.ts
```

预期：**FAIL** —— `projectService.resetProjectTable is not a function`（方法尚未实现，4 个用例全部失败）。

---

### Task 2: 服务层实现（类型 + resetProjectTable）

**Files:**
- Modify: `src/main/types/db/project.types.ts`（文件末尾追加）
- Modify: `src/main/core/services/project.service.ts`

- [ ] **Step 1: 新增共享结果类型**

在 `src/main/types/db/project.types.ts` 文件末尾（`ProjectDetail` 接口之后）追加：

```ts
export interface ProjectReloadResult {
  /** 重载的作品数量 */
  projects: number
  /** 重载的页面数量 */
  pages: number
}
```

说明：`src/main/types/db/index.ts:14` 已有 `export * from "./project.types"`，无需再改 barrel。

- [ ] **Step 2: 修改 project.service.ts 的导入与构造**

`src/main/core/services/project.service.ts` 当前头部（1-32 行）改为：

```ts
import { PageDao, ProjectDao } from "@/main/core/db";
import type {
  ProjectCreate,
  ProjectUpdate,
  ProjectQuery,
  ProjectDetail,
  ProjectReloadResult,
} from "@/main/types/db";
import { PaginationResult } from "@/shared/utils/pagination";
import { Logger } from "@/main/utils/logger";
import { fileService } from "@/main/core/services/base/file.service";
import { NodeCryptoUtil } from "@/main/utils";
import { PROJECT_DIR } from "@/main/constants/folder.constants";
import { PAGE_TYPE } from "@/shared/enums";
```

在 class 内（`private projectDao: ProjectDao;` 之后）新增成员，并修改构造函数：

```ts
class ProjectService {
  private static instance: ProjectService | null = null;
  private projectDao: ProjectDao;
  private pageDao: PageDao;

  /** 特殊字符正则（Windows 文件夹名非法字符） */
  private readonly INVALID_CHARS_REGEX = /[\\/:*?"<>|]/g;

  private constructor() {
    this.projectDao = new ProjectDao();
    this.pageDao = new PageDao();
  }
```

- [ ] **Step 3: 在 class 之前（import 与 class 之间）定义行类型**

```ts
/** 从 project.json 解析出的作品行（字段与 projects 表对齐） */
interface ProjectRow {
  id: string;
  name: string;
  file_path: string;
  description: string | null;
  type: string | null;
  status: "active" | "deleted";
  created_at: string;
  updated_at: string;
  ai_summary: string | null;
  structure: string | null;
  metadata: string;
  is_pinned: boolean;
}

/** 从 pages.json 解析出的页面行（字段与 pages 表对齐） */
interface PageRow {
  id: string;
  project_id: string | null;
  title: string;
  file_path: string;
  order_index: number;
  parent_page_id: string | null;
  word_count: number;
  ai_summary: string | null;
  page_type: string;
  metadata: string;
  status: "active" | "deleted";
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: 在 class 末尾（`checkProjectNameExists` 方法之后、class 关闭括号之前）追加核心方法**

```ts
  // ==================== 重建索引：从磁盘重载项目数据 ====================

  /**
   * 根据作品文件夹中的 project.json / pages.json 重置 projects 与 pages 表
   * 逻辑模式参考日志的 resetJournalTable：扫描磁盘 → 事务内清空重放。
   * 注意：
   *   1. 保留原 ID 与 created_at/updated_at（tagged_items 标签关联依赖 ID）
   *   2. project_chunks 随 projects 外键级联清理（派生数据，由智能任务重建）
   *   3. 磁盘上不存在的作品/页面记录会被删除
   * @returns 重载的作品与页面数量
   */
  public resetProjectTable(): ProjectReloadResult {
    try {
      const folders = this.scanProjectFolders();

      const result = this.projectDao.transaction(() => {
        // 清空旧数据（pages 先于 projects，避免外键置空/级联）
        this.projectDao.execute("DELETE FROM pages");
        this.projectDao.execute("DELETE FROM project_chunks");
        this.projectDao.execute("DELETE FROM projects");

        // 重放作品
        for (const { project } of folders) {
          this.insertProjectRow(project);
        }

        // 重放页面（project_id 必须指向已重放的作品，否则跳过防外键违约）
        const loadedProjectIds = new Set(folders.map((f) => f.project.id));
        const allPages = folders
          .flatMap((f) => f.pages)
          .filter((p) => !p.project_id || loadedProjectIds.has(p.project_id));
        const pageCount = this.insertPageRows(allPages);

        // 清理已不存在作品的孤儿标签关联
        this.projectDao.execute(
          "DELETE FROM tagged_items WHERE entity_type = 'project' AND entity_id NOT IN (SELECT id FROM projects)",
        );

        // 重建 FTS 全文索引（external-content 表 DELETE/INSERT 不会自动同步，需手动 rebuild）
        this.projectDao.execute("INSERT INTO pages_fts(pages_fts) VALUES('rebuild')");
        this.projectDao.execute("INSERT INTO projects_fts(projects_fts) VALUES('rebuild')");

        return { projects: folders.length, pages: pageCount };
      });

      Logger.info("projects/pages 表重置完成", result);
      return result;
    } catch (error) {
      Logger.error("重置 projects/pages 表失败", { error: String(error) });
      throw error;
    }
  }

  /**
   * 扫描 projects/ 目录下的作品文件夹（含 project.json 的直接子目录），
   * 读取 project.json 与同级 pages.json 构建重放数据
   */
  private scanProjectFolders(): { project: ProjectRow; pages: PageRow[] }[] {
    const jsonFiles = fileService
      .listFiles(`${PROJECT_DIR}/`, ".json")
      .map((p) => p.replace(/\\/g, "/"));

    const results: { project: ProjectRow; pages: PageRow[] }[] = [];
    const seenIds = new Set<string>();

    for (const jsonFile of jsonFiles) {
      if (!/^projects\/[^/]+\/project\.json$/.test(jsonFile)) continue;

      const projectDir = jsonFile.slice(0, -"project.json".length);
      try {
        const project = this.parseProjectJson(jsonFile, projectDir);
        if (seenIds.has(project.id)) {
          Logger.warn("磁盘上存在重复的作品 ID，跳过后续文件夹", {
            id: project.id,
            projectDir,
          });
          continue;
        }
        seenIds.add(project.id);
        const pages = this.parsePagesJson(`${projectDir}pages.json`);
        results.push({ project, pages });
      } catch (error) {
        Logger.warn("解析作品数据失败，跳过该文件夹", {
          jsonFile,
          error: String(error),
        });
      }
    }

    return results;
  }

  /**
   * 解析 project.json 为作品行
   * file_path 以磁盘实际文件夹为准（支持文件夹被手动重命名的场景）
   */
  private parseProjectJson(
    jsonPath: string,
    projectDir: string,
  ): ProjectRow {
    const raw = JSON.parse(fileService.readFile(jsonPath)) as Record<string, unknown>;
    if (
      typeof raw.id !== "string" || !raw.id ||
      typeof raw.name !== "string" || !raw.name
    ) {
      throw new Error("project.json 缺少必填字段 id/name");
    }
    const now = new Date().toISOString();
    return {
      id: raw.id,
      name: raw.name,
      file_path: projectDir,
      description: typeof raw.description === "string" ? raw.description : null,
      type: typeof raw.type === "string" ? raw.type : null,
      status: raw.status === "deleted" ? "deleted" : "active",
      created_at: typeof raw.created_at === "string" ? raw.created_at : now,
      updated_at: typeof raw.updated_at === "string" ? raw.updated_at : now,
      ai_summary: typeof raw.ai_summary === "string" ? raw.ai_summary : null,
      structure: this.serializeJsonText(raw.structure, null),
      metadata: this.serializeJsonText(raw.metadata, "{}") ?? "{}",
      is_pinned: raw.is_pinned === true || raw.is_pinned === 1,
    };
  }

  /**
   * 解析 pages.json 为页面行数组（文件不存在时返回空数组）
   * 缺少必填字段（id/title/file_path）的条目跳过
   */
  private parsePagesJson(pagesJsonPath: string): PageRow[] {
    if (!fileService.exists(pagesJsonPath)) return [];

    const rawList = JSON.parse(
      fileService.readFile(pagesJsonPath),
    ) as Record<string, unknown>[];
    const now = new Date().toISOString();
    const pages: PageRow[] = [];

    for (const raw of rawList) {
      if (
        typeof raw.id !== "string" || !raw.id ||
        typeof raw.title !== "string" || !raw.title ||
        typeof raw.file_path !== "string" || !raw.file_path
      ) {
        Logger.warn("pages.json 条目缺少必填字段，跳过", { id: raw.id });
        continue;
      }
      pages.push({
        id: raw.id,
        project_id: typeof raw.project_id === "string" ? raw.project_id : null,
        title: raw.title,
        file_path: raw.file_path,
        order_index: typeof raw.order_index === "number" ? raw.order_index : 0,
        parent_page_id:
          typeof raw.parent_page_id === "string" ? raw.parent_page_id : null,
        word_count: typeof raw.word_count === "number" ? raw.word_count : 0,
        ai_summary: typeof raw.ai_summary === "string" ? raw.ai_summary : null,
        page_type:
          typeof raw.page_type === "string" ? raw.page_type : PAGE_TYPE.PROJECT_CHAPTER,
        metadata: this.serializeJsonText(raw.metadata, "{}") ?? "{}",
        status: raw.status === "deleted" ? "deleted" : "active",
        created_at: typeof raw.created_at === "string" ? raw.created_at : now,
        updated_at: typeof raw.updated_at === "string" ? raw.updated_at : now,
      });
    }

    return pages;
  }

  /** JSON 文本字段序列化：字符串原样返回，对象序列化，空值返回兜底值 */
  private serializeJsonText(
    value: unknown,
    fallback: string | null,
  ): string | null {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  }

  /** 插入作品行（显式列清单，保留原时间戳，绕过 BaseDao.create 的时间戳覆写） */
  private insertProjectRow(project: ProjectRow): void {
    this.projectDao.execute(
      `INSERT INTO projects (id, name, file_path, description, type, status, created_at, updated_at, ai_summary, structure, metadata, is_pinned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project.id,
        project.name,
        project.file_path,
        project.description,
        project.type,
        project.status,
        project.created_at,
        project.updated_at,
        project.ai_summary,
        project.structure,
        project.metadata,
        project.is_pinned ? 1 : 0,
      ],
    );
  }

  /**
   * 按拓扑顺序插入页面（父节点先于子节点，满足 parent_page_id 外键）
   * 父节点缺失的页面跳过并告警
   * @returns 实际插入的页面数
   */
  private insertPageRows(pages: PageRow[]): number {
    const pending = [...pages];
    const insertedIds = new Set<string>();
    let progressed = true;

    while (pending.length > 0 && progressed) {
      progressed = false;
      for (let i = pending.length - 1; i >= 0; i--) {
        const page = pending[i];
        if (page.parent_page_id && !insertedIds.has(page.parent_page_id)) {
          continue;
        }
        this.insertPageRow(page);
        insertedIds.add(page.id);
        pending.splice(i, 1);
        progressed = true;
      }
    }

    if (pending.length > 0) {
      Logger.warn("部分页面因父节点缺失被跳过", { count: pending.length });
    }
    return insertedIds.size;
  }

  /** 插入页面行（显式列清单，保留原时间戳） */
  private insertPageRow(page: PageRow): void {
    this.pageDao.execute(
      `INSERT INTO pages (id, project_id, title, file_path, order_index, parent_page_id, word_count, ai_summary, page_type, metadata, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        page.id,
        page.project_id,
        page.title,
        page.file_path,
        page.order_index,
        page.parent_page_id,
        page.word_count,
        page.ai_summary,
        page.page_type,
        page.metadata,
        page.status,
        page.created_at,
        page.updated_at,
      ],
    );
  }
```

- [ ] **Step 5: 运行测试验证通过**

```bash
pnpm test tests/integration/main/project.reset.test.ts
```

预期：**PASS**（4 个用例全部通过）。

- [ ] **Step 6: 提交**

```bash
git add src/main/types/db/project.types.ts src/main/core/services/project.service.ts tests/integration/main/project.reset.test.ts
git commit -m "feat: 重建索引支持从磁盘重载作品与页面数据（服务层）"
```

---

### Task 3: IPC 四层通道打通

**Files:**
- Modify: `src/shared/enums/errorCode.enums.ts:41`（`PROJECT_DELETE_FAILED` 之后）
- Modify: `src/main/core/apis/project.api.ts`
- Modify: `src/main/ipcMain/project.ipc.ts`
- Modify: `src/main/preload/types/project.ts`
- Modify: `src/main/preload/modules/project.ts`
- Modify: `src/renderer/types/electron.d.ts`
- Modify: `src/shared/i18n/locales/zhCN.ts`（ERROR.PROJECT 段，约 535-542 行）
- Modify: `src/shared/i18n/locales/enUS.ts`（ERROR.PROJECT 段，约 543-550 行）

- [ ] **Step 1: 新增错误码**

`src/shared/enums/errorCode.enums.ts` 在 `PROJECT_DELETE_FAILED = "ERROR.PROJECT.DELETE_FAILED",` 之后追加一行：

```ts
  PROJECT_RESET_FAILED = "ERROR.PROJECT.RESET_FAILED",
```

（注：`getErrorCategory` 对既有 PROJECT_* 错误码本就走 default→UNKNOWN 分支，无需改动该函数。）

- [ ] **Step 2: 新增 i18n 错误消息（两文件必须对称）**

`zhCN.ts` ERROR.PROJECT 段追加 `RESET_FAILED`：

```ts
    PROJECT: {
      CREATE_FAILED: "创建作品失败",
      GET_FAILED: "获取作品失败",
      UPDATE_FAILED: "更新作品失败",
      DELETE_FAILED: "删除作品失败",
      LIST_FAILED: "获取作品列表失败",
      NOT_FOUND: "作品不存在",
      RESET_FAILED: "重置作品数据失败",
    },
```

`enUS.ts` ERROR.PROJECT 段追加：

```ts
      RESET_FAILED: "Failed to reset project data",
```

- [ ] **Step 3: API 层**

`src/main/core/apis/project.api.ts`：
1. 类型导入改为 `import type { ProjectCreate, ProjectUpdate, ProjectQuery, ProjectDetail, ProjectReloadResult } from "@/main/types/db";`
2. 在 `checkProjectNameExists` 函数后追加：

```ts
/**
 * 根据作品文件夹中的 project.json / pages.json 重置 projects 与 pages 表
 * @returns 重载的作品与页面数量
 */
async function resetProjectTable(): Promise<ApiResponse<ProjectReloadResult>> {
  try {
    const result = projectService.resetProjectTable();
    return response.success(result);
  } catch (error) {
    Logger.error("重置 projects/pages 表失败", { error: String(error) });
    return response.error(ErrorCode.PROJECT_RESET_FAILED, error as Error);
  }
}
```

3. 导出块追加 `resetProjectTable,`。

- [ ] **Step 4: IPC 注册**

`src/main/ipcMain/project.ipc.ts`：
1. import 中追加 `resetProjectTable,`（from `@/main/core/apis/project.api`）
2. 类型导入追加 `ProjectReloadResult`（from `@/main/types/db`）
3. `registerProjectHandlers()` 内（`project:checkNameExists` handler 之后）追加：

```ts
  ipcMain.handle(
    "project:resetProjectTable",
    async (): Promise<ApiResponse<ProjectReloadResult>> => {
      return resetProjectTable();
    },
  );
```

（注：`registerProjectHandlers` 已在 `src/main/index.ts` 注册，无需改动主入口。）

- [ ] **Step 5: preload 类型与实现**

`src/main/preload/types/project.ts`：
1. 导入追加 `ProjectReloadResult`（from `@/main/types/db`）
2. `ProjectAPI` 接口追加：

```ts
  resetProjectTable(): Promise<ApiResponse<ProjectReloadResult>>;
```

`src/main/preload/modules/project.ts` 的 `projectModule` 追加：

```ts
  resetProjectTable: () => ipcRenderer.invoke("project:resetProjectTable"),
```

- [ ] **Step 6: 渲染进程类型声明**

`src/renderer/types/electron.d.ts`：
1. 第 23 行类型导入追加 `ProjectReloadResult`：
   `import type { ProjectCreate, ProjectUpdate, ProjectQuery, ProjectDetail, ProjectReloadResult, Page, PageTree } from "@/main/types/db";`
2. `project` 块（约 109 行起，`checkNameExists` 之后）追加：

```ts
    resetProjectTable(): Promise<ApiResponse<ProjectReloadResult>>;
```

- [ ] **Step 7: 验证 + 提交**

```bash
pnpm typecheck
```

预期：无错误。通过后提交：

```bash
git add src/shared/enums/errorCode.enums.ts src/main/core/apis/project.api.ts src/main/ipcMain/project.ipc.ts src/main/preload/types/project.ts src/main/preload/modules/project.ts src/renderer/types/electron.d.ts src/shared/i18n/locales/zhCN.ts src/shared/i18n/locales/enUS.ts
git commit -m "feat: 新增 project:resetProjectTable IPC 通道"
```

---

### Task 4: 渲染层接入（store + composable + 设置页）

**Files:**
- Modify: `src/renderer/store/project.store.ts`
- Modify: `src/renderer/composables/useProject.ts`
- Modify: `src/renderer/components/settings/general/GeneralSettings.vue`
- Modify: `src/shared/i18n/locales/zhCN.ts`（DATA_MANAGER_SETTINGS 段，约 380-387 行）
- Modify: `src/shared/i18n/locales/enUS.ts`（DATA_MANAGER_SETTINGS 段，约 383-390 行）

- [ ] **Step 1: 更新设置页文案（两文件对称）**

`zhCN.ts` DATA_MANAGER_SETTINGS 段：

```ts
    DATA_MANAGER_SETTINGS: {
      WORKSPACE: "工作空间",
      SELECT_WORKSPACE: "选择工作空间",
      REBUILD_INDEX: "重建索引",
      REBUILD_INDEX_DESC: "读取本地 Journal 与作品文件，重新构建数据索引",
      REBUILD_INDEX_LOADING: "重建中...",
      REBUILD_INDEX_SUCCESS: "索引重建完成：日志 {journals} 条，作品 {projects} 个，页面 {pages} 个",
    },
```

`enUS.ts` DATA_MANAGER_SETTINGS 段：

```ts
    DATA_MANAGER_SETTINGS: {
      WORKSPACE: "Workspace",
      SELECT_WORKSPACE: "Select Workspace",
      REBUILD_INDEX: "Rebuild Index",
      REBUILD_INDEX_DESC: "Read local Journal and project files, then rebuild the data index",
      REBUILD_INDEX_LOADING: "Rebuilding...",
      REBUILD_INDEX_SUCCESS: "Index rebuilt: {journals} journals, {projects} projects, {pages} pages",
    },
```

- [ ] **Step 2: Pinia store action**

`src/renderer/store/project.store.ts`：
1. 类型导入追加 `ProjectReloadResult`：
   `import type { ProjectCreate, ProjectUpdate, ProjectQuery, ProjectDetail, ProjectReloadResult } from "@/main/types/db";`
2. 在 `checkNameExists` action 之后追加：

```ts
    /**
     * 重置 projects/pages 表（从磁盘 project.json/pages.json 重载）
     */
    const resetProjectTable = async (): Promise<ProjectReloadResult | null> => {
        errorCode.value = null;
        errorMessage.value = null;

        try {
            const response = (await window.electronAPI.project.resetProjectTable()) as ApiResponse<ProjectReloadResult>;

            if (response.success && response.data) {
                return response.data as ProjectReloadResult;
            }
            errorCode.value = response.code;
            errorMessage.value = handleApiError(response);
            return null;
        } catch {
            errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
            errorMessage.value = handleApiError({
                success: false,
                code: errorCode.value,
            });
            return null;
        }
    };
```

3. return 对象的方法列表追加 `resetProjectTable,`。

- [ ] **Step 3: composable 包装**

`src/renderer/composables/useProject.ts`：
1. 类型导入追加 `ProjectReloadResult`：
   `import type { ProjectCreate, ProjectUpdate, ProjectQuery, ProjectDetail, ProjectReloadResult } from "@/main/types/db";`
2. 在 `checkNameExists` 之后追加：

```ts
  /**
   * 重置 projects/pages 表（从磁盘 project.json/pages.json 重载）
   */
  const resetProjectTable = async (): Promise<ProjectReloadResult | null> => {
    try {
      const result = await store.resetProjectTable();
      if (result) {
        logger.info("projects/pages 表重置完成", result);
      }
      return result;
    } catch (error) {
      logger.error("重置 projects/pages 表失败", { error });
      return null;
    }
  };
```

3. return 对象追加 `resetProjectTable,`。

- [ ] **Step 4: 设置页 rebuildIndex 调用两个重置**

`src/renderer/components/settings/general/GeneralSettings.vue`：
1. 导入区（`useJournal` 导入之后）追加：

```ts
import { useProject } from "@/renderer/composables/useProject";
```

2. `const { resetJournalTable } = useJournal();` 之后追加：

```ts
const { resetProjectTable } = useProject();
```

3. 将 `rebuildIndex`（365-377 行）替换为：

```ts
const rebuildIndex = async () => {
  if (rebuildingIndex.value) return;
  rebuildingIndex.value = true;
  try {
    const [journalCount, projectResult] = await Promise.all([
      resetJournalTable(),
      resetProjectTable(),
    ]);
    message.success(
      t("SETTINGS.DATA_MANAGER_SETTINGS.REBUILD_INDEX_SUCCESS", {
        journals: journalCount,
        projects: projectResult?.projects ?? 0,
        pages: projectResult?.pages ?? 0,
      }),
    );
  } catch (error) {
    logger.error("重建索引失败", { error });
    message.error(t("ERROR.COMMON.ACTION_ERROR"));
  } finally {
    rebuildingIndex.value = false;
  }
};
```

- [ ] **Step 5: 验证 + 提交**

```bash
pnpm typecheck
pnpm test tests/unit/shared/locale-keys.test.ts
```

预期：typecheck 无错误；locale-keys 测试 PASS（两语言键对称）。提交：

```bash
git add src/renderer/store/project.store.ts src/renderer/composables/useProject.ts src/renderer/components/settings/general/GeneralSettings.vue src/shared/i18n/locales/zhCN.ts src/shared/i18n/locales/enUS.ts
git commit -m "feat: 设置页重建索引同时重载日志与项目数据"
```

---

### Task 5: 全量验证

**Files:** 无新增改动（仅验证；如发现问题修复后重新验证）

- [ ] **Step 1: 类型检查**

```bash
pnpm typecheck
```

预期：`vue-tsc --noEmit` 零错误。

- [ ] **Step 2: Lint**

```bash
pnpm lint
```

预期：ESLint 无错误（`--fix` 自动修复格式）。

- [ ] **Step 3: 全量测试**

```bash
pnpm test
```

预期：全部通过（原有用例 + 新增 4 个 `ProjectService.resetProjectTable` 用例）。

- [ ] **Step 4: 手工冒烟（可选，需 `pnpm dev`）**

1. 打开设置 → 通用 → 数据管理，确认"重建索引"描述文案已更新
2. 点击"重建索引"，确认成功提示显示三段计数（日志/作品/页面）
3. 重启应用，确认作品列表与章节树正常显示（ID 未变、标签保留、排序按原 created_at）

---

## 行为要点（供审查者核对）

1. **ID 与时间戳保留**：`insertProjectRow`/`insertPageRow` 用显式 INSERT 列清单绕过 `BaseDao.create` 的 `enhanceDataWithTimestamps` 覆写 —— 作品列表排序（`ORDER BY created_at`）与标签关联（`tagged_items.entity_id`）不受重建影响。
2. **file_path 以磁盘为准**：`parseProjectJson` 用扫描到的实际文件夹路径，覆盖 JSON 内可能过期的 `file_path`。
3. **事务原子性**：清空与重放全部在单个 `projectDao.transaction` 内，任何插入失败整体回滚，不产生半重置状态。
4. **project_chunks 不恢复**：随 `DELETE FROM projects` 级联清理（与日志重建清空 semantic_chunks 的语义一致 —— 派生数据由智能任务重新生成）。
5. **防御性跳过**：无 `project.json` 的文件夹、缺必填字段的 JSON 条目、`project_id` 指向未重放作品的页面、父节点缺失的页面、重复作品 ID —— 均 warn + 跳过，不中断整体重建。
6. **错误传播**：服务层抛错 → API 层捕获包装 `PROJECT_RESET_FAILED` → store 设置 errorCode → composable 返回 null → 设置页按 0 计数展示（与日志重置失败时的现有行为一致）。
