<template>
  <!--
    表格边缘控件：悬浮在 tiptap-editor-wrapper 上（position: relative），
    坐标相对 wrapper（scroll 容器）——clientX/Y - wrapperRect 即为 overlay 内定位。
    仅 handle/+/popover 触发 pointer-events；其它区域穿透给编辑器。

    Notion 风格参考：
      - 列 handle：列顶居中的蓝色圆角胶囊，内含 6 白点 (3x2)，点击弹出列操作菜单
      - 行 handle：行左居中的蓝色圆角胶囊，内含 6 白点 (3x2)，点击弹出行操作菜单
      - 右侧/底部 +：小方块按钮，靠近边缘时出现，hover 变蓝 + tooltip
      - 同一时刻仅悬停行/列的 handle 显示（或已选中/打开菜单的那个）
  -->
  <div v-if="active" ref="overlayEl" class="table-edge-overlay">
    <!-- 顶部列 handle（仅当前 hover / 选中 / 菜单打开的列显示）。
      n-popover 以整个 handle 作为 trigger：开关由 popover 独占（update:show），
      onColClick 只负责 CellSelection 选中。注意不要绑定 @clickoutside——
      传入 onClickoutside 后 naive-ui 会把"点击 trigger 自身"也走关闭路径
      （mouseup 即关），随后 click 阶段 handleClick 读到 show=false 又重新打开，
      导致再次点击 handle 无法关闭菜单。真正的外部点击由 naive-ui 内部
      clickoutside（排除 trigger）关闭并回调 update:show(false)。 -->
    <template v-for="(c, ci) in active.cols" :key="`ch-${ci}`">
      <n-popover v-if="isColVisible(ci)" :show="openCol === ci" trigger="click" placement="bottom" :show-arrow="false"
        :style="{ padding: '0',borderRadius: '8px' }" @update:show="(v: boolean) => onColPopoverShow(ci, v)">
        <template #trigger>
          <div class="te-handle te-handle--col" :class="{ 'is-active': isColActive(ci) }"
            :style="{ left: `${c.left + c.width / 2 - 14}px`, top: `${active.rect.top - 20}px`, width: '28px' }"
            @click.stop="onColClick(ci)">
            <div class="te-handle__btn">
              <span /><span /><span />
              <span /><span /><span />
            </div>
          </div>
        </template>
        <div class="te-menu">
          <button v-for="item in visibleColItems(ci)" :key="item.key" class="te-menu__item" :class="{
            'is-danger': item.danger,
            'is-checked': item.checked?.(ci),
          }" @click.stop="doColAction(item.key, ci)">
            <n-icon size="15">
              <component :is="item.icon" />
            </n-icon>
            <span class="te-menu__text">{{ item.label }}</span>
            <n-icon v-if="item.checked?.(ci)" size="13" class="te-menu__check">
              <CheckOutlined />
            </n-icon>
          </button>
          <div class="te-menu__sep" />
          <div class="te-menu__group-label">{{ t("EDITOR.TABLE.ALIGN") }}</div>
          <div class="te-seg">
            <button v-for="a in alignOpts" :key="a.value" class="te-seg__btn"
              :class="{ 'is-active': getAlignOf(ci) === a.value }" :title="a.label" @click.stop="doAlign(ci, a.value)">
              <n-icon size="15">
                <component :is="a.icon" />
              </n-icon>
            </button>
          </div>
        </div>
      </n-popover>
    </template>

    <!-- 左侧行 handle（仅当前 hover / 选中 / 菜单打开的行显示）；@clickoutside 同列，勿绑定 -->
    <template v-for="(r, ri) in active.rows" :key="`rh-${ri}`">
      <n-popover v-if="isRowVisible(ri)" :show="openRow === ri" trigger="click" placement="right" :show-arrow="false"
        :style="{ padding: '0',borderRadius: '8px' }" @update:show="(v: boolean) => onRowPopoverShow(ri, v)">
        <template #trigger>
          <div class="te-handle te-handle--row" :class="{ 'is-active': isRowActive(ri) }"
            :style="{ top: `${r.top + r.height / 2 - 14}px`, left: `${active.rect.left - 22}px`, height: '28px' }"
            @click.stop="onRowClick(ri)">
            <div class="te-handle__btn te-handle__btn--row">
              <span /><span /><span />
              <span /><span /><span />
            </div>
          </div>
        </template>
        <div class="te-menu">
          <button v-for="item in visibleRowItems(ri)" :key="item.key" class="te-menu__item"
            :class="{ 'is-danger': item.danger, 'is-checked': item.checked?.(ri) }"
            @click.stop="doRowAction(item.key, ri)">
            <n-icon size="15">
              <component :is="item.icon" />
            </n-icon>
            <span class="te-menu__text">{{ item.label }}</span>
            <n-icon v-if="item.checked?.(ri)" size="13" class="te-menu__check">
              <CheckOutlined />
            </n-icon>
          </button>
        </div>
      </n-popover>
    </template>

    <!-- 右侧 + 加列（贴合表格真实右缘/高度） -->
    <button v-if="active.rect" class="te-plus te-plus--col" :class="{ 'is-visible': hoverNearEdge('right') }"
      :style="{ left: `${active.rect.left + active.tableW}px`, top: `${active.rect.top}px`, height: `${active.tableH}px` }"
      @click.stop="addColumn">
      <n-icon size="14">
        <AddOutlined />
      </n-icon>
    </button>

    <!-- 底部 + 加行（贴合表格真实底缘/宽度） -->
    <button v-if="active.rect" class="te-plus te-plus--row" :class="{ 'is-visible': hoverNearEdge('bottom') }"
      :style="{ left: `${active.rect.left}px`, top: `${active.rect.top + active.tableH}px`, width: `${active.tableW}px` }"
      @click.stop="addRow">
      <n-icon size="14">
        <AddOutlined />
      </n-icon>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, onBeforeUnmount, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import type { Editor } from "@tiptap/core";
