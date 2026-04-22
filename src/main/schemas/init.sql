-- =============================================
-- PenTip 数据库初始化脚本
-- 版本: 1.0.0
-- 创建时间: 2026-04-14
-- =============================================

-- 禁用外键检查（避免循环依赖问题）
PRAGMA foreign_keys = OFF;

-- 创建作品表
CREATE TABLE IF NOT EXISTS works (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cover_image TEXT,
    target_audience TEXT,
    audience_profile TEXT,
    category TEXT,
    work_type TEXT NOT NULL,
    description TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status INTEGER DEFAULT 1,
    chapter_count INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    folder_count INTEGER DEFAULT 0,
    file_count INTEGER DEFAULT 0,
    total_size INTEGER DEFAULT 0,
    average_chapter_word_count INTEGER DEFAULT 0,
    author_notes TEXT,
    copyright_info TEXT,
    path TEXT NOT NULL UNIQUE,
    full_path TEXT NOT NULL UNIQUE,
    folder_id INTEGER,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
    CHECK (status IN (0, 1, 2, 3, 4))
);

-- 创建文件夹表
CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER,
    work_id INTEGER,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    full_path TEXT NOT NULL UNIQUE,
    primary_type TEXT,
    size INTEGER DEFAULT 0,
    file_count INTEGER DEFAULT 0,
    folder_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status INTEGER DEFAULT 1,
    description TEXT,
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE SET NULL,
    CHECK (status IN (0, 1, 2))
);

-- 创建文件表
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id INTEGER NOT NULL,
    work_id INTEGER,
    name TEXT NOT NULL,
    primary_type TEXT,
    path TEXT NOT NULL UNIQUE,
    full_path TEXT NOT NULL UNIQUE,
    extension TEXT,
    size INTEGER DEFAULT 0,
    type TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status INTEGER DEFAULT 1,
    hash_md5 TEXT,
    hash_sha256 TEXT,
    is_symlink INTEGER DEFAULT 0,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE SET NULL,
    CHECK (status IN (0, 1, 2, 3)),
    CHECK (is_symlink IN (0, 1))
);

-- 创建作品标签表
CREATE TABLE IF NOT EXISTS work_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    work_id INTEGER NOT NULL,
    tag_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

-- 创建文件版本表
CREATE TABLE IF NOT EXISTS file_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    size INTEGER DEFAULT 0,
    change_type TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    backup_path TEXT,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    CHECK (change_type IN ('create', 'update', 'rename', 'move'))
);

-- 创建数据库版本表
CREATE TABLE IF NOT EXISTS migrations_db (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    sql_statement TEXT NOT NULL,
    status INTEGER DEFAULT 0,
    executed_at TEXT,
    execution_time INTEGER,
    checksum TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (status IN (0, 1, 2))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_works_name ON works(name);
CREATE INDEX IF NOT EXISTS idx_works_work_type ON works(work_type);
CREATE INDEX IF NOT EXISTS idx_works_status ON works(status);
CREATE INDEX IF NOT EXISTS idx_works_created_at ON works(created_at);
CREATE INDEX IF NOT EXISTS idx_works_target_audience ON works(target_audience);
CREATE INDEX IF NOT EXISTS idx_works_category ON works(category);
CREATE INDEX IF NOT EXISTS idx_works_folder_id ON works(folder_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_work_id ON folders(work_id);
CREATE INDEX IF NOT EXISTS idx_folders_path ON folders(path);
CREATE INDEX IF NOT EXISTS idx_folders_primary_type ON folders(primary_type);
CREATE INDEX IF NOT EXISTS idx_folders_status ON folders(status);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_work_id ON files(work_id);
CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
CREATE INDEX IF NOT EXISTS idx_files_extension ON files(extension);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_files_type ON files(type);
CREATE INDEX IF NOT EXISTS idx_files_primary_type ON files(primary_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_tags_unique ON work_tags(work_id, tag_name);
CREATE INDEX IF NOT EXISTS idx_work_tags_tag_name ON work_tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions(file_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_versions_version ON file_versions(file_id, version_number);
CREATE INDEX IF NOT EXISTS idx_migrations_db_version ON migrations_db(version);
CREATE INDEX IF NOT EXISTS idx_migrations_db_status ON migrations_db(status);

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- 插入初始迁移记录
INSERT OR IGNORE INTO migrations_db (version, name, description, sql_statement, status, executed_at)
VALUES (
    '1.0.0',
    'Initial Setup',
    '创建初始数据库表结构',
    'CREATE TABLE works, folders, files, work_tags, file_versions, migrations_db',
    1,
    CURRENT_TIMESTAMP
);
