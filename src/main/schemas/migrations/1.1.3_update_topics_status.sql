-- =============================================
-- PenTip 数据库迁移脚本
-- 版本: 1.1.3
-- 迁移名称: update_topics_status
-- 描述: 更新主题状态枚举，改为 active / deleted
-- =============================================

-- 由于 SQLite 不支持 ALTER COLUMN / DROP CHECK，需要重建表
-- 1. 创建新表
CREATE TABLE IF NOT EXISTS topics_new (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (status IN ('active', 'deleted'))
);

-- 2. 迁移数据（pending → active, confirmed → active, archived → deleted）
INSERT INTO topics_new (id, title, summary, status, created_at, updated_at)
SELECT
    id,
    title,
    summary,
    CASE
        WHEN status IN ('pending', 'confirmed') THEN 'active'
        WHEN status = 'archived' THEN 'deleted'
        ELSE 'active'
    END,
    created_at,
    updated_at
FROM topics;

-- 3. 替换旧表
DROP TABLE topics;
ALTER TABLE topics_new RENAME TO topics;

-- 4. 重建索引
CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status);
CREATE INDEX IF NOT EXISTS idx_topics_title ON topics(title);

-- ==================== 插入迁移记录 ====================

INSERT OR IGNORE INTO migrations_db (id, version, name, description, sql_statement, status, executed_at, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000004',
    '1.1.3',
    'Update Topics Status Enum',
    '更新主题状态枚举，改为 active / deleted',
    'CREATE TABLE topics_new (...); INSERT INTO topics_new SELECT ...; DROP TABLE topics; ALTER TABLE topics_new RENAME TO topics; CREATE INDEX ...;',
    'pending',
    '',
    '2026-06-12T00:00:00.000Z',
    '2026-06-12T00:00:00.000Z'
);
