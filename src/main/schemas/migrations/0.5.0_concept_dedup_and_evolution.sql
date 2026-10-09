-- v0.5.0 概念去重与演化时间线的 schema 变更
-- 背景：概念抽取此前按「原文标题逐块 create」，同义/大小写/全半角差异都会新建概念，
--       导致 wiki 概念列表线性膨胀、演化摘要按块序而非时间线递进。
--       本迁移只补 schema，数据重建（分组去重 + 回填 title_key + 清空抽取标记）
--       由 database.migration.ts 的 dedupeConcepts() 在紧随其后执行，
--       因为 SQLite 的 ADD COLUMN 无 IF NOT EXISTS、且迁移主循环不在事务内。
--
-- UNIQUE 索引可在「列全为 NULL」时安全创建：SQLite 判定唯一性时 NULL 互不相等，
-- 因此加列 + 建索引放在同一个文件里不会因历史重复标题而失败。
-- 若改为在去重之后再建索引，dedupeConcepts() 半途失败会留下无索引的库。
ALTER TABLE concepts ADD COLUMN title_key TEXT;
ALTER TABLE concepts ADD COLUMN aliases TEXT NOT NULL DEFAULT '[]';
ALTER TABLE concepts ADD COLUMN mention_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE concepts ADD COLUMN last_evolved_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_concepts_title_key ON concepts(title_key);

-- 自登记迁移记录：buildMigrationsFromFiles 不会为文件迁移写入 migrations_db，
-- 不自登记会导致每次启动重复执行（SQL 幂等不报错但版本不前进）。
-- executed_at 用 strftime 生成 ISO 格式，与 init.sql 基线一致，保证 getCurrentVersion 排序正确。
INSERT OR IGNORE INTO migrations_db (id, version, name, description, sql_statement, status, executed_at, execution_time, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000006',
    '0.5.0',
    'Concept Dedup And Evolution Columns',
    '概念表新增 title_key / aliases / mention_count / last_evolved_at，为幂等合并与演化时间线铺路',
    'ALTER TABLE concepts ADD COLUMN title_key / aliases / mention_count / last_evolved_at + UNIQUE index idx_concepts_title_key',
    'executed',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    0,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