import { NPopover, NIcon } from "naive-ui";
import {
  AddOutlined,
  ArrowUpwardOutlined,
  ArrowDownwardOutlined,
  BorderLeftOutlined,
  BorderTopOutlined,
  ChevronLeftRound,
  ChevronRightRound,
  ExpandLessRound,
  ExpandMoreRound,
  DeleteOutlined,
  CheckOutlined,
  FormatAlignLeftOutlined,
  FormatAlignCenterOutlined,
  FormatAlignRightOutlined,
} from "@vicons/material";
import {
  insertRowAtIndex,
  insertColumnAtIndex,
  deleteRowAtIndex,
  deleteColumnAtIndex,
  setColumnAlignAtIndex,
  sortColumnAtIndex,
  toggleHeaderRowAtIndex,
  toggleHeaderColumnAtIndex,
  selectRowOrColumn,
  isHeaderRow,
  isHeaderColumn,
  getColumnAlign,
} from "./table-extension";
import type { ColumnAlign } from "./table-extension";

interface ColGeom { left: number; width: number }
interface RowGeom { top: number; height: number }
interface TableGeom {
  tableEl: HTMLTableElement;
  wrapper: HTMLElement;
  rect: { left: number; top: number; width: number; height: number };
  /** 表格自身宽高（不含 tableWrapper 的 padding，用于 + 按钮定位与 hover 热区） */
  tableW: number;
  tableH: number;
  cols: ColGeom[];
  rows: RowGeom[];
}

const props = defineProps<{ editor: Editor | null }>();
const { t, locale } = useI18n();

const overlayEl = ref<HTMLElement | null>(null);

// ── 状态 ──
const active = shallowRef<TableGeom | null>(null);
const openCol = ref(-1);
const openRow = ref(-1);
// 鼠标当前在 overlay 内的坐标（相对 wrapper）
const mouseX = ref(-9999);
const mouseY = ref(-9999);
const inOverlay = ref(false);
// 选中整列/整行的 CellSelection 对应的 index
const selectedCol = ref(-1);
const selectedRow = ref(-1);

// ── 菜单定义 ──
function bcplang(): string { return locale.value === "enUS" ? "en-US" : "zh-CN"; }

interface MenuItem {
  key: string;
  label: string;
  icon: unknown;
  danger?: boolean;
  checked?: (idx: number) => boolean;
  /** 该项在指定行/列的菜单中是否显示（缺省显示），如：切换表头行仅首行 */
  visible?: (idx: number) => boolean;
}

