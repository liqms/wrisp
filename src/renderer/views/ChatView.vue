<template>
    <n-flex class="chat-view">
        <!-- 等待系统信息加载完成后再渲染 WebView -->
        <WebView 
            v-if="isSystemReady"
            ref="webviewRef" 
            :url="currentUrl" 
            :autoLoad="autoLoad" 
            :showToolbar="true" 
            :x="webviewBounds.x"
            :y="webviewBounds.y" 
            :width="webviewBounds.width" 
            :height="webviewBounds.height" 
        />
        <n-flex v-else class="loading-container">
            <n-spin size="medium">
                <template #description>
                    {{ $t('TIPS.LOADING_SYSTEM_INFO') }}
                </template>
            </n-spin>
        </n-flex>
    </n-flex>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import WebView from '@/renderer/components/WebView.vue'
import { useConfig, useSystem } from '@/renderer/composables'
import type { miniProgram } from '@/shared/types'
import { logger } from '@/renderer/utils/logger.utils'

const { systemInfo, init } = useSystem()

// 系统信息是否准备就绪
const isSystemReady = ref(false)

const webviewBounds = ref({
    x: 0,
    y: 0,
    width: 800,
    height: 720,
})


// 响应式数据
const selectedMiniProgramId = ref<string>('')
const autoLoad = ref(true)

// 使用配置组合函数
const config = useConfig({ autoInit: true })

// 计算属性
const miniPrograms = computed(() => config.miniPrograms.value || [])
const defaultMiniProgramId = computed(() => config.defaultMiniProgramId.value)

const currentMiniProgram = computed(() => {
    if (!selectedMiniProgramId.value) return miniPrograms.value.find((mp: miniProgram) => mp.id === defaultMiniProgramId.value)
    return miniPrograms.value.find((mp: miniProgram) => mp.id === selectedMiniProgramId.value)
})

const currentUrl = computed(() => {
    if (!currentMiniProgram.value) return ''
    logger.debug('当前小程序 URL', { currentMiniProgram: currentMiniProgram.value.url })
    return currentMiniProgram.value.url || ''
})


// 监听配置变化
watch(
    () => config.loading.value,
    (newLoading, oldLoading) => {
        if (oldLoading && !newLoading && config.config.value) {
            // 配置加载完成，设置默认小程序
            if (defaultMiniProgramId.value) {
                selectedMiniProgramId.value = defaultMiniProgramId.value
            } else if (miniPrograms.value.length > 0) {
                selectedMiniProgramId.value = miniPrograms.value[0].id
            }
        }
    }
)

// 监听系统信息变化，更新 webviewBounds
watch(
    () => systemInfo.value,
    (newSystemInfo) => {
        if (newSystemInfo?.viewSize) {
            webviewBounds.value = {
                x: 0,
                y: 0,
                width: newSystemInfo.viewSize[0] || 800,
                height: newSystemInfo.viewSize[1] || 720,
            }
            logger.debug('系统信息更新，WebView 尺寸已调整', { x: webviewBounds.value.x, y: webviewBounds.value.y, width: webviewBounds.value.width, height: webviewBounds.value.height })
            // 标记系统信息已准备就绪
            isSystemReady.value = true
        }
    },
    { deep: true }
)

// 生命周期
onMounted(async () => {
    try {
        await init()
    } catch (error) {
        logger.error('系统信息初始化失败', { error: String(error) })
    }
})

</script>

<style scoped>
.chat-view {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: #f5f5f5;
}

.loading-container {
    flex: 1;
    justify-content: center;
    align-items: center;
}
</style>