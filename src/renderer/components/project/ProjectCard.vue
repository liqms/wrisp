<template>
    <n-flex class="project-card" @click="handleCardClick">
        <!-- background -->
        <n-image class="card-cover" :src="coverImagePath" :alt="name" object-fit="cover" />

        <n-flex class="card-inner">
            <n-flex class="type-tag" align="center" justify="center" :style="{ backgroundColor: tagsColor }">
                <n-text class="type-text">{{ typeLabel }}</n-text>
            </n-flex>

            <n-flex class="pin-badge" align="center" justify="center">
                <n-button text :style="{ color: 'rgb(255, 255, 255, 0.9)' }" @click.stop="handlePin">
                    <n-icon size="16">
                        <PinOffOutlined v-if="isPinned" />
                        <PushPinOutlined v-else />
                    </n-icon>
                </n-button>
            </n-flex>

            <n-flex class="card-content">
                <n-text class="card-title">{{ name }}</n-text>
            </n-flex>

            <n-flex class="hover-overlay">
                <n-space class="action-bar" @click.stop="handleSettings">
                    <n-flex align="center" justify="center" :style="{ color: 'rgb(255, 255, 255, 0.9)' }">
                        <n-icon size="14">
                            <SettingsOutlined />
                        </n-icon>
                    </n-flex>
                    <n-flex class="btn-text">{{ t('TIPS.PROJECT.PROJECT_SETTINGS') }}</n-flex>
                </n-space>
            </n-flex>
        </n-flex>
    </n-flex>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NButton, NIcon, NSpace, NFlex } from "naive-ui";
import { SettingsOutlined, PushPinOutlined, PinOffOutlined } from "@vicons/material";
import { useI18n } from "vue-i18n";
import { ProjectType } from "@/shared/enums/project.enums";
import { useThemeVars } from "naive-ui";
import { joinPath } from '@/renderer/utils/string.utils'

const { t } = useI18n();

const props = withDefaults(
    defineProps<{
        id: string;
        name: string;
        type: ProjectType;
        coverImage?: string;
        isPinned?: boolean;
    }>(),
    {
        coverImage: "",
        isPinned: false,
    },
);

import { hexToRgb } from "@/shared/enums/themeColor.enums";

const themeVars = useThemeVars();
const tagsColor = computed(() => hexToRgb(themeVars.value.primaryColor, 0.5));

const emit = defineEmits<{
    (e: "click", id: string): void;
    (e: "settings", id: string): void;
    (e: "pin", id: string): void;
}>();

const defaultCoverImage = "images/project_cover_default.png";
const coverImagePath = computed((): string => {
    return props.coverImage ? joinPath('app://', props.coverImage) : joinPath('app://', defaultCoverImage)
})

const typeLabel = computed(() =>
    t(`APP.PROJECT_TYPE.${props.type.toUpperCase()}`),
);


const handleCardClick = () => {
    emit("click", props.id);
};

const handleSettings = (e: Event) => {
    e.stopPropagation();
    emit("settings", props.id);
};

const handlePin = (e: Event) => {
    e.stopPropagation();
    emit("pin", props.id);
};
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.project-card {
    display: flex;
    position: relative;
    align-items: stretch;
    transition: all $transition-base ease;
    width: 140px;
    height: 196px;
    border-radius: $radius-md;
    border: 1px solid var(--bg-secondary);
    padding: 0;
    overflow: hidden;
    cursor: pointer;

    :deep(.n-space-item) {
        width: 100%;
        height: 100%;
    }

    &:hover {
        transform: translateY(-2px);
        border-color: var(--primary-color);
        box-shadow: 0 0 0 1px var(--primary-color);

        .hover-overlay {
            opacity: 1;
        }

        .pin-badge {
            opacity: 1;
        }
    }

}

.card-inner {
    position: relative;
    width: 100%;
    height: 100%;
}

.card-cover {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: $radius-md;

    :deep(img) {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
}

.type-tag {
    position: absolute;
    top: 0px;
    left: 0px;
    z-index: 2;
    padding: 2px 16px;
    border-radius: $radius-md 0 $radius-md;
    backdrop-filter: blur(4px);
    width: fit-content;
}

.type-text {
    color: rgb(255, 255, 255, 0.8);
    font-size: $font-xs;
}

.pin-badge {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 2;
    transition: opacity $transition-fast ease;
    opacity: 0;
}

.card-content {
    position: absolute;
    inset: 0;
    padding: 50px 20px;
    z-index: 1;
}

.card-title {
    font-size: $font-sm;
    font-weight: $font-semibold;
    color: rgb(255, 255, 255, 0.9);
    line-height: 1.2;
    word-break: break-word;
}

.hover-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 3;
    opacity: 0;
    transition: opacity $transition-base ease;
}

.action-bar {
    background: rgba(20, 40, 40, 0.9);
    backdrop-filter: blur(8px);
    padding: $spacing-xs 0;
    width: 100%;
    align-items: center;
    justify-content: center !important;
    border-radius: 0 0 $radius-md $radius-md;
    gap: 8px 4px !important;
    cursor: pointer;
}

.btn-text {
    color: rgb(255, 255, 255, 0.9);
    font-size: $font-xs;
}
</style>