const rowMenuItems = computed<MenuItem[]>(() => [
  { key: "row-above", label: t("EDITOR.TABLE.ADD_ROW_ABOVE"), icon: ExpandLessRound },
  { key: "row-below", label: t("EDITOR.TABLE.ADD_ROW_BELOW"), icon: ExpandMoreRound },
  {
    key: "row-header", label: t("EDITOR.TABLE.TOGGLE_HEADER_ROW"), icon: BorderTopOutlined, visible: (ri) => ri === 0, checked: (ri) => {
      const g = active.value;
      if (!g || !props.editor) return false;
      return isHeaderRow(props.editor, g.tableEl, ri);
    }
  },
  { key: "row-delete", label: t("EDITOR.TABLE.DELETE_ROW"), icon: DeleteOutlined, danger: true },
]);

const colMenuItems = computed<MenuItem[]>(() => [
  { key: "col-left", label: t("EDITOR.TABLE.ADD_COLUMN_LEFT"), icon: ChevronLeftRound },
  { key: "col-right", label: t("EDITOR.TABLE.ADD_COLUMN_RIGHT"), icon: ChevronRightRound },
  {
    key: "col-header", label: t("EDITOR.TABLE.TOGGLE_HEADER_COLUMN"), icon: BorderLeftOutlined, visible: (ci) => ci === 0, checked: (ci) => {
      const g = active.value;
      if (!g || !props.editor) return false;
      return isHeaderColumn(props.editor, g.tableEl, ci);
    }
  },
  { key: "sort-asc", label: t("EDITOR.TABLE.SORT_ASC"), icon: ArrowUpwardOutlined },
  { key: "sort-desc", label: t("EDITOR.TABLE.SORT_DESC"), icon: ArrowDownwardOutlined },
  { key: "col-delete", label: t("EDITOR.TABLE.DELETE_COLUMN"), icon: DeleteOutlined, danger: true },
]);

const alignOpts = [
  { value: "left" as const, label: t("EDITOR.TABLE.ALIGN_LEFT"), icon: FormatAlignLeftOutlined },
  { value: "center" as const, label: t("EDITOR.TABLE.ALIGN_CENTER"), icon: FormatAlignCenterOutlined },
  { value: "right" as const, label: t("EDITOR.TABLE.ALIGN_RIGHT"), icon: FormatAlignRightOutlined },
];

/** 按当前行/列过滤菜单项（visible 缺省为显示） */
function visibleRowItems(ri: number): MenuItem[] {
  return rowMenuItems.value.filter((it) => it.visible?.(ri) !== false);
}

function visibleColItems(ci: number): MenuItem[] {
  return colMenuItems.value.filter((it) => it.visible?.(ci) !== false);
}

// ── 几何计算 ──
/**
 * 宿主（滚动容器 + 定位容器）：.tiptap-editor-wrapper，overlay 是它的子节点。
 * 必须从编辑器 DOM 向上解析，绝不能读 overlayEl.parentElement——overlay 受
 * v-if="active" 控制，未挂载时 ref 为 null → measureTable 永远失败 →
 * active 永远置不上（自死锁，控件一次都出不来）。
 */
function getWrapper(): HTMLElement | null {
  const ed = props.editor;
  if (!ed) return null;
  const hostEl = ed.options.element;
  const hostNode = hostEl instanceof Element ? hostEl : null;
  return hostNode?.closest<HTMLElement>(".tiptap-editor-wrapper") ?? (hostNode as HTMLElement | null);
}

function cur(): TableGeom | null { return active.value; }

function measureTable(tableEl: HTMLTableElement): TableGeom | null {
  const wrapper = tableEl.closest<HTMLElement>(".tableWrapper");
  const host = getWrapper();
  if (!wrapper || !host) return null;
  const hr = host.getBoundingClientRect();
  const wr = wrapper.getBoundingClientRect();
  const tr = tableEl.getBoundingClientRect();
  const left0 = wr.left - hr.left + host.scrollLeft;
  const top0 = wr.top - hr.top + host.scrollTop;
  // 列/行几何直接取单元格自身 rect 换算为宿主内容坐标：
  // .tableWrapper 内部横向滚动（宽表）时，按首行宽度累加的推算法会整体错位
  const toX = (r: DOMRect): number => r.left - hr.left + host.scrollLeft;
  const toY = (r: DOMRect): number => r.top - hr.top + host.scrollTop;
  const cols: ColGeom[] = [];
  const rows: RowGeom[] = [];
  const fr = tableEl.rows[0];
  if (fr) {
    for (let i = 0; i < fr.cells.length; i++) {
      const cr = fr.cells[i].getBoundingClientRect();
      cols.push({ left: toX(cr), width: cr.width });
    }
  }
  for (let i = 0; i < tableEl.rows.length; i++) {
    const rr = tableEl.rows[i].getBoundingClientRect();
    rows.push({ top: toY(rr), height: rr.height });
  }
  // 表宽钳制到 .tableWrapper 可视宽度（减去右侧 padding）：
  // 宽表横向滚动时 + 按钮与 hover 热区贴可视右缘（Notion 行为），而非溢出裁剪区
  const cs = getComputedStyle(wrapper);
  const tableW = Math.min(tr.width, wrapper.clientWidth - parseFloat(cs.paddingRight));
  return {
    tableEl, wrapper,
    rect: { left: left0, top: top0, width: wrapper.offsetWidth, height: wrapper.offsetHeight },
    tableW,
    tableH: tr.height,
    cols, rows,
  };
}

