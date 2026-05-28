<template>
    <n-tooltip placement="top">
        <template #trigger>
            <n-button size="tiny" round :color="selected ? value : disabledColor" @click="handleClick"></n-button>
        </template>
        {{ label }}
    </n-tooltip>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { hexToRgb } from "@/shared/enums";

const props = defineProps<{
    label: string;
    value: string;
    selected?: boolean;
}>();

const emit = defineEmits(['click'] as const);

const disabledColor = computed(() => {
    return hexToRgb(props.value, 0.2);
});

const handleClick = () => {
    emit("click");
};

</script>

<style scoped lang="scss">
.color-card {
    position: relative;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    // margin: 6px;
    cursor: pointer;
    outline: none;

    .swatch {
        width: 100%;
        height: 100%;
        border-radius: 6px;
        background: var(--color);
        box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06) inset;
    }

    .check {
        position: absolute;
        right: 4px;
        top: 2px;
        background: rgba(255, 255, 255, 0.85);
        color: #222;
        font-size: 12px;
        line-height: 12px;
        padding: 2px 4px;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }

    &.selected {
        box-shadow:
            0 0 0 3px rgba(0, 0, 0, 0.06),
            0 0 0 1px rgba(0, 0, 0, 0.04) inset;
        transform: translateY(-2px);
    }
}
</style>
