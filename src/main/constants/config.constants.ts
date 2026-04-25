import { AppConfig } from "../types";
import { ThemeEnum, LocaleEnum, UpdateChannelEnum } from "@/shared/enums";

export const DEFAULT_APP_CONFIG: AppConfig = {
    general: {
        theme: ThemeEnum.DARK,
        locale: LocaleEnum.ZH,
        autoSave: true,
        autoSaveInterval: 10,
        updateChannel: UpdateChannelEnum.STABLE,
        autoStart: true,
        messageNotify: true,
    },
    miniPrograms: [
        {
            id: 'deepseek',
            name: 'DeepSeek',
            url: 'https://chat.deepseek.com/',
            icon: 'https://chat.deepseek.com/favicon.ico',
            area: 'china',
            isHidden: false,
        },
        {
            id: 'doubao',
            name: 'Doubao',
            url: 'https://www.doubao.com/chat/',
            icon: 'https:////lf-flow-web-cdn.doubao.com/obj/flow-doubao/doubao/chat/favicon.png',
            area: 'china',
            isHidden: false
        }
    ],
    defaultMiniProgramId: 'deepseek',
    userInfo: {
        nickname: '用户',
        avatar: 'avatar/01.png',
        token: '',
        refreshToken: '',
        registrationDate: new Date().toISOString(),
        lastLoginDate: new Date().toISOString(),
        email: '',
        bio: '',
        preferences: {
            country: '中国',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            notification: true
        }
    },
    version: '0.0.0',
    workspace: '',
    updatedAt: '',
}