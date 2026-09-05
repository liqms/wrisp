import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { Suggestion } from "@tiptap/suggestion";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import type { ApiResponse, Character, Tag } from "@/shared/types";
import { t } from "@/renderer/plugins/i18n";

/** 建议列表项：id 用于去重标识，label 用于展示与插入 */
export interface SuggestItem {
  id: string;
  label: string;
}

/** 下拉渲染器内部状态 */
interface MenuState {
  menu: HTMLDivElement | null;
  items: SuggestItem[];
  selected: number;
  clientRect: (() => DOMRect | null) | null;
  command: ((item: SuggestItem) => void) | null;
}

/**
 * 搜索人物表（@ 触发）：query 为空时不搜索、不显示下拉
 */
export async function loadCharacterItems(
  query: string,
): Promise<SuggestItem[]> {
  if (!query) return [];
  try {
    const response = (await window.electronAPI.character.findCharacters(query, {
      limit: 8,
    })) as ApiResponse<Character[]>;
    const data = response.success ? response.data : null;
    // ApiResponse 联合含 ListResponse<T[]>，代入 T=Character[] 后 data 类型为
    // Character[] | Character[][]；实际返回恒为 Character[]，此处断言收窄。
    const list = (Array.isArray(data) ? data : []) as Character[];
    return list.map((c) => ({ id: c.id, label: c.name }));
  } catch {
    return [];
  }
}

/**
 * 搜索标签表（# 触发）：query 为空时不搜索、不显示下拉
 */
export async function loadTagItems(query: string): Promise<SuggestItem[]> {
  if (!query) return [];
  try {
    const response = (await window.electronAPI.tag.findTags(query, {
      limit: 8,
    })) as ApiResponse<Tag[]>;
    const data = response.success ? response.data : null;
    const list = (Array.isArray(data) ? data : []) as Tag[];
    return list.map((tag) => ({ id: tag.id, label: tag.name }));
  } catch {
    return [];
  }
}

/** 空查询且无结果时不显示下拉；有查询词时显示空态提示 */
function shouldShowMenu(props: SuggestionProps<SuggestItem>): boolean {
  return props.items.length > 0 || props.query.trim().length > 0;
}

/**
 * 下拉视觉样式全部走 global.scss 的 .inline-sem-suggest-* 类，
 * 颜色引用主题 CSS 变量（:root / html[data-theme="dark"]），亮暗色自动切换。
 * 此处仅保留动态定位（top/left）为内联样式。
 */

/** suggestion render 契约的渲染器对象类型（render 值是「返回该对象的工厂函数」） */
type SuggestRenderer = NonNullable<
  ReturnType<NonNullable<SuggestionOptions<SuggestItem>["render"]>>
>;

function createSuggestionRender(iconChar: string): SuggestRenderer {
  const state: MenuState = {
    menu: null,
    items: [],
    selected: 0,
    clientRect: null,
    command: null,
  };

  const destroyMenu = (): void => {
    state.menu?.remove();
    state.menu = null;
    state.items = [];
    state.selected = 0;
    state.clientRect = null;
    state.command = null;
  };

  const renderItems = (): void => {
    const menu = state.menu;
    if (!menu) return;
    menu.innerHTML = "";

    if (state.items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "inline-sem-suggest-empty";
      empty.textContent = t("EDITOR.INLINE_SEMANTIC.NO_MATCH");
      menu.appendChild(empty);
      return;
    }

    state.items.forEach((item, index) => {
      const itemEl = document.createElement("div");
      itemEl.className =
        index === state.selected
          ? "inline-sem-suggest-item active"
          : "inline-sem-suggest-item";

      const icon = document.createElement("span");
      icon.className = "inline-sem-suggest-icon";
      icon.textContent = iconChar;
      const label = document.createElement("span");
      label.textContent = item.label;

      itemEl.appendChild(icon);
      itemEl.appendChild(label);
      itemEl.addEventListener("mousedown", (event) => {
        event.preventDefault();
        state.command?.(item);
      });
      itemEl.addEventListener("mouseenter", () => {
        state.selected = index;
        renderItems();
      });

      menu.appendChild(itemEl);
    });
  };

  const position = (): void => {
    const rect = state.clientRect?.();
    if (!rect || !state.menu) return;
    Object.assign(state.menu.style, {
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
    } satisfies Partial<CSSStyleDeclaration>);
  };

  const sync = (props: SuggestionProps<SuggestItem>): void => {
    if (!shouldShowMenu(props)) {
      destroyMenu();
      return;
    }
    if (!state.menu) {
      const menu = document.createElement("div");
      menu.className = "inline-sem-suggest-menu";
      document.body.appendChild(menu);
      state.menu = menu;
    }
    state.items = props.items;
    state.selected = 0;
    state.clientRect = props.clientRect ?? null;
    state.command = props.command;
    renderItems();
    position();
  };

  return {
    onStart: sync,
    onUpdate: sync,
    onKeyDown: ({ event }) => {
      if (!state.menu) return false;
      if (event.key === "ArrowUp") {
        state.selected =
          (state.selected - 1 + state.items.length) % state.items.length;
        renderItems();
        return true;
      }
      if (event.key === "ArrowDown") {
        state.selected = (state.selected + 1) % state.items.length;
        renderItems();
        return true;
      }
      if (event.key === "Enter") {
        const item = state.items[state.selected];
        if (item) state.command?.(item);
        return true;
      }
      if (event.key === "Escape") {
        destroyMenu();
        return true;
      }
      return false;
    },
    onExit: destroyMenu,
  };
}

/** 选中后插入纯文本（与手动输入行为完全一致），后缀空格便于连续书写 */
function insertPlainText(
  editor: SuggestionProps<SuggestItem>["editor"],
  range: { from: number; to: number },
  char: string,
  label: string,
): void {
  editor
    .chain()
    .focus()
    .insertContentAt(range, [{ type: "text", text: `${char}${label} ` }])
    .run();
}

/**
 * 行内语义建议扩展：@ 搜索人物表、# 搜索标签表，选中插入纯文本。
 * tiptap v3 的 Suggestion 工厂支持在单个 Extension 中挂多个建议插件。
 */
export function createInlineSemanticSuggestExtension() {
  return Extension.create({
    name: "inlineSemanticSuggest",
    addProseMirrorPlugins() {
      const editor = this.editor;

      const atOptions: SuggestionOptions<SuggestItem> = {
        editor,
        char: "@",
        pluginKey: new PluginKey("inlineSemanticAt"),
        items: ({ query }) => loadCharacterItems(query),
        render: () => createSuggestionRender("@"),
        command: ({ editor: ed, range, props }) => {
          insertPlainText(ed, range, "@", props.label);
        },
      };

      const hashOptions: SuggestionOptions<SuggestItem> = {
        editor,
        char: "#",
        pluginKey: new PluginKey("inlineSemanticHash"),
        items: ({ query }) => loadTagItems(query),
        render: () => createSuggestionRender("#"),
        command: ({ editor: ed, range, props }) => {
          insertPlainText(ed, range, "#", props.label);
        },
      };

      return [Suggestion(atOptions), Suggestion(hashOptions)];
    },
  });
}
