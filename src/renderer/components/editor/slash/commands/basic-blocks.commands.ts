import type { Editor } from "@tiptap/core";
import type { CommandGroup, SlashCommand } from "./types";
import {
  SubjectOutlined,
  FormatListNumberedOutlined,
  FormatListBulletedOutlined,
  ChecklistOutlined,
  CodeOutlined,
  FormatQuoteOutlined,
  TableChartOutlined,
  HorizontalRuleOutlined,
  ImageOutlined,
  FunctionsOutlined,
  CampaignOutlined,
} from "@vicons/material";
import { deleteSlashText } from "./helpers";
import { showInlineMathInput } from "../../features/math/mathematics-extension";
import { handleApiError } from "@/renderer/utils/error.utils";

/** 删除斜杠文本并聚焦（所有块级命令的前置步骤） */
function run(editor: Editor, pos: number, chain: (ed: Editor) => void): void {
  deleteSlashText(editor, pos);
  chain(editor);
}

/**
 * 表格上下文守卫：GFM 单元格是单行语义，无法承载多行/围栏块语法，
 * 在单元格内插入这类块保存时会破坏表格结构或退化为字面前缀——菜单层隐藏。
 */
const notInTableCell = (ed: Editor): boolean => !ed.isActive("table");

/**
 * 选择本地图片并作为附件插入：
 * 斜杠文本删除后打开系统图片选择框（仅图片格式），
 * 选中文件复制到工作空间 attachments/images/ 后插入 app:// 图片节点；
 * 用户取消时不插入任何内容，失败时弹通知。
 */
async function importImageAttachment(editor: Editor, pos: number): Promise<void> {
  deleteSlashText(editor, pos);

  const result = await window.electronAPI.attachment.importImage();
  if (!result.success) {
    handleApiError(result, true);
    return;
  }
  // ApiResponse 联合类型包含列表/分页分支（data 可能为数组），此处仅接受单个对象
  const imported = result.data;
  if (!imported || Array.isArray(imported)) return; // 用户取消选择

  editor
    .chain()
    .focus()
    .insertContent({
      type: "image",
      attrs: { src: imported.url, alt: imported.fileName },
    })
    .run();
}

/**
 * 构建基本块命令组：与 BubbleMenu 块类型面板对齐的基础格式块，
 * 外加分割线 / 图片 / 数学公式。
 */
