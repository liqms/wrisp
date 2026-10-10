import {
  ThemeMode,
  ThemeColor,
  Locale,
  UpdateChannel,
} from "@/shared/enums/config.enums";
import type { Profession } from "@/shared/enums/profession.enums";
import type { WritingPreference } from "./writing-preference.types";
import type { LocalizedText } from "./template.types";

export interface General {
  themeMode: ThemeMode;
  themeColor: ThemeColor;
  locale: Locale;
  updateChannel: UpdateChannel;
  /** 日志页面日期标题行的显示格式（TimeUtil 模板，如 YYYY-MM-DD） */
  journalDateFormat: string;
}

export interface UserInfo {
  nickname: string; // 用户昵称
  avatar?: string; // 头像URL
  token?: string; // 认证令牌
  refreshToken?: string; // 刷新令牌
  registrationDate: string; // 注册日期
  lastLoginDate?: string; // 最后登录日期
  email?: string; // 邮箱地址
  bio?: string; // 个人简介
  preferences: {
    // 用户偏好设置
    country?: string; // 国家或地区
    timezone: string; // 时区设置
    notification: boolean; // 通知偏好
    profession?: Profession; // 当前用户职业，决定 Slash Menu 展示哪套模板
  };
}

export interface FailoverConfig {
  maxRetries: number;
  retryDelayMs: number;
  circuitBreakerThreshold: number;
  cooldownMs: number;
}

export interface SkillsConfig {
  remoteUpdateEnabled: boolean;
  remoteUpdateUrl: string;
}

/**
 * 智能整理（smart-tasks）的调参与资源治理配置。
 * 可选键：历史配置里整块不存在，消费方需自带默认值兜底
 * （config.service 加载时会对嵌套块做深合并，但 setValue 只能写已存在的键）。
 */
export interface SmartTaskConfig {
  /** 语义链接的逐块并发上限 */
  semanticLinkConcurrency: number;
  /** 每块送入 reranker 的 ANN 候选数 */
  annTopK: number;
  /** 每块最终写入的链接数（批内截断，不涉及分数绝对值） */
  rerankTopK: number;
  /** ONNX 会话 intraOpNumThreads；null = 按核数与同批会话数分摊 */
  onnxIntraOpThreads: number | null;
  /** node-llama-cpp 实例级 maxThreads；null = 同上；仅 CPU 形态下有意义 */
  llmMaxThreads: number | null;
  /** 概念抽取输入的正文字符窗口 */
  conceptInputWindowChars: number;
  /** 概念向量对齐：≥ 该 cosine 直接合并 */
  conceptMergeAutoThreshold: number;
  /** 概念向量对齐：介于两阈值之间交 LLM 判定，低于 review 值则新建 */
  conceptMergeReviewThreshold: number;
  /** 主题聚类的成对 cosine 阈值 */
  topicClusterThreshold: number;
  /** 演化摘要单次喂入的证据条数 */
  evidenceBatchSize: number;
  /** 分片流水线的每片文件数 */
  shardSize: number;
  /** 允许同层内多个 CPU-bound 模型组并行（限线程落地后才适合放开） */
  allowCpuBoundParallel: boolean;
}

export interface KeymapItem {
  id: string;
  /** 快捷键名称（双语，zh/en） */
  name: LocalizedText;
  keys: string;
}

export interface AppConfig {
  general: General; // 通用配置
  userInfo: UserInfo; // 用户信息
  version: string; // 配置版本
  workspace: string; // 工作目录
  currentProjectId?: string; // 当前选择的项目ID
  isFirstLaunch: boolean; // 是否首次启动
  isUpdateLaunch: boolean; // 是否更新后首次启动
  updatedAt: string; // 更新时间
  /**
   * 用户写作偏好（跨作品，创作智能体使用）。
   * 可选：历史用户配置里没有该字段，消费方需自带默认值兜底。
   */
  writingPreference?: WritingPreference;
  failoverConfig: FailoverConfig; // 降级/熔断配置
  skillsConfig: SkillsConfig; // Skills 远程更新配置
  shortcuts?: KeymapItem[]; // 快捷键配置
  /** 智能整理调参（可选，缺省取 DEFAULT_SMART_TASK_CONFIG） */
  smartTask?: SmartTaskConfig;

}