/**
 * 找出当前激活的 <table> DOM。优先鼠标悬停的表（Notion 行为：hover 哪张
 * 表显示哪张的控件），其次选区所在表（点 handle/单元格后鼠标可能已离开
 * 表区），最后保留上次激活表。
 */
function findActiveTable(): HTMLTableElement | null {
  const ed = props.editor;
  if (!ed) return null;
  // 菜单打开期间锚定当前表，避免鼠标/选区漂移导致 popover 跳表
  const g0 = cur();
  if ((openCol.value >= 0 || openRow.value >= 0) && g0 && document.body.contains(g0.tableEl)) {
    return g0.tableEl;
  }
  if (lastMouseTarget instanceof Element) {
    const t = lastMouseTarget.closest("table");
    const hostEl = ed.options.element;
    const hostNode = hostEl instanceof Element ? hostEl : null;
    if (t && hostNode?.contains(t)) return t as HTMLTableElement;
  }
  const { $from } = ed.state.selection;
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.spec.tableRole === "table") {
      try {
        const dom = ed.view.nodeDOM($from.before(d));
        if (dom instanceof HTMLElement) {
          const tbl = dom.matches("table") ? dom as HTMLTableElement : dom.querySelector<HTMLTableElement>("table");
          if (tbl) return tbl;
        }
      } catch {
        // ignore
      }
    }
  }
  if (g0 && document.body.contains(g0.tableEl)) return g0.tableEl;
  return null;
}

function refresh(): void {
  const ed = props.editor;
  if (!ed) { active.value = null; return; }
  const te = findActiveTable();
  if (!te) {
    if (!inOverlay.value) {
      active.value = null;
      openCol.value = -1;
      openRow.value = -1;
      selectedCol.value = -1;
      selectedRow.value = -1;
    }
    return;
  }
  const g = measureTable(te);
  if (!g) return;
  active.value = g;
}

// ── hover / 激活状态 ──
function hoverCol(): number {
  const g = cur();
  if (!g?.rect) return -1;
  if (mouseX.value < -9000) return -1;
  // handle 顶部区域向外扩展 16px
  if (mouseY.value < g.rect.top - 20 || mouseY.value > g.rect.top + g.rect.height + 4) return -1;
  if (mouseX.value < g.rect.left - 4 || mouseX.value > g.rect.left + g.rect.width + 4) return -1;
  for (let i = 0; i < g.cols.length; i++) {
    if (mouseX.value >= g.cols[i].left - 2 && mouseX.value < g.cols[i].left + g.cols[i].width + 2) return i;
  }
  return -1;
}
function hoverRow(): number {
  const g = cur();
  if (!g?.rect) return -1;
  if (mouseY.value < -9000) return -1;
  if (mouseX.value < g.rect.left - 20 || mouseX.value > g.rect.left + g.rect.width + 4) return -1;
  if (mouseY.value < g.rect.top - 4 || mouseY.value > g.rect.top + g.rect.height + 4) return -1;
  for (let i = 0; i < g.rows.length; i++) {
    if (mouseY.value >= g.rows[i].top - 2 && mouseY.value < g.rows[i].top + g.rows[i].height + 2) return i;
  }
  return -1;
}
function isColActive(ci: number): boolean {
  return openCol.value === ci || selectedCol.value === ci;
}
function isRowActive(ri: number): boolean {
  return openRow.value === ri || selectedRow.value === ri;
}
function isColVisible(ci: number): boolean {
  return hoverCol() === ci || openCol.value === ci || selectedCol.value === ci;
}
function isRowVisible(ri: number): boolean {
  return hoverRow() === ri || openRow.value === ri || selectedRow.value === ri;
}
function hoverNearEdge(edge: "right" | "bottom"): boolean {
  const g = cur();
  if (!g?.rect) return false;
  const { rect, tableW, tableH } = g;
  const TOL = 22;
  if (edge === "right") {
    return mouseX.value >= rect.left + tableW - TOL && mouseX.value <= rect.left + tableW + 22
      && mouseY.value >= rect.top - 4 && mouseY.value <= rect.top + tableH + 4;
  }
  return mouseY.value >= rect.top + tableH - TOL && mouseY.value <= rect.top + tableH + 22
    && mouseX.value >= rect.left - 4 && mouseX.value <= rect.left + tableW + 4;
}

