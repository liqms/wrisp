import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { defineComponent, h } from "vue";
import { Editor, EditorContent, useEditor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import { NMessageProvider } from "naive-ui";
import { naive } from "@/renderer/plugins/naive-ui";
import { createCodeBlockLowlight } from "@/renderer/components/editor/features/code-block/code-block-extension";
import zhCNMessages from "@/shared/i18n/locales/zhCN";

const i18n = createI18n({
  legacy: false,
  locale: "zhCN",
  fallbackLocale: "zhCN",
  messages: { zhCN: zhCNMessages },
  globalInjection: true,
  allowComposition: true,
  missingWarn: false,
  fallbackWarn: false,
});

const writeText = vi.fn().mockResolvedValue(undefined);

/**
 * 宿主组件：挂载 EditorContent 以启用 Vue NodeView 上下文。
 * NodeView 组件经 editor.appContext.provides 继承宿主组件链的 provide，
 * 故需在 EditorContent 祖先层包 NMessageProvider（与 App.vue 结构一致）。
 */
const Host = defineComponent({
  name: "CodeBlockHost",
  components: { EditorContent },
  setup() {
    const editor = useEditor({
      content:
        '<pre><code class="language-javascript">const a = 1;</code></pre>',
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        createCodeBlockLowlight(),
      ],
    });
    return { editor };
  },
  render() {
    return h(NMessageProvider, () =>
      h(EditorContent, {
        editor: (this as unknown as { editor?: Editor }).editor ?? undefined,
      }),
    );
  },
});

let wrapper: VueWrapper | null = null;

function getEditor(): Editor {
  return (wrapper!.vm as unknown as { editor: Editor }).editor;
}

/**
 * 取 CodeBlockView 的 setupState。
 * NodeView 经 VueRenderer 挂载在独立 Vue 实例上：
 * toolbar 的 __vueParentComponent 是 NodeViewWrapper，其 parent 才是
 * CodeBlockView。setupState 经 proxyRefs 包装，ref 读写自动解包。
 */
function getViewSetupState(root: HTMLElement): {
  menuVisible: boolean;
  onLanguageChange: (value: string | null) => void;
} {
  const toolbar = root.querySelector(".code-block-toolbar") as unknown as {
    __vueParentComponent: {
      parent: {
        setupState: {
          menuVisible: boolean;
          onLanguageChange: (value: string | null) => void;
        };
      };
    };
  };
  return toolbar.__vueParentComponent.parent.setupState;
}

function setupClipboard(): void {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  writeText.mockClear();
  document.body.innerHTML = "";
});

describe("代码块扩展（CodeBlockLowlight + 悬浮工具栏）", () => {
  it("渲染节点视图工具栏并显示当前语言", async () => {
    setupClipboard();
    wrapper = mount(Host, { global: { plugins: [i18n, naive, createPinia()] } });
    await flushPromises();

    const toolbar = wrapper.find(".code-block-toolbar");
    expect(toolbar.exists()).toBe(true);
    // 语言下拉 + 复制按钮均渲染
    expect(wrapper.find(".code-block-lang").exists()).toBe(true);
    expect(wrapper.find(".code-block-copy").exists()).toBe(true);
    // 触发器显示当前语言
    expect(wrapper.text()).toContain("javascript");
  });

  it("lowlight 装饰器对代码内容做语法高亮", async () => {
    setupClipboard();
    wrapper = mount(Host, { global: { plugins: [i18n, naive, createPinia()] } });
    await flushPromises();

    const editor = getEditor();
    const keyword = editor.view.dom.querySelector(".hljs-keyword");
    expect(keyword?.textContent).toBe("const");
  });

  it("下拉展开态驱动 show-toolbar 类（菜单 teleport 在 body 时保持工具栏显示）", async () => {
    setupClipboard();
    wrapper = mount(Host, { global: { plugins: [i18n, naive, createPinia()] } });
    await flushPromises();

    // 悬浮显隐由 CSS :hover 实现（浏览器原生），此处验证受控通道：
    // NSelect update:show → menuVisible → .show-toolbar 类
    const viewState = getViewSetupState(wrapper.element);
    expect(wrapper.find(".code-block-wrap").classes()).not.toContain(
      "show-toolbar",
    );
    viewState.menuVisible = true;
    await flushPromises();
    expect(wrapper.find(".code-block-wrap").classes()).toContain(
      "show-toolbar",
    );
    viewState.menuVisible = false;
    await flushPromises();
    expect(wrapper.find(".code-block-wrap").classes()).not.toContain(
      "show-toolbar",
    );
  });

  it("下拉展开后输入框聚焦不触发 PM selection 抢夺（闪关回归）", async () => {
    setupClipboard();
    wrapper = mount(Host, { global: { plugins: [i18n, naive, createPinia()] } });
    await flushPromises();

    // 真实浏览器点击序列：mousedown（组件上 .stop）→ click（NSelect 开菜单）
    const trigger = wrapper.find(".code-block-lang .n-base-selection");
    await trigger.trigger("mousedown");
    await trigger.trigger("click");
    await flushPromises();

    const state = getViewSetupState(wrapper.element);
    expect(state.menuVisible).toBe(true);
    expect(document.querySelector(".n-base-select-menu")).toBeTruthy();

    // 模拟真实 Chromium 的 input.focus() 副作用：
    // 编辑器根持有焦点（input 在 view.dom 内 → hasFocusAndSelection 通过），
    // DOM selection 落入 filterable 输入框 → 触发 document selectionchange。
    // 修复前：PM 会 dispatch setSelection 并经 selectionToDOM 写回 DOM
    // selection（removeAllRanges），导致输入框失焦 → NSelect closeMenu 闪关。
    const editor = getEditor();
    const txs: string[] = [];
    editor.on("transaction", ({ transaction }) => {
      txs.push(`doc:${transaction.docChanged} sel:${transaction.selectionSet}`);
    });
    const input = wrapper.element.querySelector(
      ".code-block-lang input",
    ) as HTMLInputElement;
    editor.view.dom.focus();
    const sel = document.getSelection();
    if (!sel) throw new Error("document.getSelection() returned null");
    sel.removeAllRanges();
    const range = document.createRange();
    range.setStart(input, 0);
    range.setEnd(input, 0);
    sel.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    await flushPromises();
    await new Promise((r) => setTimeout(r, 250));

    // PM 不得因工具栏内 selection 产生任何事务
    expect(txs).toEqual([]);
    // 菜单保持展开
    expect(state.menuVisible).toBe(true);
    expect(document.querySelector(".n-base-select-menu")).toBeTruthy();
  });

  it("语言选择更新节点 language 属性并反映到 HTML", async () => {
    setupClipboard();
    wrapper = mount(Host, { global: { plugins: [i18n, naive, createPinia()] } });
    await flushPromises();

    const editor = getEditor();
    // 直接调用语言切换逻辑（等价于 NSelect 的 update:value 回调）
    getViewSetupState(wrapper.element).onLanguageChange("python");
    await flushPromises();

    expect(editor.getHTML()).toContain("language-python");
    // 语言下拉触发器同步显示新语言
    expect(wrapper.text()).toContain("python");
  });

  it("复制按钮调用剪贴板并弹出 message 提示", async () => {
    setupClipboard();
    wrapper = mount(Host, { global: { plugins: [i18n, naive, createPinia()] } });
    await flushPromises();

    await wrapper.find(".code-block-copy").trigger("click");
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith("const a = 1;");
    // message 经 teleport 渲染到 body
    expect(document.body.textContent).toContain("已复制");
  });
});
