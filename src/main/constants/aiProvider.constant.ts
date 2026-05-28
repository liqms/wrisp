import { MODEL_TYPE } from "@/shared/enums/";
import { AIProvider } from "@/shared/types/config.types";

export const DEFAULT_PROVIDER: AIProvider[] = [
    {
        id: 'deepseek',
        name: '深度求索',
        logoPath: 'logos/deepseek.png',
        baseUrl: 'https://api.deepseek.cn',
        websiteUrl: 'https://platform.deepseek.com',
        apiKey: '',
        models: [
            {
                id: 'deepseek-v4-flash',
                name: 'DeepSeek V4 Flash',
                type: MODEL_TYPE.TEXT,
                logoPath: 'logos/deepseek.png',
                contextLength: 128000,
                maxTokens: 8000,
                isInputText: true,
                isInputPic: false,
                isInputVideo: false,
                isInputAudio: false,
                isDefault: true
            },
            {
                id: 'deepseek-v4-pro',
                name: 'DeepSeek V4 Pro',
                type: MODEL_TYPE.TEXT,
                logoPath: 'logos/deepseek.png',
                contextLength: 128000,
                maxTokens: 8000,
                isInputText: true,
                isInputPic: false,
                isInputVideo: false,
                isInputAudio: false,
                isDefault: true
            },
        ],
        enabled: true,
    },
    {
        id: 'volcengine',
        name: '火山引擎',
        logoPath: 'logos/volcengine.png',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        websiteUrl: 'https://www.volcengine.com/',
        apiKey: '',
        models: [
            {
                id: 'doubao-seed-1-8-251228',
                name: 'Doubao-Seed-1.8',
                type: MODEL_TYPE.TEXT,
                logoPath: 'logos/volcengine.png',
                contextLength: 256000,
                maxTokens: 32000,
                isInputText: true,
                isInputPic: true,
                isInputVideo: true,
                isInputAudio: false,
            },
        ],
        enabled: true,
    }
]