function getAlignOf(ci: number): ColumnAlign | null {
  const g = cur();
  if (!g || !props.editor) return null;
  return getColumnAlign(props.editor, g.tableEl, ci);
}

// ── 动作 ──
/** 点击 handle：仅做 CellSelection 选中；popover 的开关由 naive-ui trigger 独占（见 onXxxPopoverShow） */
function onColClick(ci: number): void {
  const g = cur();
  if (!g || !props.editor) return;
  selectRowOrColumn(props.editor, g.tableEl, "col", ci);
  selectedCol.value = ci;
  selectedRow.value = -1;
}
function onRowClick(ri: number): void {
  const g = cur();
  if (!g || !props.editor) return;
  selectRowOrColumn(props.editor, g.tableEl, "row", ri);
  selectedRow.value = ri;
  selectedCol.value = -1;
}

/** popover 开关的唯一所有者：true 时互斥清掉另一轴的菜单 */
function onColPopoverShow(ci: number, v: boolean): void {
  if (v) {
    openCol.value = ci;
    openRow.value = -1;
  } else if (openCol.value === ci) {
    openCol.value = -1;
  }
}
function onRowPopoverShow(ri: number, v: boolean): void {
  if (v) {
    openRow.value = ri;
    openCol.value = -1;
  } else if (openRow.value === ri) {
    openRow.value = -1;
  }
}

function afterAction(): void {
  openCol.value = -1;
  openRow.value = -1;
  // 菜单操作（插入/删除行列）会使索引整体移位，selected 必须一并清掉，避免错位高亮
  selectedCol.value = -1;
  selectedRow.value = -1;
  nextTick(refresh);
}

function doColAction(key: string, ci: number): void {
  const g = cur();
  if (!g || !props.editor) return;
  const ed = props.editor, te = g.tableEl;
  switch (key) {
    case "col-left": insertColumnAtIndex(ed, te, ci); break;
    case "col-right": insertColumnAtIndex(ed, te, ci + 1); break;
    case "col-header": toggleHeaderColumnAtIndex(ed, te, ci); break;
    case "sort-asc": sortColumnAtIndex(ed, te, ci, "asc", bcplang()); break;
    case "sort-desc": sortColumnAtIndex(ed, te, ci, "desc", bcplang()); break;
    case "col-delete": deleteColumnAtIndex(ed, te, ci); break;
  }
  afterAction();
}
function doRowAction(key: string, ri: number): void {
  const g = cur();
  if (!g || !props.editor) return;
  const ed = props.editor, te = g.tableEl;
  switch (key) {
    case "row-above": insertRowAtIndex(ed, te, ri); break;
    case "row-below": insertRowAtIndex(ed, te, ri + 1); break;
    case "row-header": toggleHeaderRowAtIndex(ed, te, ri); break;
    case "row-delete": deleteRowAtIndex(ed, te, ri); break;
  }
  afterAction();
}
function doAlign(ci: number, a: ColumnAlign): void {
  const g = cur();
  if (!g || !props.editor) return;
  setColumnAlignAtIndex(props.editor, g.tableEl, ci, a);
  nextTick(refresh);
}
function addColumn(): void {
  const g = cur();
  if (!g || !props.editor) return;
  insertColumnAtIndex(props.editor, g.tableEl, g.cols.length);
  afterAction();
}
function addRow(): void {
  const g = cur();
  if (!g || !props.editor) return;
  insertRowAtIndex(props.editor, g.tableEl, g.rows.length);
  afterAction();
}

