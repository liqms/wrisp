
/** Wiki 概览统计 */
export interface WikiOverviewStats {
  journalCount: number;
  chunkCount: number;
  conceptCount: number;
  topicCount: number;
  projectCount: number;
}

/** 概览页 — 近期概念摘要 */
export interface WikiConceptSummary {
  id: string;
  title: string;
  blockCount: number;
  createdAt: string;
}

/** 概览页 — 近期主题摘要 */
export interface WikiTopicSummary {
  id: string;
  title: string;
  blockCount: number;
  conceptCount: number;
  updatedAt: string;
}

/** Wiki 概览聚合数据 */
export interface WikiOverview {
  stats: WikiOverviewStats;
  recentConcepts: WikiConceptSummary[];
  recentTopics: WikiTopicSummary[];
}

/** 待整理资源数 */
export interface WikiPendingCount {
  pendingChunks: number;
}

/** 概念卡片项（含 block_count） */
export interface ConceptCard {
  id: string;
  title: string;
  evolvingSummary: string | null;
  relevance: number;
  blockCount: number;
  createdAt: string;
  updatedAt: string;
}

/** 主题卡片项（含 block_count + concept_count） */
export interface TopicCard {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  blockCount: number;
  conceptCount: number;
  createdAt: string;
  updatedAt: string;
}
