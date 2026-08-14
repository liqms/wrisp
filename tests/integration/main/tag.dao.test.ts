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

  const schemaPaths = [
    path.resolve(process.cwd(), 'src/main/schemas/init.sql'),
  ]
  for (const schemaPath of schemaPaths) {
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
import { getDatabase } from '@/main/core/db/connection'

describe('TagDao', () => {
  let dao: TagDao

  beforeEach(() => {
    const db = getDatabase()
    db.exec('DELETE FROM tags')
    db.exec('DELETE FROM tagged_items')
    dao = new TagDao()
  })

  it('should create a tag with generated UUID', () => {
    const id = dao.create({ name: 'fiction' })
    expect(id).toBeDefined()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)

    const saved = dao.findById(id)
    expect(saved).not.toBeNull()
    expect(saved!.name).toBe('fiction')
    expect(saved!.color).toBe('#666666')
    expect(saved!.created_at).toBeDefined()
    expect(saved!.updated_at).toBeDefined()
  })

  it('should find a tag by name', () => {
    const id = dao.create({ name: 'fantasy' })
    const found = dao.findByName('fantasy')
    expect(found).not.toBeUndefined()
    expect(found!.id).toBe(id)
  })

  it('should return undefined for non-existent name', () => {
    const found = dao.findByName('nonexistent')
    expect(found).toBeUndefined()
  })

  it('should update a tag (returns row count)', () => {
    const id = dao.create({ name: 'old-name' })
    const updated = dao.update(id, { name: 'new-name', color: '#ff0000' })
    expect(updated).toBe(1)

    const saved = dao.findById(id)
    expect(saved!.name).toBe('new-name')
    expect(saved!.color).toBe('#ff0000')
  })

  it('should delete a tag (returns row count)', () => {
    const id = dao.create({ name: 'temporary' })
    const deleted = dao.delete(id)
    expect(deleted).toBe(1)

    const saved = dao.findById(id)
    expect(saved).toBeUndefined()
  })

  it('should find tags by name with LIKE', () => {
    dao.create({ name: 'sci-fi' })
    dao.create({ name: 'science' })
    dao.create({ name: 'fantasy' })

    const results = dao.findByNameLike('sci')
    expect(results).toHaveLength(2)
    expect(results.map((r) => r.name).sort()).toEqual(['sci-fi', 'science'])
  })

  it('should check if a name exists', () => {
    dao.create({ name: 'unique-tag' })
    expect(dao.checkNameExists('unique-tag')).toBe(true)
    expect(dao.checkNameExists('non-existent')).toBe(false)
  })

  it('should exclude current id when checking name existence', () => {
    const id = dao.create({ name: 'tag-name' })
    expect(dao.checkNameExists('tag-name', id)).toBe(false)
  })

  it('should list all tags', () => {
    dao.create({ name: 'a' })
    dao.create({ name: 'b' })
    const all = dao.findAll()
    expect(all).toHaveLength(2)
  })

  it('should paginate tags', () => {
    for (let i = 1; i <= 10; i++) {
      dao.create({ name: `tag-${i}` })
    }
    const page1 = dao.paginate({ page: 1, pageSize: 3, orderBy: 'name', orderDir: 'ASC' })
    expect(page1.data).toHaveLength(3)
    expect(page1.total).toBe(10)
    expect(page1.totalPages).toBe(4)
    expect(page1.hasNext).toBe(true)
    expect(page1.hasPrev).toBe(false)
    expect(page1.data[0].name).toBe('tag-1')
  })
})
