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

    // FTS 全文索引已重建（external-content 表需手动 rebuild）
    const ftsPages = (getDatabase().prepare('SELECT count(*) AS c FROM pages_fts').get() as { c: number }).c
    const ftsProjects = (getDatabase().prepare('SELECT count(*) AS c FROM projects_fts').get() as { c: number }).c
    expect(ftsPages).toBe(2)
    expect(ftsProjects).toBe(1)

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
    expect(pageDao.findById('page-no-title')).toBeUndefined()
    expect(pageDao.findById('page-dangling')).toBeUndefined()
    expect(pageDao.findById('page-foreign')).toBeUndefined()
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
