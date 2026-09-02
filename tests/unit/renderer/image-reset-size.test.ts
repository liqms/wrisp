import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import ImageView from "@/renderer/components/editor/features/image/ImageView.vue";
import zhCNMessages from "@/shared/i18n/locales/zhCN";
import type { DOMWrapper } from "@vue/test-utils";

// ImageView setup 调用 useI18n，直接挂载也需提供 i18n 上下文
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
 * 回归：浮层"原始大小"按钮（updateAttributes("image", { width: null })）不生效。
 * 根因：ImageView 内 watch(widthAttr) 仅在 v 为真值时同步 currentWidth，
 * width 被清除为 null 时被跳过，旧宽度继续渲染。
 */

interface ImageAttrs {
  src: string;
  alt: string;
  width: number | null;
  align: "left" | "center" | "right" | null;
}

function makeNode(attrs: Partial<ImageAttrs>) {
  const full: ImageAttrs = {
    src: "app://workspace/attachments/images/test.png",
    alt: "",
    width: null,
    align: null,
    ...attrs,
  };
  return { attrs: full };
}

function mountView(node: ReturnType<typeof makeNode>) {
  return mount(ImageView, {
    global: { plugins: [i18n] },
    props: {
      node,
      // ImageView setup 注册事务监听（描述编辑 meta 信号），mock editor 需提供 on/off
      editor: { on: () => { }, off: () => { }, commands: { focus: () => { } } },
      decorations: {},
      selected: false,
      extension: {},
      getPos: () => 1,
      updateAttributes: () => { },
      deleteNode: () => { },
      view: {},
      innerDecorations: {},
      HTMLAttributes: {},
    } as never,
  });
}

function holderOf(wrapper: ReturnType<typeof mountView>): DOMWrapper<HTMLElement> {
  return wrapper.find<HTMLElement>(".image-node__holder");
}

describe("ImageView 原始大小重置回归（width: null）", () => {
  it("缩放后清除 width 属性，渲染宽度应被移除（恢复原始大小）", async () => {
    const wrapper = mountView(makeNode({ width: 300 }));
    expect(holderOf(wrapper).element.style.width).toBe("300px");

    await wrapper.setProps({ node: makeNode({ width: null }) } as never);
    expect(holderOf(wrapper).element.style.width).toBe("");
  });

  it("未设置 width 时初始不显式渲染宽度", () => {
    const wrapper = mountView(makeNode({ width: null }));
    expect(holderOf(wrapper).element.style.width).toBe("");
  });

  it("清除后再次设置具体宽度仍生效（链路可继续缩放）", async () => {
    const wrapper = mountView(makeNode({ width: 300 }));
    await wrapper.setProps({ node: makeNode({ width: null }) } as never);
    expect(holderOf(wrapper).element.style.width).toBe("");

    await wrapper.setProps({ node: makeNode({ width: 150 }) } as never);
    expect(holderOf(wrapper).element.style.width).toBe("150px");
  });
});
