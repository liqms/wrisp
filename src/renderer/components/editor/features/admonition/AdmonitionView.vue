<template>
  <NodeViewWrapper as="div" class="admonition-edit" data-admonition="" :data-type="currentType">
    <!-- 类型标题行（编辑态）：点击弹出下拉切换类型；阅读态（marked 渲染）仍走 CSS ::before 纯文本标题。
         mousedown/click .stop：阻断冒泡到 TiptapEditor wrapper 的 @click="focus"，
         避免编辑器抢走焦点导致下拉菜单一闪即关（同 CodeBlockView 工具栏） -->
    <div class="admonition-title" contenteditable="false" @mousedown.stop @click.stop>
      <n-dropdown placement="bottom-start" trigger="click" :options="typeOptions" @select="onSelectType"
        @update:show="menuShow = $event">
        <div class="admonition-title__trigger" :class="{ 'is-menu-open': menuShow }" title="切换提示块类型">
          <n-icon :size="16">
            <component :is="currentMeta.icon" />
          </n-icon>
          <span class="admonition-title__label">{{ currentMeta.label }}</span>
          <n-icon :size="14" class="admonition-title__chevron">
            <ExpandMoreOutlined />
          </n-icon>
        </div>
      </n-dropdown>
    </div>
    <NodeViewContent as="div" class="admonition-content" />
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { computed, h, ref } from "vue";
import type { Component } from "vue";
import { NIcon } from "naive-ui";
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from "@tiptap/vue-3";
import {
  ErrorOutlined,
  ExpandMoreOutlined,
  InfoOutlined,
  LightbulbOutlined,
  StickyNote2Outlined,
  WarningAmberOutlined,
} from "@vicons/material";
import type { AdmonitionType } from "./admonition-extension";

const props = defineProps(nodeViewProps);

/** 下拉菜单展开态：菜单 teleport 到 body 后触发器失去 hover，
 *  靠该状态保持箭头显示（同 CodeBlockView 的 .show-toolbar 思路） */
const menuShow = ref(false);

/** 类型元数据：key 与 admonition-extension 白名单一致，label 同 ::before/气泡菜单文案 */
const TYPE_META: { key: AdmonitionType; label: string; icon: Component }[] = [
  { key: "note", label: "笔记", icon: StickyNote2Outlined },
  { key: "tip", label: "提示", icon: LightbulbOutlined },
  { key: "info", label: "信息", icon: InfoOutlined },
  { key: "warning", label: "警告", icon: WarningAmberOutlined },
  { key: "danger", label: "危险", icon: ErrorOutlined },
];

/** 当前类型（非法值回退 note，同 sanitizeAdmonitionType） */
const currentType = computed<AdmonitionType>(() => {
  const type = props.node.attrs.type;
  return TYPE_META.some((m) => m.key === type) ? (type as AdmonitionType) : "note";
});

const currentMeta = computed(() => TYPE_META.find((m) => m.key === currentType.value) ?? TYPE_META[0]);

/** 下拉选项：类型图标 + 文案（n-dropdown 全局注册，icon 走 render function） */
const typeOptions = computed(() =>
  TYPE_META.map((m) => ({
    key: m.key,
    label: m.label,
    icon: () => h(NIcon, { size: 16 }, { default: () => h(m.icon) }),
  })),
);

/** 切换类型：更新 admonition 节点 type 属性（容器色调与标题随之联动） */
function onSelectType(key: string | number): void {
  const meta = TYPE_META.find((m) => m.key === key);
  if (meta) props.updateAttributes({ type: meta.key });
}
</script>
