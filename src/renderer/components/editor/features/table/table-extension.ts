import type { Editor, JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Fragment } from "@tiptap/pm/model";
import { TableMap } from "@tiptap/pm/tables";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { TextSelection, Selection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import {
  Table,
  TableRow,
  TableHeader,
  TableCell,
  renderTableToMarkdown,
} from "@tiptap/extension-table";
import {
  addRow,
  addColumn,
  removeRow,
  removeColumn,
  CellSelection,
  columnIsHeader,
} from "@tiptap/pm/tables";

/**
 * 表格扩展：基于官方 @tiptap/extension-table 封装。
 *
 * 官方 TableKit 直接可用，但 renderTableToMarkdown 存在缺陷：
 * 单元格文本中的 `|` 未转义——保存后重载时 marked 会把它当作列分隔符，
 * 导致表格结构被破坏（单元格内容被拆成多列）。此处在渲染前把文本中的
 * `|` 替换为哨兵字符（绕过文本节点的 markdown 转义），渲染完成后再
 * 统一替换为 `\|`（GFM 表格单元格内的标准竖线转义）。
 */

/** 哨兵字符（私用区，正常文本不会出现） */
const PIPE_SENTINEL = "\uE000";

/** 递归保护：把表格 JSON 中文本节点的 `|` 替换为哨兵字符（浅拷贝，无变更时返回原节点） */
function protectCellPipes(node: JSONContent): JSONContent {
  if (node.type === "text" && typeof node.text === "string" && node.text.includes("|")) {
    return { ...node, text: node.text.split("|").join(PIPE_SENTINEL) };
  }
  if (node.content && node.content.length > 0) {
    let changed = false;
    const content = node.content.map((child) => {
      const next = protectCellPipes(child);
      if (next !== child) changed = true;
      return next;
    });
    return changed ? { ...node, content } : node;
  }
  return node;
}

/** 管道转义版表格节点：修复官方渲染器不转义单元格内 `|` 的问题 */
const WrispTable = Table.extend({
  renderMarkdown(node, helpers) {
    const output = renderTableToMarkdown(protectCellPipes(node), helpers);
    // 哨兵 → `\|`：GFM 表格单元格内的竖线转义（marked splitCells 解析时还原为 `|`）
    return output.split(PIPE_SENTINEL).join("\\|");
  },
});

/**
 * 创建表格扩展集（等价官方 TableKit，但 Table 为管道转义版）。
 * resizable 开启列宽拖拽（TableView 渲染 colgroup + 列宽手柄）。
 */
export function createTableExtensions() {
  return [
    WrispTable.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// 列级操作（对齐 / 排序）：GFM 的对齐是列级语义（分隔行 :---:），排序是行重排，
// 两者均不改变管道结构，序列化零影响。
// ─────────────────────────────────────────────────────────────────────────────

/** GFM 支持的列对齐值 */
export type ColumnAlign = "left" | "center" | "right";

/** 排序方向 */
export type SortDirection = "asc" | "desc";

/** 当前选区所在表格的定位信息 */
interface TableContext {
  table: PMNode;
  tablePos: number;
  map: TableMap;
  colIndex: number;
}

/**
 * 从选区向上解析 cell → row → table 层级，返回表格定位。
 * 支持普通光标与 CellSelection（拖选单元格）两种选区形态。
 */
function findTableContext(state: EditorState): TableContext | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth >= 3; depth--) {
    const role = $from.node(depth).type.spec.tableRole;
    if (role !== "cell" && role !== "header_cell") continue;
    const table = $from.node(depth - 2);
    if (table.type.spec.tableRole !== "table") return null;
    const tablePos = $from.before(depth - 2);
    const map = TableMap.get(table);
    const cellRel = $from.before(depth) - (tablePos + 1);
    return { table, tablePos, map, colIndex: map.findCell(cellRel).left };
  }
  return null;
}

/**
 * 设置当前列对齐：对整列所有单元格统一写入 align 属性（GFM 对齐为列级语义，
 * 单格不一致会导致序列化取值歧义）。跨行（rowspan）单元格只写一次。
 */
export function setTableColumnAlign(editor: Editor, align: ColumnAlign): boolean {
  const ctx = findTableContext(editor.state);
  if (!ctx) return false;
  const { table, tablePos, map, colIndex } = ctx;

  return editor
    .chain()
    .focus()
    .command(({ tr }) => {
      const touched = new Set<number>();
      for (let rowIdx = 0; rowIdx < map.height; rowIdx++) {
        const cellRel = map.positionAt(rowIdx, colIndex, table);
        if (touched.has(cellRel)) continue;
        touched.add(cellRel);
        const cell = table.nodeAt(cellRel);
        if (!cell || cell.attrs.align === align) continue;
        tr.setNodeMarkup(tablePos + 1 + cellRel, undefined, { ...cell.attrs, align });
      }
      return true;
    })
    .run();
}

/** 读取当前列对齐（取表头行/首行该列单元格的 align 属性，用于工具栏反显） */
export function getTableColumnAlign(editor: Editor): ColumnAlign | null {
  const ctx = findTableContext(editor.state);
  if (!ctx) return null;
  const { table, map, colIndex } = ctx;
  const cell = table.nodeAt(map.positionAt(0, colIndex, table));
  return (cell?.attrs.align as ColumnAlign | undefined) ?? null;
}

/** 排序比较：空单元格固定排末尾（与方向无关）；数字列自然排序；相等项保持原序（sort 稳定性） */
function compareCellText(a: string, b: string, direction: SortDirection, locale?: string): number {
  const av = a.trim();
  const bv = b.trim();
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  const result = av.localeCompare(bv, locale, { numeric: true, sensitivity: "base" });
  return direction === "asc" ? result : -result;
}

/**
 * 按当前列排序表格行（表头行固定在最上，不参与排序）。
 */
export function sortTableColumn(
  editor: Editor,
  direction: SortDirection,
  locale?: string,
): boolean {
  const ctx = findTableContext(editor.state);
  if (!ctx) return false;
  const { table, tablePos, map, colIndex } = ctx;

  const rows: PMNode[] = [];
  table.forEach((row) => rows.push(row));
  if (rows.length === 0) return false;

  const headerCount = rows[0].firstChild?.type.name === "tableHeader" ? 1 : 0;
  if (rows.length - headerCount < 2) return false;

  const keyed: { row: PMNode; key: string }[] = [];
  for (let i = headerCount; i < rows.length; i++) {
    const cell = table.nodeAt(map.positionAt(i, colIndex, table));
    keyed.push({ row: rows[i], key: cell?.textContent ?? "" });
  }
  keyed.sort((a, b) => compareCellText(a.key, b.key, direction, locale));

  const sorted = [...rows.slice(0, headerCount), ...keyed.map((k) => k.row)];
  if (sorted.every((row, i) => row === rows[i])) return false;

  const newTable = table.copy(Fragment.fromArray(sorted));
  return editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.replaceWith(tablePos, tablePos + table.nodeSize, newTable);
      const end = tablePos + newTable.nodeSize;
      tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(end, tr.doc.content.size)), -1));
      return true;
    })
    .run();
}

