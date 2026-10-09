-- v0.6.0 页面（pages）的分阶段处理标记
-- 背景：页面内容的语义化此前只落在 chunk 层（chunk_type='page'），整页级的摘要与向量
--       缺失，导致「页级粗召回」无从实现。本迁移为 pages 补齐与 semantic_chunks 同构的
--       标记列，让 page-summary / page-vectorize 两个新智能任务按各自阶段增量选取。
--
-- 列分工与 semantic_chunks 一致：
--   last_smart_processed_at  —— 只作「最后被任一页面级任务触碰」的观测值
--   last_summary_generated_at —— page-summary 专用（页面摘要已生成）
--   last_vectorized_at        —— page-vectorize 专用（页面向量已写入）
-- 写入方必须走 PageDao.recordStage()，它不刷新 updated_at：选取比较的正是 updated_at，
-- 若写标记本身把 updated_at 顶到标记之后，该页会在下一轮被自己重新选中，收敛不了。
--
-- 列全为 NULL 是预期的初始态：老库的每一页都会在新列上被判为「待处理」，
-- 于是 0.6.0 上线后的首轮整理做一次全量页面摘要与向量化，之后靠标记收敛。
ALTER TABLE pages ADD COLUMN last_smart_processed_at TEXT;
ALTER TABLE pages ADD COLUMN last_summary_generated_at TEXT;
ALTER TABLE pages ADD COLUMN last_vectorized_at TEXT;

-- 自登记迁移记录：buildMigrationsFromFiles 不会为文件迁移写入 migrations_db，
-- 不自登记会导致每次启动重复执行（ADD COLUMN 无 IF NOT EXISTS，重复执行会报错）。
-- executed_at 用 strftime 生成 ISO 格式，与 init.sql 基线一致，保证 getCurrentVersion 排序正确。
INSERT OR IGNORE INTO migrations_db (id, version, name, description, sql_statement, status, executed_at, execution_time, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000008',
    '0.6.0',
    'Page Stage Marks',
    '页面新增 last_smart_processed_at / last_summary_generated_at / last_vectorized_at，支撑页面级摘要与向量化任务的增量选取',
    'ALTER TABLE pages ADD COLUMN last_smart_processed_at / last_summary_generated_at / last_vectorized_at',
    'executed',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    0,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
