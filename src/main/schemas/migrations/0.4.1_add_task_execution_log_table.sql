-- v0.4.1 新增智能整理执行记录表：TaskExecutionDao 依赖该表记录增量处理的执行历史
-- 背景：init.sql 仅在数据库尚未初始化时执行，存量库不会跑到其中的建表语句，
--       因此新表必须通过迁移文件补齐（与 0.2.0 人物表、0.3.0 创作会话表同一范式）。
--       缺表会导致 SmartTaskScheduler.start() 在 findLatestSucceeded 处抛
--       "no such table: task_execution_log"，智能整理无法启动。
CREATE TABLE IF NOT EXISTS task_execution_log (
    id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    tasks_summary TEXT NOT NULL DEFAULT '{}',
    processed_until TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (status IN ('running', 'paused', 'succeeded', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_task_execution_log_status
    ON task_execution_log(status);
CREATE INDEX IF NOT EXISTS idx_task_execution_log_started_at
    ON task_execution_log(started_at);

-- 自登记迁移记录：buildMigrationsFromFiles 不会为文件迁移写入 migrations_db，
-- 不自登记会导致每次启动重复执行（SQL 幂等不报错但版本不前进）。
-- executed_at 用 strftime 生成 ISO 格式，与 init.sql 基线一致，保证 getCurrentVersion 排序正确。
INSERT OR IGNORE INTO migrations_db (id, version, name, description, sql_statement, status, executed_at, execution_time, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000005',
    '0.4.1',
    'Add Task Execution Log Table',
    '新增智能整理执行记录表：记录每次智能整理的状态、任务摘要与增量处理进度',
    'CREATE TABLE task_execution_log (id, started_at, finished_at, status, tasks_summary, processed_until, created_at, updated_at) + index idx_task_execution_log_status / idx_task_execution_log_started_at',
    'executed',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    0,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);