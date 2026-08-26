<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import type { PageCatalogItem } from "@/shared/types/page.types";

withDefaults(
  defineProps<{
    items?: PageCatalogItem[];
    /** 当前定位章节在目录中的索引（-1 表示无高亮） */
    activeIndex?: number;
  }>(),
  { items: () => [], activeIndex: -1 },
);

const emit = defineEmits<{
  (e: "select", item: PageCatalogItem): void;
}>();

const { t } = useI18n();

/** 是否显示目录浮层：默认隐藏，仅显示占位横线 */
const hover = ref(false);

function handleSelect(item: PageCatalogItem) {
  emit("select", item);
}
</script>

<template>
  <div class="catalog-floating">
    <!-- 占位横线：默认唯一可见元素，悬停显示目录浮层；首尾更宽，当前章节高亮 -->
    <div class="catalog-trigger" role="button" @mouseenter="hover = true" @mouseleave="hover = false">
      <div v-for="(_, index) in items" :key="index">
        <div class="catalog-placeholder-line"
          :class="{ 'is-first': index === 0, 'is-last': index === items.length - 1, 'is-active': index === activeIndex }" />
      </div>
    </div>

    <!-- 悬浮目录浮层（Notion 风格） -->
    <Transition name="catalog-pop">
      <div v-show="hover" class="catalog-popover" @mouseenter="hover = true" @mouseleave="hover = false">
        <n-scrollbar v-if="items.length" class="catalog-body">
          <div v-for="(item, index) in items" :key="index" class="catalog-item"
            :class="[`level-${item.level}`, { 'is-active': index === activeIndex }]"
            :style="{ paddingLeft: (item.level - 1) * 14 + 8 + 'px' }" :title="item.text" @click="handleSelect(item)">
            {{ item.text }}
          </div>
        </n-scrollbar>
        <div v-else class="catalog-empty">{{ t("TIPS.PAGE.CATALOG_EMPTY") }}</div>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

/* 悬浮容器：不参与布局、不拦截编辑区事件，仅触发条与浮层可交互 */
.catalog-floating {
  position: absolute;
  top: 180px;
  right: 40px;
  z-index: $z-sticky;
  pointer-events: none;
}

/* 占位横线触发条 */
.catalog-trigger {
  position: absolute;
  /* 避开右侧原生滚动条 */
  width: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  pointer-events: auto;
  cursor: default;
  user-select: none;
  gap: 14px;


  .catalog-placeholder-line {
    width: 14px;
    height: 2px;
    border-radius: 1px;
    background: var(--text-quaternary);
    transition: background $transition-fast, box-shadow $transition-fast, width $transition-fast;

    /* 首尾横线更宽，形成视觉边框 */
    &.is-first,
    &.is-last {
      width: 22px;
    }

    /* 当前定位章节对应的横线高亮 */
    &.is-active {
      background: var(--primary-color);
      box-shadow: 0 0 4px var(--primary-color);
    }
  }

}

/* 悬浮目录浮层 */
.catalog-popover {
  position: absolute;
  top: -10px;
  right: -24px;
  width: 220px;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: $radius-md;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  pointer-events: auto;
  padding: 14px;
}

.catalog-item {
  padding: 3px 8px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  &.level-2 {
    font-weight: $font-medium;
  }

  &.level-3 {
    color: var(--text-quaternary);
  }

  /* 当前定位章节高亮 */
  &.is-active {
    color: var(--primary-color);
    font-weight: $font-medium;
    background: var(--bg-hover);
  }
}

.catalog-empty {
  padding: 16px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-quaternary);
}

/* 浮层出现 / 消失动画 */
.catalog-pop-enter-active,
.catalog-pop-leave-active {
  transition: opacity $transition-fast, transform $transition-fast;
}

.catalog-pop-enter-from,
.catalog-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