/** 鼠标离开编辑区（宿主 wrapper）：重置 hover 坐标让 handle/+ 隐藏；菜单打开时保留现场 */
function onHostLeave(): void {
  inOverlay.value = false;
  if (openCol.value < 0 && openRow.value < 0) {
    mouseX.value = -9999;
    mouseY.value = -9999;
  }
}

// ── 全局鼠标/滚动/事务事件 ──
let lastMouseTarget: EventTarget | null = null;
/** mousemove/scroll 监听目标：wrapper（滚动容器），handle/+按钮是 editor 元素的兄弟节点，挂在 editor 元素上会漏事件 */
let listenHost: HTMLElement | null = null;

let lastClientX = -1;
let lastClientY = -1;

function onMouseMove(e: MouseEvent): void {
  lastMouseTarget = e.target;
  const host = getWrapper();
  if (!host) return;
  const hr = host.getBoundingClientRect();
  lastClientX = e.clientX;
  lastClientY = e.clientY;
  mouseX.value = e.clientX - hr.left + host.scrollLeft;
  mouseY.value = e.clientY - hr.top + host.scrollTop;
  inOverlay.value = overlayEl.value?.contains(e.target as Node) ?? false;
  const g = cur();
  if (!g || !document.body.contains(g.tableEl)) {
    refresh();
    return;
  }
  // 菜单关闭时鼠标移入另一张表 → 切换激活表（菜单打开期间保持锚定）
  if (openCol.value < 0 && openRow.value < 0 && lastMouseTarget instanceof Element) {
    const ht = lastMouseTarget.closest("table");
    if (ht && ht !== g.tableEl && document.body.contains(ht)) refresh();
  }
}

function onScroll(): void {
  // 滚动后鼠标未动但内容动了：按最近一次 client 坐标重算内容坐标，hover 高亮不失真
  const host = getWrapper();
  if (host && lastClientX >= 0) {
    const hr = host.getBoundingClientRect();
    mouseX.value = lastClientX - hr.left + host.scrollLeft;
    mouseY.value = lastClientY - hr.top + host.scrollTop;
  }
  if (cur()) nextTick(refresh);
}

function onSelectionUpdate(): void {
  // 选区一变，行/列选中态一律失效：mousedown 改选区发生在 popover 关闭（mouseup）
  // 之前，若此时不清，"点表格内单元格关菜单"会残留幽灵 handle。
  // onColClick/onRowClick 在 dispatch 之后才写 selected，不受影响。
  selectedCol.value = -1;
  selectedRow.value = -1;
  nextTick(refresh);
}
function onUpdate(): void {
  nextTick(refresh);
}

let blurTimer: number | undefined;
function onFocus(): void {
  // 编辑器重新获得焦点：取消挂起的 blur 卸载定时器（点击菜单项会短暂 blur 再 focus）
  window.clearTimeout(blurTimer);
  blurTimer = undefined;
  nextTick(refresh);
}
function onBlur(): void {
  window.clearTimeout(blurTimer);
  blurTimer = window.setTimeout(() => {
    blurTimer = undefined;
    const ed = props.editor;
    if (!ed) return;
    if (openCol.value < 0 && openRow.value < 0 && !inOverlay.value && !ed.isFocused) {
      active.value = null;
    }
  }, 180);
}

function bind(): void {
  const ed = props.editor;
  if (!ed) return;
  ed.on("selectionUpdate", onSelectionUpdate);
  ed.on("update", onUpdate);
  ed.on("focus", onFocus);
  ed.on("blur", onBlur);
  const hostEl = ed.options.element;
  const hostNode = hostEl instanceof Element ? hostEl : null;
  // 优先挂到滚动容器 wrapper（覆盖 handle/+ 按钮 hover 区域），取不到时退回 editor 元素
  listenHost = hostNode?.closest<HTMLElement>(".tiptap-editor-wrapper") ?? (hostNode as HTMLElement | null);
  listenHost?.addEventListener("mousemove", onMouseMove as EventListener);
  listenHost?.addEventListener("mouseleave", onHostLeave);
  // capture：.tableWrapper 的横向滚动事件不冒泡，捕获阶段才能监听到 → 触发重测量
  listenHost?.addEventListener("scroll", onScroll, { passive: true, capture: true });
  window.addEventListener("resize", onScroll);
  nextTick(refresh);
}
function unbind(ed?: Editor | null): void {
  const target = ed ?? props.editor;
  if (target) {
    target.off("selectionUpdate", onSelectionUpdate);
    target.off("update", onUpdate);
    target.off("focus", onFocus);
    target.off("blur", onBlur);
  }
  window.clearTimeout(blurTimer);
  blurTimer = undefined;
  listenHost?.removeEventListener("mousemove", onMouseMove as EventListener);
  listenHost?.removeEventListener("mouseleave", onHostLeave);
  listenHost?.removeEventListener("scroll", onScroll, { capture: true });
  listenHost = null;
  window.removeEventListener("resize", onScroll);
}

