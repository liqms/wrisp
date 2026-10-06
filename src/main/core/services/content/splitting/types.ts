/** 产出该语义块的切分层级：structure=L1，length=L2，semantic=L3 */
export type ChunkLayer = "structure" | "length" | "semantic";

/** 单个语义块（切分结果，尚未落库） */
export interface SplitChunk {
  /** 块正文（保留原始 Markdown 文本） */
  content: string;
  /** 起始行号（1-based，闭区间） */
  startLine: number;
  /** 结束行号（1-based，闭区间） */
  endLine: number;
  /** 所属小节标题（Markdown 标题文本，无标题时为 null） */
  sectionTitle: string | null;
  /** 正文 SHA256，用于判断块内容是否变化 */
  contentHash: string;
  /** 字数（CJK 按字、其余按空白分词） */
  wordCount: number;
  /** 产出该块的切分层级（仅用于日志与调参，不落库） */
  layer: ChunkLayer;
}

/** 粗块类型：普通文本 / ::: 自定义块围栏 */
export type CoarseBlockKind = "text" | "fence";

/** L1 输出的粗块：一个显式结构单元 */
export interface CoarseBlock {
  kind: CoarseBlockKind;
  /** `:::blockType` 的块类型名；kind 为 fence 时有值 */
  blockType: string | null;
  sectionTitle: string | null;
  /** 1-based */
  startLine: number;
  /** 1-based */
  endLine: number;
  /** 块内逐行原文（绝对行号由 startLine 锚定） */
  lines: string[];
}

/** 需要 L3 语义精修的粗块 */
export interface RefineTarget {
  block: CoarseBlock;
  /** L2 的长度约束结果；L3 不可用或未发现语义低谷时保留它 */
  fallback: SplitChunk[];
}

/**
 * 切分结果按文档顺序分成若干段：
 * 每段要么是结构稳定的块（无 target），要么是一个待精修粗块 + 它的 L2 结果。
 * L3 精修只替换自己那段，不影响其它段，也不改变文档顺序。
 */
export interface SplitSegment {
  chunks: SplitChunk[];
  target: RefineTarget | null;
}

export interface SplitResult {
  segments: SplitSegment[];
  /** coarse=L1 粗块数，refined=其中需要 L3 精修的数量（日志与调参用） */
  stats: { coarse: number; refined: number };
}

/** 句子（L2/L3 的最小切分单位，携带绝对行号区间） */
export interface Sentence {
  text: string;
  /** 1-based */
  startLine: number;
  /** 1-based */
  endLine: number;
}

/**
 * L3 依赖的句子向量提供函数。
 * 注入而非直接调用 localGateway：切分算法可在无模型环境下测试，
 * L4 延迟分块实现时也可替换为 token 级向量来源。
 */
export type SentenceEmbedder = (texts: string[]) => Promise<number[][]>;
