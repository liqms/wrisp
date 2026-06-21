-- =============================================
-- PenTip 数据库迁移脚本
-- 版本: 1.1.4
-- 迁移名称: add_projects_status
-- 描述: 作品表增加 status 字段（active / deleted）
-- =============================================

-- 由于 SQLite 不支持 ALTER COLUMN / ADD CONSTRAINT，需要重建表
-- 1. 创建新表
CREATE TABLE IF NOT EXISTS projects_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    ai_summary TEXT DEFAULT '',
    structure TEXT DEFAULT '',
    metadata TEXT DEFAULT '{}',
    CHECK (status IN ('active', 'deleted'))
);

-- 2. 迁移数据（所有现有记录设为 active）
INSERT INTO projects_new (id, name, description, type, status, created_at, updated_at, ai_summary, structure, metadata)
SELECT
    id,
    name,
    description,
    type,
    'active',
    created_at,
    updated_at,
    ai_summary,
    structure,
    metadata
FROM projects;

-- 3. 替换旧表
DROP TABLE projects;
ALTER TABLE projects_new RENAME TO projects;

-- 4. 重建索引
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- ==================== 插入迁移记录 ====================

INSERT OR IGNORE INTO migrations_db (id, version, name, description, sql_statement, status, executed_at, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000005',
    '1.1.4',
    'Add Projects Status Field',
    '作品表增加 status 字段（active / deleted）',
    'CREATE TABLE projects_new (...); INSERT INTO projects_new SELECT ...; DROP TABLE projects; ALTER TABLE projects_new RENAME TO projects; CREATE INDEX ...;',
    'pending',
    '',
    '2026-06-12T00:00:00.000Z',
    '2026-06-12T00:00:00.000Z'
);
