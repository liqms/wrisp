import { ref, computed, onUnmounted } from 'vue'
import { useConfigStore } from '@/renderer/store/config.store'
import type { userInfo } from '@/shared/types'
import { logger } from '@/renderer/utils/logger.utils'

/**
 * 用户管理组合式函数
 * 专注于用户信息管理和偏好设置，提供简洁的 API 接口
 */
export function useUser(options: { autoInit?: boolean } = {}) {
    const { autoInit = true } = options
    
    // 使用配置存储
    const configStore = useConfigStore()
    
    // 响应式状态
    const userInfo = computed(() => configStore.config?.userInfo)
    const loading = ref(false)
    const errorCode = ref('')
    const errorMessage = ref('')
    
    // 计算属性
    const isAuthenticated = computed(() => {
        return !!(userInfo.value?.token && userInfo.value?.token.length > 0)
    })
    
    const hasProfile = computed(() => {
        return !!(userInfo.value?.nickname || userInfo.value?.avatar || userInfo.value?.bio)
    })
    
    const registrationDays = computed(() => {
        if (!userInfo.value?.registrationDate) return 0
        const regDate = new Date(userInfo.value.registrationDate)
        const now = new Date()
        const diffTime = Math.abs(now.getTime() - regDate.getTime())
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    })
    
    // 用户信息操作
    const updateNickname = async (nickname: string) => {
        try {
            loading.value = true
            errorCode.value = ''
            errorMessage.value = ''
            
            await configStore.setConfigValue('userInfo.nickname', nickname)
            logger.info(`用户昵称已更新: ${nickname}`)
            
        } catch (error) {
            errorCode.value = 'USER_UPDATE_NICKNAME_FAILED'
            errorMessage.value = '更新用户昵称失败'
            logger.error('更新用户昵称失败:', {error:String(error)})
            throw error
        } finally {
            loading.value = false
        }
    }
    
    const updateAvatar = async (avatarUrl: string) => {
        try {
            loading.value = true
            errorCode.value = ''
            errorMessage.value = ''
            
            await configStore.setConfigValue('userInfo.avatar', avatarUrl)
            logger.info(`用户头像已更新: ${avatarUrl}`)
            
        } catch (error) {
            errorCode.value = 'USER_UPDATE_AVATAR_FAILED'
            errorMessage.value = '更新用户头像失败'
            logger.error('更新用户头像失败:', {error:String(error)})
            throw error
        } finally {
            loading.value = false
        }
    }
    
    const updateBio = async (bio: string) => {
        try {
            loading.value = true
            errorCode.value = ''
            errorMessage.value = ''
            
            await configStore.setConfigValue('userInfo.bio', bio)
            logger.info(`用户简介已更新: ${bio}`)
            
        } catch (error) {
            errorCode.value = 'USER_UPDATE_BIO_FAILED'
            errorMessage.value = '更新用户简介失败'
            logger.error('更新用户简介失败:', {error:String(error)})
            throw error
        } finally {
            loading.value = false
        }
    }
    
    const updateEmail = async (email: string) => {
        try {
            loading.value = true
            errorCode.value = ''
            errorMessage.value = ''
            
            await configStore.setConfigValue('userInfo.email', email)
            logger.info(`用户邮箱已更新: ${email}`)
            
        } catch (error) {
            errorCode.value = 'USER_UPDATE_EMAIL_FAILED'
            errorMessage.value = '更新用户邮箱失败'
            logger.error('更新用户邮箱失败:', {error:String(error)})
            throw error
        } finally {
            loading.value = false
        }
    }
    
    // 认证相关操作
    const setAuthToken = async (token: string, refreshToken?: string) => {
        try {
            loading.value = true
            errorCode.value = ''
            errorMessage.value = ''
            
            await configStore.setConfigValue('userInfo.token', token)
            if (refreshToken) {
                await configStore.setConfigValue('userInfo.refreshToken', refreshToken)
            }
            
            // 更新最后登录时间
            await configStore.setConfigValue('userInfo.lastLoginDate', new Date().toISOString())
            
            logger.info('用户认证令牌已设置')
            
        } catch (error) {
            errorCode.value = 'USER_SET_TOKEN_FAILED'
            errorMessage.value = '设置用户令牌失败'
            logger.error('设置用户令牌失败:', {error:String(error)})
            throw error
        } finally {
            loading.value = false
        }
    }
    
    const clearAuthToken = async () => {
        try {
            loading.value = true
            errorCode.value = ''
            errorMessage.value = ''
            
            await configStore.setConfigValue('userInfo.token', '')
            await configStore.setConfigValue('userInfo.refreshToken', '')
            
            logger.info('用户认证令牌已清除')
            
        } catch (error) {
            errorCode.value = 'USER_CLEAR_TOKEN_FAILED'
            errorMessage.value = '清除用户令牌失败'
            logger.error('清除用户令牌失败:', {error:String(error)})
            throw error
        } finally {
            loading.value = false
        }
    }
    
    // 偏好设置操作
    const updateCountry = async (country: string) => {
        try {
            loading.value = true
            errorCode.value = ''
            errorMessage.value = ''
            
            await configStore.setConfigValue('userInfo.preferences.country', country)
            logger.info(`用户国家/地区已更新: ${country}`)
            
        } catch (error) {
            errorCode.value = 'USER_UPDATE_COUNTRY_FAILED'
            errorMessage.value = '更新用户国家/地区失败'
            logger.error('更新用户国家/地区失败:', {error:String(error)})
            throw error
        } finally {
            loading.value = false
        }
    }
    
    const updateTimezone = async (timezone: string) => {
        try {
            loading.value = true
            errorCode.value = ''
            errorMessage.value = ''
            
            await configStore.setConfigValue('userInfo.preferences.timezone', timezone)
            logger.info(`用户时区已更新: ${timezone}`)
            
        } catch (error) {
            errorCode.value = 'USER_UPDATE_TIMEZONE_FAILED'
            errorMessage.value = '更新用户时区失败'
            logger.error('更新用户时区失败:', {error:String(error)})
            throw error
        } finally {
            loading.value = false
        }
    }
    
    const updateNotificationPreference = async (enabled: boolean) => {
        try {
            loading.value = true
            errorCode.value = ''
            errorMessage.value = ''
            
            await configStore.setConfigValue('userInfo.preferences.notification', enabled)
            logger.info(`用户通知偏好已更新: ${enabled}`)
            
        } catch (error) {
            errorCode.value = 'USER_UPDATE_NOTIFICATION_FAILED'
            errorMessage.value = '更新用户通知偏好失败'
            logger.error('更新用户通知偏好失败:', {error:String(error)})
            throw error
        } finally {
            loading.value = false
        }
    }
    
    // 批量更新用户信息
    const updateProfile = async (profile: Partial<userInfo>) => {
        try {
            loading.value = true
            errorCode.value = ''
            errorMessage.value = ''
            
            for (const [key, value] of Object.entries(profile)) {
                if (value !== undefined) {
                    await configStore.setConfigValue(`userInfo.${key}`, value)
                }
            }
            
            logger.info('用户信息已批量更新', profile)
            
        } catch (error) {
            errorCode.value = 'USER_UPDATE_PROFILE_FAILED'
            errorMessage.value = '更新用户信息失败'
            logger.error('更新用户信息失败:', {error:String(error)})
            throw error
        } finally {
            loading.value = false
        }
    }
    
    // 重置用户信息到默认值
    const resetProfile = async () => {
        try {
            loading.value = true
            errorCode.value = ''
            errorMessage.value = ''
            
            const defaultUserInfo = {
                nickname: '用户',
                avatar: '',
                bio: '',
                email: '',
                preferences: {
                    country: '中国',
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    notification: true
                }
            }
            
            await updateProfile(defaultUserInfo)
            logger.info('用户信息已重置为默认值')
            
        } catch (error) {
            errorCode.value = 'USER_RESET_PROFILE_FAILED'
            errorMessage.value = '重置用户信息失败'
            logger.error('重置用户信息失败:', {error:String(error)})
            throw error
        } finally {
            loading.value = false
        }
    }
    
    // 清除错误信息
    const clearError = () => {
        errorCode.value = ''
        errorMessage.value = ''
    }
    
    // 重置状态
    const reset = () => {
        loading.value = false
        clearError()
    }
    
    // 清理资源
    const cleanup = () => {
        reset()
    }
    
    // 自动初始化
    if (autoInit) {
        // 可以在这里添加初始化逻辑
    }
    
    // 组件卸载时清理
    onUnmounted(() => {
        cleanup()
    })
    
    return {
        // 状态
        userInfo,
        loading: computed(() => loading.value),
        errorCode: computed(() => errorCode.value),
        errorMessage: computed(() => errorMessage.value),
        
        // 计算属性
        isAuthenticated,
        hasProfile,
        registrationDays,
        
        // 用户信息操作
        updateNickname,
        updateAvatar,
        updateBio,
        updateEmail,
        
        // 认证操作
        setAuthToken,
        clearAuthToken,
        
        // 偏好设置操作
        updateCountry,
        updateTimezone,
        updateNotificationPreference,
        
        // 批量操作
        updateProfile,
        resetProfile,
        
        // 工具方法
        clearError,
        reset,
        cleanup
    }
}

export type UseUserReturn = ReturnType<typeof useUser>