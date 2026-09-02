import { Mention } from "@tiptap/extension-mention";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import type { ApiResponse } from "@/shared/types/api.types";
import type { PaginationResult } from "@/shared/utils/pagination";
import type { PageInfo } from "@/shared/types/page.types";

/** 提及候选项（对应页面） */
export interface MentionItem {
  id: string;
  label: string;
}

/** 页面列表缓存：首次触发 @ 时拉取一次，避免每次输入都走 IPC */
let cachedItems: MentionItem[] | null = null;

async function loadMentionItems(): Promise<MentionItem[]> {
  if (cachedItems) return cachedItems;
  let items: MentionItem[];
  try {
    const response = (await window.electronAPI.page.paginate({
      page: 1,
      pageSize: 50,
    })) as ApiResponse<PaginationResult<PageInfo>>;
    const payload = response.success && response.data ? response.data : null;
    const list = Array.isArray(payload) ? payload[0] : payload;
    items = (list?.data ?? []).map((p: PageInfo) => ({ id: p.id, label: p.title }));
  } catch {
    items = [];
  }
  cachedItems = items;
  return items;
}

/** 重置提及候选缓存（页面新建/改名后可调用以刷新） */
export function resetMentionCache(): void {
  cachedItems = null;
}

/**
 * 用纯 DOM 渲染 @ 建议列表（不为浮层引入 Vue 挂载）。
 * 样式全部内联，自包含、不污染全局样式表。
 * 注意：render 契约是「返回渲染器的工厂函数」，每次激活时调用一次。
 */
type MentionRenderer = NonNullable<
  ReturnType<NonNullable<SuggestionOptions<MentionItem>["render"]>>
>;
/** Mention 的 suggestion 配置类型（editor 由扩展运行时注入） */
type MentionSuggestion = Omit<SuggestionOptions<MentionItem>, "editor">;

function createSuggestionRender(): MentionRenderer {
  const menuState = {
    menu: null as HTMLDivElement | null,
    items: [] as MentionItem[],
    selected: 0,
    clientRect: null as (() => DOMRect | null) | null,
    command: null as ((item: MentionItem) => void) | null,
  };

  function applyStyles(el: HTMLDivElement): void {
    el.style.cssText = `
      position: fixed; z-index: 10000; min-width: 200px; max-width: 280px;
      background: var(--bg-primary, #fff); border: 1px solid var(--border-color, #ddd);
      border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.2);
      padding: 4px; max-height: 240px; overflow-y: auto;`;
  }

  function rowStyles(el: HTMLDivElement, active: boolean): void {
    el.style.cssText = `
      display: flex; align-items: center; gap: 8px; padding: 6px 8px;
      border-radius: 4px; cursor: pointer; font-size: 13px;
      color: ${active ? "var(--primary-color, #18a058)" : "var(--text-color, #333)"};
      background: ${active ? "var(--bg-hover, rgba(0,0,0,.06))" : "transparent"};`;
  }

  function iconStyles(el: HTMLSpanElement): void {
    el.style.cssText = `
      width: 20px; height: 20px; flex-shrink: 0; border-radius: 4px;
      background: var(--bg-secondary, #f2f2f2); color: var(--text-color, #666);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 600;`;
  }

  function selectItem(index: number): void {
    const item = menuState.items[index];
    if (item) menuState.command?.(item);
  }

  function renderItems(): void {
    const { menu } = menuState;
    if (!menu) return;
    menu.innerHTML = "";
    if (menuState.items.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "无匹配页面";
      empty.style.cssText = "padding: 10px 8px; font-size: 12px; color: var(--text-third, #999);";
      menu.appendChild(empty);
      return;
    }
    menuState.items.forEach((item, i) => {
      const row = document.createElement("div");
      rowStyles(row, i === menuState.selected);
      row.addEventListener("mouseenter", () => {
        menuState.selected = i;
        renderItems();
      });
      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectItem(i);
      });
      const icon = document.createElement("span");
      iconStyles(icon);
      icon.textContent = "@";
      const label = document.createElement("span");
      label.textContent = item.label;
      row.appendChild(icon);
      row.appendChild(label);
      menu.appendChild(row);
    });
  }

  function position(): void {
    const { menu, clientRect } = menuState;
    if (!menu || !clientRect) return;
    const rect = clientRect();
    if (!rect) return;
    const below = rect.bottom + 4;
    const height = menu.offsetHeight || 120;
    const spaceBelow = window.innerHeight - below;
    if (spaceBelow < height && rect.top > height) {
      menu.style.top = `${rect.top - height - 4}px`;
    } else {
      menu.style.top = `${below}px`;
    }
    menu.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - 292))}px`;
  }

  function syncProps(props: SuggestionProps<MentionItem>): void {
    menuState.items = props.items;
    menuState.selected = 0;
    menuState.clientRect = props.clientRect ?? null;
    menuState.command = props.command;
  }

  return {
    onStart: (props) => {
      const menu = document.createElement("div");
      applyStyles(menu);
      menuState.menu = menu;
      syncProps(props);
      renderItems();
      document.body.appendChild(menu);
      position();
    },
    onUpdate: (props) => {
      syncProps(props);
      renderItems();
      position();
    },
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        menuState.selected = (menuState.selected + 1) % Math.max(menuState.items.length, 1);
        renderItems();
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        const n = Math.max(menuState.items.length, 1);
        menuState.selected = (menuState.selected - 1 + n) % n;
        renderItems();
        return true;
      }
      if (event.key === "Enter" && menuState.items.length > 0) {
        event.preventDefault();
        selectItem(menuState.selected);
        return true;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        return true;
      }
      return false;
    },
    onExit: () => {
      menuState.menu?.remove();
      menuState.menu = null;
      menuState.command = null;
      menuState.clientRect = null;
      menuState.items = [];
    },
  };
}

/**
 * 创建配置好的 Mention 扩展（@ 触发，候选 = 页面列表）。
 */
export function createMentionExtension() {
  const suggestion: MentionSuggestion = {
    char: "@",
    items: async ({ query }) => {
      const items = await loadMentionItems();
      const q = query.toLowerCase();
      return items.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 8);
    },
    render: createSuggestionRender,
    command: ({ editor, range, props }) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: "mention",
            attrs: { id: props.id, label: props.label, mentionSuggestionChar: "@" },
          },
          { type: "text", text: " " },
        ])
        .run();
    },
  };

  return Mention.configure({
    HTMLAttributes: {
      class: "mention-node",
    },
    suggestion,
  });
}
