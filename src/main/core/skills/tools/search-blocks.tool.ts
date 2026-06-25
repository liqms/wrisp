import { captureService } from "@/main/core/services/capture.service";
import { Logger } from "@/main/utils/logger";
import { SEARCH_TYPE } from "@/shared/enums";
import type { RegisteredTool } from "@/shared/types/skill.types";

/**
 * search_blocks 工具 — 语义搜索历史 Block
 * 权限级别：read
 */
export const searchBlocksTool: RegisteredTool = {
  name: "search_blocks",
  description: "通过语义搜索查找相关的历史笔记块（Block），返回匹配的 Block 内容",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "搜索关键词或语义查询",
      },
      limit: {
        type: "integer",
        description: "返回结果数量上限",
        default: 5,
      },
    },
    required: ["query"],
  },
  permission: "read",

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const query = String(args.query || "");
      const limit = Math.min(Number(args.limit) || 5, 20);

      if (!query.trim()) {
        return JSON.stringify({ error: "查询参数 query 不能为空", results: [] });
      }

      const results = await captureService.search(query, limit, SEARCH_TYPE.SEMANTIC);

      const formatted = results.map((item) => ({
        id: item.id,
        content: item.content,
      }));

      Logger.info(`[search_blocks] 搜索完成`, {
        query: query.substring(0, 50),
        resultCount: formatted.length,
      });

      return JSON.stringify({ results: formatted });
    } catch (error) {
      Logger.error("[search_blocks] 执行失败", { error: String(error) });
      return JSON.stringify({
        error: String(error),
        results: [],
      });
    }
  },
};