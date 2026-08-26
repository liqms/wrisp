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

// mock 文件服务，避免真实 IO，并断言 remove 调用
const fileServiceMock = vi.hoisted(() => ({
  exists: vi.fn(() => true),
  readFile: vi.fn(() => ''),
  writeFile: vi.fn(),
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

import { PageDao } from '@/main/core/db/page.dao'
import { ProjectDao } from '@/main/core/db/project.dao'
import { getDatabase } from '@/main/core/db/connection'
import { pageService } from '@/main/core/services/page.service'
import { PAGE_TYPE, PROJECT_TYPE } from '@/shared/enums'

describe('PageService', () => {
  let pageDao: PageDao
  let projectId: string

  beforeEach(() => {
    const db = getDatabase()
    for (const t of ['pages', 'projects']) {
      db.exec(`DELETE FROM ${t}`)
    }
    pageDao = new PageDao()
    fileServiceMock.exists.mockReturnValue(true)
    fileServiceMock.remove.mockClear()
    projectId = new ProjectDao().create({ name: 'Test', type: PROJECT_TYPE.NOVEL, file_path: 'projects/test.md' })
  })

  it('createPage 同级 order_index 依次递增', () => {
    const id1 = pageService.createPage({ projectId, parentId: null, title: 'A', content: '', pageType: PAGE_TYPE.PROJECT_CHAPTER })
    const id2 = pageService.createPage({ projectId, parentId: null, title: 'B', content: '', pageType: PAGE_TYPE.PROJECT_CHAPTER })

    expect(pageDao.findById(id1)!.order_index).toBe(0)
    expect(pageDao.findById(id2)!.order_index).toBe(1)
  })

  it('movePage 可挂到子节点下并移到根', () => {
    const parent = pageService.createPage({ projectId, parentId: null, title: 'Parent', content: '', pageType: PAGE_TYPE.PROJECT_CHAPTER })
    const root2 = pageService.createPage({ projectId, parentId: null, title: 'Root2', content: '', pageType: PAGE_TYPE.PROJECT_CHAPTER })

    // 挂到 Parent 下
    expect(pageService.movePage({ id: root2, parentId: parent })).toBe(1)
    expect(pageDao.findById(root2)!.parent_page_id).toBe(parent)

    // 移到根
    expect(pageService.movePage({ id: root2, parentId: null })).toBe(1)
    expect(pageDao.findById(root2)!.parent_page_id).toBeNull()
  })

  it('deletePage 软删除自身与后代并保留 md 文件', () => {
    const parent = pageService.createPage({ projectId, parentId: null, title: 'Parent', content: '', pageType: PAGE_TYPE.PROJECT_CHAPTER })
    const child = pageService.createPage({ projectId, parentId: parent, title: 'Child', content: '', pageType: PAGE_TYPE.PROJECT_CHAPTER })
    const grand = pageService.createPage({ projectId, parentId: child, title: 'Grand', content: '', pageType: PAGE_TYPE.PROJECT_CHAPTER })

    // 自身 + 两个后代共 3 条记录被标记删除
    expect(pageService.deletePage(parent)).toBe(3)

    // 记录保留（软删除），状态置为 deleted
    expect(pageDao.findById(parent)!.status).toBe('deleted')
    expect(pageDao.findById(child)!.status).toBe('deleted')
    expect(pageDao.findById(grand)!.status).toBe('deleted')

    // 软删除保留 md 文件，不调用 remove
    expect(fileServiceMock.remove).not.toHaveBeenCalled()
  })
})
