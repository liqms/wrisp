import { OUTPUT_MODEL_TYPE, LOCALE } from "@/shared/enums";
import { AIProvider } from "@/shared/types";

export const PROVIDER: AIProvider[] = [
    {
        id: 'deepseek',
        name: '深度求索',
        logoPath: 'logos/deepseek.png',
        baseUrl: 'https://api.deepseek.cn',
        websiteUrl: 'https://platform.deepseek.com',
        locale: LOCALE.ZH,
        models: [
            {
                id: 'deepseek-v4-flash',
                name: 'DeepSeek V4 Flash',
                outputType: OUTPUT_MODEL_TYPE.TEXT,
                contextLength: 1000000,
                maxTokens: 1000000,
                isInputText: true,
                isInputPic: false,
                isInputVideo: false,
                isInputAudio: false,
            },
            {
                id: 'deepseek-v4-pro',
                name: 'DeepSeek V4 Pro',
                outputType: OUTPUT_MODEL_TYPE.TEXT,
                contextLength: 1000000,
                maxTokens: 1000000,
                isInputText: true,
                isInputPic: false,
                isInputVideo: false,
                isInputAudio: false,
            },
        ],
    },
    {
        id: 'volcengine',
        name: '火山引擎',
        logoPath: 'logos/volcengine.png',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        websiteUrl: 'https://www.volcengine.com/',
        locale: LOCALE.ZH,
        models: [
            {
                id: 'doubao-seed-2-0-lite-260215',
                name: 'Doubao Seed 2.0 Lite',
                outputType: OUTPUT_MODEL_TYPE.TEXT,
                contextLength: 256000,
                maxTokens: 2560000,
                isInputText: true,
                isInputPic: true,
                isInputVideo: true,
                isInputAudio: true,
            },
            {
                id: 'doubao-seed-2-0-pro-260215',
                name: 'Doubao Seed 2.0 Pro',
                outputType: OUTPUT_MODEL_TYPE.TEXT,
                contextLength: 256000,
                maxTokens: 2560000,
                isInputText: true,
                isInputPic: true,
                isInputVideo: true,
                isInputAudio: true,
            },
        ],
    }
]
