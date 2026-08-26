<template>
    <n-flex v-if="projects.length > 0" vertical class="project-list">
        <!-- 标题行：未传 title 时不显示 -->
        <n-flex v-if="title" class="list-header">
            <n-text class="list-title">{{ title }}</n-text>
        </n-flex>

        <n-flex class="project-grid">
            <ProjectCard v-for="project in projects" :id="project.id" :key="project.id" :name="project.name"
                :type="project.type" :is-pinned="!!project.is_pinned" @click="handleClick" @settings="handleSettings"
                @pin="handlePin" />
        </n-flex>
    </n-flex>
</template>

<script setup lang="ts">
import ProjectCard from "./ProjectCard.vue";
import type { ProjectDetail } from "@/main/types/db";

defineProps<{
    title?: string;
    projects: ProjectDetail[];
}>();

const emit = defineEmits<{
    (e: "click", id: string): void;
    (e: "settings", id: string): void;
    (e: "pin", id: string): void;
}>();

const handleClick = (id: string) => emit("click", id);
const handleSettings = (id: string) => emit("settings", id);
const handlePin = (id: string) => emit("pin", id);
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.project-list {
    margin-bottom: $spacing-lg;
    gap: $spacing-md;
}

.list-header {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    padding-left: $spacing-xs;
}

.list-title {
    font-size: $font-sm;
    font-weight: $font-semibold;
    color: var(--text-primary);
}

.project-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: $spacing-md !important;
}
</style>
