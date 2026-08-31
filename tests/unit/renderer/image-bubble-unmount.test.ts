import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, onBeforeUnmount, onMounted, shallowRef } from "vue";
import { createI18n } from "vue-i18n";
import { Editor, EditorContent } from "@tiptap/vue-3";
import { BubbleMenu } from "@tiptap/vue-3/menus";
import { NodeSelection } from "@tiptap/pm/state";
import { getExtensions } from "@/renderer/components/editor/extensions";
import zhCNMessages from "@/shared/i18n/locales/zhCN";
import type { BubbleMenuPluginProps } from "@tiptap/extension-bubble-menu";
import type { Extensions } from "@tiptap/core";

/**
 * 复现：Uncaught (in promise) TypeError: Cannot read properties of null (reading 'exposed')
 * at getComponentPublicInstance → setRef → unmount → patchKeyedChildren
 *
 * 模拟 TiptapEditor 真实结构：EditorContent + tiptap BubbleMenu(图片浮层) + v-if 兄弟节点。
 */

// ImageView（NodeView）通过 EditorContent 注入的 appContext 调用 useI18n，
// 宿主必须安装 i18n 插件，否则 ImageView setup 抛错（selectionUpdate 监听残留 → 后续事务崩溃）
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
function buildExtensions(): Extensions {
  // 用最小扩展集 + 图片扩展（不含 i18n/naive-ui 依赖重的部分）
  const exts = getExtensions();
  return exts;
}

function findImagePos(ed: Editor): number {
  let pos = -1;
  ed.state.doc.descendants((node, p) => {
    if (node.type.name === "image" && pos < 0) pos = p;
    return true;
  });
  return pos;
}

function makeHost(hostBox: { editor?: Editor }) {
  return defineComponent({
    props: {
      showSibling: { type: Boolean, default: true },
    },
    setup(props) {
      // shallowRef：ref 的 UnwrapRef 会深解包 Editor.contentComponent（Ref 类型），
      // 类型变形后不可赋回 Editor（tiptap useEditor 内部同样用 shallowRef）
      const editor = shallowRef<Editor | null>(null);
      onMounted(() => {
        editor.value = new Editor({
          element: document.createElement("div"),
          extensions: buildExtensions(),
          content:
            '<p>一段文字</p><img src="app://workspace/attachments/images/test.png" alt="t">',
        });
        hostBox.editor = editor.value;
      });
      onBeforeUnmount(() => {
        editor.value?.destroy();
        editor.value = null;
      });
      // 拆出显式类型的 props 变量：h() 字面量推断会与 BubbleMenu 的 PropType 泛型冲突（TS2769）
      const bubbleProps = (ed: Editor): InstanceType<typeof BubbleMenu>["$props"] => ({
        editor: ed,
        pluginKey: "imageBubbleMenu",
        updateDelay: 0,
        options: { placement: "top", offset: 8 },
        shouldShow: (p: NonNullable<BubbleMenuPluginProps["shouldShow"]> extends (x: infer A) => unknown ? A : never) =>
          p.editor.isActive("image"),
      });
      return () =>
        h("div", { class: "host-root" }, [
          editor.value ? h(EditorContent, { editor: editor.value }) : null,
          editor.value ? h(BubbleMenu, bubbleProps(editor.value)) : null,
          props.showSibling ? h("div", { class: "sib" }, "sibling") : null,
        ]);
    },
  });
}

describe("image bubble menu unmount regression", () => {
  let unhandled: unknown[];
  const onUnhandled = (e: unknown) => unhandled.push(e);

  beforeEach(() => {
    unhandled = [];
    process.on("unhandledRejection", onUnhandled);
    window.addEventListener("unhandledrejection", onUnhandled as EventListener);
  });

  afterEach(() => {
    process.off("unhandledRejection", onUnhandled);
    window.removeEventListener("unhandledrejection", onUnhandled as EventListener);
  });

  it("选中图片 → 显示浮层 → 卸载组件，不抛 exposed 错误", async () => {
    const box: { editor?: Editor } = {};
    const Host = makeHost(box);
    const wrapper = mount(Host, {
      global: { plugins: [i18n] },
    });
    await flushPromises();
    await flushPromises(); // 等待 BubbleMenu onMounted 的 nextTick registerPlugin

    const ed = box.editor!;
    expect(ed).toBeTruthy();

    // 选中图片 → 触发 bubble show（root div 被 append 到 view.dom.parentElement）
    const pos = findImagePos(ed);
    expect(pos).toBeGreaterThanOrEqual(0);
    ed.commands.command(({ tr }) => {
      tr.setSelection(NodeSelection.create(ed.state.doc, pos));
      return true;
    });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 20)); // updateDelay=0 的 debounce

    // 更新属性（缩放）
    ed.commands.updateAttributes("image", { width: 300 });
    await flushPromises();

    // 删除图片（触发 NodeView destroy）
    ed.commands.command(({ tr }) => {
      const { from, to } = ed.state.selection;
      tr.delete(from, to);
      return true;
    });
    await flushPromises();

    // 卸载整个组件树
    wrapper.unmount();
    await flushPromises();
    await new Promise((r) => setTimeout(r, 20));

    const msgs = unhandled.map((e) => String((e as Error)?.message ?? e));
    const exposed = msgs.filter((m) => m.includes("exposed"));
    expect(exposed).toEqual([]);
    expect(wrapper.element).toBeTruthy();
  });

  it("选中图片 → 显示浮层 → 兄弟 v-if 翻转（keyed diff）→ 卸载", async () => {
    const box: { editor?: Editor } = {};
    const Host = makeHost(box);
    const wrapper = mount(Host, {
      props: { showSibling: true },
      global: { plugins: [i18n] },
    });
    await flushPromises();
    await flushPromises();

    const ed = box.editor!;
    const pos = findImagePos(ed);
    ed.commands.command(({ tr }) => {
      tr.setSelection(NodeSelection.create(ed.state.doc, pos));
      return true;
    });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 20));

    // bubble 已显示（root div 物理位于 EditorContent 的容器内）
    // 翻转兄弟 v-if → host re-render → children keyed diff
    await wrapper.setProps({ showSibling: false });
    await flushPromises();
    await wrapper.setProps({ showSibling: true });
    await flushPromises();

    wrapper.unmount();
    await flushPromises();
    await new Promise((r) => setTimeout(r, 20));

    const msgs = unhandled.map((e) => String((e as Error)?.message ?? e));
    const exposed = msgs.filter((m) => m.includes("exposed"));
    expect(exposed).toEqual([]);
  });
});
