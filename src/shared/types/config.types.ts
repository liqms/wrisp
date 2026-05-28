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

export interface MiniProgram {
  id: string;
  name: string;
  url: string;
  icon: string;
  area: string;
  isHidden: boolean;
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

export interface AIProvider {
  id: string;
  name: string;
  models: Model[];
  apiKey: string;
  logoPath: string;
  baseUrl: string;
  websiteUrl?: string;
  enabled: boolean;
}

export interface Model {
  id: string;
  name: string;
  type: string;
  logoPath: string;
  contextLength: number;
  maxTokens: number;
  isInputText: boolean;
  isInputPic: boolean;
  isInputAudio: boolean;
  isInputVideo: boolean;
  isDefault?: boolean;
}
export interface DefaultModel {
  type: string;
  providerId: string;
  modelId: string;
}

export interface AppConfig {
  general: General; // 通用配置
  miniPrograms: MiniProgram[]; // 小程序列表
  defaultMiniProgramId?: string; // 默认小程序ID
  userInfo: UserInfo; // 用户信息
  aiProviders: AIProvider[]; // AI提供方列表
  defaultModels: DefaultModel[]; // 默认模型列表
  version: string; // 配置版本
  workspace: string; // 工作目录
  currentProjectId?: string; // 当前选择的项目ID
  isFirstLaunch: boolean; // 是否首次启动
  isUpdateLaunch: boolean; // 是否更新后首次启动
  updatedAt: string; // 更新时间
}
