// types/block.ts

export interface SemanticBlock {
  id: string;
  content: string; // Markdown 格式文本
  content_type: string; // 内容类型，例如 "insight", "to-do", "info" 等
  split_index?: number; // 分割索引，用于在分割时记录分割位置
  metadata?: Record<string, any>; // 可选的元数据字段，用于存储额外信息
  word_count: number; // 词汇数量
  created_at?: string;
  updated_at?: string;
}
