
import type { ApiResponse } from "@/shared/types";
import type {
  WikiOverview,
  WikiPendingCount,
  ConceptCard,
  TopicCard,
} from "@/shared/types";

export interface WikiAPI {
  /** 监听主进程的 Wiki 数据变化事件（切分 / 智能整理完成后广播），返回取消订阅函数 */
  onUpdated(callback: () => void): () => void;
  wiki: {
    overview(): Promise<ApiResponse<WikiOverview>>;
    pendingCount(): Promise<ApiResponse<WikiPendingCount>>;
    conceptCards(params: {
      keyword?: string;
      orderBy?: string;
      orderDir?: "ASC" | "DESC";
      page?: number;
      pageSize?: number;
    }): Promise<ApiResponse<{ data: ConceptCard[]; total: number }>>;
    topicCards(params: {
      keyword?: string;
      orderBy?: string;
      orderDir?: "ASC" | "DESC";
      page?: number;
      pageSize?: number;
    }): Promise<ApiResponse<{ data: TopicCard[]; total: number }>>;
  };
  topic: {
    update(
      id: string,
      data: { title?: string; summary?: string },
    ): Promise<ApiResponse<boolean>>;
    delete(id: string): Promise<ApiResponse<boolean>>;
  };
}
