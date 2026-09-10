/**
 * 构造 LanceDB 的 project 过滤表达式。
 * 非法输入直接抛错，避免跨作品泄漏或注入。
 */
export function buildProjectFilter(projectId: string): string {
  if (!projectId || projectId.trim() === "") {
    throw new Error("PROJECT_ID_REQUIRED");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(projectId)) {
    throw new Error(`INVALID_PROJECT_ID: ${projectId}`);
  }
  return `project_id = '${projectId}'`;
}
