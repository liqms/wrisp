-- =============================================
-- Wrisp 数据库初始化脚本
-- 版本: 2.0.0
-- 创建时间: 2026-06-28
-- 基于 docs/storage/sqlite.md v2 设计
-- =============================================

-- 禁用外键检查（避免循环依赖问题）
PRAGMA foreign_keys = OFF;

-- ==================== 核心表 ====================

-- 创建文件索引表
CREATE TABLE IF NOT EXISTS file_index (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL UNIQUE,
    file_hash TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    date TEXT,
    name TEXT,
    last_synced TEXT,
    sync_status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 创建语义块表
CREATE TABLE IF NOT EXISTS semantic_chunks (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL REFERENCES file_index(id),
    file_path TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    section_title TEXT,
    content TEXT NOT NULL,
    content_hash TEXT,
    chunk_type TEXT DEFAULT 'journal',
    ai_summary TEXT,
    word_count INTEGER DEFAULT 0,
    temporal_score REAL DEFAULT 0.0,
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (status IN ('active', 'deleted'))
);

-- 创建语义块 FTS5 全文索引
CREATE VIRTUAL TABLE IF NOT EXISTS semantic_chunks_fts USING fts5(
    content,
    ai_summary,
    content='semantic_chunks',
    content_rowid='rowid'
);

-- 创建概念 FTS5 全文索引
CREATE VIRTUAL TABLE IF NOT EXISTS concepts_fts USING fts5(
    title,
    evolving_summary,
    content='concepts',
    content_rowid='rowid'
);

-- 创建主题 FTS5 全文索引
CREATE VIRTUAL TABLE IF NOT EXISTS topics_fts USING fts5(
    title,
    summary,
    content='topics',
    content_rowid='rowid'
);

-- 创建作品 FTS5 全文索引
CREATE VIRTUAL TABLE IF NOT EXISTS projects_fts USING fts5(
    name,
    description,
    ai_summary,
    content='projects',
    content_rowid='rowid'
);

-- 创建页面 FTS5 全文索引
CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
    title,
    ai_summary,
    content='pages',
    content_rowid='rowid'
);

-- 创建标签表
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 创建标签关联表
CREATE TABLE IF NOT EXISTS tagged_items (
    tag_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    added_at TEXT NOT NULL,
    PRIMARY KEY (tag_id, entity_type, entity_id),
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- 创建语义链接表
CREATE TABLE IF NOT EXISTS semantic_links (
    id TEXT PRIMARY KEY,
    source_chunk_id TEXT NOT NULL REFERENCES semantic_chunks(id),
    target_chunk_id TEXT NOT NULL REFERENCES semantic_chunks(id),
    link_type TEXT DEFAULT 'semantic',
    similarity REAL DEFAULT 0.0,
    ai_explanation TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(source_chunk_id, target_chunk_id)
);

-- 创建概念表
CREATE TABLE IF NOT EXISTS concepts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    evolving_summary TEXT,
    timeline TEXT DEFAULT '[]',
    relevance REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 创建概念-语义块关联表
CREATE TABLE IF NOT EXISTS concept_chunks (
    concept_id TEXT NOT NULL,
    chunk_id TEXT NOT NULL,
    relevance_score REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (concept_id, chunk_id),
    FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE CASCADE,
    FOREIGN KEY (chunk_id) REFERENCES semantic_chunks(id) ON DELETE CASCADE
);

-- 创建主题表
CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (status IN ('active', 'deleted'))
);

-- 创建主题-语义块关联表
CREATE TABLE IF NOT EXISTS topic_chunks (
    topic_id TEXT NOT NULL,
    chunk_id TEXT NOT NULL,
    relevance_score REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (topic_id, chunk_id),
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    FOREIGN KEY (chunk_id) REFERENCES semantic_chunks(id) ON DELETE CASCADE
);

-- 创建主题-概念关联表
CREATE TABLE IF NOT EXISTS topic_concepts (
    topic_id TEXT NOT NULL,
    concept_id TEXT NOT NULL,
    relevance_score REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (topic_id, concept_id),
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE CASCADE
);

