import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { defineComponent, h, ref } from "vue";
import { Editor } from "@tiptap/vue-3";
import { NodeSelection } from "@tiptap/pm/state";
import { naive } from "@/renderer/plugins/naive-ui";
import TiptapEditor from "@/renderer/components/editor/TiptapEditor.vue";
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
 * 复现：Uncaught (in promise) TypeError: Cannot read properties of null (reading 'exposed')
 *
 * 模拟 PageView 的真实结构：带 :key 的组件切换（页面 A → 页面 B），
 * 其中 TiptapEditor 内含 n-flex + BubbleMenu + ImageBubbleMenu + SlashMenu + ContextMenu。
 */
const PageHost = defineComponent({
  name: "PageHost",
  components: { TiptapEditor },
  props: {
    pageKey: { type: String, required: true },
    loading: { type: Boolean, default: false },
  },
  setup(props) {
    const editorRef = ref<unknown>(null);
    return () =>
      h("div", { class: "editor-wrap" }, [
        props.loading
          ? h("div", { class: "spin" }, "loading")
          : h(TiptapEditor, {
            key: props.pageKey,
            ref: editorRef,
            modelValue: `# page ${props.pageKey}\n\n<p>文字</p><img src="app://workspace/attachments/images/t.png" alt="">`,
            slashCommand: false,
            enableBubbleMenu: true,
            minHeight: 100,
            maxHeight: 400,
          }),
      ]);
  },
});

function findImagePos(ed: Editor): number {
  let pos = -1;
  ed.state.doc.descendants((node, p) => {
    if (node.type.name === "image" && pos < 0) pos = p;
    return true;
  });
  return pos;
}

function getEditor(wrapper: VueWrapper): Editor | null {
  const comp = wrapper.findComponent(TiptapEditor);
  if (!comp.exists()) return null;
  const ss = (comp.vm.$ as unknown as { setupState?: Record<string, unknown> }).setupState;
  const ed = ss?.editor as Editor | undefined;
  return ed ?? null;
}

describe("TiptapEditor 页面切换卸载回归（reading 'exposed'）", () => {
  let unhandled: unknown[];
  const onUnhandled = (e: unknown) => unhandled.push(e);
  let wrapper: VueWrapper | null = null;

  beforeEach(() => {
    unhandled = [];
    process.on("unhandledRejection", onUnhandled);
    window.addEventListener("unhandledrejection", onUnhandled as EventListener);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    process.off("unhandledRejection", onUnhandled);
    window.removeEventListener("unhandledrejection", onUnhandled as EventListener);
    document.body.innerHTML = "";
  });

  it("选中图片后切换页面 key，不抛 exposed 错误", async () => {
    wrapper = mount(PageHost, {
      props: { pageKey: "page-a", loading: false },
      global: { plugins: [i18n, naive, createPinia()] },
    });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 30)); // 等 modelValue watch 异步设内容

    const ed = getEditor(wrapper);
    expect(ed).toBeTruthy();

    // 选中图片 → image bubble show
    const pos = findImagePos(ed!);
    expect(pos).toBeGreaterThanOrEqual(0);
    ed!.commands.command(({ tr }) => {
      tr.setSelection(NodeSelection.create(ed!.state.doc, pos));
      return true;
    });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 60)); // bubble updateDelay + debounce

    // 切换页面（key A→B）：unmount 旧 TiptapEditor + mount 新的
    await wrapper.setProps({ pageKey: "page-b" });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 60));

    // 再切回 A
    await wrapper.setProps({ pageKey: "page-a" });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 60));

    const msgs = unhandled.map((e) => String((e as Error)?.message ?? e));
    const exposed = msgs.filter((m) => m.includes("exposed"));
    expect(exposed).toEqual([]);
    expect(msgs).toEqual([]);
  });

  it("loading 翻转 + 页面 key 切换组合（v-if 链 keyed diff）", async () => {
    wrapper = mount(PageHost, {
      props: { pageKey: "page-a", loading: true },
      global: { plugins: [i18n, naive, createPinia()] },
    });
    await flushPromises();

    await wrapper.setProps({ loading: false });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 30));

    const ed = getEditor(wrapper);
    expect(ed).toBeTruthy();
    const pos = findImagePos(ed!);
    ed!.commands.command(({ tr }) => {
      tr.setSelection(NodeSelection.create(ed!.state.doc, pos));
      return true;
    });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 60));

    // 切页 + loading（模拟 FileTree 切换页面时的 loading→loaded 序列）
    await wrapper.setProps({ pageKey: "page-b", loading: true });
    await flushPromises();
    await wrapper.setProps({ loading: false });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 60));

    const msgs = unhandled.map((e) => String((e as Error)?.message ?? e));
    expect(msgs.filter((m) => m.includes("exposed"))).toEqual([]);
  });
});
