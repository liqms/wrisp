import { BaseDao } from "./base.dao";
import { FileIndex, FileIndexCreate, FileIndexUpdate, SyncStatus } from "@/main/types/db";

/**
 * 文件索引数据访问对象
 * 继承 BaseDao 获得完整的 CRUD + 批量操作能力：
 *   create / createBatch / update / delete / deleteByIds
 *   findById / findByIds / findAll / paginate / exists / transaction
 */
export class FileIndexDao extends BaseDao<FileIndex, FileIndexCreate, FileIndexUpdate> {
  constructor() {
    super("file_index", {
      enabled: true,
      createdAtField: "created_at",
      updatedAtField: "updated_at",
    });
  }

  /**
   * 根据文件路径查询单个文件索引
   * @param filePath - 文件相对路径
   * @returns 文件索引记录，未找到时返回 null
   */
  findByFilePath(filePath: string): FileIndex | null {
    if (!filePath) return null;
    return super.queryOne("SELECT * FROM file_index WHERE file_path = ?", [filePath]);
  }

  /**
   * 创建文件索引（按 file_path 去重）
   * 如果 file_path 已存在，直接返回现有记录 ID 不重复创建
   * @param data - 创建参数（必含 file_path）
   * @returns 记录 ID
   */
  create(data: FileIndexCreate): string {
    const existing = this.findByFilePath(data.file_path);
    if (existing) {
      return existing.id;
    }
    return super.create(data);
  }

  /**
   * 根据文件路径更新文件索引
   * @param filePath - 文件相对路径
   * @param data - 更新数据
   * @returns 受影响的行数
   */
  updateByFilePath(filePath: string, data: FileIndexUpdate): number {
    if (!filePath) return 0;
    const existing = this.findByFilePath(filePath);
    if (!existing) return 0;
    return this.update(existing.id, data);
  }

  /**
   * 批量创建文件索引（事务内原子执行）
   * 自动跳过已存在的 file_path
   * @param dataList - 创建参数数组
   * @returns 记录 ID 数组
   */
  createBatch(dataList: FileIndexCreate[]): string[] {
    if (dataList.length === 0) return [];
    return this.transaction(() => dataList.map((d) => this.create(d)));
  }

  /**
   * 根据文件路径删除文件索引
   * @param filePath - 文件相对路径
   * @returns 受影响的行数
   */
  deleteByFilePath(filePath: string): number {
    if (!filePath) return 0;
    return this.execute("DELETE FROM file_index WHERE file_path = ?", [filePath]).changes;
  }

  /**
   * 批量删除文件索引（事务内原子执行）
   * @param filePaths - 文件路径数组
   * @returns 受影响的行数
   */
  batchDeleteByFilePaths(filePaths: string[]): number {
    if (filePaths.length === 0) return 0;
    return this.transaction(() => {
      let total = 0;
      for (const fp of filePaths) {
        total += this.deleteByFilePath(fp);
      }
      return total;
    });
  }

  /**
   * 更新同步状态
   * @param id - 记录 ID
   * @param status - 新同步状态
   * @param syncedAt - 同步时间（默认当前时间）
   */
  updateSyncStatus(id: string, status: SyncStatus, syncedAt?: string): number {
    const timestamp = syncedAt || this.getCurrentTimestamp();
    return this.execute(
      "UPDATE file_index SET sync_status = ?, last_synced = ?, updated_at = ? WHERE id = ?",
      [status, timestamp, timestamp, id],
    ).changes;
  }
}