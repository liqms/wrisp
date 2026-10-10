/**
 * 语义块切分阈值（四层策略 L1~L4）
 *
 * L1 结构感知：零成本，按显式结构产出粗块，无阈值。
 * L2 长度约束：粗块按字符数约束，超阈值时按句子边界装箱并按比例重叠。
 * L3 语义边界：句子向量相邻余弦相似度低于阈值处视为话题低谷，按内容体裁取不同阈值。
 * L4 延迟分块：仅保留 Token 上限常量作为接口，暂未实现。
 */

/** L2 触发阈值：粗块字符数上限（唯一的长度口径） */
export const CHUNK_MAX_COARSE_CHARS = 500;
/** L2 句子重叠比例（相对块内句子数，取整后至少 1 句） */
export const CHUNK_SENTENCE_OVERLAP_RATIO = 0.15;
/** 切分结果小于该字符数时并入前一块，避免碎片块 */
export const CHUNK_MIN_CHUNK_CHARS = 80;
/** L3 单块句子数上限：超出则放弃精修，约束模型推理成本 */
export const CHUNK_MAX_REFINE_SENTENCES = 512;
/** L3 句子向量批量推理大小 */
export const CHUNK_EMBED_BATCH_SIZE = 32;
/** L3 相似度低谷阈值：日志/技术类（边界清晰，宁可不切） */
export const CHUNK_SEMANTIC_THRESHOLD_LOG = 0.75;
/** L3 相似度低谷阈值：叙事/思考类（话题渐变，允许更早切分） */
export const CHUNK_SEMANTIC_THRESHOLD_NARRATIVE = 0.55;
/** L4 延迟分块的文档编码 Token 上限（接口占位，当前未实现） */
export const CHUNK_LATE_CHUNKING_MAX_TOKENS = 8192;

/**
 * 摘要阶段判定「有正文可摘要」的最低字数（口径：剥掉 Markdown 后的正文，见 countProseWords）。
 *
 * 低于 12 字的块只剩标题、图注、一行清单之类的内容，模型要么复述原文、
 * 要么编造；这些块直接打阶段标记跳过，既省推理也免得一整轮都在空转。
 * 取值参考：一句最短的完整中文陈述约 8~15 字，12 字以下的块基本不构成论述。
 */
export const CHUNK_SUMMARY_MIN_PROSE_WORDS = 12;

