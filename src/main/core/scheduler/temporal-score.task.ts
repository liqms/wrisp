import { ChunkDao } from '@/main/core/db'
import { Logger } from '@/main/utils/logger'
import { TimeUtil } from '@/shared/utils'
import { DEFAULT_TEMPORAL_SCORE_CONFIG } from '@/main/constants/auto.constants'

/**
 * 时间热度分重算任务
 *
 * 按指数衰减公式（score = exp(-λ·ageDays)，λ = ln2 / 半衰期）刷新
 * `semantic_chunks.temporal_score`。衰减分数只在其计算时刻有效，需要随
 * 时间推移周期性重算；单块增量初始化由语义链接任务负责。
 */
export class TemporalScoreTask {
  /** 单例实例 */
  private static instance: TemporalScoreTask
  /** 语义块 DAO */
  private chunkDao: ChunkDao

  private constructor() {
    this.chunkDao = new ChunkDao()
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): TemporalScoreTask {
    if (!TemporalScoreTask.instance) {
      TemporalScoreTask.instance = new TemporalScoreTask()
    }
    return TemporalScoreTask.instance
  }

  /**
   * 重算全表语义块的时间热度分
   * @returns 实际更新的行数
   */
  public recompute(): number {
    const { halfLifeDays } = DEFAULT_TEMPORAL_SCORE_CONFIG
    const now = TimeUtil.now()
    try {
      const changes = this.chunkDao.recomputeTemporalScores((createdAt) =>
        TimeUtil.temporalScore(createdAt, now, halfLifeDays),
      )
      Logger.info('时间热度分重算完成', { changes, halfLifeDays })
      return changes
    } catch (error) {
      Logger.error('时间热度分重算失败', { error: String(error) })
      return 0
    }
  }
}

export const temporalScoreTask = TemporalScoreTask.getInstance()