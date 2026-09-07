import { describe, it, expect, afterEach } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { defineComponent, h } from "vue";
import { Editor, EditorContent, useEditor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import { NMessageProvider } from "naive-ui";
import { naive } from "@/renderer/plugins/naive-ui";
import { Admonition } from "@/renderer/components/editor/features/admonition/admonition-extension";
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

/**
 * 宿主组件：挂载 EditorContent 以启用 Vue NodeView 上下文
 * （NodeView 经 editor.appContext 继承宿主组件链的 provide/组件注册）。
 */
const Host = defineComponent({
  name: "AdmonitionHost",
  components: { EditorContent },
  setup() {
    const editor = useEditor({
      content: '<div data-admonition="" data-type="note"><p>提示内容</p></div>',
      extensions: [StarterKit.configure({ codeBlock: false }), Admonition],
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
 * 取 AdmonitionView 的 setupState。
 * NodeView 经 VueRenderer 挂载在独立 Vue 实例上：
 * 标题行的 __vueParentComponent 是 NodeViewWrapper，其 parent 才是 AdmonitionView
 * （同 code-block-view.test.ts 的工具栏取用方式）。
 */
function getViewSetupState(root: HTMLElement): {
  onSelectType: (key: string | number) => void;
} {
  const title = root.querySelector(".admonition-title") as unknown as {
    __vueParentComponent: {
      parent: {
        setupState: {
          onSelectType: (key: string | number) => void;
        };
      };
    };
  };
  return title.__vueParentComponent.parent.setupState;
}

/** 收集文档中 admonition 节点 */
function collectAdmonitions(editor: Editor) {
  const nodes: { attrs: Record<string, unknown> }[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "admonition") nodes.push(node);
    return true;
  });
  return nodes;
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = "";
});

describe("提示块 NodeView（可点击标题切换类型）", () => {
  it("编辑态渲染标题行触发器与内容区，容器 data-type 联动", async () => {
    wrapper = mount(Host, { global: { plugins: [i18n, naive, createPinia()] } });
    await flushPromises();

    expect(wrapper.find(".admonition-title").exists()).toBe(true);
    expect(wrapper.find(".admonition-title__trigger").exists()).toBe(true);
    // 标题显示当前类型文案（note → 笔记）
    expect(wrapper.text()).toContain("笔记");
    // 容器携带类型标识（供 CSS 色调映射）
    expect(wrapper.find(".admonition-edit").attributes("data-type")).toBe("note");
    // 内容渲染在 contentDOM 包裹层内
    expect(wrapper.find(".admonition-content p").text()).toContain("提示内容");
  });

  it("onSelectType 切换类型：节点属性与标题文案联动更新", async () => {
    wrapper = mount(Host, { global: { plugins: [i18n, naive, createPinia()] } });
    await flushPromises();

    getViewSetupState(wrapper.element).onSelectType("warning");
    await flushPromises();

    // 节点 attrs 更新
    const admonitions = collectAdmonitions(getEditor());
    expect(admonitions).toHaveLength(1);
    expect(admonitions[0]?.attrs.type).toBe("warning");
    // DOM：容器 data-type 与标题文案随之切换
    expect(wrapper.find(".admonition-edit").attributes("data-type")).toBe("warning");
    expect(wrapper.text()).toContain("警告");
  });

  it("标题行是纯编辑态 UI：getHTML 不包含标题元素", async () => {
    wrapper = mount(Host, { global: { plugins: [i18n, naive, createPinia()] } });
    await flushPromises();

    const html = getEditor().getHTML();
    expect(html).toContain('data-admonition=""');
    expect(html).toContain('data-type="note"');
    // 标题行/包裹层不进入序列化（阅读态由 ::before 渲染标题）
    expect(html).not.toContain("admonition-title");
    expect(html).not.toContain("admonition-content");
  });
});
