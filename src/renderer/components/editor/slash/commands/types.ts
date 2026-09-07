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
  /**
   * 当前选区下是否可用（菜单打开时求值）：
   * 返回 false 的命令从菜单中隐藏，用于禁止特定上下文插入
   * （如表格单元格内禁止再嵌套表格——GFM 无法序列化嵌套表格）
   */
  isEnabled?: (editor: Editor) => boolean;
}

/** 命令分组（用于菜单分区展示） */
export interface CommandGroup {
  id: string;
  label: string;
  items: SlashCommand[];
}
