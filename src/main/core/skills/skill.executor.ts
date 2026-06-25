import { aiService } from '@/main/core/services/ai.service';
import { skillManager } from './skill.manager';
import { toolRegistry } from './tool.registry';
import { Logger } from '@/main/utils/logger';
import type {
  SkillDefinition,
  SkillPreProcess,
  SkillPostProcess,
  SkillExecuteResult,
  ToolCallResult,
} from '@/shared/types/skill.types';
import type { LLMRequest, LLMMessage, ToolCall } from '@/main/core/model-gateway/llm-gateway/types';
import { OUTPUT_MODEL_TYPE } from '@/shared/enums';

const DEFAULT_MAX_STEPS = 5;
const DEFAULT_L2_TIMEOUT_MS = 60_000;
const MAX_CONCURRENT_L2 = 1;

export class SkillExecutor {
  private l2Semaphore = 0;
  private l2Queue: Array<{
    skill: SkillDefinition;
    inputs: Record<string, unknown>;
    startTime: number;
    resolve: (result: SkillExecuteResult) => void;
    reject: (error: Error) => void;
  }> = [];

  /**
   * 执行 Skill（自动判断 L1/L2）
   */
  async execute(skillId: string, inputs: Record<string, unknown>): Promise<SkillExecuteResult> {
    const startTime = Date.now();
    const skill = skillManager.getSkillDefinition(skillId);
    if (!skill) {
      throw new Error(`SKILL_NOT_FOUND: ${skillId}`);
    }

    const isL2 = !!(skill.tools && skill.tools.length > 0);

    if (isL2) {
      return this.enqueueL2(skill, inputs, startTime);
    }
    return this.executeL1(skill, inputs, startTime);
  }

  // ==================== L2 并发队列 ====================

  private enqueueL2(
    skill: SkillDefinition,
    inputs: Record<string, unknown>,
    startTime: number,
  ): Promise<SkillExecuteResult> {
    if (this.l2Semaphore < MAX_CONCURRENT_L2) {
      return this.runL2(skill, inputs, startTime);
    }

    return new Promise<SkillExecuteResult>((resolve, reject) => {
      this.l2Queue.push({ skill, inputs, startTime, resolve, reject });
      Logger.info(`[SkillExecutor] L2 Skill 已排队: ${skill.id}`, {
        queueLength: this.l2Queue.length,
      });
    });
  }

  private dequeueL2(): void {
    if (this.l2Queue.length > 0 && this.l2Semaphore < MAX_CONCURRENT_L2) {
      const next = this.l2Queue.shift()!;
      this.runL2(next.skill, next.inputs, next.startTime)
        .then(next.resolve)
        .catch(next.reject);
    }
  }

  private async runL2(
    skill: SkillDefinition,
    inputs: Record<string, unknown>,
    startTime: number,
  ): Promise<SkillExecuteResult> {
    this.l2Semaphore++;
    try {
      return await this.executeL2(skill, inputs, startTime);
    } finally {
      this.l2Semaphore--;
      this.dequeueL2();
    }
  }

  // ==================== L1 执行 ====================

  private async executeL1(
    skill: SkillDefinition,
    inputs: Record<string, unknown>,
    startTime: number,
  ): Promise<SkillExecuteResult> {
    const validatedInputs = this.validateInputs(skill, inputs);
    const renderedPrompt = this.renderPrompt(skill.promptTemplate, validatedInputs);
    const preProcessed = this.applyPreProcess(renderedPrompt, skill.preProcess);

    const messages: LLMMessage[] = [];
    if (skill.systemPrompt) {
      messages.push({ role: 'system', content: skill.systemPrompt });
    }
    messages.push({ role: 'user', content: preProcessed });

    const request: LLMRequest = {
      messages,
      outputType: OUTPUT_MODEL_TYPE.TEXT,
      taskType: skill.taskType,
      temperature: skill.temperature,
    };
    const response = await aiService.chatCompletion(request);

    const content = this.applyPostProcess(response.content, skill.postProcess);
    const executionTimeMs = Date.now() - startTime;

    return {
      content,
      level: 'L1',
      steps: 1,
      modelUsed: response.model,
      tokensUsed: response.usage.totalTokens,
      executionTimeMs,
    };
  }

  // ==================== L2 执行（ReAct 循环） ====================

