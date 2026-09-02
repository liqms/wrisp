import { describe, it, expect, afterEach } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { defineComponent, h } from "vue";
import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/vue-3";
import { EditorContent, useEditor } from "@tiptap/vue-3";
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

const Host = defineComponent({
  name: "CodeBlockUnmountHost",
  components: { EditorContent },
  setup() {
    const editor = useEditor({
      content: '<pre><code class="language-javascript">const a = 1;</code></pre>',
      extensions: [StarterKit.configure({ codeBlock: false }), createCodeBlockLowlight()],
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

function findCodeBlockPos(editor: Editor): number {
  let pos = -1;
  editor.state.doc.descendants((node, p) => {
    if (pos < 0 && node.type.name === "codeBlock") pos = p;
    return true;
  });
  return pos;
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = "";
});

describe("代码块 NodeView 卸载回归（reading 'exposed'）", () => {
  it("菜单展开 + 属性更新 + 选中后删除节点，卸载不抛 exposed 错误", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => unhandled.push(e);
    process.on("unhandledRejection", onUnhandled);
    process.on("uncaughtException", onUnhandled);

    try {
      wrapper = mount(Host, { global: { plugins: [i18n, naive, createPinia()] } });
      await flushPromises();

      const editor = getEditor();

      // 1. 打开语言下拉菜单（NSelect 菜单 teleport 到 body）
      const trigger = wrapper.find(".code-block-lang .n-base-selection");
      await trigger.trigger("mousedown");
      await trigger.trigger("click");
      await flushPromises();
      expect(document.querySelector(".n-base-select-menu")).toBeTruthy();

      // 2. 选中代码块（selectNode → updateProps(selected) → renderComponent re-render）
      const pos = findCodeBlockPos(editor);
      editor.commands.command(({ tr }) => {
        tr.setSelection(NodeSelection.create(editor.state.doc, pos));
        return true;
      });
      await flushPromises();

      // 3. 更新语言属性（node changed → rerenderComponent）
      editor.commands.updateAttributes("codeBlock", { language: "python" });
      await flushPromises();
      await new Promise((r) => setTimeout(r, 30));

      // 4. 菜单展开状态下删除代码块（NodeView destroy → render(null) → NSelect + Teleport 卸载）
      editor.commands.command(({ tr }) => {
        const { from, to } = editor.state.selection;
        tr.delete(from, to);
        return true;
      });
      await flushPromises();
      await new Promise((r) => setTimeout(r, 30));

      // 5. 卸载整树
      wrapper.unmount();
      wrapper = null;
      await flushPromises();
      await new Promise((r) => setTimeout(r, 30));

      const msgs = unhandled.map((e) => String((e as Error)?.message ?? e));
      const exposed = msgs.filter((m) => m.includes("exposed"));
      expect(exposed).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
      process.off("uncaughtException", onUnhandled);
    }
  });

  it("取消选中 + 连续属性更新 + 整树卸载，不抛 exposed 错误", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => unhandled.push(e);
    process.on("unhandledRejection", onUnhandled);
    process.on("uncaughtException", onUnhandled);

    try {
      wrapper = mount(Host, { global: { plugins: [i18n, naive, createPinia()] } });
      await flushPromises();

      const editor = getEditor();
      const pos = findCodeBlockPos(editor);

      // 选中 → 取消选中 → 再选中（selectNode/deselectNode 交替触发 updateProps re-render）
      for (let round = 0; round < 3; round += 1) {
        editor.commands.command(({ tr }) => {
          tr.setSelection(NodeSelection.create(editor.state.doc, pos));
          return true;
        });
        await flushPromises();
        editor.commands.setTextSelection(0);
        await flushPromises();
        editor.commands.updateAttributes("codeBlock", { language: "typescript" });
        await flushPromises();
      }

      wrapper.unmount();
      wrapper = null;
      await flushPromises();
      await new Promise((r) => setTimeout(r, 30));

      const msgs = unhandled.map((e) => String((e as Error)?.message ?? e));
      const exposed = msgs.filter((m) => m.includes("exposed"));
      expect(exposed).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
      process.off("uncaughtException", onUnhandled);
    }
  });
});
