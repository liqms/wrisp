import { aiService } from '@/main/core/services/ai.service';
import { skillManager } from './skill.manager';
import { Logger } from '@/main/utils/logger';
import type { SkillDefinition, SkillPostProcess } from '@/shared/types/skill.types';
import type { LLMRequest, LLMMessage } from '@/main/core/model-gateway/llm-gateway/types';
import { OUTPUT_MODEL_TYPE } from '@/shared/enums';

export class SkillExecutor {
  async execute(skillId: string, inputs: Record<string, unknown>): Promise<string> {
    try {
      const skill = skillManager.getSkillDefinition(skillId);
      if (!skill) {
        throw new Error(`SKILL_NOT_FOUND: ${skillId}`);
      }

      const validatedInputs = this.validateInputs(skill, inputs);
      const renderedPrompt = this.renderPrompt(skill.promptTemplate, validatedInputs);

      const messages: LLMMessage[] = [];

      if (skill.systemPrompt) {
        messages.push({ role: 'system', content: skill.systemPrompt });
      }

      messages.push({ role: 'user', content: renderedPrompt });

      const request: LLMRequest = { messages, outputType: OUTPUT_MODEL_TYPE.TEXT, taskType: skill.taskType };
      const response = await aiService.chatCompletion(request);

      return this.postProcess(response.content, skill.postProcess);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error(`Skill execution failed: ${skillId}`, { error: errorMessage });
      throw error;
    }
  }

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

  private postProcess(result: string, postProcess?: SkillPostProcess): string {
    if (!postProcess) {
      return result;
    }

    switch (postProcess.type) {
      case 'trim':
        return result.trim();
      default:
        return result;
    }
  }

  private validateInputs(
    skill: SkillDefinition,
    inputs: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...inputs };

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
}

export const skillExecutor = new SkillExecutor();