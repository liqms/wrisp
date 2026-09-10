import { Logger } from "@/main/utils/logger";
import type { OutlineNode } from "@/shared/types";

export interface MaterialSearchItem {
  kind: "chunk" | "concept" | "topic";
  id: string;
  title?: string;
  content: string;
  score?: number;
}

/**
 * 素材检索函数（由调用方注入）。
 * 之所以用注入而非直接 import 服务，是为了让本编排可单测，
 * 也便于将来替换检索实现。
 */
export type MaterialSearchFn = (params: {
  projectId: string;
  query: string;
  kinds?: string[];
  limit?: number;
}) => Promise<MaterialSearchItem[]>;

export interface NodeMaterials {
  nodeId: string;
  items: MaterialSearchItem[];
}

const DEFAULT_LIMIT_PER_NODE = 5;

/**
 * 大纲阶段素材预取（方案 C）：为每个大纲节点检索本作品素材，供用户过目。
 *
 * - 检索一律限定在 projectId 内，杜绝跨作品召回；
 * - 单节点失败保守降级为空素材，不影响其它节点，也不中断整个流程；
 * - 节点无标题且无摘要时不发起检索（查询为空没有意义）。
 */
export async function prefetchOutlineMaterials(
  projectId: string,
  nodes: OutlineNode[],
  search: MaterialSearchFn,
  limitPerNode: number = DEFAULT_LIMIT_PER_NODE,
): Promise<NodeMaterials[]> {
  const result: NodeMaterials[] = [];

  for (const node of nodes) {
    const query = [node.title, node.summary].filter(Boolean).join(" ");
    if (!query.trim()) {
      result.push({ nodeId: node.id, items: [] });
      continue;
    }

    try {
      const items = await search({ projectId, query, limit: limitPerNode });
      result.push({ nodeId: node.id, items });
    } catch (error) {
      Logger.warn("[OutlineMaterialPrefetch] 节点素材检索失败，已跳过", {
        nodeId: node.id,
        error: String(error),
      });
      result.push({ nodeId: node.id, items: [] });
    }
  }

  return result;
}
