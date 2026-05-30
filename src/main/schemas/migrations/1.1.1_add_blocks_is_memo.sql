-- =============================================
-- PenTip 数据库迁移脚本
-- 版本: 1.1.1
-- 迁移名称: add_blocks_is_memo
-- 描述: 添加块 是否为 memo 字段
-- =============================================

-- blocks 表添加 is_memo 字段
ALTER TABLE blocks
    ADD COLUMN is_memo INTEGER DEFAULT 0;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_blocks_is_memo ON blocks(is_memo);

-- ==================== 插入迁移记录 ====================

INSERT OR IGNORE INTO migrations_db (id, version, name, description, sql_statement, status, executed_at, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '1.1.1',
    'Add Blocks Is Memo Field',
    '添加块 是否为 memo 字段',
    'ALTER TABLE blocks ADD COLUMN is_memo INTEGER DEFAULT 0;CREATE INDEX IF NOT EXISTS idx_blocks_is_memo ON blocks(is_memo);',
    'executed',
    '2026-05-30T19:45:15.255Z',
    '2026-05-30T19:45:15.255Z',
    '2026-05-30T19:45:15.255Z'
);