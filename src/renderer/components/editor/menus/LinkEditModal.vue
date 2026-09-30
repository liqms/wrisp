<template>
  <Teleport to="body">
    <div v-if="visible" ref="popRef" class="link-popover" :style="posStyle">
      <div class="link-popover__row">
        <n-icon size="16" class="link-popover__icon">
          <LinkOutlined />
        </n-icon>
        <input ref="inputRef" v-model="url" class="link-input" type="text" spellcheck="false"
          :placeholder="t('EDITOR.LINK_EDIT_PLACEHOLDER')" @keydown.enter.prevent="confirm"
          @keydown.esc.prevent="cancel" />
        <button class="link-btn" :title="t('EDITOR.LINK_EDIT_SAVE')" @click="confirm">
          <n-icon size="14">
            <CheckOutlined />
          </n-icon>
        </button>
        <button class="link-btn" :title="t('EDITOR.LINK_EDIT_CANCEL')" @click="cancel">
          <n-icon size="14">
            <CloseOutlined />
          </n-icon>
        </button>
      </div>
      <div v-if="hasHref" class="link-popover__actions">
        <button class="link-action" @click="openExternal">
          {{ t('EDITOR.LINK_EDIT_OPEN') }}
        </button>
        <button class="link-action link-action--danger" @click="remove">
          {{ t('EDITOR.LINK_EDIT_REMOVE') }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { NIcon } from "naive-ui";
import { LinkOutlined, CheckOutlined, CloseOutlined } from "@vicons/material";

const props = defineProps<{
  visible: boolean;
  href: string;
  /** 锚点元素：popover 显示在其下方居中；为空时显示在视口顶部居中 */
  anchorEl?: HTMLElement | null;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
  /** 保存链接（空值表示移除链接） */
  save: [href: string];
  /** 移除链接 */
  remove: [];
  /** 在系统浏览器打开 */
  open: [];
}>();

const { t } = useI18n();
const url = ref(props.href);
const popRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);

const posStyle = ref({ left: "0px", top: "0px" });
const hasHref = computed(() => !!url.value);

let cleanup: (() => void) | null = null;

watch(() => props.visible, (v) => {
  if (v) {
    url.value = props.href;
    void nextTick(() => {
      updatePosition();
      inputRef.value?.focus();
      inputRef.value?.select();
      // 监听滚动/尺寸变化与外部点击，保持定位并支持点外关闭
      const onMove = () => updatePosition();
      const onDocDown = (e: MouseEvent) => {
        const target = e.target as Node | null;
        if (popRef.value && !popRef.value.contains(target)) {
          emit("update:visible", false);
        }
      };
      window.addEventListener("resize", onMove);
      window.addEventListener("scroll", onMove, true);
      document.addEventListener("mousedown", onDocDown, true);
      cleanup = () => {
        window.removeEventListener("resize", onMove);
        window.removeEventListener("scroll", onMove, true);
        document.removeEventListener("mousedown", onDocDown, true);
      };
    });
  } else {
    cleanup?.();
    cleanup = null;
  }
});

onBeforeUnmount(() => cleanup?.());

/** 定位：锚点元素下方居中；无锚点时视口顶部居中 */
function updatePosition() {
  const el = popRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (props.anchorEl) {
    const anchorRect = props.anchorEl.getBoundingClientRect();
    const left = anchorRect.left + anchorRect.width / 2 - rect.width / 2;
    const top = anchorRect.bottom + 6;
    posStyle.value = {
      left: `${Math.max(8, left)}px`,
      top: `${top}px`,
    };
  } else {
    posStyle.value = {
      left: "50%",
      top: "80px",
    };
    // 无锚点时改为实际居中，需重新读取尺寸
    const next = el.getBoundingClientRect();
    posStyle.value = {
      left: `${window.innerWidth / 2 - next.width / 2}px`,
      top: `${Math.max(80, next.top)}px`,
    };
  }
}

function confirm() {
  emit("save", url.value.trim());
}

function remove() {
  emit("remove");
}

function cancel() {
  emit("update:visible", false);
}

function openExternal() {
  emit("open");
}
</script>

<style scoped>
/* 与 BubbleMenu 内联 link popover 一致的视觉 */
.link-popover {
  position: fixed;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 6px;
  background: #2b2b2b;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}

.link-popover__row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.link-popover__icon {
  color: #888;
  flex-shrink: 0;
}

.link-input {
  width: 220px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid #444;
  border-radius: 4px;
  background: #1e1e1e;
  color: #e0e0e0;
  font-size: 12px;
  outline: none;

  &::placeholder {
    color: #777;
  }

  &:focus {
    border-color: #5a8ee8;
  }
}

.link-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #bbb;
  cursor: pointer;
  transition: background 100ms ease, color 100ms ease;

  &:hover {
    background: #3c3c3c;
    color: #fff;
  }
}

.link-popover__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 2px 2px;
}

.link-action {
  border: none;
  background: transparent;
  color: #888;
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;

  &:hover {
    color: #e0e0e0;
    background: #3c3c3c;
  }

  &--danger:hover {
    color: #ff7875;
  }
}
</style>
