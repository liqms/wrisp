import { AppConfig } from "../types";
import {
  THEME_MODE,
  LOCALE,
  UPDATE_CHANNEL,
  THEME_COLOR,
} from "@/shared/enums";
import { TimeUtil } from "@/shared/utils";

export const DEFAULT_APP_CONFIG: AppConfig = {
  general: {
    themeMode: THEME_MODE.DARK,
    themeColor: THEME_COLOR.GREEN,
    locale: LOCALE.ZH,
    updateChannel: UPDATE_CHANNEL.STABLE,
  },
  userInfo: {
    nickname: "用户",
    avatar: "avatar/01.png",
    token: "",
    refreshToken: "",
    registrationDate: TimeUtil.toISOString(Date.now()),
    lastLoginDate: TimeUtil.toISOString(Date.now()),
    email: "",
    bio: "",
    preferences: {
      country: "中国",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      notification: true,
    },
  },
  version: "1.0.0",
  workspace: "",
  currentProjectId: "",
  isFirstLaunch: true,
  isUpdateLaunch: false,
  updatedAt: TimeUtil.toISOString(Date.now()),
  failoverConfig: {
    maxRetries: 2,
    retryDelayMs: 1000,
    circuitBreakerThreshold: 3,
    cooldownMs: 30000,
  },
  skillsConfig: {
    remoteUpdateEnabled: true,
    remoteUpdateUrl: "",
  },
  shortcuts: [],
};
