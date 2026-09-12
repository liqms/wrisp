/** 大纲节点（页面级） */
export interface OutlineNode {
  id: string;
  title: string;
  summary: string;
  status: "pending" | "confirmed" | "written";
  children?: OutlineNode[];
}

/** 大纲解析结果 */
export interface ParsedOutline {
  nodes: OutlineNode[];
}
