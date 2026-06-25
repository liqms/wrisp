import { Logger } from "@/main/utils/logger";
import { searchBlocksTool } from "./tools/search-blocks.tool";
import type { RegisteredTool, SkillToolDefinition } from "@/shared/types/skill.types";

/**
 * 工具注册表 — 管理所有可供 Skill 调用的工具
 * 工具按权限级别（read/write）区分，在主进程执行
 */
class ToolRegistry {
  private static instance: ToolRegistry | null = null;
  private tools: Map<string, RegisteredTool> = new Map();

  private constructor() {
    this.registerBuiltInTools();
  }

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  /**
   * 注册工具
   */
  public register(tool: RegisteredTool): void {
    if (this.tools.has(tool.name)) {
      Logger.warn(`[ToolRegistry] 工具 "${tool.name}" 已存在，将被覆盖`);
    }
    this.tools.set(tool.name, tool);
    Logger.info(`[ToolRegistry] 工具已注册: ${tool.name} (${tool.permission})`);
  }

  /**
   * 获取工具定义
   */
  public get(name: string): RegisteredTool | null {
    return this.tools.get(name) || null;
  }

  /**
   * 执行工具
   */
  public async execute(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`TOOL_NOT_FOUND: ${name}`);
    }
    Logger.info(`[ToolRegistry] 执行工具: ${name}`, { args: Object.keys(args) });
    return tool.execute(args);
  }

  /**
   * 根据 Skill 的 tools 定义，过滤出已注册的工具
   */
  public resolveTools(toolDefs: SkillToolDefinition[]): RegisteredTool[] {
    if (!toolDefs || toolDefs.length === 0) return [];

    const resolved: RegisteredTool[] = [];
    for (const def of toolDefs) {
      const tool = this.tools.get(def.function.name);
      if (tool) {
        resolved.push(tool);
      } else {
        Logger.warn(`[ToolRegistry] Skill 引用未注册的工具: ${def.function.name}`);
      }
    }
    return resolved;
  }

  /**
   * 生成 LLM 兼容的 tools 数组（OpenAI 格式）
   */
  public getToolsForLLM(toolDefs: SkillToolDefinition[]): SkillToolDefinition[] {
    if (!toolDefs || toolDefs.length === 0) return [];

    const result: SkillToolDefinition[] = [];
    for (const def of toolDefs) {
      if (this.tools.has(def.function.name)) {
        result.push(def);
      }
    }
    return result;
  }

  /**
   * 获取所有已注册工具名称
   */
  public getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 获取所有已注册工具
   */
  public getAll(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 注册内置工具
   */
  private registerBuiltInTools(): void {
    this.register(searchBlocksTool);
  }
}

export const toolRegistry = ToolRegistry.getInstance();
export default ToolRegistry;