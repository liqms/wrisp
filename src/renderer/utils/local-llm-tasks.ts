import type { TaskType } from "@/shared/enums";

/** 切换某个任务的「走本地」勾选，返回新的任务类型列表（去重，保持既有顺序） */
export function toggleLocalLlmTask(
  current: TaskType[],
  task: TaskType,
  checked: boolean,
): TaskType[] {
  const set = new Set(current);
  if (checked) set.add(task);
  else set.delete(task);
  return Array.from(set);
}