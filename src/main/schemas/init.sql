-- =============================================
-- PenTip 数据库初始化脚本
-- 版本: 1.1.0
-- 创建时间: 2026-05-14
-- =============================================

-- 禁用外键检查（避免循环依赖问题）
PRAGMA foreign_keys = OFF;

-- ==================== 新增核心表 ====================

-- 创建 Block 表
CREATE TABLE IF NOT EXISTS blocks (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'text',
    source TEXT DEFAULT 'manual',
    language TEXT DEFAULT 'zh',
    metadata TEXT DEFAULT '{}',
    parent_block_id TEXT REFERENCES blocks(id),
    split_index INTEGER DEFAULT 0,
    is_memo INTEGER DEFAULT 0,
    is_archived INTEGER DEFAULT 0,
    ai_summary TEXT,
    temporal_score REAL DEFAULT 0.0,
    word_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 创建 Block FTS5 全文索引
CREATE VIRTUAL TABLE IF NOT EXISTS blocks_fts USING fts5(
    content,
    ai_summary,
    content='blocks',
    content_rowid='rowid',
   );

-- 创建标签表
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#666666',
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
    source_block_id TEXT NOT NULL REFERENCES blocks(id),
    target_block_id TEXT NOT NULL REFERENCES blocks(id),
    link_type TEXT DEFAULT 'semantic',
    similarity REAL DEFAULT 0.0,
    ai_explanation TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(source_block_id, target_block_id)
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

-- 创建概念-Block 关联表
CREATE TABLE IF NOT EXISTS concept_blocks (
    concept_id TEXT NOT NULL,
    block_id TEXT NOT NULL,
    relevance_score REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (concept_id, block_id),
    FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE CASCADE,
    FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
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

-- 创建主题-Block 关联表
CREATE TABLE IF NOT EXISTS topic_blocks (
    topic_id TEXT NOT NULL,
    block_id TEXT NOT NULL,
    relevance_score REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (topic_id, block_id),
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
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
    block_id TEXT NOT NULL REFERENCES blocks(id),
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
    CHECK (status IN ('pending', 'read', 'archived'))
);

-- 创建反思-Block 关联表
CREATE TABLE IF NOT EXISTS reflection_blocks (
    reflection_id TEXT NOT NULL,
    block_id TEXT NOT NULL,
    relevance_score REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (reflection_id, block_id),
    FOREIGN KEY (reflection_id) REFERENCES reflections(id) ON DELETE CASCADE,
    FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
);

-- ==================== 原有表（保留兼容） ====================

-- 创建作品表
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
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

-- 创建作品-Block 关联表
CREATE TABLE IF NOT EXISTS project_blocks (
    project_id TEXT NOT NULL,
    block_id TEXT NOT NULL,
    relevance_score REAL DEFAULT 0.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (project_id, block_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
);

-- 创建页面表
CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT,
    order_index INTEGER DEFAULT 0,
    parent_page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
    is_container INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    ai_summary TEXT,
    metadata TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (status IN ('active', 'archived')),
    CHECK (is_container IN (0, 1))
);

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

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- ==================== 创建索引 ====================

-- Block 索引
CREATE INDEX IF NOT EXISTS idx_blocks_source ON blocks(source);
CREATE INDEX IF NOT EXISTS idx_blocks_parent ON blocks(parent_block_id);
CREATE INDEX IF NOT EXISTS idx_blocks_created_at ON blocks(created_at);
CREATE INDEX IF NOT EXISTS idx_blocks_temporal_score ON blocks(temporal_score);
CREATE INDEX IF NOT EXISTS idx_blocks_status ON blocks(status);
CREATE INDEX IF NOT EXISTS idx_blocks_is_memo ON blocks(is_memo);
CREATE INDEX IF NOT EXISTS idx_blocks_is_archived ON blocks(is_archived);

-- 标签索引
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- 标签关联索引
CREATE INDEX IF NOT EXISTS idx_tagged_items_tag ON tagged_items(tag_id);
CREATE INDEX IF NOT EXISTS idx_tagged_items_entity ON tagged_items(entity_type, entity_id);

-- 语义链接索引
CREATE INDEX IF NOT EXISTS idx_semantic_links_source ON semantic_links(source_block_id);
CREATE INDEX IF NOT EXISTS idx_semantic_links_target ON semantic_links(target_block_id);
CREATE INDEX IF NOT EXISTS idx_semantic_links_type ON semantic_links(link_type);

-- 概念索引
CREATE INDEX IF NOT EXISTS idx_concepts_relevance ON concepts(relevance);
CREATE INDEX IF NOT EXISTS idx_concepts_title ON concepts(title);

-- 概念-Block 关联表索引
CREATE INDEX IF NOT EXISTS idx_concept_blocks_concept ON concept_blocks(concept_id);
CREATE INDEX IF NOT EXISTS idx_concept_blocks_block ON concept_blocks(block_id);

-- 主题索引
CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status);
CREATE INDEX IF NOT EXISTS idx_topics_title ON topics(title);

-- 主题-Block 关联表索引
CREATE INDEX IF NOT EXISTS idx_topic_blocks_topic ON topic_blocks(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_blocks_block ON topic_blocks(block_id);

-- 主题-概念关联表索引
CREATE INDEX IF NOT EXISTS idx_topic_concepts_topic ON topic_concepts(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_concepts_concept ON topic_concepts(concept_id);

-- 时间事件索引
CREATE INDEX IF NOT EXISTS idx_temporal_events_block_id ON temporal_events(block_id);
CREATE INDEX IF NOT EXISTS idx_temporal_events_type ON temporal_events(event_type);

-- 反思索引
CREATE INDEX IF NOT EXISTS idx_reflections_type ON reflections(type);
CREATE INDEX IF NOT EXISTS idx_reflections_status ON reflections(status);

-- 反思-Block 关联表索引
CREATE INDEX IF NOT EXISTS idx_reflection_blocks_reflection ON reflection_blocks(reflection_id);
CREATE INDEX IF NOT EXISTS idx_reflection_blocks_block ON reflection_blocks(block_id);

-- 作品表索引
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);

-- 作品-Block 关联表索引
CREATE INDEX IF NOT EXISTS idx_project_blocks_project ON project_blocks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_blocks_block ON project_blocks(block_id);

-- 页面表索引
CREATE INDEX IF NOT EXISTS idx_pages_project ON pages(project_id);
CREATE INDEX IF NOT EXISTS idx_pages_order ON pages(project_id, order_index);
CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_page_id);
CREATE INDEX IF NOT EXISTS idx_pages_container ON pages(project_id, is_container, order_index);

-- 迁移表索引
CREATE INDEX IF NOT EXISTS idx_migrations_db_version ON migrations_db(version);

-- 任务队列索引
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_group_id ON tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_tasks_depends_on ON tasks(depends_on);

-- ==================== FTS 同步触发器 ====================

CREATE TRIGGER IF NOT EXISTS blocks_ai AFTER INSERT ON blocks BEGIN
    INSERT INTO blocks_fts(rowid, content, ai_summary)
    VALUES (new.rowid, new.content, new.ai_summary);
END;

CREATE TRIGGER IF NOT EXISTS blocks_ad AFTER DELETE ON blocks BEGIN
    DELETE FROM blocks_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER IF NOT EXISTS blocks_au AFTER UPDATE ON blocks BEGIN
    DELETE FROM blocks_fts WHERE rowid = old.rowid;
    INSERT INTO blocks_fts(rowid, content, ai_summary)
    VALUES (new.rowid, new.content, new.ai_summary);
END;

-- ==================== 插入初始迁移记录 ====================

INSERT OR IGNORE INTO migrations_db (id, version, name, description, sql_statement, status, executed_at, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '1.1.1',
    'Init Tables and Indexes',
    '初始化关联关系表',
    'CREATE TABLE blocks, blocks_fts, tags, tagged_items, semantic_links, concepts, concept_blocks, topics, topic_blocks, topic_concepts, temporal_events, reflections, reflection_blocks, projects, project_blocks, pages, migrations_db',
    'executed',
    '2026-05-21T23:55:15.255Z',
    '2026-05-21T23:55:15.255Z',
    '2026-05-21T23:55:15.255Z'
);
