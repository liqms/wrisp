/**
 * Worker LLM 推理 handler（骨架）
 * 预留 node-llama-cpp 集成接口，当前返回"未实现"错误
 */
export async function load(_config?: { modelName?: string }): Promise<void> {
  throw new Error("本地 LLM 功能尚未实现");
}

export async function generate(_prompt: string, _options?: unknown): Promise<string> {
  throw new Error("本地 LLM 功能尚未实现");
}

export async function generateStream(
  _prompt: string,
  _options?: unknown,
): Promise<AsyncIterable<string>> {
  throw new Error("本地 LLM 功能尚未实现");
}

export async function unload(): Promise<void> {
  // 预留
}