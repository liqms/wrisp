-- Migration: 添加智能任务执行相关表
CREATE TABLE IF NOT EXISTS task_execution_log (
    id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    tasks_summary TEXT NOT NULL DEFAULT '{}',
    processed_until TEXT
);

-- 为 blocks 表添加 last_smart_processed_at 字段
ALTER TABLE blocks ADD COLUMN last_smart_processed_at TEXT;