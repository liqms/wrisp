
import type { AIProvider, ModelConfig } from "@/shared/types/model.types";

export const DEFAULT_PROVIDER: AIProvider[] = []
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
    aiProviders: DEFAULT_PROVIDER,
    defaultModels: [],
    providerPriority: [],
    enableAiMode: false,
    enableCloudAi: false,
}

export const ZH_REMOTE_HOST = 'https://hf-mirror.com'
export const EN_REMOTE_HOST = 'https://huggingface.co'





