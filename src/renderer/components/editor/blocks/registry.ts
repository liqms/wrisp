import type { Component } from "vue";
import type { Editor } from "@tiptap/core";
import { metricCardBlock } from "./definitions/metric";

/**
 * 自定义块字段 schema：声明字段类型、默认值与校验规则。
 * 弹窗表单、md 字段行编解码、HTML 桥接均由该声明驱动。
 */
export interface WrispBlockField {
  /** md 字段名（同时是节点 attr 名），写入 `key: value` 行 */
  key: string;
  type: "text" | "number" | "enum" | "boolean";
  /** i18n 键（弹窗表单 label / 校验消息） */
  labelKey: string;
  /** 默认值（空值/非法值回退） */
  default: string | number | boolean;
  /** 必填（弹窗校验） */
  required?: boolean;
  /** 最大长度（text 截断 + 输入框 maxlength） */
  maxLength?: number;
  /** 输入格式校验（仅对非空 text 生效，不通过回退默认值） */
  pattern?: RegExp;
  /** 枚举受控词表（非法值回退默认值） */
  enumValues?: Array<{ value: string; labelKey: string }>;
}

/**
 * 数据型原子块定义：字段全在 attrs、无内联内容、弹窗编辑。
 * 引擎据此生成 marked 扩展、Tiptap 节点、编辑弹窗与 slash 命令。
 */
export interface WrispBlockDefinition {
  /** 卡片节点名（Tiptap 节点 type） */
  type: string;
  /** md 围栏名：`:::${mdName}` */
  mdName: string;
  /** 字段声明（顺序即 md 序列化顺序） */
  fields: WrispBlockField[];
  /** 卡片 NodeView 组件 */
  cardView: Component;
  /** 分组容器 NodeView：提供时连续围栏自动归组，并生成 `${type}Group` 容器节点 */
  groupView?: Component;
  /** 弹窗标题 i18n 键（也作为 slash 命令标题） */
  titleKey: string;
  /** slash 命令描述 i18n 键 */
  descKey?: string;
  /** slash 命令图标 */
  slashIcon?: Component;
}

/** 弹窗编辑请求（NodeView → 弹窗宿主；宿主按 nodeType 解析块定义） */
export interface WrispBlockEditRequest {
  editor: Editor;
  /** 节点当前文档位置 */
  pos: number;
  /** 卡片节点类型名 */
  nodeType: string;
  /** 编辑前的 attrs 快照（作为表单初始值） */
  attrs: Record<string, string | number | boolean>;
}

/** 已注册的自定义块（新增块在此追加一行即可） */
const blocks: WrispBlockDefinition[] = [metricCardBlock];

export function getBlocks(): WrispBlockDefinition[] {
  return blocks;
}

/** 按节点类型名查找块定义 */
export function findBlockByType(type: string): WrispBlockDefinition | undefined {
  return blocks.find((def) => def.type === type);
}
