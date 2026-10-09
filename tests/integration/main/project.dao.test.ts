// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp'), getVersion: vi.fn(() => '1.0.0'), getName: vi.fn(() => 'Wrisp'), on: vi.fn() },
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

import { TagDao } from '@/main/core/db/tag.dao'
import { ProjectDao } from '@/main/core/db/project.dao'
import { getDatabase } from '@/main/core/db/connection'

describe('ProjectDao', () => {
  let projectDao: ProjectDao
  let tagDao: TagDao

  beforeEach(() => {
    const db = getDatabase()
    for (const t of ['pages', 'tagged_items', 'tags', 'projects']) {
      db.exec(`DELETE FROM ${t}`)
    }
    projectDao = new ProjectDao()
    tagDao = new TagDao()
  })

  it('should create and find a project', () => {
    const id = projectDao.create({ name: 'My Novel', type: 'novel', file_path: 'projects/my-novel.md' })
    const saved = projectDao.findById(id)
    expect(saved).not.toBeNull()
    expect(saved!.name).toBe('My Novel')
    expect(saved!.type).toBe('novel')
    expect(saved!.status).toBe('active')
  })

  it('should update a project', () => {
    const id = projectDao.create({ name: 'Old Name', type: 'series', file_path: 'projects/old-name.md' })
    projectDao.update(id, { name: 'New Name' })
    expect(projectDao.findById(id)!.name).toBe('New Name')
  })

  it('should delete a project', () => {
    const id = projectDao.create({ name: 'Temp', type: 'book', file_path: 'projects/temp.md' })
    expect(projectDao.delete(id)).toBe(1)
    expect(projectDao.findById(id)).toBeUndefined()
  })

  it('should list all projects with pagination', () => {
    for (let i = 1; i <= 5; i++) projectDao.create({ name: `Project ${i}`, type: 'novel', file_path: `projects/project-${i}.md` })
    const result = projectDao.paginate({ page: 1, pageSize: 2, orderBy: 'name', orderDir: 'ASC' })
    expect(result.data).toHaveLength(2)
    expect(result.total).toBe(5)
    expect(result.hasNext).toBe(true)
  })

  it('should find projects by name like', () => {
    projectDao.create({ name: 'Alpha Project', type: 'product', file_path: 'projects/alpha.md' })
    expect(projectDao.findByNameLike('Alpha')).toHaveLength(1)
  })

  // ───── Item B：findByNameLike 必须转义 LIKE 通配符（% / _ / 转义符自身） ─────

  it('findByNameLike：名字里的 % 不再被当通配符，且 ESCAPE 子句本身可用', () => {
    projectDao.create({ name: '100%覆盖率', type: 'novel', file_path: 'projects/pct.md' })
    projectDao.create({ name: '100x覆盖率', type: 'novel', file_path: 'projects/x.md' })
    // 未转义时模式 %100%覆% 会把 '100x覆盖率' 一并捞进来（候选集过宽）
    const hits = projectDao.findByNameLike('100%覆')
    expect(hits.map((p) => p.name)).toEqual(['100%覆盖率'])
  })

  it('findByNameLike：名字里的 _ 不再被当单字符通配符', () => {
    projectDao.create({ name: 'a_b', type: 'novel', file_path: 'projects/under.md' })
    projectDao.create({ name: 'axb', type: 'novel', file_path: 'projects/axb.md' })
    expect(projectDao.findByNameLike('a_b').map((p) => p.name)).toEqual(['a_b'])
  })

  it('findByNameLike：转义符自身（反斜杠）参与匹配仍可检索', () => {
    projectDao.create({ name: '路径\\文件', type: 'novel', file_path: 'projects/bs.md' })
    expect(projectDao.findByNameLike('路径\\文件').map((p) => p.name)).toEqual(['路径\\文件'])
  })

  it('findByNameLike：普通关键词行为不变（防转义过头）', () => {
    projectDao.create({ name: '读书笔记', type: 'novel', file_path: 'projects/note.md' })
    projectDao.create({ name: '随笔', type: 'novel', file_path: 'projects/essay.md' })
    expect(projectDao.findByNameLike('笔记').map((p) => p.name)).toEqual(['读书笔记'])
  })

  it('should manage tags via saveTags', () => {
    const pid = projectDao.create({ name: 'Tagged', type: 'research', file_path: 'projects/tagged.md' })
    const tid = tagDao.create({ name: 'important' })
    projectDao.saveTags(pid, [tid])
    const rows = getDatabase().prepare('SELECT * FROM tagged_items WHERE entity_id = ?').all(pid)
    expect(rows).toHaveLength(1)

    projectDao.clearTags(pid)
    expect(getDatabase().prepare('SELECT * FROM tagged_items WHERE entity_id = ?').all(pid)).toHaveLength(0)
  })

  it('should check if a project name exists', () => {
    projectDao.create({ name: 'Unique', type: 'series', file_path: 'projects/unique.md' })
    expect(projectDao.checkNameExists('Unique')).toBe(true)
    expect(projectDao.checkNameExists('Nonexistent')).toBe(false)
  })
})
