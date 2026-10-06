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

  const schemaPath = path.resolve(process.cwd(), 'src/main/schemas/init.sql')
  memDb.exec(fs.readFileSync(schemaPath, 'utf-8'))
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

import { ConceptChunkDao } from '@/main/core/db/conceptChunk.dao'
import { TaggedItemDao } from '@/main/core/db/taggedItem.dao'
import { TagDao } from '@/main/core/db/tag.dao'
import { getDatabase } from '@/main/core/db/connection'

type Row = Record<string, unknown>

describe('复合主键关联表 DAO', () => {
  const timestamp = '2026-01-01T00:00:00.000Z'

  beforeEach(() => {
    const db = getDatabase()
    db.exec('DELETE FROM tagged_items')
    db.exec('DELETE FROM concept_chunks')
    db.exec('DELETE FROM tags')
    db.exec('DELETE FROM concepts')
    db.exec('DELETE FROM semantic_chunks')
    db.exec('DELETE FROM file_index')

    db.prepare(
      'INSERT INTO file_index (id, file_path, file_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run('file-1', '/tmp/a.md', 'hash-1', timestamp, timestamp)
    db.prepare(
      'INSERT INTO semantic_chunks (id, file_id, file_path, start_line, end_line, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('chunk-1', 'file-1', '/tmp/a.md', 1, 2, '内容', timestamp, timestamp)
    db.prepare(
      'INSERT INTO concepts (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run('concept-1', '概念', timestamp, timestamp)
  })

  it('concept_chunks: create 不应为无 id 列的表注入 id', () => {
    const dao = new ConceptChunkDao()
    const returned = dao.create({ concept_id: 'concept-1', chunk_id: 'chunk-1' })

    expect(returned).toBe('')
    const rows = dao.findBy('concept_id', 'concept-1')
    expect(rows).toHaveLength(1)
    expect(rows[0].chunk_id).toBe('chunk-1')
    expect(rows[0].created_at).toBeTruthy()
    expect(rows[0].updated_at).toBeTruthy()
  })

  it('tagged_items: addTagsToEntity 应写入 added_at 且幂等', () => {
    const tagId = new TagDao().create({ name: 'fiction' })
    const dao = new TaggedItemDao()

    dao.addTagsToEntity('block', 'chunk-1', [tagId])
    let rows = getDatabase().prepare('SELECT * FROM tagged_items').all() as Row[]
    expect(rows).toHaveLength(1)
    expect(rows[0].added_at).toBeTruthy()
    expect(rows[0].tag_id).toBe(tagId)

    dao.addTagsToEntity('block', 'chunk-1', [tagId])
    rows = getDatabase().prepare('SELECT * FROM tagged_items').all() as Row[]
    expect(rows).toHaveLength(1)
  })
})
