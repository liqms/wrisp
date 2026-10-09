-- v0.5.1 语义块的分阶段处理标记
-- 背景：last_smart_processed_at 一个列被 chunk-summary / concept-extract /
--       semantic-link 三种任务轮流覆写，谁最后写就代表谁，任何单任务都无法据此
--       判断「这块我处理过没有」；于是各任务退化成用 DAG 级 processed_until 水位
--       选取，水位又只在整轮 succeeded 时才有意义 —— 失败条目被水位越过，永不重试。
--       本迁移把「概念抽取」「语义链接」两个阶段各自拆一条标记列，选取条件改成
--       `last_xxx_at IS NULL OR updated_at > last_xxx_at`。
--
-- 列全为 NULL 是预期的初始态：老库的每一块都会在新列上被判为「待处理」，
-- 于是 0.5.x 上线后的首轮整理做一次全量重抽 —— 这正是概念去重（0.5.0）想要的效果。
-- 之后靠标记列收敛，不再每轮重烧全库。
--
-- 写入方必须走 ChunkDao.recordStage()，它不刷新 updated_at：
-- 选取比较的正是 updated_at，若写标记本身把 updated_at 顶到标记之后，
-- 该块会在下一轮被自己重新选中，收敛不了（同 recomputeTemporalScores 的理由）。
ALTER TABLE semantic_chunks ADD COLUMN last_concept_extracted_at TEXT;
ALTER TABLE semantic_chunks ADD COLUMN last_linked_at TEXT;

-- 自登记迁移记录：buildMigrationsFromFiles 不会为文件迁移写入 migrations_db，
-- 不自登记会导致每次启动重复执行（ADD COLUMN 无 IF NOT EXISTS，重复执行会报错）。
-- executed_at 用 strftime 生成 ISO 格式，与 init.sql 基线一致，保证 getCurrentVersion 排序正确。
INSERT OR IGNORE INTO migrations_db (id, version, name, description, sql_statement, status, executed_at, execution_time, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000007',
    '0.5.1',
    'Chunk Stage Marks',
    '语义块新增 last_concept_extracted_at / last_linked_at，让各智能任务按自己的阶段标记增量选取',
    'ALTER TABLE semantic_chunks ADD COLUMN last_concept_extracted_at / last_linked_at',
    'executed',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    0,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