export function buildBasicBlocksGroup(t: (key: string) => string): CommandGroup {
  const items: SlashCommand[] = [
    {
      id: "basic-paragraph",
      title: t("EDITOR.SLASH.BASIC_BLOCKS.PARAGRAPH_TITLE"),
      description: t("EDITOR.SLASH.BASIC_BLOCKS.PARAGRAPH_DESC"),
      icon: SubjectOutlined,
      action: ({ editor, pos }) =>
        run(editor, pos, (ed) => ed.chain().focus().setNode("paragraph").run()),
    },
    {
      id: "basic-heading-1",
      title: t("EDITOR.SLASH.BASIC_BLOCKS.HEADING_1_TITLE"),
      description: t("EDITOR.SLASH.BASIC_BLOCKS.HEADING_1_DESC"),
      // 文本徽标与 BubbleMenu 块类型面板的 H1/H2/H3 图标语言一致；
      // 样式由 SlashMenu 的字符串图标容器（.cmd-icon-text）统一渲染
      icon: "H1",
      action: ({ editor, pos }) =>
        run(editor, pos, (ed) => ed.chain().focus().toggleHeading({ level: 1 }).run()),
      isEnabled: notInTableCell,
    },
    {
      id: "basic-heading-2",
      title: t("EDITOR.SLASH.BASIC_BLOCKS.HEADING_2_TITLE"),
      description: t("EDITOR.SLASH.BASIC_BLOCKS.HEADING_2_DESC"),
      icon: "H2",
      action: ({ editor, pos }) =>
        run(editor, pos, (ed) => ed.chain().focus().toggleHeading({ level: 2 }).run()),
      isEnabled: notInTableCell,
    },
    {
      id: "basic-heading-3",
      title: t("EDITOR.SLASH.BASIC_BLOCKS.HEADING_3_TITLE"),
      description: t("EDITOR.SLASH.BASIC_BLOCKS.HEADING_3_DESC"),
      icon: "H3",
      action: ({ editor, pos }) =>
        run(editor, pos, (ed) => ed.chain().focus().toggleHeading({ level: 3 }).run()),
      isEnabled: notInTableCell,
    },
    {
      id: "basic-bullet-list",
      title: t("EDITOR.SLASH.BASIC_BLOCKS.BULLET_LIST_TITLE"),
      description: t("EDITOR.SLASH.BASIC_BLOCKS.BULLET_LIST_DESC"),
      icon: FormatListBulletedOutlined,
      action: ({ editor, pos }) =>
        run(editor, pos, (ed) => ed.chain().focus().toggleBulletList().run()),
    },
    {
      id: "basic-ordered-list",
      title: t("EDITOR.SLASH.BASIC_BLOCKS.ORDERED_LIST_TITLE"),
      description: t("EDITOR.SLASH.BASIC_BLOCKS.ORDERED_LIST_DESC"),
      icon: FormatListNumberedOutlined,
      action: ({ editor, pos }) =>
        run(editor, pos, (ed) => ed.chain().focus().toggleOrderedList().run()),
    },
    {
      id: "basic-task-list",
      title: t("EDITOR.SLASH.BASIC_BLOCKS.TASK_LIST_TITLE"),
      description: t("EDITOR.SLASH.BASIC_BLOCKS.TASK_LIST_DESC"),
      icon: ChecklistOutlined,
      action: ({ editor, pos }) =>
        run(editor, pos, (ed) => ed.chain().focus().toggleTaskList().run()),
    },
    {
      id: "basic-code-block",
      title: t("EDITOR.SLASH.BASIC_BLOCKS.CODE_BLOCK_TITLE"),
      description: t("EDITOR.SLASH.BASIC_BLOCKS.CODE_BLOCK_DESC"),
      icon: CodeOutlined,
      action: ({ editor, pos }) =>
        run(editor, pos, (ed) => ed.chain().focus().toggleCodeBlock().run()),
      // ``` 围栏在管道表格内会直接破坏 GFM 解析
      isEnabled: notInTableCell,
    },
    {
      id: "basic-blockquote",
      title: t("EDITOR.SLASH.BASIC_BLOCKS.BLOCKQUOTE_TITLE"),
      description: t("EDITOR.SLASH.BASIC_BLOCKS.BLOCKQUOTE_DESC"),
      icon: FormatQuoteOutlined,
      action: ({ editor, pos }) =>
        run(editor, pos, (ed) => ed.chain().focus().toggleBlockquote().run()),
      isEnabled: notInTableCell,
    },
    {
      id: "basic-table",
      title: t("EDITOR.SLASH.BASIC_BLOCKS.TABLE_TITLE"),
      description: t("EDITOR.SLASH.BASIC_BLOCKS.TABLE_DESC"),
      icon: TableChartOutlined,
      // 插入 3x3 表格（首行为表头）；插入后 Tab 切换单元格，行列管理见表格气泡菜单
      action: ({ editor, pos }) =>
        run(editor, pos, (ed) =>
          ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        ),
      // 单元格内禁止嵌套表格：schema 允许（table 属 block 组）但 GFM 无法序列化，
      // 嵌套表格保存时会被序列化器拍平破坏结构——菜单层面直接隐藏
      isEnabled: notInTableCell,
    },
    {
      id: "basic-admonition",
      title: t("EDITOR.SLASH.BASIC_BLOCKS.ADMONITION_TITLE"),
      description: t("EDITOR.SLASH.BASIC_BLOCKS.ADMONITION_DESC"),
      icon: CampaignOutlined,
      // 包裹当前块为提示块（默认 note 类型，插入后可经气泡菜单切换类型）
      action: ({ editor, pos }) =>
        run(editor, pos, (ed) => ed.chain().focus().toggleWrap("admonition", { type: "note" }).run()),
      // ::: 围栏在管道表格内会破坏 GFM 解析
      isEnabled: notInTableCell,
    },
    {
      id: "basic-horizontal-rule",
      title: t("EDITOR.SLASH.BASIC_BLOCKS.HORIZONTAL_RULE_TITLE"),
      description: t("EDITOR.SLASH.BASIC_BLOCKS.HORIZONTAL_RULE_DESC"),
      icon: HorizontalRuleOutlined,
      action: ({ editor, pos }) =>
        run(editor, pos, (ed) => ed.chain().focus().setHorizontalRule().run()),
      // 分割线在单元格内退化为 "---" 字面文本
      isEnabled: notInTableCell,
    },
    {
      id: "basic-image",
      title: t("EDITOR.SLASH.BASIC_BLOCKS.IMAGE_TITLE"),
      description: t("EDITOR.SLASH.BASIC_BLOCKS.IMAGE_DESC"),
      icon: ImageOutlined,
      action: ({ editor, pos }) => importImageAttachment(editor, pos),
    },
    {
      id: "basic-inline-math",
      title: t("EDITOR.SLASH.BASIC_BLOCKS.INLINE_MATH_TITLE"),
      description: t("EDITOR.SLASH.BASIC_BLOCKS.INLINE_MATH_DESC"),
      icon: FunctionsOutlined,
      // 斜杠文本删除后光标落位，弹出空的 LaTeX 输入框；
      // 确认且非空才插入行内公式，空输入/取消则不插入
      action: ({ editor, pos }) =>
        run(editor, pos, (ed) => showInlineMathInput(ed)),
    },
  ];

  return {
    id: "basicBlocks",
    label: t("EDITOR.SLASH.BASIC_BLOCKS.GROUP_LABEL"),
    items,
  };
}