// ─────────────────────────────────────────────────────────────────────────────
// 基于行列索引的操作：边缘控件（handle / + 按钮）通过 DOM 定位到行/列索引后调用。
// 依赖 prosemirror-tables 的底层 addRow/addColumn/removeRow/removeColumn（接受
// TableRect + index），绕开"必须选中单元格才能操作"的限制。
// ─────────────────────────────────────────────────────────────────────────────

/** TableRect 形态（prosemirror-tables addRow/addColumn/removeRow/removeColumn 入参）
 *  prosemirror-tables 要求 rect 同时满足 Rect 形状 {left, top, right, bottom}
 *  和 tableRect 形状 {map, table, tableStart}。整表操作时 left=top=0，
 *  right=map.width，bottom=map.height，覆盖整张表。
 */
function tableRect(table: PMNode, tablePos: number, map: TableMap) {
  return {
    map,
    table,
    tableStart: tablePos + 1,
    left: 0,
    top: 0,
    right: map.width,
    bottom: map.height,
  };
}

/**
 * 通过 editor.view.nodeDOM 匹配 table DOM → PM 节点定位。
 * prosemirror-tables TableView 结构：<div class="tableWrapper"> → <table>；
 * view.nodeDOM(pos) 返回 pos 对应的 node view DOM（即外层 div）。
 */
function findTableByDom(
  view: EditorView,
  tableEl: HTMLTableElement,
): { table: PMNode; tablePos: number; map: TableMap } | null {
  const wrapper = tableEl.closest<HTMLElement>(".tableWrapper");
  if (!wrapper) return null;
  let found: { table: PMNode; tablePos: number; map: TableMap } | null = null;
  view.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.spec.tableRole === "table") {
      try {
        const dom = view.nodeDOM(pos);
        if (dom === wrapper) {
          found = { table: node, tablePos: pos, map: TableMap.get(node) };
          return false;
        }
      } catch {
        // pos 非法，跳过
      }
    }
    return undefined;
  });
  return found;
}