  private async executeL2(
    skill: SkillDefinition,
    inputs: Record<string, unknown>,
    startTime: number,
  ): Promise<SkillExecuteResult> {
    const maxSteps = skill.maxSteps || DEFAULT_MAX_STEPS;
    const validatedInputs = this.validateInputs(skill, inputs);
    const renderedPrompt = this.renderPrompt(skill.promptTemplate, validatedInputs);
    const preProcessed = this.applyPreProcess(renderedPrompt, skill.preProcess);

    // 解析工具，提前验证是否有可用的已注册工具
    const llmTools = toolRegistry.getToolsForLLM(skill.tools || []);

    if (llmTools.length === 0 && (skill.tools?.length ?? 0) > 0) {
      throw new Error(`L2_SKILL_NO_TOOLS: Skill ${skill.id} 定义了工具，但均未注册`);
    }

    const messages: LLMMessage[] = [];
    if (skill.systemPrompt) {
      messages.push({ role: 'system', content: skill.systemPrompt });
    }
    messages.push({ role: 'user', content: preProcessed });

    let totalTokens = 0;
    let modelUsed = '';

    for (let step = 0; step < maxSteps; step++) {
      const request: LLMRequest = {
        messages,
        outputType: OUTPUT_MODEL_TYPE.TEXT,
        temperature: skill.temperature,
        tools: llmTools,
      };

      const response = await this.withTimeout(
        aiService.chatCompletion(request),
        DEFAULT_L2_TIMEOUT_MS,
      );

      totalTokens += response.usage.totalTokens;
      modelUsed = response.model;

      // 如果有 tool_calls，执行工具
      if (response.toolCalls && response.toolCalls.length > 0) {
        // 添加 assistant 消息（含 tool_calls）
        messages.push({
          role: 'assistant',
          content: response.content || '',
        });

        // 执行每个工具调用
        for (const toolCall of response.toolCalls) {
          const result = await this.executeToolCall(toolCall);
          messages.push({
            role: 'user',
            content: JSON.stringify({
              tool_call_id: result.toolCallId,
              result: result.error ? `Error: ${result.error}` : result.result,
            }),
          });
        }
        continue;
      }

      // 直接输出，结束循环
      const content = this.applyPostProcess(response.content, skill.postProcess);
      const executionTimeMs = Date.now() - startTime;

      return {
        content,
        level: 'L2',
        steps: step + 1,
        modelUsed,
        tokensUsed: totalTokens,
        executionTimeMs,
      };
    }

    // 达到 maxSteps 上限，返回最后一条 assistant 消息
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
    const content = this.applyPostProcess(
      lastAssistantMsg?.content || '',
      skill.postProcess,
    );
    const executionTimeMs = Date.now() - startTime;

    return {
      content,
      level: 'L2',
      steps: maxSteps,
      modelUsed,
      tokensUsed: totalTokens,
      executionTimeMs,
    };
  }

  // ==================== 工具调用 ====================

  private async executeToolCall(toolCall: ToolCall): Promise<ToolCallResult> {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      const result = await toolRegistry.execute(toolCall.function.name, args);
      return {
        toolCallId: toolCall.id,
        name: toolCall.function.name,
        result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`[SkillExecutor] 工具调用失败: ${toolCall.function.name}`, {
        error: errorMessage,
      });
      return {
        toolCallId: toolCall.id,
        name: toolCall.function.name,
        result: '',
        error: errorMessage,
      };
    }
  }

  // ==================== Prompt 渲染 ====================

  private renderPrompt(
    template: string,
    params: Record<string, unknown>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_match: string, variable: string) => {
      const value = params[variable];
      if (value === undefined || value === null) {
        return '';
      }
      return String(value);
    });
  }

  // ==================== 预处理管道 ====================

  private applyPreProcess(
    input: string,
    preProcess?: SkillPreProcess[],
  ): string {
    if (!preProcess || preProcess.length === 0) {
      return input;
    }

    let result = input;
    for (const rule of preProcess) {
      switch (rule.type) {
        case 'trim':
          result = result.trim();
          break;
        case 'stripHtml':
          result = result.replace(/<[^>]*>/g, '');
          break;
        case 'extractSelection':
          // 从输入中提取选中文本（如果以特定格式包装）
          break;
      }
    }
    return result;
  }

  // ==================== 后处理管道 ====================

  private applyPostProcess(
    result: string,
    postProcess?: SkillPostProcess,
  ): string {
    if (!postProcess) {
      return result;
    }

    switch (postProcess.type) {
      case 'trim':
        return result.trim();
      case 'stripHtml':
        return result.replace(/<[^>]*>/g, '');
      case 'formatJson':
        try {
          const parsed = JSON.parse(result);
          return JSON.stringify(parsed, null, 2);
        } catch {
          return result;
        }
      case 'wrapMarkdown':
        return `\`\`\`\n${result}\n\`\`\``;
      default:
        return result;
    }
  }

  // ==================== 参数验证 ====================

  private validateInputs(
    skill: SkillDefinition,
    inputs: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...inputs };

    // 优先使用 input（JSON Schema 格式）
    if (skill.input) {
      for (const [key, prop] of Object.entries(skill.input.properties)) {
        if (!(key in merged) || merged[key] === undefined || merged[key] === null) {
          if (prop.default !== undefined) {
            merged[key] = prop.default;
          } else if (skill.input.required?.includes(key)) {
            throw new Error(`MISSING_REQUIRED_PARAM: ${key}`);
          }
        }
      }
      return merged;
    }

    // 兼容旧格式 parameters
    if (!skill.parameters) {
      return merged;
    }

    for (const parameter of skill.parameters) {
      if (!(parameter.name in merged) || merged[parameter.name] === undefined || merged[parameter.name] === null) {
        if (parameter.default !== undefined && parameter.default !== null) {
          merged[parameter.name] = parameter.default;
        } else {
          throw new Error(`MISSING_REQUIRED_PARAM: ${parameter.name}`);
        }
      }
    }

    return merged;
  }

  // ==================== 超时控制 ====================

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('L2_SKILL_TIMEOUT')), timeoutMs);
      }),
    ]).finally(() => {
      if (timer !== undefined) clearTimeout(timer);
    });
  }
}

export const skillExecutor = new SkillExecutor();