-- 创建时间事件表
CREATE TABLE IF NOT EXISTS temporal_events (
    id TEXT PRIMARY KEY,
    chunk_id TEXT NOT NULL REFERENCES semantic_chunks(id),
    event_type TEXT NOT NULL,
    event_data TEXT DEFAULT '{}',
    temporal_score REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 创建反思表
CREATE TABLE IF NOT EXISTS reflections (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    ai_explanation TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (status IN ('pending', 'read', 'deleted'))
);

-- 创建反思-语义块关联表
CREATE TABLE IF NOT EXISTS reflection_chunks (
    reflection_id TEXT NOT NULL,
    chunk_id TEXT NOT NULL,
    relevance_score REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (reflection_id, chunk_id),
    FOREIGN KEY (reflection_id) REFERENCES reflections(id) ON DELETE CASCADE,
    FOREIGN KEY (chunk_id) REFERENCES semantic_chunks(id) ON DELETE CASCADE
);

-- ==================== 业务表 ====================

-- 创建作品表
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    description TEXT,
    type TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    ai_summary TEXT DEFAULT '',
    structure TEXT DEFAULT '',
    metadata TEXT DEFAULT '{}',
    CHECK (status IN ('active', 'deleted'))
);

-- 创建作品-语义块关联表
CREATE TABLE IF NOT EXISTS  project_chunks (
    project_id TEXT NOT NULL,
    chunk_id TEXT NOT NULL,
    relevance_score REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (project_id, chunk_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (chunk_id) REFERENCES semantic_chunks(id) ON DELETE CASCADE
);

-- 创建页面表
CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    parent_page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
    is_container INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    ai_summary TEXT,
    metadata TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (status IN ('active', 'deleted')),
    CHECK (is_container IN (0, 1))
);

-- ==================== 基础设施表 ====================

-- 创建数据库版本表
CREATE TABLE IF NOT EXISTS migrations_db (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    sql_statement TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    executed_at TEXT DEFAULT '',
    execution_time INTEGER,
    checksum TEXT DEFAULT '',
    error_message TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (status IN ('pending', 'executed', 'failed'))
);

-- 创建通用任务队列表
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payload TEXT NOT NULL DEFAULT '{}',
    priority INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    result TEXT,
    group_id TEXT,
    depends_on TEXT,
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled'))
);

-- 创建 Skill 执行历史表
CREATE TABLE IF NOT EXISTS skill_executions (
    id TEXT PRIMARY KEY,
    skill_id TEXT NOT NULL,
    input TEXT,
    output TEXT,
    level TEXT NOT NULL DEFAULT 'L1',
    model_used TEXT,
    tokens_used INTEGER DEFAULT 0,
    execution_time_ms INTEGER DEFAULT 0,
    steps INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'succeeded',
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- ==================== 创建索引 ====================

-- 文件索引表索引
CREATE INDEX IF NOT EXISTS idx_file_index_path ON file_index(file_path);
CREATE INDEX IF NOT EXISTS idx_file_index_status ON file_index(sync_status);

-- 语义块索引
CREATE INDEX IF NOT EXISTS idx_semantic_chunks_file ON semantic_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_semantic_chunks_path ON semantic_chunks(file_path);
CREATE INDEX IF NOT EXISTS idx_semantic_chunks_hash ON semantic_chunks(content_hash);
CREATE INDEX IF NOT EXISTS idx_semantic_chunks_type ON semantic_chunks(chunk_type);

-- 标签索引
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- 标签关联索引
CREATE INDEX IF NOT EXISTS idx_tagged_items_tag ON tagged_items(tag_id);
CREATE INDEX IF NOT EXISTS idx_tagged_items_entity ON tagged_items(entity_type, entity_id);

-- 语义链接索引
CREATE INDEX IF NOT EXISTS idx_semantic_links_source ON semantic_links(source_chunk_id);
CREATE INDEX IF NOT EXISTS idx_semantic_links_target ON semantic_links(target_chunk_id);
CREATE INDEX IF NOT EXISTS idx_semantic_links_type ON semantic_links(link_type);

-- 概念索引
CREATE INDEX IF NOT EXISTS idx_concepts_relevance ON concepts(relevance);
CREATE INDEX IF NOT EXISTS idx_concepts_title ON concepts(title);

-- 概念-语义块关联表索引
CREATE INDEX IF NOT EXISTS idx_concept_chunks_concept ON concept_chunks(concept_id);
CREATE INDEX IF NOT EXISTS idx_concept_chunks_chunk ON concept_chunks(chunk_id);

-- 主题索引
CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status);
CREATE INDEX IF NOT EXISTS idx_topics_title ON topics(title);