/**
 * 执行事务并聚焦：封装 chain().focus().command(fn).run() 的通用模式。
 * 所有 index 操作共用此模板，避免重复样板。
 */
function runIndexCommand(
  editor: Editor,
  tableEl: HTMLTableElement,
  fn: (ctx: { table: PMNode; tablePos: number; map: TableMap; tr: Transaction; state: EditorState }) => boolean,
): boolean {
  const view = editor.view;
  return editor
    .chain()
    .focus()
    .command(({ tr, state }) => {
      const ctx = findTableByDom(view, tableEl);
      if (!ctx) return false;
      return fn({ ...ctx, tr, state });
    })
    .run();
}

/** 在指定行索引处插入一行（index=行数时追加到末尾） */
export function insertRowAtIndex(editor: Editor, tableEl: HTMLTableElement, index: number): boolean {
  return runIndexCommand(editor, tableEl, ({ table, tablePos, map, tr }) => {
    addRow(tr, tableRect(table, tablePos, map), Math.max(0, Math.min(index, map.height)));
    return true;
  });
}

/** 在指定列索引处插入一列（index=列数时追加到末尾） */
export function insertColumnAtIndex(editor: Editor, tableEl: HTMLTableElement, index: number): boolean {
  return runIndexCommand(editor, tableEl, ({ table, tablePos, map, tr }) => {
    addColumn(tr, tableRect(table, tablePos, map), Math.max(0, Math.min(index, map.width)));
    return true;
  });
}

/** 删除指定行（至少保留一行） */
export function deleteRowAtIndex(editor: Editor, tableEl: HTMLTableElement, index: number): boolean {
  return runIndexCommand(editor, tableEl, ({ table, tablePos, map, tr }) => {
    if (map.height <= 1) return false;
    removeRow(tr, tableRect(table, tablePos, map), Math.max(0, Math.min(index, map.height - 1)));
    return true;
  });
}

/** 删除指定列（至少保留一列） */
export function deleteColumnAtIndex(editor: Editor, tableEl: HTMLTableElement, index: number): boolean {
  return runIndexCommand(editor, tableEl, ({ table, tablePos, map, tr }) => {
    if (map.width <= 1) return false;
    removeColumn(tr, tableRect(table, tablePos, map), Math.max(0, Math.min(index, map.width - 1)));
    return true;
  });
}

/** 设置指定列的对齐（列菜单调用） */
export function setColumnAlignAtIndex(
  editor: Editor,
  tableEl: HTMLTableElement,
  colIndex: number,
  align: ColumnAlign,
): boolean {
  return runIndexCommand(editor, tableEl, ({ table, tablePos, map, tr }) => {
    const col = Math.max(0, Math.min(colIndex, map.width - 1));
    const touched = new Set<number>();
    for (let rowIdx = 0; rowIdx < map.height; rowIdx++) {
      const cellRel = map.positionAt(rowIdx, col, table);
      if (touched.has(cellRel)) continue;
      touched.add(cellRel);
      const cell = table.nodeAt(cellRel);
      if (!cell || cell.attrs.align === align) continue;
      tr.setNodeMarkup(tablePos + 1 + cellRel, undefined, { ...cell.attrs, align });
    }
    return true;
  });
}

/** 按指定列排序（列菜单调用） */
export function sortColumnAtIndex(
  editor: Editor,
  tableEl: HTMLTableElement,
  colIndex: number,
  direction: SortDirection,
  locale?: string,
): boolean {
  const view = editor.view;
  const ctx = findTableByDom(view, tableEl);
  if (!ctx) return false;
  const { table, tablePos, map } = ctx;
  const col = Math.max(0, Math.min(colIndex, map.width - 1));

  const rows: PMNode[] = [];
  table.forEach((row) => rows.push(row));
  if (rows.length === 0) return false;

  const headerCount = rows[0].firstChild?.type.name === "tableHeader" ? 1 : 0;
  if (rows.length - headerCount < 2) return false;

  const keyed: { row: PMNode; key: string }[] = [];
  for (let i = headerCount; i < rows.length; i++) {
    const cell = table.nodeAt(map.positionAt(i, col, table));
    keyed.push({ row: rows[i], key: cell?.textContent ?? "" });
  }
  keyed.sort((a, b) => compareCellText(a.key, b.key, direction, locale));
  const sorted = [...rows.slice(0, headerCount), ...keyed.map((k) => k.row)];
  if (sorted.every((row, i) => row === rows[i])) return false;

  const newTable = table.copy(Fragment.fromArray(sorted));
  return editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.replaceWith(tablePos, tablePos + table.nodeSize, newTable);
      const end = tablePos + newTable.nodeSize;
      tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(end, tr.doc.content.size)), -1));
      return true;
    })
    .run();
}

