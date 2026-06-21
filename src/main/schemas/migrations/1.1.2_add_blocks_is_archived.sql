-- =============================================
-- PenTip 数据库迁移脚本
-- 版本: 1.1.2
-- 迁移名称: add_blocks_is_archived
-- 描述: 添加块 归档标记字段
-- =============================================

-- blocks 表添加 is_archived 字段
ALTER TABLE blocks
    ADD COLUMN is_archived INTEGER DEFAULT 0;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_blocks_is_archived ON blocks(is_archived);

-- ==================== 插入迁移记录 ====================

INSERT OR IGNORE INTO migrations_db (id, version, name, description, sql_statement, status, executed_at, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    '1.1.2',
    'Add Blocks Is Archived Field',
    '添加块 归档标记字段',
    'ALTER TABLE blocks ADD COLUMN is_archived INTEGER DEFAULT 0;CREATE INDEX IF NOT EXISTS idx_blocks_is_archived ON blocks(is_archived);',
    'pending',
    '',
    '2026-06-11T00:00:00.000Z',
    '2026-06-11T00:00:00.000Z'
);