watch(() => props.editor, (ed, prev) => {
  if (prev) unbind(prev);
  if (ed) nextTick(bind);
}, { immediate: true });

onBeforeUnmount(() => unbind());

watch([openCol, openRow], () => nextTick(refresh));
</script>

<style lang="scss">
/* 非 scoped：popover/tooltip teleport 到 body，样式需要全局生效 */
@use "@/renderer/styles/_variables" as *;

.tiptap-editor-wrapper {
  .table-edge-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 60;

    // ── handle 胶囊（6 点） ──
    .te-handle {
      position: absolute;
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 62;


      .te-handle__btn {
        display: grid;
        grid-template-columns: repeat(3, 2px);
        grid-template-rows: repeat(2, 2px);
        gap: 2px;
        padding: 4px;
        border-radius: 2px;
        background: var(--bg-primary);
        box-shadow: 0 2px 6px rgba(0, 0, 0, .18);
        transition: transform .1s ease, filter .1s ease;

        span {
          width: 2px;
          height: 2px;
          border-radius: 50%;
          background: var(--text-color);
          opacity: .9;
        }

        &--row {
          grid-template-columns: repeat(2, 2px);
          grid-template-rows: repeat(3, 2px);
          padding: 5px 4px;
          margin-left: 22px;
        }
      }

      &--col {
        height: 20px;
        margin-top: 15px;
      }

      &--row {
        width: 22px;
      }

      &:hover .te-handle__btn,
      &.is-active .te-handle__btn {
        filter: brightness(1.08);
        transform: scale(1.05);
        background: color-mix(in srgb, var(--primary-color) 50%, transparent);
      }

    }

    // ── + 加行列按钮 ──
    .te-plus {
      position: absolute;
      // 不可见时禁用命中：整条边缘热区若保持 auto，会挡住编辑器点击、误弹 tooltip
      pointer-events: none;
      background: var(--bg-primary);
      color: var(--text-color);
      border: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0;
      transition: opacity .15s ease, background .15s ease, color .15s ease, border-color .15s ease;
      z-index: 61;
      margin: 4px 0;

      &--col {
        width: 20px;
        border-radius: 6px;
        margin-left: 4px;
      }

      &--row {
        height: 20px;
        border-radius: 6px;
        margin-top: 8px;
      }

      &.is-visible {
        opacity: 1;
        pointer-events: auto;
      }

      &:hover {
        background: color-mix(in srgb, var(--primary-color) 50%, transparent);
        color: var(--text-color);
      }
    }
  }

  /* 表格容器外边距 + padding 给 handle/plus 留位 */
  .tableWrapper {
    margin: 16px 0 28px 0;
    overflow-x: auto;
    // padding: 0 24px 26px 0;
  }
}

// ── popover 菜单 ──
.te-menu {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 4px;
  min-width: 180px;
  box-shadow: var(--shadow-md);

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    background: transparent;
    border: 0;
    border-radius: 5px;
    color: var(--text-primary);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: background .1s;

    &:hover {
      background: var(--bg-tertiary);
    }

    &.is-danger {
      color: #ff6b6b;
    }

    .te-menu__check {
      margin-left: auto;
      color: var(--primary-color);
    }
  }

  &__text {
    flex: 1;
  }

  &__group-label {
    font-size: 11px;
    color: var(--text-quaternary);
    padding: 6px 10px 2px;
  }

  &__sep {
    height: 1px;
    background: var(--border-color);
    margin: 4px 6px;
  }
}

.te-seg {
  display: flex;
  gap: 2px;
  padding: 2px 4px 4px;

  &__btn {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 6px 0;
    background: transparent;
    border: 0;
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background .1s, color .1s;
    width: 30px;

    &:hover {
      background: var(--bg-tertiary);
    }

    &.is-active {
      color: var(--primary-color);
      background: color-mix(in srgb, var(--primary-color) 15%, transparent);
    }
  }
}
</style>