-- 主题-语义块关联表索引
CREATE INDEX IF NOT EXISTS idx_topic_chunks_topic ON topic_chunks(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_chunks_chunk ON topic_chunks(chunk_id);

-- 主题-概念关联表索引
CREATE INDEX IF NOT EXISTS idx_topic_concepts_topic ON topic_concepts(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_concepts_concept ON topic_concepts(concept_id);

-- 时间事件索引
CREATE INDEX IF NOT EXISTS idx_temporal_events_chunk_id ON temporal_events(chunk_id);
CREATE INDEX IF NOT EXISTS idx_temporal_events_type ON temporal_events(event_type);

-- 反思索引
CREATE INDEX IF NOT EXISTS idx_reflections_type ON reflections(type);
CREATE INDEX IF NOT EXISTS idx_reflections_status ON reflections(status);

-- 反思-语义块关联表索引
CREATE INDEX IF NOT EXISTS idx_reflection_chunks_reflection ON reflection_chunks(reflection_id);
CREATE INDEX IF NOT EXISTS idx_reflection_chunks_chunk ON reflection_chunks(chunk_id);

-- 作品表索引
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);

-- 作品-语义块关联表索引
CREATE INDEX IF NOT EXISTS idx_project_chunks_project ON  project_chunks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_chunks_chunk ON  project_chunks(chunk_id);

-- 页面表索引
CREATE INDEX IF NOT EXISTS idx_pages_project ON pages(project_id);
CREATE INDEX IF NOT EXISTS idx_pages_order ON pages(project_id, order_index);
CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_page_id);
CREATE INDEX IF NOT EXISTS idx_pages_container ON pages(project_id, is_container, order_index);
CREATE INDEX IF NOT EXISTS idx_pages_summary ON pages(ai_summary);

-- 迁移表索引
CREATE INDEX IF NOT EXISTS idx_migrations_db_version ON migrations_db(version);
CREATE INDEX IF NOT EXISTS idx_migrations_db_status ON migrations_db(status);

-- 任务队列索引
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_group_id ON tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_tasks_depends_on ON tasks(depends_on);

-- Skill 执行历史索引
CREATE INDEX IF NOT EXISTS idx_skill_executions_skill_id ON skill_executions(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_executions_created_at ON skill_executions(created_at);

-- ==================== 插入初始迁移记录 ====================

INSERT OR IGNORE INTO migrations_db (id, version, name, description, sql_statement, status, executed_at, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '2.0.0',
    'Init Tables and Indexes',
    '初始化 v2 架构：file_index + semantic_chunks + FTS + AI 索引表',
    'CREATE TABLE file_index, semantic_chunks, semantic_chunks_fts, concepts_fts, topics_fts, projects_fts, pages_fts, tags, tagged_items, semantic_links, concepts, concept_chunks, topics, topic_chunks, topic_concepts, temporal_events, reflections, reflection_chunks, projects,  project_chunks, pages, migrations_db, tasks, skill_executions',
    'executed',
    '2026-06-28T00:00:00.000Z',
    '2026-06-28T00:00:00.000Z',
    '2026-06-28T00:00:00.000Z'
);
