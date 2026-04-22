import { WorkDao, FileDao, FolderDao, WorkTagDao, CompositeDao } from '../db'
import { Logger } from '@/main/utils/logger'
import { Work, WorkCreate, WorkUpdate, WorkStatus, WorkQuery } from '@/main/types/db'
import { CreateChapterRequest, NovelChapterInfo, FolderAndFileList, CreateNovelRequest, NovelBaseInfo, NovelDetail, NovelQueryRequest, UpdateNovelRequest, CreateFileRequest, UpdateFileRequest, UpdateChapterRequest, ChapterQueryRequest } from '@/shared/types'
import { folderService } from './folder.service'
import { fileService } from './file.service'
import { PaginationResult } from '@/shared/utils/pagination'

/**
 * 小说作品服务
 * 提供小说作品的业务逻辑处理，包括作品的创建、查询、更新、删除等操作
 * 同时处理作品与文件夹、文件的关联管理
 */
class NovelService {
  private static instance: NovelService | null = null
  private workDao: WorkDao
  private compositeDao: CompositeDao
  private fileDao: FileDao
  private folderDao: FolderDao
  private workTagDao: WorkTagDao
  /**
   * 私有构造函数
   * 初始化小说作品服务实例，创建所需的 DAO 实例
   */
  private constructor() {
    this.workDao = new WorkDao()
    this.compositeDao = new CompositeDao()
    this.fileDao = new FileDao()
    this.folderDao = new FolderDao()
    this.workTagDao = new WorkTagDao()
    Logger.info('NovelService 初始化完成')
  }

  /**
   * 获取 NovelService 的单例实例
   * @returns NovelService 单例实例
   */
  public static getInstance(): NovelService {
    if (!NovelService.instance) {
      NovelService.instance = new NovelService()
    }
    return NovelService.instance
  }

  /**
   * 创建小说作品
   * 在数据库中创建小说作品记录
   * @param request - 创建小说作品请求对象
   * @returns 创建成功的小说作品对象
   * @throws {Error} 当数据库记录创建失败时抛出错误
   */
  public createNovel(request: CreateNovelRequest): NovelBaseInfo {
    // 创建小说作品根文件夹
    const novelFolder = folderService.create({
      name: request.name,
      work_type: 'novel',
      description: request.description || '',
    })
    // 创建小说作品记录
    const createRequest: WorkCreate = {
      ...request,
      work_type: 'novel',
      path: novelFolder.path,
      full_path: novelFolder.full_path,
      chapter_count: 0,
      word_count: 0,
      total_size: 0,
      average_chapter_word_count: 0,
      folder_count: 0,
      file_count: 0,
      folder_id: novelFolder.id,
    }
    const id = this.workDao.create(createRequest)
    const work = this.workDao.findById(id)

    if (!work) {
      throw new Error('创建小说作品失败')
    }

    // 创建作品标签
    if (request.tags) {
      request.tags.forEach(tag => {
        this.workTagDao.create({
          work_id: id,
          tag_name: tag || '',
        })
      })
    }

    const result: NovelBaseInfo = {
      id: work.id,
      name: work.name,
      cover_image: work.cover_image,
      target_audience: work.target_audience || '',
      category: work.category || '',
      audience_profile: work.audience_profile || '',
      description: work.description || '',
      author_notes: work.author_notes || '',
      copyright_info: work.copyright_info || '',
      status: work.status,
    }

    Logger.info('数据库记录小说作品成功', { workId: id, workTitle: request.name })
    return result
  }

  /**
   * 根据 ID 获取小说作品详细信息
   * @param id - 小说作品 ID
   * @returns 小说作品对象，未找到时返回 null
   */
  public getNovelInfo(id: number): NovelDetail | null {
    const work = this.workDao.findById(id)
    if (!work) {
      return null
    }

    const tags = this.workTagDao.findByParams({
      work_id: id,
    }).data || []

    // 查询小说作品下的最近更新的章节文件，10条
    const files = this.fileDao.findByParams({
      work_id: id,
      primary_type: 'chapter',
      page: 1,
      page_size: 10,
      order_by: 'updated_at',
      order_dir: 'DESC',
    }).data || []

    const result: NovelDetail = {
      novel: {
        ...work,
      },
      tags: tags,
      stats: {
        word_count: work.word_count,
        chapter_count: work.chapter_count,
        folder_count: work.folder_count,
        file_count: work.file_count,
        total_size: work.total_size,
        average_chapter_word_count: work.average_chapter_word_count,
      },
      recently_updated_file: {
        id: files[0].id,
        name: files[0].name,
        word_count: files[0].word_count,
        size: files[0].size,
      },
    }
    return result
  }


  /**
   * 查询小说作品列表
   * 根据查询参数查询符合条件的小说作品列表
   * @param request - 查询参数对象
   * @returns 符合条件的小说作品列表
   */
  public queryNovels(request: NovelQueryRequest): PaginationResult<NovelBaseInfo> {
    const queryParams: WorkQuery = {
      work_type: 'novel',
      status: request.status,
      target_audience: request.target_audience,
      category: request.category,
      page: request.page || 1,
      page_size: request.page_size || 10,
      order_by: request.order_by || 'updated_at',
      order_dir: request.order_dir || 'DESC',
    }
    const works = this.workDao.findByParams(queryParams)
    return works
  }


