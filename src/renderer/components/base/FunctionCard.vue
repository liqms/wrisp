<template>
  <n-flex class="function-card" hoverable :bordered="false" @click="handleClick" @mouseenter="showMask = true"
    @mouseleave="showMask = false">
    <n-flex class="card-content" vertical>
      <!-- 图片区域 -->
      <n-flex class="image-wrapper" justify="center" align="center">
        <n-image :src="imageUrl" class="function-image" />
        <!-- 悬浮蒙版 -->
        <n-flex v-if="showMask" class="mask-overlay" justify="center" align="center">
          <n-text class="mask-desc">{{ description }}</n-text>
        </n-flex>
      </n-flex>
      <!-- 标题区域 -->
      <n-text class="card-title">{{ title }}</n-text>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  title: string
  description: string
  imageUrl: string
}

defineProps<Props>()

const showMask = ref(false)

const handleClick = () => {
  // 可以在这里添加点击事件处理
}
</script>

<style lang="scss" scoped>
@use '@/renderer/styles/_variables.scss' as *;

.function-card {
  cursor: pointer;
  border-radius: $radius-lg;
  overflow: hidden;
  transition: all $transition-base ease;
  // width: 100%;
  flex-shrink: 0;
  max-width: calc(180px * 16 / 9);

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
  }
}

.card-content {
  gap: $spacing-sm;
  height: 100%;
  // width: 100%;
  max-width: calc(180px * 16 / 9);
}

.image-wrapper {
  position: relative;
  // width: 100%;
  height: 180px;
  overflow: hidden;
  border-radius: $radius-md;
  flex-shrink: 0;
}

.function-image {
  // width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform $transition-base ease;
  border-radius: $radius-md;

  &:hover {
    transform: scale(1.05);
  }
}

.mask-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  animation: fadeIn 0.2s ease;
}

.mask-desc {
  color: #fff;
  font-size: $font-base;
  text-align: center;
  padding: 0 $spacing-sm;
  line-height: 1.5;
}

.card-title {
  display: block;
  font-size: $font-base;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  margin-bottom: $spacing-sm;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}
</style>