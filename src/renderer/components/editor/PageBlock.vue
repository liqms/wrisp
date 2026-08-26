<template>
    <!-- scroll.capture：编辑器内部滚动不冒泡，在根节点捕获以驱动目录高亮 -->
    <n-flex class="page-block" @scroll.capture.passive="handleEditorScroll">
        <!-- 页面标题：可编辑，防抖自动保存 -->
        <n-flex vertical class="page-block-title-wrap">
            <input v-model="editTitle" class="page-block-title" type="text"
                :placeholder="t('EDITOR.PAGE_TITLE_PLACEHOLDER')" @keydown.enter.prevent="focusContent" />
        </n-flex>
        <!-- 页面正文：Markdown 编辑器，防抖自动保存 -->
        <TiptapEditor ref="editorRef" v-model:model-value="editContent" class="page-block-editor"
            :min-height="editorMinHeight" :max-height="editorMaxHeight" :slash-command="true" :enable-bubble-menu="true"
            @enter="saveNow" />
    </n-flex>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import TiptapEditor from "./TiptapEditor.vue";
import { usePage } from "@/renderer/composables/usePage";
import type { PageCatalogItem } from "@/shared/types/page.types";

const props = defineProps<{
    /** 页面 ID，变化时自动重新加载 */
    pageID: string;
}>();

const emit = defineEmits<{
    /** 自动保存完成 */
    (e: "saved", pageId: string): void;
    /** 内容目录更新（1-3 级标题） */
    (e: "catalog", items: PageCatalogItem[]): void;
    /** 当前定位章节在目录中的索引（-1 表示无） */
    (e: "catalog-active", index: number): void;
}>();

const { t } = useI18n();
const { getPage, updatePage } = usePage();

/** 编辑中的标题 / 内容（Markdown） */
const editTitle = ref("");
const editContent = ref("");
/** 上次已保存的标题 / 内容，用于跳过无变化的保存 */
const lastSavedTitle = ref("");
const lastSavedContent = ref("");

const editorRef = ref<InstanceType<typeof TiptapEditor> | null>(null);

/** 正文最小高度（px） */
const editorMinHeight = 200;
/** 正文最大高度（px），接近无上限，让编辑器内部自行滚动 */
const editorMaxHeight = 10000;

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
/** 标记当前变更来自外部数据同步（加载页面），不应触发保存 */
let isSyncingFromProp = false;

/** 加载页面并同步到编辑器 */
const loadPage = async (id: string) => {
    if (!id) return;
    const data = await getPage(id);
    isSyncingFromProp = true;
    const title = data?.title ?? "";
    const content = data?.content ?? "";
    editTitle.value = title;
    editContent.value = content;
    lastSavedTitle.value = title;
    lastSavedContent.value = content;
};

watch(() => props.pageID, (id) => loadPage(id), { immediate: true });

/** 立即保存标题与内容（写回 md 文件与页面表） */
const saveNow = async () => {
    const md = editorRef.value?.getMarkdown() ?? editContent.value;
    if (md == null) return;
    if (md === lastSavedContent.value && editTitle.value === lastSavedTitle.value) return;
    lastSavedTitle.value = editTitle.value;
    lastSavedContent.value = md;
    const ok = await updatePage({
        id: props.pageID,
        title: editTitle.value,
        content: md,
    });
    if (ok) {
        emit("saved", props.pageID);
    }
};

/** 标题 / 内容变化后防抖 800ms 自动保存 */
watch([editTitle, editContent], () => {
    if (isSyncingFromProp) {
        isSyncingFromProp = false;
        return;
    }
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }
    autoSaveTimer = setTimeout(() => {
        autoSaveTimer = null;
        void saveNow();
    }, 800);
});

/** 标题输入回车后聚焦正文 */
const focusContent = () => {
    editorRef.value?.focus();
};

/**
 * 目录跟随编辑器 doc 变化：
 * 初始加载的 setContent 与每次编辑都会产生新的 doc 引用，从而触发
 * getCatalog() 抛给父级（比监听 editContent 更可靠，避免加载时拿到空目录）。
 */
watch(
    () => editorRef.value?.editor?.state.doc,
    () => {
        emit("catalog", editorRef.value?.getCatalog() ?? []);
        updateActiveCatalog();
    },
);

/** 当前定位章节在目录中的索引（供目录横线/浮层高亮） */
const activeCatalogIndex = ref(-1);

/**
 * 计算当前定位的章节：最后一个顶部越过滚动容器上沿（留 90px 缓冲）的标题。
 * 标题 DOM 顺序与 getCatalog() 的文档顺序一致，索引可直接对应。
 */
const updateActiveCatalog = () => {
    const ed = editorRef.value?.editor;
    const wrap = ed?.view.dom.closest(".tiptap-editor-wrapper") as HTMLElement | null;
    if (!ed || !wrap) return;
    const headings = ed.view.dom.querySelectorAll<HTMLElement>("h1, h2, h3");
    const topLine = wrap.getBoundingClientRect().top + 90;
    let active = -1;
    headings.forEach((el, index) => {
        if (el.getBoundingClientRect().top <= topLine) active = index;
    });
    activeCatalogIndex.value = active;
};

/** 滚动节流：每帧最多计算一次 */
let scrollRaf = 0;
const handleEditorScroll = () => {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        updateActiveCatalog();
    });
};

watch(activeCatalogIndex, (index) => emit("catalog-active", index));

/** 目录点击定位：滚动并聚焦到对应标题位置 */
const scrollToCatalog = (pos: number) => {
    const ed = editorRef.value?.editor; // defineExpose 自动解包 ref，得到 Editor 实例
    if (ed) ed.commands.focus(pos);
};

defineExpose({ scrollToCatalog });

onBeforeUnmount(() => {
    // 取消未执行的滚动计算
    if (scrollRaf) {
        cancelAnimationFrame(scrollRaf);
        scrollRaf = 0;
    }
    // 有未落盘的防抖保存时立即补存，避免切换页面丢失改动
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = null;
        void saveNow();
    }
});
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.page-block {
    display: flex;
    flex-direction: column !important;
    height: 100%;
    min-height: 0;
    width: 100%;
    padding: $spacing-xl 0;
}

.page-block-title-wrap {
    flex-shrink: 0;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    height: 32px;
    padding: 0 $spacing-2xl;
}

.page-block-title {
    flex-shrink: 0;
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text-primary);
    font-size: $font-xl;
    font-weight: $font-bold;
    line-height: 32px;
    padding: $spacing-xs 0;
    margin-bottom: $spacing-sm;
    border-bottom: 1px solid transparent;
    transition: border-color $transition-base;

    &:focus {
        border-bottom-color: var(--border-color);
    }

    &::placeholder {
        color: var(--text-quaternary);
        font-weight: $font-normal;
    }
}

.page-block-editor {
    flex: 1;
    min-height: 0;
}

/* 编辑器内部由自身滚动，滚动条位于整个编辑器最右侧；正文内容居中并限制在 800px */
.page-block :deep(.page-block-editor .ProseMirror) {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 $spacing-2xl;
}
</style>
