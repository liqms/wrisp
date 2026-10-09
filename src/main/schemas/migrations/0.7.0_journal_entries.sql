-- v0.7.0 Journal 条目化：日志真源从「每日整篇 .md」迁移为 journal_entries 条目表
-- 背景：移动端多源记录与云端合并要求以「条目」为最小同步单元（id 全局唯一、自带时间戳、
--       软删除 tombstone、updated_at 冲突判定）。.md 文件降级为确定性渲染产物。
--       本迁移为纯 DDL：不解析、不搬运任何存量日志内容（设计决策见 spec §3-2）。
-- semantic_chunks.entry_id：journal 块锚回条目（wiki 回链优先按条目定位）；可空，
--       page/其它来源块不填。file_id NOT NULL 锚定模型保持不变。

CREATE TABLE IF NOT EXISTS journal_entries (
    id           TEXT PRIMARY KEY,
    date         TEXT NOT NULL,
    occurred_at  TEXT NOT NULL,
    source       TEXT NOT NULL DEFAULT 'desktop',
    type         TEXT NOT NULL DEFAULT 'text',
    content      TEXT NOT NULL,
    attachments  TEXT,
    metadata     TEXT,
    chunked_at   TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    deleted_at   TEXT,
    CHECK (source IN ('desktop', 'mobile', 'import')),
    CHECK (type IN ('text', 'voice', 'image', 'expense', 'task'))
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_date  ON journal_entries(date, occurred_at);
CREATE INDEX IF NOT EXISTS idx_journal_entries_dirty ON journal_entries(chunked_at) WHERE chunked_at IS NULL;

CREATE TABLE IF NOT EXISTS journal_entry_projects (
    entry_id   TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id)        ON DELETE CASCADE,
    added_at   TEXT NOT NULL,
    PRIMARY KEY (entry_id, project_id)
);

-- ADD COLUMN 无 IF NOT EXISTS，靠文末自登记保证本文件只执行一次：
--   全新库不执行本文件（init.sql 基线已升到 0.7.0 并直接带 entry_id 列）；
--   存量库（基线 0.6.0）走到这里必然有表无列，ALTER 安全。
ALTER TABLE semantic_chunks ADD COLUMN entry_id TEXT;
CREATE INDEX IF NOT EXISTS idx_semantic_chunks_entry ON semantic_chunks(entry_id);

-- 自登记迁移记录：buildMigrationsFromFiles 不会为文件迁移写入 migrations_db，
-- 不自登记会导致每次启动重复执行（ADD COLUMN 无 IF NOT EXISTS，重复执行会报错）。
-- executed_at 用 strftime 生成 ISO 格式，与 init.sql 基线一致，保证 getCurrentVersion 排序正确。
INSERT OR IGNORE INTO migrations_db (id, version, name, description, sql_statement, status, executed_at, execution_time, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000009',
    '0.7.0',
    'Journal Entries',
    '新增 journal_entries、journal_entry_projects 表与 semantic_chunks.entry_id 列，日志条目化为移动端合并预留同步能力',
    'CREATE TABLE journal_entries / journal_entry_projects; ALTER TABLE semantic_chunks ADD COLUMN entry_id',
    'executed',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    0,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
