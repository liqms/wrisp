import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { CommandGroup, SlashCommand } from "./types";
import { getBlocks } from "@/renderer/components/editor/blocks/registry";
import type { WrispBlockDefinition } from "@/renderer/components/editor/blocks/registry";
import { openBlockEditor } from "@/renderer/components/editor/blocks/components/bus";
import { deleteSlashText } from "./helpers";

/** 由块字段声明生成默认 attrs */
function defaultAttrs(def: WrispBlockDefinition): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const field of def.fields) {
    attrs[field.key] = String(field.default);
  }
  return attrs;
}

/**
 * 插入一个自定义块节点（默认 attrs）并立即打开编辑弹窗。
 *
 * 并入规则：插入点所在文本块已空、且前一个同级块是同类分组时，
 * 直接把卡片追加到该分组末尾——避免连续插入产生多个单卡分组
 * （单卡分组会让卡片独占一行且无法合并，与重载后的归组结构不一致）。
 * 其余情况创建新分组（与重载后的文档结构一致，保证 round-trip 结构稳定）。
 * 新节点位置通过「节点对象同一性」在事务后的文档中定位，
 * 不依赖插入后光标落点（空段落/段落中部等上下文下光标位置并不确定）。
 */
export function insertBlock(editor: Editor, pos: number, def: WrispBlockDefinition): void {
  deleteSlashText(editor, pos);
  const attrs = defaultAttrs(def);
  const type = editor.state.schema.nodes[def.type];
  const groupType = def.groupView
    ? editor.state.schema.nodes[`${def.type}Group`]
    : undefined;
  if (!type) return;

  // 探测前邻分组：当前文本块已空且前一个同级块是同类分组 → 并入其末尾
  // 注意：index(depth-1) 才是当前块在父容器中的兄弟索引（index(depth) 是块内子节点索引）
  let mergeEnd: number | null = null;
  if (groupType) {
    const { $from } = editor.state.selection;
    const depth = $from.depth;
    if (depth >= 1 && $from.parent.content.size === 0) {
      const container = $from.node(depth - 1);
      const index = $from.index(depth - 1);
      if (index > 0) {
        const prev = container.child(index - 1);
        if (prev.type === groupType) {
          // 前邻分组节点结束 = 当前块节点开始（$from.before(depth)），
          // 其 close 标记宽 1，组内内容末尾（插入点）= close 标记之前。
          // 注意不能把插入点算到分组结束之后——那是父容器层级，卡片会落在组外。
          mergeEnd = $from.before(depth) - 1;
        }
      }
    }
  }

  let created: PMNode | null = null;
  let nodePos = -1;
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      const card = type.create(attrs);
      if (mergeEnd !== null) {
        created = card;
        nodePos = mergeEnd;
        tr.insert(mergeEnd, card);
      } else {
        created = groupType ? groupType.create({}, [card]) : card;
        tr.replaceSelectionWith(created);
      }
      return true;
    })
    .run();

  if (!created) return;

  if (nodePos < 0) {
    // 按对象同一性找到新插入容器，卡片位于容器起始 + 1（group）或容器自身（裸卡片）
    const container = created;
    editor.state.doc.descendants((node, p) => {
      if (node === container) {
        nodePos = groupType ? p + 1 : p;
        return false;
      }
      return true;
    });
  }

  if (nodePos >= 0) {
    openBlockEditor({ editor, pos: nodePos, nodeType: def.type, attrs });
  }
}

/** 构建自定义块命令组（声明式注册表驱动，新增块自动出现在 Slash 菜单） */
export function buildBlocksGroup(t: (key: string) => string): CommandGroup {
  const items: SlashCommand[] = getBlocks().map((def) => ({
    id: `block-${def.type}`,
    title: t(def.titleKey),
    description: def.descKey ? t(def.descKey) : "",
    icon: def.slashIcon ?? "▦",
    action: ({ editor, pos }) => insertBlock(editor, pos, def),
    // 自定义块（指标卡等）为围栏/多行结构，GFM 单元格无法承载——表格上下文隐藏
    isEnabled: (editor) => !editor.isActive("table"),
  }));
  return {
    id: "blocks",
    label: t("EDITOR.BLOCKS.GROUP_LABEL"),
    items,
  };
}
