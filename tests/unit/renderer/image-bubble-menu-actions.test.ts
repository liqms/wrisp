import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { defineComponent, h, ref } from "vue";
import { Editor } from "@tiptap/vue-3";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { NImage } from "naive-ui";
import { naive } from "@/renderer/plugins/naive-ui";
import TiptapEditor from "@/renderer/components/editor/TiptapEditor.vue";
import ImageBubbleMenu from "@/renderer/components/editor/features/image/ImageBubbleMenu.vue";
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
 * 图片浮层 / NodeView 行为回归：
 * 1. "查看原图"按钮调起 Naive UI NImage 预览
 * 2. 悬浮图片不显示浮层，选中图片后才显示
 * 3. 拖动左右手柄调整宽度，松手后写入 width 属性
 * 4. "添加图片描述"写入 alt 属性并持久化到文档
 */
const EditorHost = defineComponent({
  name: "EditorHost",
  components: { TiptapEditor },
  setup() {
    const editorRef = ref<unknown>(null);
    return () =>
      h("div", { class: "editor-wrap" }, [
        h(TiptapEditor, {
          ref: editorRef,
          modelValue:
            '<p>一段文字</p><img src="app://workspace/attachments/images/t.png" alt="">',
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

/**
 * happy-dom 中 bubble 菜单的 DOM 不挂载在可查询树内（floating 定位依赖布局引擎），
 * 因此直接调用 ImageBubbleMenu 的 setupState 方法验证行为（与按钮 @click 同一入口）。
 * ImageView（NodeView）的交互则通过 wrapper 内真实 DOM 事件驱动验证。
 */
function getBubbleState(wrapper: VueWrapper): Record<string, unknown> {
  const comp = wrapper.findComponent(ImageBubbleMenu);
  if (!comp.exists()) throw new Error("ImageBubbleMenu not mounted");
  return (comp.vm.$ as unknown as { setupState?: Record<string, unknown> }).setupState ?? {};
}

function getImageAttrs(ed: Editor): Record<string, unknown> {
  let attrs: Record<string, unknown> | null = null;
  ed.state.doc.descendants((node) => {
    if (node.type.name === "image" && !attrs) attrs = node.attrs as Record<string, unknown>;
    return true;
  });
  return attrs ?? {};
}

function getImageEl(ed: Editor): HTMLImageElement {
  const pos = findImagePos(ed);
  const dom = ed.view.nodeDOM(pos) as Element | null;
  const img = dom?.querySelector("img") ?? null;
  if (!img) throw new Error("image node DOM not found");
  return img;
}

/** mock 选中图片的 <img>：naturalWidth / clientWidth（happy-dom 无布局引擎，默认均为 0） */
function mockImageMetrics(ed: Editor, natural: number, client: number): void {
  const img = getImageEl(ed);
  Object.defineProperty(img, "naturalWidth", { configurable: true, value: natural });
  Object.defineProperty(img, "clientWidth", { configurable: true, value: client });
}

async function selectImage(ed: Editor): Promise<void> {
  const pos = findImagePos(ed);
  expect(pos).toBeGreaterThanOrEqual(0);
  ed.commands.command(({ tr }) => {
    tr.setSelection(NodeSelection.create(ed.state.doc, pos));
    return true;
  });
  await flushPromises();
  await new Promise((r) => setTimeout(r, 80)); // bubble updateDelay + debounce
}

describe("图片浮层按钮行为（查看原图 / 悬浮 / 拖拽 / 描述）", () => {
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

  function setup(): Promise<void> {
    wrapper = mount(EditorHost, {
      global: { plugins: [i18n, naive, createPinia()] },
    });
    return flushPromises().then(() =>
      new Promise((r) => setTimeout(r, 30)),
    );
  }

  function bubbleShouldShow(wrapper: VueWrapper, ed: Editor): boolean {
    const st = getBubbleState(wrapper) as unknown as {
      shouldShow: (p: {
        editor: Editor;
        view: unknown;
        state: unknown;
        from: number;
        to: number;
      }) => boolean;
    };
    expect(typeof st.shouldShow).toBe("function");
    return st.shouldShow({ editor: ed, view: ed.view, state: ed.state, from: 1, to: 1 });
  }

  it("查看原图：调起 Naive UI NImage 预览", async () => {
    await setup();
    const ed = getEditor(wrapper!);
    expect(ed).toBeTruthy();

    await selectImage(ed!);

    const nImg = wrapper!.findComponent(NImage);
    expect(nImg.exists()).toBe(true);
    const before = (nImg.vm.$ as unknown as { setupState?: { previewShow?: boolean } })
      .setupState?.previewShow;
    expect(before).toBe(false);

    const st = getBubbleState(wrapper!) as unknown as {
      viewOriginal: () => void;
    };
    expect(typeof st.viewOriginal).toBe("function");
    st.viewOriginal();
    await flushPromises();
    await new Promise((r) => setTimeout(r, 20));

    const after = (nImg.vm.$ as unknown as { setupState?: { previewShow?: boolean } })
      .setupState?.previewShow;
    expect(after).toBe(true);

    const msgs = unhandled.map((e) => String((e as Error)?.message ?? e));
    expect(msgs.filter((m) => m.includes("exposed"))).toEqual([]);
  });

  it("悬浮图片（未选中）不显示浮层，选中图片后才显示", async () => {
    await setup();
    const ed = getEditor(wrapper!);
    expect(ed).toBeTruthy();

    // 先把光标移回段落（autofocus 落在末尾图片上会形成 NodeSelection，不算未选中场景）
    ed!.commands.command(({ tr }) => {
      tr.setSelection(TextSelection.create(ed!.state.doc, 1));
      return true;
    });
    await flushPromises();

    // 无选区 → 不显示
    expect(bubbleShouldShow(wrapper!, ed!)).toBe(false);

    // 鼠标悬浮图片（未选中）→ 仍不显示
    const img = getImageEl(ed!);
    img.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    await flushPromises();
    expect(bubbleShouldShow(wrapper!, ed!)).toBe(false);

    // 选中图片 → 显示
    await selectImage(ed!);
    expect(bubbleShouldShow(wrapper!, ed!)).toBe(true);
  });

  it("选中图片后点击'添加描述'，进入编辑态且不污染文档 alt", async () => {
    await setup();
    const ed = getEditor(wrapper!);
    expect(ed).toBeTruthy();

    await selectImage(ed!);
    expect(getImageAttrs(ed!).alt).toBeNull();

    const st = getBubbleState(wrapper!) as unknown as {
      editCaption: () => void;
    };
    expect(typeof st.editCaption).toBe("function");
    st.editCaption();
    await flushPromises();

    // 仅进入编辑态（输入框出现），alt 保持 null（编辑占位不落文档）
    expect(getImageAttrs(ed!).alt).toBeNull();
    expect(wrapper!.find("input.image-caption__input").exists()).toBe(true);
  });

  it("描述输入回车后持久化到文档 alt 属性", async () => {
    await setup();
    const ed = getEditor(wrapper!);
    expect(ed).toBeTruthy();

    const st = getBubbleState(wrapper!) as unknown as { editCaption: () => void };
    st.editCaption();
    await flushPromises();

    const input = wrapper!.find("input.image-caption__input");
    expect(input.exists()).toBe(true);
    await input.setValue("一只在窗台上的猫");
    await input.trigger("keydown.enter");
    await flushPromises();

    expect(getImageAttrs(ed!).alt).toBe("一只在窗台上的猫");
    // 提交后退出编辑态
    expect(wrapper!.find("input.image-caption__input").exists()).toBe(false);
  });

  it("拖动右侧手柄：宽度实时变化，松手后写入 width 属性", async () => {
    await setup();
    const ed = getEditor(wrapper!);
    expect(ed).toBeTruthy();
    mockImageMetrics(ed!, 1600, 760); // 显示 760，原始 1600

    const handle = wrapper!.find(".image-resize-handle--right");
    expect(handle.exists()).toBe(true);
    await handle.trigger("mousedown", { clientX: 500 });

    // 拖动 +60px → 760 + 60 = 820；拖动中显示宽度提示
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 560 }));
    await flushPromises();
    const sizeTip = wrapper!.find(".image-drag-size");
    expect(sizeTip.exists()).toBe(true);
    expect(sizeTip.text()).toBe("820 px");

    // 松手 → 持久化，提示消失
    window.dispatchEvent(new MouseEvent("mouseup"));
    await flushPromises();
    expect(getImageAttrs(ed!).width).toBe(820);
    expect(wrapper!.find(".image-drag-size").exists()).toBe(false);
  });

  it("拖动左侧手柄：向左拖（dx 负）→ 变宽", async () => {
    await setup();
    const ed = getEditor(wrapper!);
    expect(ed).toBeTruthy();
    mockImageMetrics(ed!, 1600, 760);

    const handle = wrapper!.find(".image-resize-handle--left");
    expect(handle.exists()).toBe(true);
    await handle.trigger("mousedown", { clientX: 500 });

    // 向左拖 40px（dx=-40）→ 760 - (-40) = 800
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 460 }));
    await flushPromises();
    expect(wrapper!.find(".image-drag-size").text()).toBe("800 px");

    window.dispatchEvent(new MouseEvent("mouseup"));
    await flushPromises();
    expect(getImageAttrs(ed!).width).toBe(800);
  });
});
