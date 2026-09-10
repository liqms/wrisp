import {
  materialSearchService,
  type MaterialKind,
} from "@/main/core/services/material-search.service";
import { Logger } from "@/main/utils/logger";
import type { RegisteredTool } from "@/shared/types/skill.types";

const ALLOWED_KINDS: readonly MaterialKind[] = ["chunk", "concept", "topic"];

/**
 * search_materials 工具 — 按作品检索创作素材（语义块 / 概念 / 主题）
 * 权限级别：read
 * 约束：projectId 必填，检索严格按作品隔离。
 */
export const searchMaterialsTool: RegisteredTool = {
  name: "search_materials",
  description:
    "按作品检索创作素材：语义块、概念、主题。必须提供 projectId，检索限定在该作品内。",
  parameters: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "作品 id（必填，用于隔离）" },
      query: { type: "string", description: "搜索关键词或语义查询" },
      kinds: {
        type: "array",
        description: "检索类型，可选 chunk/concept/topic",
        items: { type: "string", enum: ["chunk", "concept", "topic"] },
        default: ["chunk"],
      },
      limit: { type: "integer", description: "返回条数上限", default: 5 },
    },
    required: ["projectId", "query"],
  },
  permission: "read",

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const projectId = String(args.projectId ?? "");
      const query = String(args.query ?? "");
      if (!projectId.trim()) {
        return JSON.stringify({
          error: "缺少必填参数 projectId（检索必须按作品隔离）",
          results: [],
        });
      }
      if (!query.trim()) {
        return JSON.stringify({ error: "查询参数 query 不能为空", results: [] });
      }

      const rawKinds = Array.isArray(args.kinds) ? args.kinds.map(String) : [];
      const kinds = rawKinds.filter((k): k is MaterialKind =>
        (ALLOWED_KINDS as readonly string[]).includes(k),
      );
      const limit = Math.min(Number(args.limit) || 5, 20);

      const results = await materialSearchService.search({
        projectId,
        query,
        kinds: kinds.length > 0 ? kinds : undefined,
        limit,
      });

      Logger.info("[search_materials] 检索完成", {
        projectId,
        query: query.substring(0, 50),
        resultCount: results.length,
      });
      return JSON.stringify({ results });
    } catch (error) {
      Logger.error("[search_materials] 执行失败", { error: String(error) });
      return JSON.stringify({ error: String(error), results: [] });
    }
  },
};
