import {
  ThemeMode,
  ThemeColor,
  Locale,
  UpdateChannel,
} from "@/shared/enums/config.enums";

export interface General {
  themeMode: ThemeMode;
  themeColor: ThemeColor;
  locale: Locale;
  updateChannel: UpdateChannel;
}

export interface UserInfo {
  nickname: string; // 用户昵称
  avatar?: string; // 头像URL
  token?: string; // 认证令牌
  refreshToken?: string; // 刷新令牌
  registrationDate: string; // 注册日期
  lastLoginDate?: string; // 最后登录日期
  email?: string; // 邮箱地址
  bio?: string; // 个人简介
  preferences: {
    // 用户偏好设置
    country?: string; // 国家或地区
    timezone: string; // 时区设置
    notification: boolean; // 通知偏好
  };
}

export interface FailoverConfig {
  maxRetries: number;
  retryDelayMs: number;
  circuitBreakerThreshold: number;
  cooldownMs: number;
}

export interface SkillsConfig {
  remoteUpdateEnabled: boolean;
  remoteUpdateUrl: string;
}

export interface KeymapItem {
  id: string;
  keys: string;
}

export interface AppConfig {
  general: General; // 通用配置
  userInfo: UserInfo; // 用户信息
  version: string; // 配置版本
  workspace: string; // 工作目录
  currentProjectId?: string; // 当前选择的项目ID
  isFirstLaunch: boolean; // 是否首次启动
  isUpdateLaunch: boolean; // 是否更新后首次启动
  updatedAt: string; // 更新时间
  failoverConfig: FailoverConfig; // 降级/熔断配置
  skillsConfig: SkillsConfig; // Skills 远程更新配置
  shortcuts?: KeymapItem[]; // 快捷键配置

}
