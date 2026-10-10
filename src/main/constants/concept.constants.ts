/**
 * 概念抽取的提示词与阈值常量。
 *
 * 集中放在这里而不是散进 executor，是为了让「抽取质量」相关的可调项
 * 与 prompt 契约保持同源：改措辞时不必读执行器代码。
 */

/** 抽取指令（契约：只输出 JSON 数组，无解释、无代码栅栏） */
export const CONCEPT_EXTRACT_SYSTEM_PROMPT = [
  "你是严格的知识库概念抽取器。只输出 JSON 数组，不要任何解释文字、不要代码栅栏。",
  '每个概念对象形如 {"title":"...","aliases":["..."],"evidence":"不超过30字的原文片段","confidence":0.0}',
  "约束：",
  "1) 最多 5 个概念；每个 title 为 2–6 字的名词短语；",
  "2) 只抽取本文实际讨论的对象/方法/现象，不抽取主题词以外的泛化词（如「问题」「方法」「内容」「东西」）；",
  "3) 若「已有概念」中存在语义等价项，必须复用其写法，不得另造同义词；",
  "4) 无法确定时宁可不输出；confidence 表示把握度。",
].join("\n");

/** user 消息模板：{candidates} 为已有概念列表，{input} 为原文窗口构造的输入 */
export const CONCEPT_EXTRACT_USER_TEMPLATE =
  "已有概念（优先复用）：{candidates}\n文本：\n{input}";

/** 单块最多抽取的概念数（与 system 约束 1 一致，超出部分丢弃） */
export const CONCEPT_MAX_PER_BLOCK = 5;

/** 低于此把握度的概念直接判为非法输出（整块失败，见设计 D8） */
export const CONCEPT_MIN_CONFIDENCE = 0.5;

/** title 归一化后的长度区间（过短无信息量，过长已成句子） */
export const CONCEPT_TITLE_MIN_CHARS = 2;
export const CONCEPT_TITLE_MAX_CHARS = 24;

/** evidence 保留的最大字数 */
export const CONCEPT_EVIDENCE_MAX_CHARS = 30;

/**
 * 泛化词表：模型仍可能输出的「主题词以外」的空概念。
 * 命中即丢弃（不算解析失败——格式合法，只是没有信息量）。
 * 比对的是 normalizeConceptTitle 之后的形式，故此处只写归一形态。
 */
export const CONCEPT_GENERALITY_STOPWORDS = [
  "问题",
  "方法",
  "内容",
  "东西",
  "情况",
  "特点",
  "优势",
  "不足",
  "总结",
  "介绍",
  "分析",
  "研究",
  "应用",
  "发展",
  "影响",
  "意义",
  "背景",
  "结论",
  "观点",
  "建议",
  "步骤",
  "要素",
];

/** 单轮 prompt 字符预算（本地模型 contextSize 4096，留出输出与模板余量） */
export const CONCEPT_PROMPT_BUDGET_CHARS = 2000;

/** 注入 prompt 的候选概念条数上限 */
export const CONCEPT_CANDIDATES_PER_BLOCK = 8;

/** 首轮（无向量召回可用时）从库中取多少条历史概念标题作为候选池 */
export const CONCEPT_CANDIDATE_POOL = 50;

/** 采样参数：抽取要求稳定复现，低温 */
export const CONCEPT_TEMPERATURE = 0.2;

/** 输出 token 上限（≤5 个概念的 JSON 数组，800 已宽裕） */
export const CONCEPT_MAX_OUTPUT_TOKENS = 800;
