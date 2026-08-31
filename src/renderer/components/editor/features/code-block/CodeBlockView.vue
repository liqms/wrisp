<template>
  <NodeViewWrapper class="code-block-wrap" :class="{ 'show-toolbar': menuVisible }">
    <!-- mousedown/click 必须 .stop 阻断冒泡到 TiptapEditor wrapper 的 @click="focus"，
         否则 editor.commands.focus() 会抢走 NSelect 输入框焦点并立即关闭下拉菜单（闪关） -->
    <div class="code-block-toolbar" contenteditable="false" @mousedown.stop @click.stop>
      <n-select class="code-block-lang" size="tiny" filterable :value="language" :options="languageOptions" menu-size="small"
        :consistent-menu-width="false" :fallback-option="false" :placeholder="t('EDITOR.CODE_BLOCK.SELECT_LANGUAGE')"
        @update:show="onMenuShowChange" @update:value="onLanguageChange" />
      <button class="code-block-copy" type="button" :title="t('EDITOR.CODE_BLOCK.COPY')" @click="copyCode">
        <n-icon :size="14">
          <ContentCopyOutlined />
        </n-icon>
      </button>
    </div>
    <pre><NodeViewContent as="code" :class="languageClass" /></pre>
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useMessage } from "naive-ui";
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from "@tiptap/vue-3";
import { ContentCopyOutlined } from "@vicons/material";

const props = defineProps(nodeViewProps);

const { t } = useI18n();
const message = useMessage();

/** 语言下拉展开态：菜单 teleport 到 body，鼠标移向菜单时 wrap :hover 失效，
 *  靠该状态驱动 .show-toolbar 保持工具栏可见 */
const menuVisible = ref(false);

function onMenuShowChange(show: boolean): void {
  menuVisible.value = show;
}

const language = computed<string>(() => {
  const value = props.node?.attrs?.language;
  return typeof value === "string" && value ? value : "javascript";
});

const languageClass = computed<string>(() => {
  const prefix = String(
    (props.extension?.options as Record<string, unknown> | undefined)?.languageClassPrefix ?? "language-",
  );
  return `${prefix}${language.value}`;
});

const languageOptions = computed(() => {
  const options = props.extension?.options as
    | { lowlight?: { listLanguages?: () => string[] } }
    | undefined;
  const list = options?.lowlight?.listLanguages?.() ?? [];
  return list
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ label: value, value }));
});

function onLanguageChange(value: string | null): void {
  props.updateAttributes({ language: value ?? "javascript" });
}

async function copyCode(): Promise<void> {
  const text = props.node?.textContent ?? "";
  if (!text) return;
  await writeClipboard(text);
  message.success(t("EDITOR.CODE_BLOCK.COPIED"));
}

async function writeClipboard(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // 降级
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
</script>

<style lang="scss" scoped>
.code-block-wrap {
  position: relative;

  .code-block-toolbar {
    position: absolute;
    top: 6px;
    right: 12px;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease;
  }

  &:hover .code-block-toolbar,
  &.show-toolbar .code-block-toolbar {
    opacity: 1;
    pointer-events: auto;
  }

  .code-block-lang {
    width: 100px;

    :deep(.n-base-selection) {
      border: none;
      box-shadow: none;
      background-color: transparent;
      min-height: 24px;
      height: 24px;
      border-radius: 4px;
      transition: background-color 0.15s ease;
    }

    &:hover :deep(.n-base-selection) {
      background-color: var(--bg-hover);
    }

    :deep(.n-base-selection-label),
    :deep(.n-base-selection-tags) {
      background-color: transparent;
      padding: 0 8px;
      height: 24px;
      line-height: 24px;
    }

    :deep(.n-base-selection-label__render-label span) {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
    }

    :deep(.n-base-suffix),
    :deep(.n-base-selection-placeholder),
    :deep(.n-base-clear) {
      color: var(--text-quaternary);
    }

    :deep(.n-base-selection:hover .n-base-suffix) {
      color: var(--text-secondary);
    }
  }

  .code-block-copy {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background-color: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;

    &:hover {
      background-color: var(--bg-hover);
      color: var(--text-primary);
    }
  }
}
</style>