/** 选中整行/整列（CellSelection），点击 handle 时高亮 */
export function selectRowOrColumn(
  editor: Editor,
  tableEl: HTMLTableElement,
  axis: "row" | "col",
  index: number,
): boolean {
  const ctx = findTableByDom(editor.view, tableEl);
  if (!ctx) return false;
  const { table, tablePos, map } = ctx;
  const col = axis === "col" ? Math.max(0, Math.min(index, map.width - 1)) : 0;
  const row = axis === "row" ? Math.max(0, Math.min(index, map.height - 1)) : 0;
  const anchorCellRel = map.positionAt(row, col, table);
  const anchorPos = tablePos + 1 + anchorCellRel;
  const $anchor = editor.state.doc.resolve(anchorPos);
  const cellSelection = axis === "row"
    ? CellSelection.rowSelection($anchor)
    : CellSelection.colSelection($anchor);
  editor.view.dispatch(editor.state.tr.setSelection(cellSelection as unknown as Selection));
  editor.view.focus();
  return true;
}

/** 判断指定列是否为表头列 */
export function isHeaderColumn(editor: Editor, tableEl: HTMLTableElement, colIndex: number): boolean {
  const ctx = findTableByDom(editor.view, tableEl);
  if (!ctx) return false;
  const { table, map } = ctx;
  return columnIsHeader(map, table, Math.max(0, Math.min(colIndex, map.width - 1)));
}

/** 判断指定行是否为表头行 */
export function isHeaderRow(editor: Editor, tableEl: HTMLTableElement, rowIndex: number): boolean {
  const ctx = findTableByDom(editor.view, tableEl);
  if (!ctx) return false;
  const { table, map } = ctx;
  const row = Math.max(0, Math.min(rowIndex, map.height - 1));
  const cell = table.nodeAt(map.positionAt(row, 0, table));
  return cell?.type.name === "tableHeader";
}

/** 获取指定列的对齐 */
export function getColumnAlign(editor: Editor, tableEl: HTMLTableElement, colIndex: number): ColumnAlign | null {
  const ctx = findTableByDom(editor.view, tableEl);
  if (!ctx) return null;
  const { table, map } = ctx;
  const col = Math.max(0, Math.min(colIndex, map.width - 1));
  const cell = table.nodeAt(map.positionAt(0, col, table));
  return (cell?.attrs.align as ColumnAlign | undefined) ?? null;
}

/** 切换指定行的表头状态（整行 tableHeader ↔ tableCell） */
export function toggleHeaderRowAtIndex(editor: Editor, tableEl: HTMLTableElement, index: number): boolean {
  return runIndexCommand(editor, tableEl, ({ table, tablePos, map, tr, state }) => {
    const rowIdx = Math.max(0, Math.min(index, map.height - 1));
    const toHeader = table.nodeAt(map.positionAt(rowIdx, 0, table))?.type.name !== "tableHeader";
    const cellType = toHeader ? state.schema.nodes.tableHeader : state.schema.nodes.tableCell;
    for (let col = 0; col < map.width; col++) {
      const cellRel = map.positionAt(rowIdx, col, table);
      // rowspan 跨行时同一 cell 可能在上方已处理过（cellRel 相同则跳过）
      if (rowIdx > 0 && cellRel === map.positionAt(rowIdx - 1, col, table)) continue;
      const cell = table.nodeAt(cellRel);
      if (!cell || cell.type === cellType) continue;
      tr.setNodeMarkup(tablePos + 1 + cellRel, cellType, cell.attrs);
    }
    return true;
  });
}

/** 切换指定列的表头状态（整列 tableHeader ↔ tableCell） */
export function toggleHeaderColumnAtIndex(editor: Editor, tableEl: HTMLTableElement, index: number): boolean {
  return runIndexCommand(editor, tableEl, ({ table, tablePos, map, tr, state }) => {
    const colIdx = Math.max(0, Math.min(index, map.width - 1));
    const toHeader = table.nodeAt(map.positionAt(0, colIdx, table))?.type.name !== "tableHeader";
    const cellType = toHeader ? state.schema.nodes.tableHeader : state.schema.nodes.tableCell;
    const touched = new Set<number>();
    for (let row = 0; row < map.height; row++) {
      const cellRel = map.positionAt(row, colIdx, table);
      if (touched.has(cellRel)) continue;
      touched.add(cellRel);
      const cell = table.nodeAt(cellRel);
      if (!cell || cell.type === cellType) continue;
      tr.setNodeMarkup(tablePos + 1 + cellRel, cellType, cell.attrs);
    }
    return true;
  });
}
