import { chunkService } from "@/main/core/services/chunk.service";
import { conceptChunkDao } from "@/main/core/db/conceptChunk.dao";
import { topicChunkDao } from "@/main/core/db/topicChunk.dao";
import { conceptDao } from "@/main/core/db/concept.dao";
import { topicDao } from "@/main/core/db/topic.dao";
import { SEARCH_TYPE } from "@/shared/enums";

export type MaterialKind = "chunk" | "concept" | "topic";

export interface MaterialSearchParams {
  /** 作品 id（必填）：检索严格按作品隔离 */
  projectId: string;
  query: string;
  kinds?: MaterialKind[];
  limit?: number;
}

export interface MaterialSearchItem {
  kind: MaterialKind;
  id: string;
  title?: string;
  content: string;
  score?: number;
}

const DEFAULT_KINDS: MaterialKind[] = ["chunk"];
const MAX_LIMIT = 20;

/**
 * 素材检索统一入口。
 * 所有检索强制带 projectId，杜绝跨作品召回。
 */
class MaterialSearchService {
  private static instance: MaterialSearchService | null = null;

  public static getInstance(): MaterialSearchService {
    if (!MaterialSearchService.instance) {
      MaterialSearchService.instance = new MaterialSearchService();
    }
    return MaterialSearchService.instance;
  }

  public async search(
    params: MaterialSearchParams,
  ): Promise<MaterialSearchItem[]> {
    const { projectId, query } = params;
    if (!projectId || projectId.trim() === "") {
      throw new Error("PROJECT_ID_REQUIRED");
    }
    const kinds = params.kinds?.length ? params.kinds : DEFAULT_KINDS;
    const limit = Math.min(Math.max(params.limit ?? 5, 1), MAX_LIMIT);

    const result: MaterialSearchItem[] = [];

    if (kinds.includes("chunk")) {
      const chunks = await chunkService.search(
        query,
        limit,
        SEARCH_TYPE.SEMANTIC,
        projectId,
      );
      result.push(
        ...chunks.map((c) => ({
          kind: "chunk" as const,
          id: c.id,
          content: c.content,
        })),
      );
    }

    // 概念/主题无 project_id，须经 project_chunks 关联过滤
    if (kinds.includes("concept") || kinds.includes("topic")) {
      const allowed = new Set(chunkService.getProjectChunkIds(projectId));
      if (kinds.includes("concept")) {
        result.push(...this.collectConcepts(allowed, limit));
      }
      if (kinds.includes("topic")) {
        result.push(...this.collectTopics(allowed, limit));
      }
    }

    return result.slice(0, limit);
  }

  private collectConcepts(
    allowed: Set<string>,
    limit: number,
  ): MaterialSearchItem[] {
    if (allowed.size === 0) return [];
    const links = conceptChunkDao.findByChunkIds([...allowed]);
    const ids = new Set(links.map((l) => l.concept_id));
    return conceptDao
      .findByIds([...ids])
      .slice(0, limit)
      .map((c) => ({
        kind: "concept" as const,
        id: c.id,
        title: c.title,
        content: c.evolving_summary ?? "",
      }));
  }

  private collectTopics(
    allowed: Set<string>,
    limit: number,
  ): MaterialSearchItem[] {
    if (allowed.size === 0) return [];
    const links = topicChunkDao.findByChunkIds([...allowed]);
    const ids = new Set(links.map((l) => l.topic_id));
    return topicDao
      .findByIds([...ids])
      .slice(0, limit)
      .map((t) => ({
        kind: "topic" as const,
        id: t.id,
        title: t.title,
        content: t.summary ?? "",
      }));
  }
}

export const materialSearchService = MaterialSearchService.getInstance();
