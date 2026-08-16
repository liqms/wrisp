/**
 * 应用程序文件夹名称常量定义
 *
 * 集中管理项目中使用的所有文件夹/目录名称常量，
 * 避免在各处代码中硬编码字符串。
 */

// ============ 工作空间文件夹 ============

/** SQLite 数据库文件夹 */
export const SQLITE_DIR = "sqlite" as const;

/** 主数据库文件名 */
export const MAIN_DB_FILE = "wrisp.db" as const;

// ============ UserData 文件夹 ============

/** 配置文件存储文件夹 (electron-store) */
export const CONFIG_DIR = "config" as const;

/** 备份文件夹 */
export const BACKUPS_DIR = "backups" as const;

/** 技能文件夹 */
export const SKILLS_DIR = "skills" as const;

/** 下载缓存文件夹 */
export const DOWNLOAD_CACHE_DIR = "downloads" as const;

/** 静态资源缓存子文件夹 */
export const STATIC_CACHE_DIR = "static" as const;

/** 本地模型文件夹 */
export const MODELS_DIR = "models" as const;


// ============ Schema 文件夹 ============

/** SQL Schema 文件夹 */
export const SCHEMAS_DIR = "schemas" as const;

/** SQL 迁移子文件夹 */
export const MIGRATIONS_DIR = "migrations" as const;

// ============ 构建输出文件夹 ============

/** Vite 渲染进程构建输出 */
export const DIST_RENDERER_DIR = "dist-renderer" as const;

/** Electron 构建输出 */
export const DIST_ELECTRON_DIR = "dist-electron" as const;

// ============ 默认工作空间 ============

/** 默认工作空间文件夹名称（位于用户文档目录下） */
export const DEFAULT_WORKSPACE_DIR = "Wrisp" as const;

/** 作品文件夹 */
export const PROJECT_DIR = "projects" as const;

// ============ 模板文件夹 ============

/** 模板根文件夹（工作空间下） */
export const TEMPLATES_DIR = "templates" as const;

/** Slash 模板子文件夹 */
export const SLASH_TEMPLATES_DIR = "slash" as const;

/** Slash 模板文件名 */
export const SLASH_TEMPLATES_FILE = "templates.json" as const;

/** 章节文件夹 */
export const CHAPTER_DIR = "chapters" as const;

/** 日志文件夹 */
export const JOURNAL_DIR = "journal" as const;

/** 作品素材文件夹 */
export const PROJECT_ASSETS_DIR = "assets" as const;

/** 作品设定文件夹 */
export const PROJECT_SETTINGS_DIR = "settings" as const;
