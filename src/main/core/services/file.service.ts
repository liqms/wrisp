import fs from 'fs'
import path, { join } from 'path'
import crypto from 'crypto'
import { FileDao, FolderDao, FileVersionDao } from '../db'
import { Logger } from '@/main/utils/logger'
import { File, FileCreate, FileUpdate, FileQuery, FileType, FileVersionCreate } from '@/main/types/db'
import { configService } from './config.service'
import { CreateFileRequest, FileQueryRequest, UpdateFileRequest } from '@/shared/types'
import { PaginationResult } from '@/shared/utils/pagination'

/**
 * 文件服务
 * 提供文件的业务逻辑处理，包括文件的创建、查询、更新、删除等操作
 * 同时处理物理文件操作和数据库记录的同步
 */
class FileService {
  private static instance: FileService | null = null
  private fileDao: FileDao
  private folderDao: FolderDao
  private fileVersionDao: FileVersionDao
  private workspaceDir: string

  /**
   * 私有构造函数
   * 初始化文件服务实例，创建所需的 DAO 实例
   */
  private constructor() {
    this.fileDao = new FileDao()
    this.folderDao = new FolderDao()
    this.fileVersionDao = new FileVersionDao()
    this.workspaceDir = this.getWorkspaceDir()
    Logger.info('FileService 初始化完成')
  }

