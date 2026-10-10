/**
 * 从上一轮执行记录里还原各任务的数据量，作为本轮进度条的权重预估。
 *
 * 加权进度需要「尚未开始的步骤」也有权重，否则进度条只能等任务真正跑起来才动。
 * 本轮实际条数在执行前无从得知，于是取上一轮 `tasks_summary` 里的
 * `processedCount + failedCount`（即上一轮实际尝试过的条数）。
 */
export function parseEstimatedAmounts(
  tasksSummary: string | null | undefined,
): Record<string, number> {
  if (!tasksSummary) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(tasksSummary);
  } catch {
    return {};
  }
  if (!Array.isArray(parsed)) return {};

  const toCount = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

  const estimates: Record<string, number> = {};
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const { name, processedCount, failedCount } = item as Record<string, unknown>;
    if (typeof name !== "string") continue;
    const amount = toCount(processedCount) + toCount(failedCount);
    if (amount > 0) estimates[name] = amount;
  }
  return estimates;
}
