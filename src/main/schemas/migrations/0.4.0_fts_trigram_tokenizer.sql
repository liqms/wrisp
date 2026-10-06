-- v0.4.0 FTS5 全文索引改用 trigram 分词器
-- 背景：默认 unicode61 分词器把连续中文视为单个 token，无法做子串匹配，
--       导致 FTS 索引对中文检索形同虚设（此前检索统一回退 LIKE 全表扫描）。
--       trigram 按「每 3 个字符」建索引，既可命中中文子串，也保留 LIKE 的子串语义，
--       且大小写不敏感、% 与 _ 按字面处理，与 LIKE 行为一致。
-- 限制：trigram 无法索引少于 3 个字符的子串，DAO 层对 <3 字符关键词回退 LIKE。
-- FTS 表是 external-content（content='<主表>'），DROP 后 rebuild 即可从主表重建，无需迁移数据。

DROP TABLE IF EXISTS semantic_chunks_fts;
CREATE VIRTUAL TABLE semantic_chunks_fts USING fts5(
    content,
    ai_summary,
    content='semantic_chunks',
    content_rowid='rowid',
    tokenize='trigram'
);
INSERT INTO semantic_chunks_fts(semantic_chunks_fts) VALUES('rebuild');

DROP TABLE IF EXISTS concepts_fts;
CREATE VIRTUAL TABLE concepts_fts USING fts5(
    title,
    evolving_summary,
    content='concepts',
    content_rowid='rowid',
    tokenize='trigram'
);
INSERT INTO concepts_fts(concepts_fts) VALUES('rebuild');

DROP TABLE IF EXISTS topics_fts;
CREATE VIRTUAL TABLE topics_fts USING fts5(
    title,
    summary,
    content='topics',
    content_rowid='rowid',
    tokenize='trigram'
);
INSERT INTO topics_fts(topics_fts) VALUES('rebuild');

DROP TABLE IF EXISTS projects_fts;
CREATE VIRTUAL TABLE projects_fts USING fts5(
    name,
    description,
    ai_summary,
    content='projects',
    content_rowid='rowid',
    tokenize='trigram'
);
INSERT INTO projects_fts(projects_fts) VALUES('rebuild');

DROP TABLE IF EXISTS pages_fts;
CREATE VIRTUAL TABLE pages_fts USING fts5(
    title,
    ai_summary,
    content='pages',
    content_rowid='rowid',
    tokenize='trigram'
);
INSERT INTO pages_fts(pages_fts) VALUES('rebuild');

-- 自登记迁移记录：buildMigrationsFromFiles 不会为文件迁移写入 migrations_db，
-- 不自登记会导致每次启动重复执行（SQL 幂等不报错但版本不前进）。
-- executed_at 用 strftime 生成 ISO 格式，与 init.sql 基线一致，保证 getCurrentVersion 排序正确。
INSERT OR IGNORE INTO migrations_db (id, version, name, description, sql_statement, status, executed_at, execution_time, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000004',
    '0.4.0',
    'FTS5 Trigram Tokenizer',
    'FTS5 全文索引改用 trigram 分词器，支持中文子串检索',
    'DROP + CREATE semantic_chunks_fts / concepts_fts / topics_fts / projects_fts / pages_fts (tokenize=''trigram'') + rebuild',
    'executed',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    0,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);