<template>
    <n-flex justify="space-between" align="center" class="model-item" @click="handleClick">
        <n-flex align="center" class="model-info">
            <n-text class="model-name">{{ model.name }}</n-text>
            <n-space class="input-icons" align="center">
                <n-icon v-if="model.isInputText" class="model-icon" size="16">
                    <TextIcon />
                </n-icon>
                <n-icon v-if="model.isInputPic" class="model-icon" size="16">
                    <ImageIcon />
                </n-icon>
                <n-icon v-if="model.isInputAudio" class="model-icon" size="16">
                    <AudioIcon />
                </n-icon>
                <n-icon v-if="model.isInputVideo" class="model-icon" size="16">
                    <VideoIcon />
                </n-icon>
            </n-space>
            <n-divider vertical class="model-divider" />
            <n-icon class="model-icon" size="16">
                <Component :is="outputIcon" />
            </n-icon>
        </n-flex>
    </n-flex>
</template>

<script setup lang="ts">
import { computed, h, type Component } from 'vue'
import type { Model } from '@/shared/types'
import { OUTPUT_MODEL_TYPE } from '@/shared/enums'
import type { OutputModelType } from '@/shared/enums'

const TextIcon = (): Component => h('svg', { xmlns: 'http://www.w3.org/2000/svg', width: '16', height: '16', viewBox: '0 0 16 16' }, [
    h('rect', { width: '14', height: '14', x: '1', y: '1', fill: 'none', stroke: 'currentColor', rx: '1.5' }),
    h('path', {
        fill: 'currentColor',
        d: 'M11.75 3.83h-7.5c-.21 0-.42.17-.42.42v.83c0 .21.17.42.42.42h2.92v6.25c0 .21.16.42.41.42h.84c.2 0 .41-.17.41-.42V5.5h2.92c.21 0 .42-.17.42-.42v-.83c0-.25-.17-.42-.42-.42'
    })
])

const ImageIcon = (): Component => h('svg', { xmlns: 'http://www.w3.org/2000/svg', width: '16', height: '16', viewBox: '0 0 16 16' }, [
    h('path', {
        fill: 'currentColor',
        d: 'M13.5.502H2.501c-.276 0-2 0-2 2V13.5c0 2 2 2 2 2h11c1.999 0 1.999-2 1.999-2V2.502c0-2-1.723-2-2-2m1 12.998s0 1-1 1l-3.77-3.928-2.056 1.786L4.587 9.5l-3.085 2.857V2.502c0-1 .723-1 1-1H13.5c.277 0 1 0 1 1zm-4-9.006A2.004 2.004 0 0 0 8.498 6.5c0 1.107.896 2.006 2.002 2.006A2.005 2.005 0 0 0 12.503 6.5 2.005 2.005 0 0 0 10.5 4.494'
    })
])

const AudioIcon = (): Component => h('svg', { xmlns: 'http://www.w3.org/2000/svg', width: '16', height: '16', viewBox: '0 0 16 16' }, [
    h('path', { stroke: 'currentColor', d: 'M8 4v8m3-6v4M5 6v4' }),
    h('rect', { width: '14', height: '14', x: '1', y: '1', fill: 'none', stroke: 'currentColor', rx: '1.5' })
])

const VideoIcon = (): Component => h('svg', { xmlns: 'http://www.w3.org/2000/svg', width: '16', height: '16', viewBox: '0 0 16 16', opacity: '1' }, [
    h('path', {
        fill: 'currentColor',
        d: 'M2.5 2.161a.34.34 0 0 0-.244.104.34.34 0 0 0-.102.244v11.102c0 .197.15.348.345.348h11.03a.34.34 0 0 0 .243-.104.34.34 0 0 0 .102-.244V2.509a.34.34 0 0 0-.102-.244.34.34 0 0 0-.243-.104zm0-1.157h11.029c.822 0 1.495.677 1.495 1.505v11.102c0 .828-.673 1.505-1.495 1.505H2.499a1.47 1.47 0 0 1-1.056-.442 1.5 1.5 0 0 1-.439-1.063V2.509c0-.828.673-1.505 1.495-1.505z'
    }),
    h('path', {
        fill: 'currentColor',
        d: 'M10.865 7.57a.96.96 0 0 1-.327 1.308l-3.515 2.117a.9.9 0 0 1-.467.132.84.84 0 0 1-.477-.122.85.85 0 0 1-.355-.348.9.9 0 0 1-.121-.47V5.933c0-.16.037-.33.121-.47a.9.9 0 0 1 .355-.349.9.9 0 0 1 .477-.122c.168 0 .327.047.467.132l3.515 2.126c.14.075.243.188.327.32M6.752 6.3v3.52L9.65 8.06 6.752 6.31z'
    })
])

interface Props {
    model: Model
}

const props = defineProps<Props>()

const emit = defineEmits<{
    (e: 'click'): void
}>()

const outputIcon = computed((): Component => {
    const iconMap: Record<OutputModelType, () => Component> = {
        [OUTPUT_MODEL_TYPE.TEXT]: TextIcon,
        [OUTPUT_MODEL_TYPE.IMAGE]: ImageIcon,
        [OUTPUT_MODEL_TYPE.AUDIO]: AudioIcon,
        [OUTPUT_MODEL_TYPE.VIDEO]: VideoIcon
    }
    return iconMap[props.model.outputType] || TextIcon
})

const handleClick = (): void => {
    emit('click')
}
</script>

<style lang="scss" scoped>
@use "@/renderer/styles/_variables.scss" as *;

.model-item {
    padding: $spacing-md;
    border-radius: $radius-md;
    transition: background-color 0.2s;
    border: 1px solid var(--border-color);

    &:hover {
        background-color: var(--bg-tertiary);
    }
}

.model-info {
    gap: $spacing-sm !important;
    align-items: center;
}

.model-name {
    font-size: $font-sm;
    color: var(--text-primary);
}

.input-icons {
    gap: $spacing-xs !important;
    display: inline-flex;
    align-items: center;
    height: 16px;
}

.model-icon {
    color: var(--icon-color);
    display: inline-flex;
    align-items: center;
}

.model-divider {
    height: 10px;
    margin: 0;
}
</style>
