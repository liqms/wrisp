import type { Editor } from "@tiptap/core";
import type { Component } from "vue";

/** 斜杠命令的执行上下文 */
export interface SlashCommandContext {
  editor: Editor;
  /** 触发斜杠的起始位置 */
  pos: number;
}

/** 单个斜杠命令 */
export interface SlashCommand {
  id: string;
  title: string;
  description: string;
  /** 命令图标：可为 Vue 组件（@vicons 等）或 HTML 字符串 */
  icon: string | Component;
  action: (ctx: SlashCommandContext) => void;
}

/** 命令分组（用于菜单分区展示） */
export interface CommandGroup {
  id: string;
  label: string;
  items: SlashCommand[];
}
