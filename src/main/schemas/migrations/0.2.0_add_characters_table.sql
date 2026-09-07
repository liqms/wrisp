-- v0.2.0 新增人物表：@人物提及同步
-- 归属：contact=联系人（现实中的人） / project=作品人物（owner_id 指向 projects）
-- 唯一性：同名人物可归属不同作品；联系人按名称全局唯一（表达式唯一索引）
CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_type TEXT NOT NULL DEFAULT 'contact' CHECK (owner_type IN ('contact', 'project')),
    owner_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    description TEXT DEFAULT '',
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_characters_identity ON characters(name, owner_type, COALESCE(owner_id, ''));
CREATE INDEX IF NOT EXISTS idx_characters_owner ON characters(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name);

-- 自登记迁移记录：buildMigrationsFromFiles 不会为文件迁移写入 migrations_db，
-- 不自登记会导致每次启动重复执行（SQL 幂等不报错但版本不前进）。
-- executed_at 用 strftime 生成 ISO 格式，与 init.sql 基线一致，保证 getCurrentVersion 排序正确。
INSERT OR IGNORE INTO migrations_db (id, version, name, description, sql_statement, status, executed_at, execution_time, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '0.2.0',
    'Add Characters Table',
    '新增人物表：@人物提及同步（归属联系人/作品、简介、元信息）',
    'CREATE TABLE characters (id, name, owner_type, owner_id, description, metadata, created_at, updated_at) + unique index idx_characters_identity',
    'executed',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    0,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