  /**
   * 获取 FileService 的单例实例
   * @returns FileService 单例实例
   */
  public static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService()
    }
    return FileService.instance
  }

  /**
   * 获取工作区目录路径
   * @returns 工作区目录路径，未配置时返回空字符串
   */
  private getWorkspaceDir(): string {
    return configService.getValue<string>('workspace') || ''
  }

  /**
   * 创建文件
   * 在物理文件系统中创建文件，并在数据库中记录文件信息
   * @param request - 创建文件请求对象
   * @param request.folderId - 所属文件夹 ID
   * @param request.workId - 所属作品 ID，可选
   * @param request.name - 文件名称
   * @param request.content - 文件内容，可选，默认为空字符串
   * @param request.extension - 文件扩展名，可选，默认为空字符串
   * @returns 创建成功的文件对象
   * @throws {Error} 当文件夹不存在时抛出错误
   * @throws {Error} 当物理文件创建失败时抛出错误
   * @throws {Error} 当数据库记录创建失败时抛出错误
   */
  public create(request: CreateFileRequest): File {
    if (!this.workspaceDir) {
      throw new Error('未配置工作区目录')
    }
    const folderPath = this.getFolderPath(request.folder_id)
    if (!folderPath) {
      throw new Error('文件夹不存在')
    }

    const filePath = this.generateUniqueFileName({ folderPath, extension: request.extension })
    const absoluteFilePath = path.join(this.workspaceDir, filePath.full_path)

    try {
      fs.writeFileSync(absoluteFilePath, request.content || '', { encoding: 'utf8' })
      Logger.info('物理创建文件成功', { path: absoluteFilePath })
    } catch (error) {
      throw new Error(`物理创建文件失败: ${(error as Error).message}`)
    }

    const fileStats = fs.statSync(absoluteFilePath)
    const hash = this.calculateFileHash(absoluteFilePath)
    const type = this.detectFileType(request.extension || '')

    let wordCount = 0
    if (request.extension === 'txt' || request.extension === 'md') {
      wordCount = this.calculateWordCount(request.content || '').word_count
    }


    const fileCreate: FileCreate = {
      folder_id: request.folder_id,
      work_id: request.work_id,
      name: request.name,
      path: filePath.path,
      full_path: filePath.full_path,
      extension: request.extension || null,
      size: fileStats.size,
      type: type as FileType || undefined,
      hash_md5: hash.md5,
      hash_sha256: hash.sha256,
      is_symlink: fileStats.isSymbolicLink() ? 1 : 0,
      version_number: 1,
      word_count: wordCount,
      duration: 0,
    }

    const id = this.fileDao.create(fileCreate)
    const file = this.fileDao.findById(id)

    if (!file) {
      fs.unlinkSync(absoluteFilePath)
      throw new Error('创建文件失败')
    }
    // 创建文件版本记录
    const fileVersionCreate: FileVersionCreate = {
      file_id: id,
      change_type: 'create',
      version_number: 1,
      size: fileStats.size,
      description: '初始版本',
      backup_path: null,
    }
    this.fileVersionDao.create(fileVersionCreate)

    Logger.info('数据库记录文件成功', { fileId: id, fileName: request.name, filePath: filePath })
    return file
  }

  /**
   * 获取文件信息
   * 支持通过文件 ID 或文件路径查询文件基本信息
   * @param identifier - 文件标识符，可以是文件 ID 或文件路径
   * @returns 文件信息对象，未找到时返回 null
   */
  public getInfo(identifier: number | string): File | null {
    if (typeof identifier === 'number') {
      // 通过 ID 查询
      return this.fileDao.findById(identifier)
    } else {
      // 通过路径查询
      const file = this.fileDao.findByParams({ path: identifier })
      return file ? file.data[0] : null
    }
  }

  /**
   * 获取文件内容和信息
   * 支持通过文件 ID 或文件路径查询文件信息、标签和文件内容
   * @param identifier - 文件标识符，可以是文件 ID 或文件路径
   * @returns 文件信息对象（包含文件内容和可选标签），未找到或读取失败时返回 null
   */
  public getContent(identifier: number | string): (File & { content: string }) | null {
    let file = this.getInfo(identifier)

    if (!file) {
      return null
    }

    const absoluteFilePath = path.join(this.workspaceDir, file.path)

    try {
      const content = fs.readFileSync(absoluteFilePath, { encoding: 'utf8' })

      return { ...file, content }

    } catch (error) {
      Logger.error('读取文件内容失败', {
        fileId: file.id,
        path: file.path,
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  /**
   * 分页查询文件列表
   * 提供完整的文件分页查询功能，包含分页元信息
   * @param request - 查询参数对象
   * @param page - 页码（从 1 开始）
   * @param pageSize - 每页记录数（最大 100）
   * @returns 分页结果对象，包含数据、总数、页码和分页信息
   */
  public query(request: FileQueryRequest): PaginationResult<File> {
    // 使用标准查询参数
    const query: FileQuery = {
      work_id: request.work_id,
      folder_id: request.folder_id,
      name: request.name,
      extension: request.extension,
      type: request.type,
      status: request.status,
      page: request.page,
      page_size: request.page_size,
      order_by: request.order_by,
      order_dir: request.order_dir,
      primary_type: request.primary_type,
    }
    return this.fileDao.findByParams(query)

  }

  /**
   * 更新文件
   * 支持更新文件名称、内容、所属文件夹和作品关联，同步更新物理文件和数据库记录
   * @param id - 文件 ID
   * @param request - 更新请求对象
   * @param request.name - 新文件名称，可选
   * @param request.content - 新文件内容，可选
   * @returns 更新影响的行数
   * @throws {Error} 当文件不存在时抛出错误
   * @throws {Error} 当文件夹不存在时抛出错误
   * @throws {Error} 当物理文件操作失败时抛出错误
   */
  public update(id: number, request: UpdateFileRequest): number {
    const existingFile = this.fileDao.findById(id)
    if (!existingFile) {
      throw new Error('文件不存在')
    }

    const absoluteFilePath = path.join(this.workspaceDir, existingFile.full_path)

    if (request.content !== undefined) {
      try {
        fs.writeFileSync(absoluteFilePath, request.content, { encoding: 'utf8' })
        Logger.info('物理更新文件内容成功', { path: absoluteFilePath })
      } catch (error) {
        throw new Error(`物理更新文件内容失败: ${(error as Error).message}`)
      }
    }

    const fileStats = fs.statSync(absoluteFilePath)
    const hash = this.calculateFileHash(absoluteFilePath)

    let wordCount = 0
    if (existingFile.extension === 'txt' || existingFile.extension === 'md') {
      wordCount = this.calculateWordCount(request.content || '').word_count
    }

    const fileUpdate: FileUpdate = {
      name: request.name,
      size: request.content !== undefined ? fileStats.size : undefined,
      hash_md5: hash.md5,
      hash_sha256: hash.sha256,
      word_count: wordCount,
      duration: 0,
    }

    const changes = this.fileDao.update(id, fileUpdate)

    if (changes > 0) {
      // 创建文件版本记录
      const fileVersionCreate: FileVersionCreate = {
        file_id: id,
        change_type: 'update',
        version_number: existingFile.version_number ? existingFile.version_number + 1 : 1,
        size: request.content !== undefined ? fileStats.size : undefined,
        description: '更新版本',
        backup_path: null,
      }
      this.fileVersionDao.create(fileVersionCreate)

      Logger.info('数据库更新文件成功', { fileId: id, changes })
    }

    return changes
  }

  /**
   * 永久删除文件
   * 删除物理文件、数据库记录和关联的标签
   * @param id - 文件 ID
   * @returns 删除影响的行数
   * @throws {Error} 当文件不存在时抛出错误
   * @throws {Error} 当物理文件删除失败时抛出错误
   */
  public delete(id: number): number {
    const file = this.fileDao.findById(id)
    if (!file) {
      return 0
    }
    const absoluteFilePath = join(this.workspaceDir, file.full_path)

    try {
      fs.unlinkSync(absoluteFilePath)
      Logger.info('物理删除文件成功', { path: absoluteFilePath })
    } catch (error) {
      throw new Error(`物理删除文件失败: ${(error as Error).message}`)
    }

    const changes = this.fileDao.delete(id)

    if (changes > 0) {
      // 删除文件版本记录
      this.fileVersionDao.deleteByFileId(id)
      Logger.info('数据库删除文件成功', { fileId: id })
    }

    return changes
  }

  /**
   * 查找重复文件
   * 根据文件哈希值查找内容相同的文件
   * @returns 重复文件列表
   */
  public findDuplicates(): File[] {
    return this.fileDao.findDuplicates()
  }

  /**
   * 批量移动文件
   * 支持批量移动文件到新的文件夹
   * @param ids - 文件 ID 列表
   * @param newFolderId - 新文件夹 ID
   * @returns 更新影响的行数
   */
  public batchMove(ids: number[], newFolderId: number): number {
    let totalChanges = 0
    const newFolderPath = this.getFolderPath(newFolderId)

    if (!newFolderPath) {
      throw new Error('新文件夹不存在')
    }

    for (const id of ids) {
      const file = this.fileDao.findById(id)
      if (!file) {
        continue
      }
      const absoluteFullPath = join(this.workspaceDir, file.full_path)
      const newFilePath = path.join(newFolderPath, `${file.path}.${file.extension}`)
      const absoluteNewFullPath = join(this.workspaceDir, newFilePath)

      try {
        fs.renameSync(absoluteFullPath, absoluteNewFullPath)
      } catch (error) {
        continue
      }

      const changes = this.fileDao.update(id, { folder_id: newFolderId, full_path: newFilePath })
      totalChanges += changes
      if (changes > 0) {
        // 创建文件版本记录
        const fileVersionCreate: FileVersionCreate = {
          file_id: id,
          change_type: 'move',
          version_number: file.version_number ? file.version_number : 1,
          size: file.size,
          description: '移动文件',
          backup_path: null,
        }
        this.fileVersionDao.create(fileVersionCreate)
      }
      Logger.info('数据库移动文件成功', { fileId: id, changes })
    }

    return totalChanges
  }


  /**
   * 获取文件夹路径
   * @param folderId - 文件夹 ID
   * @returns 文件夹路径，文件夹不存在时返回 null
   */
  private getFolderPath(folderId: number): string | null {
    const folder = this.folderDao.findById(folderId)
    return folder?.path || null
  }

  /**
   * 生成唯一文件名路径
   * 为新创建的文件生成一个唯一的文件名路径，包含时间戳和随机数
   * @param folderPath - 文件夹路径
   * @param serial - 序列号，用于区分文件名
   * @param extension - 文件扩展名
   * @returns 唯一文件名路径，格式为 "folderPath/file_timestamp.extension" 
   */
  private generateUniqueFileName(options: { folderPath: string, serial?: number, extension?: string }): { path: string, full_path: string } {
    const { folderPath, serial, extension } = options
    const now = Math.floor(Date.now() / 1000)
    const path = `file_${now}`
    const full_path = `${folderPath}/${path}_${serial}${extension}`
    return { path, full_path }
  }

  /**
   * 计算文件哈希值
   * 计算文件的 MD5 和 SHA-256 哈希值
   * @param filePath - 文件路径
   * @returns 包含 MD5 和 SHA-256 哈希值的对象，计算失败时返回空字符串
   */
  private calculateFileHash(filePath: string): { md5: string; sha256: string } {
    try {
      const content = fs.readFileSync(filePath)
      const md5 = crypto.createHash('md5').update(content).digest('hex')
      const sha256 = crypto.createHash('sha256').update(content).digest('hex')
      return { md5, sha256 }
    } catch {
      return { md5: '', sha256: '' }
    }
  }


  /**
   * 检测文件类型
   * 根据文件扩展名判断文件类型（文档、图片、视频、音频、压缩包、代码、可执行文件等）
   * @param extension - 文件扩展名
   * @returns 文件类型，无法识别时返回 'other'
   */
  private detectFileType(extension: string | null): string | null {
    if (!extension) return 'other'

    const typeMap: Record<string, string> = {
      // 文档
      'txt': 'document',
      'doc': 'document',
      'docx': 'document',
      'pdf': 'document',
      'xls': 'document',
      'xlsx': 'document',
      'ppt': 'document',
      'pptx': 'document',
      'odt': 'document',
      'ods': 'document',
      'odp': 'document',
      // 图片
      'jpg': 'image',
      'jpeg': 'image',
      'png': 'image',
      'gif': 'image',
      'bmp': 'image',
      'webp': 'image',
      'svg': 'image',
      'ico': 'image',
      // 视频
      'mp4': 'video',
      'mkv': 'video',
      'avi': 'video',
      'mov': 'video',
      'wmv': 'video',
      'flv': 'video',
      // 音频
      'mp3': 'audio',
      'wav': 'audio',
      'flac': 'audio',
      'ogg': 'audio',
      'm4a': 'audio',
      // 压缩包
      'zip': 'archive',
      'rar': 'archive',
      '7z': 'archive',
      'tar': 'archive',
      'gz': 'archive',
      'bz2': 'archive',
      // 代码
      'js': 'code',
      'ts': 'code',
      'jsx': 'code',
      'tsx': 'code',
      'html': 'code',
      'css': 'code',
      'json': 'code',
      'xml': 'code',
      'yaml': 'code',
      'yml': 'code',
      'md': 'code',
      'py': 'code',
      'java': 'code',
      'cpp': 'code',
      'c': 'code',
      'go': 'code',
      'rs': 'code',
      'php': 'code',
      'rb': 'code',
      'swift': 'code',
      'kotlin': 'code',
      // 可执行文件
      'exe': 'executable',
      'msi': 'executable',
      'dll': 'executable',
      'sh': 'executable',
      'bat': 'executable'
    }

    return typeMap[extension] || 'other'
  }

  /**
   * 计算文件字数
   * 计算文件的字数，一个汉字或一个单词都计算为1个字符
   * @param content - 文件内容
   * @returns 包含字数的对象
   */
  private calculateWordCount(content: string): { word_count: number } {
    if (!content || content.trim().length === 0) {
      return { word_count: 0 }
    }

    // 去除标点符号和多余空格
    const cleanedContent = content
      .replace(/[\p{P}\p{S}]/gu, ' ')  // 去除标点符号和符号
      .replace(/\s+/g, ' ')            // 将多个空格合并为一个
      .trim()                          // 去除首尾空格

    if (cleanedContent.length === 0) {
      return { word_count: 0 }
    }

    // 按空格分割单词，每个单词或汉字都算作1个
    const words = cleanedContent.split(' ')

    // 统计有效字符（汉字、字母、数字等）
    let wordCount = 0
    for (const word of words) {
      if (word.length > 0) {
        wordCount++
      }
    }

    return { word_count: wordCount }
  }
}

export default FileService

export const fileService = FileService.getInstance()
