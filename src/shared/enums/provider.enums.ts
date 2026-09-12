import { LOCALE } from "@/shared/enums";
import { AIProvider } from "@/shared/types";

export const PROVIDER: AIProvider[] = [
    {
        id: 'deepseek',
        name: '深度求索',
        logoPath: 'logos/deepseek.png',
        baseUrl: 'https://api.deepseek.com',
        websiteUrl: 'https://platform.deepseek.com',
        locale: LOCALE.ZH,
        models: [],
    },
    {
        id: 'volcengine',
        name: '火山引擎',
        logoPath: 'logos/volcengine.png',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        websiteUrl: 'https://www.volcengine.com/',
        locale: LOCALE.ZH,
        models: [],
    },
    {
        id: 'openai',
        name: 'OpenAI',
        logoPath: 'logos/openai.png',
        baseUrl: 'https://api.openai.com/v1',
        websiteUrl: 'https://platform.openai.com',
        locale: LOCALE.EN,
        models: [],
    },
    {
        id: 'claude',
        name: 'Anthropic Claude',
        logoPath: 'logos/claude.png',
        baseUrl: 'https://api.anthropic.com/v1',
        websiteUrl: 'https://console.anthropic.com',
        locale: LOCALE.EN,
        models: [],
    },
    {
        id: 'qwen',
        name: '通义千问',
        logoPath: 'logos/qwen.png',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        websiteUrl: 'https://dashscope.aliyun.com',
        locale: LOCALE.ZH,
        models: [],
    },
]
