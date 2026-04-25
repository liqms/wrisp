<template>
    <n-flex class="settings-container">
        <n-anchor>
            <n-anchor-link title="演示" href="#演示"></n-anchor-link>
        </n-anchor>
        <n-scrollbar vertical>
            <n-card title="基本设置" size="small" class="settings-card">
                <n-flex justify="flex-start" align="center" class="setting-item">
                    <n-text class="setting-label">{{ t('CONFIG.THEME') }}</n-text>
                    <n-select v-model:value="theme" :options="themeOptions" menu-size="medium" class="setting-select" />
                </n-flex>
                <n-flex justify="flex-start" align="center" class="setting-item">
                    <n-text class="setting-label">{{ t('CONFIG.LOCALE') }}</n-text>
                    <n-select v-model:value="locale" :options="localeOptions" menu-size="medium"
                        class="setting-select" />
                </n-flex>
                <n-flex justify="flex-start" align="center" class="setting-item">
                    <n-text class="setting-label">{{ t('CONFIG.AUTO_START') }}</n-text>
                    <n-switch v-model:value="autoStart" size="small" class="setting-switch" />
                </n-flex>
                <n-flex justify="flex-start" align="center" class="setting-item">
                    <n-text class="setting-label">{{ t('CONFIG.MESSAGE_NOTIFY') }}</n-text>
                    <n-switch v-model:value="messageNotify" size="small" class="setting-switch" />
                </n-flex>

                <n-divider />
            </n-card>
        </n-scrollbar>
    </n-flex>
</template>
<script setup lang="ts">
import { watch, ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { setLocale } from '../plugins/i18n'
import type { Theme, Locale } from '@/shared/enums'
import { ThemeEnum, LocaleEnum } from '@/shared/enums'
import { ChevronForwardOutline } from '@vicons/ionicons5'
import { useConfig } from '../composables/useConfig'
import { logger } from '@/renderer/utils/logger.utils'

// 使用 useI18n 获取响应式的翻译函数
const { t } = useI18n()
const router = useRouter()
const config = useConfig()

const {
    theme: configTheme,
    locale: configLocale,
    autoSave: configAutoSave,
    autoSaveInterval: configAutoSaveInterval,
    autoStart: configAutoStart,
    messageNotify: configMessageNotify,
    updateChannel: configUpdateChannel,
    defaultMiniProgramId: configDefaultMiniProgramId,
    version: configVersion,
    workspace: configWorkspace,
    updateAutoSave,
    updateTheme,
    updateDefaultMiniProgramId,
    updateAutoStart,
    updateMessageNotify

} = config
const themeOptions = computed(() => [
    {
        label: t('CONFIG.DARK'),
        value: ThemeEnum.DARK
    },
    {
        label: t('CONFIG.LIGHT'),
        value: ThemeEnum.LIGHT
    }
])
const localeOptions = computed(() => [
    {
        label: t('CONFIG.LOCALE_ZH_CN'),
        value: LocaleEnum.ZH
    },
    {
        label: t('CONFIG.LOCALE_EN_US'),
        value: LocaleEnum.EN
    }
])

// 本地状态
const theme = ref<string>(ThemeEnum.LIGHT)
const locale = ref<string>(LocaleEnum.ZH)
const autoSave = ref(true)
const autoSaveInterval = ref(10000)
const autoStart = ref(false)
const messageNotify = ref(true)
const updateChannel = ref('stable')
const defaultMiniProgramId = ref<string>('')
const version = ref('1.0.0')
const workspace = ref<string | null>('')

// 初始化本地状态
onMounted(() => {
    theme.value = configTheme.value
    locale.value = configLocale.value
    autoSave.value = configAutoSave.value
    autoSaveInterval.value = configAutoSaveInterval.value
    autoStart.value = configAutoStart.value
    messageNotify.value = configMessageNotify.value
    updateChannel.value = configUpdateChannel.value
    defaultMiniProgramId.value = configDefaultMiniProgramId.value
    version.value = configVersion.value
    workspace.value = configWorkspace.value
})
// 监听配置变化
watch(() => config, (newConfig) => {
    theme.value = newConfig.theme.value
    locale.value = newConfig.locale.value
    autoSave.value = newConfig.autoSave.value
    autoSaveInterval.value = newConfig.autoSaveInterval.value
    autoStart.value = newConfig.autoStart.value
    messageNotify.value = newConfig.messageNotify.value
    updateChannel.value = newConfig.updateChannel.value
    defaultMiniProgramId.value = newConfig.defaultMiniProgramId.value
    version.value = newConfig.version.value
    workspace.value = newConfig.workspace.value
})

// 监听本地状态变化并保存
watch(theme, (newTheme) => {
    if (newTheme !== undefined) {
        logger.debug('更新主题', { newTheme })
        updateTheme(newTheme)
        // setValue('general.theme', newTheme)
    }
})

watch(locale, async (newLocale) => {
    if (newLocale !== undefined) {
        await setLocale(newLocale)
        // 更新配置中的语言设置
        config.updateLocale(newLocale)
    }
})

watch(autoSave, (newAutoSave) => {
    if (newAutoSave !== undefined) {
        updateAutoSave(newAutoSave)
    }
})

watch(autoStart, (newAutoStart) => {
    if (newAutoStart !== undefined) {
        updateAutoStart(newAutoStart)
    }
})

watch(messageNotify, (newMessageNotify) => {
    if (newMessageNotify !== undefined) {
        updateMessageNotify(newMessageNotify)
    }
})

watch(defaultMiniProgramId, (newDefaultMiniProgramId) => {
    if (newDefaultMiniProgramId !== undefined) {
        updateDefaultMiniProgramId(newDefaultMiniProgramId)
    }
})
</script>
<style scoped lang="scss">
@use '../styles/_variables' as *;

.settings-container {
    height: 100%;
    padding: 10px;

}

.setting-item {
    margin-bottom: 10px;
}

.setting-label {
    width: 100px;
    // text-align: right;
}

.setting-select {
    width: 200px;
    margin-left: 10px;
}

.setting-switch {
    margin-left: 10px;
}
</style>
