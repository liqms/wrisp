-- v0.3.0 新增创作会话表：创作智能体的可中断/可恢复会话
-- 背景：init.sql 仅在数据库尚未初始化时执行，存量库不会跑到其中的建表语句，
-- 因此新表必须通过迁移文件补齐（与 0.2.0 人物表同一范式）。
CREATE TABLE IF NOT EXISTS creation_sessions (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL,
    project_id TEXT NOT NULL,
    page_id TEXT,
    stage TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    pending_kind TEXT,
    delegation TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (scope IN ('work', 'page')),
    CHECK (status IN ('active', 'awaiting-confirm', 'paused', 'completed', 'aborted'))
);

CREATE INDEX IF NOT EXISTS idx_creation_sessions_project
    ON creation_sessions(project_id, status);

-- 自登记迁移记录：buildMigrationsFromFiles 不会为文件迁移写入 migrations_db，
-- 不自登记会导致每次启动重复执行（SQL 幂等不报错但版本不前进）。
-- executed_at 用 strftime 生成 ISO 格式，与 init.sql 基线一致，保证 getCurrentVersion 排序正确。
INSERT OR IGNORE INTO migrations_db (id, version, name, description, sql_statement, status, executed_at, execution_time, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    '0.3.0',
    'Add Creation Sessions Table',
    '新增创作会话表：创作智能体的可中断/可恢复会话（作用域、阶段、状态、待确认步骤、逐项委托开关）',
    'CREATE TABLE creation_sessions (id, scope, project_id, page_id, stage, status, pending_kind, delegation, created_at, updated_at) + index idx_creation_sessions_project',
    'executed',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    0,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
