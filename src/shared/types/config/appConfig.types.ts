export interface general {
    theme: string
    locale: string
    autoSave: boolean
    autoSaveInterval: number
    updateChannel: string
    autoStart: boolean
    messageNotify: boolean        
}

export interface miniProgram {
    id: string
    name: string
    url: string
    icon?: string
    area: string
    isHidden: boolean
}

export interface userInfo {
    nickname: string                    // 用户昵称
    avatar?: string                     // 头像URL
    token?: string                      // 认证令牌
    refreshToken?: string               // 刷新令牌
    registrationDate: string           // 注册日期
    lastLoginDate?: string              // 最后登录日期
    email?: string                      // 邮箱地址
    bio?: string                        // 个人简介
    preferences: {                      // 用户偏好设置
        country?: string                // 国家或地区
        timezone: string                // 时区设置
        notification: boolean           // 通知偏好
    }
}

export interface AppConfig {
    general: general                    // 通用配置
    miniPrograms: miniProgram[]        // 小程序列表
    defaultMiniProgramId?: string      // 默认小程序ID
    userInfo: userInfo                 // 用户信息
    version: string                    // 配置版本
    workspace: string                  // 工作目录
    updatedAt: string                  // 更新时间
}