  /**
   * 更新小说作品
   * 支持更新小说作品标题、封面、描述、状态等信息
   * @param id - 小说作品 ID
   * @param request - 更新请求对象
   * @returns 更新影响的行数
   * @throws {Error} 当小说作品不存在时抛出错误
   */
  public updateNovel(id: number, request: UpdateNovelRequest): boolean {
    const existingWork = this.workDao.findById(id)
    if (!existingWork) {
      throw new Error('小说作品不存在')
    }

    const workUpdate: WorkUpdate = {
      name: request.name,
      cover_image: request.cover_image,
      target_audience: request.target_audience,
      category: request.category,
      audience_profile: request.audience_profile,
      description: request.description,
      author_notes: request.author_notes,
      copyright_info: request.copyright_info,
      status: request.status,
    }

    if (request.tags) {
      this.workTagDao.remove(id)
      request.tags.forEach(tag => {
        this.workTagDao.create({
          work_id: id,
          tag_name: tag || '',
        })
      })
    }

    const changes = this.workDao.update(id, workUpdate)

    if (changes > 0) {
      Logger.info('数据库更新小说作品成功', { workId: id, changes })
      return true
    }
    return false
  }

  /**
   * 永久删除小说作品
   * 删除数据库记录，同时解除与文件夹和文件的关联
   * @param id - 小说作品 ID
   * @returns 删除影响的行数
   * @throws {Error} 当小说作品不存在时抛出错误
   */
  public deleteNovel(id: number): {
    worksDeleted: number
    foldersDeleted: number
    filesDeleted: number
    worksTagsDeleted: number
    fileVersionsDeleted: number
  } {
    return this.compositeDao.deleteWorkRecursive(id)
  }

  /**
   * 计算小说作品的统计信息
   * @param id - 小说作品 ID
   * @returns 是否更新成功
   */
  private updateNovelStats(id: number): boolean {
    const folderCount = this.folderDao.count(`work_id = ? and status = 1`, [id])
    const fileCount = this.fileDao.count(`work_id = ? and status = 1`, [id])
    const totalSize = this.fileDao.query(`SELECT SUM(size) FROM files WHERE work_id = ? and status = 1`, [id])[0].size
    const wordCount = this.fileDao.query(`SELECT SUM(word_count) FROM files WHERE work_id = ? and status = 1 and primary_type = 'chapter'`, [id])[0].word_count
    const chapterCount = this.workDao.count(`work_id = ? and primary_type = 'chapter'`, [id])
    const averageChapterWordCount = wordCount / chapterCount || 0


    const workUpdate: WorkUpdate = {
      word_count: wordCount,
      chapter_count: chapterCount,
      folder_count: folderCount,
      file_count: fileCount,
      total_size: totalSize,
      average_chapter_word_count: averageChapterWordCount,
    }

    const changes = this.workDao.update(id, workUpdate)
    return changes > 0
  }

  /**
   * 创建小说章节
   * @param request - 创建请求对象
   * @returns 新创建的章节 ID
   * @throws {Error} 当小说作品不存在时抛出错误
   */
  public createChapter(request: CreateChapterRequest): NovelChapterInfo {
    const { work_id, folder_id, name, content } = request
    const existingWork = this.workDao.findById(work_id)
    if (!existingWork) {
      throw new Error('小说作品不存在')
    }
    const chapter: CreateFileRequest = {
      work_id,
      folder_id,
      name,
      content,
      extension: '.md',
    }

    const file = fileService.create(chapter)
    this.updateNovelStats(work_id)    
    return file 
    
  }
  /**
   * 查询小说章节列表
   * @param request - 查询请求对象
   * @returns 符合条件的小说章节列表
   */
  public queryChapters(request: ChapterQueryRequest): FolderAndFileList {
    const folderContents = this.compositeDao.getFolderContentsBatch([request.folder_id])[0]
    return {
      folders: folderContents.folders || [],
      files: folderContents.files || [],
    }
  }

  /**
   * 查询小说章节内容
   * @param id - 小说章节 ID
   * @returns 小说章节内容
   * @throws {Error} 当小说章节不存在时抛出错误
   */
  public queryChapterContent(id: number): NovelChapterInfo {
    const file = fileService.getContent(id)
    if (!file) {
      throw new Error('小说章节不存在')
    }
    const result = {
      ...file,
      content: file.content || '',
    }
    return result
  }

  /**
   * 更新小说章节内容
   * @param id - 小说章节 ID
   * @param content - 新的章节内容
   * @returns 是否更新成功
   * @throws {Error} 当小说章节不存在时抛出错误
   */
  public updateChapterContent(id: number, request: UpdateChapterRequest): boolean {
    const fileParams: UpdateFileRequest = {
      name: request.name,
      content: request.content,
    }
    fileService.update(id, fileParams)
    return true
  }

  /**
   * 删除小说章节
   * @param id - 小说章节 ID
   * @returns 是否删除成功
   * @throws {Error} 当小说章节不存在时抛出错误
   */
  public deleteChapter(id: number): boolean {
    fileService.delete(id)
    return true
  }


}

export default NovelService

export const novelService = NovelService.getInstance()
