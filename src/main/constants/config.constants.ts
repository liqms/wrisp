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
        }
    ],
    version: '0.0.0',
    workspace: '',
    updatedAt: '',
}