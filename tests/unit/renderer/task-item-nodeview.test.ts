import { describe, it, expect, afterEach } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { defineComponent, h } from "vue";
import type { WritableComputedRef } from "vue";
import { Editor, EditorContent, useEditor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import { NMessageProvider } from "naive-ui";
import { naive } from "@/renderer/plugins/naive-ui";
import { i18n as globalI18n } from "@/renderer/plugins/i18n";
import { WrispTaskItem } from "@/renderer/components/editor/features/task-item/task-item-extension";
import zhCNMessages from "@/shared/i18n/locales/zhCN";

// NodeView（TaskItemView）的 t() 取自全局 i18n 单例（默认 enUS），
// 测试断言中文文案前切到 zhCN（vitest 按文件隔离模块图，无跨文件泄漏）
(globalI18n.global.locale as WritableComputedRef<string>).value = "zhCN";

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
  name: "TaskItemHost",
  components: { EditorContent },
  setup() {
    const editor = useEditor({
      content:
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>完成报告 [[2026-09-06]]</p></li></ul>',
      extensions: [StarterKit, TaskList, WrispTaskItem.configure({ nested: true })],
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

function firstTaskItem(): { attrs: Record<string, unknown> } | undefined {
  let found: { attrs: Record<string, unknown> } | undefined;
  getEditor().state.doc.descendants((node) => {
    if (!found && node.type.name === "taskItem") found = node;
    return true;
  });
  return found;
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = "";
});

describe("任务节点 NodeView", () => {
  it("编辑态渲染勾选框 + 内容（日期为统一 [[文本]]，无专属药丸 UI）", async () => {
    wrapper = mount(Host, { global: { plugins: [i18n, naive, createPinia()] } });
    await flushPromises();

    expect(wrapper.find(".task-item-node").exists()).toBe(true);
    const input = wrapper.find(".task-item-checkbox input");
    expect((input.element as HTMLInputElement).checked).toBe(true);
    // title 走全局 i18n（EDITOR.TASK_ITEM 键位正确时为中文）
    expect(wrapper.find(".task-item-checkbox").attributes("title")).toBe(
      "切换完成状态",
    );
    // 日期作为行内文本保留在内容区（与正文统一，由 inline-sem Decoration 渲染）
    expect(wrapper.find(".task-item-text").text()).toContain("完成报告 [[2026-09-06]]");
    // 无任务专属日期 UI
    expect(wrapper.find(".task-item-date").exists()).toBe(false);
    expect(wrapper.find(".task-item-date-placeholder").exists()).toBe(false);
  });

  it("勾选框 change 事件切换完成状态", async () => {
    wrapper = mount(Host, { global: { plugins: [i18n, naive, createPinia()] } });
    await flushPromises();

    const input = wrapper.find(".task-item-checkbox input");
    (input.element as HTMLInputElement).checked = false;
    await input.trigger("change");
    await flushPromises();
    expect(firstTaskItem()?.attrs.checked).toBe(false);

    (input.element as HTMLInputElement).checked = true;
    await input.trigger("change");
    await flushPromises();
    expect(firstTaskItem()?.attrs.checked).toBe(true);
  });

  it("任务节点无 date 专属属性（日期非必要信息）", async () => {
    wrapper = mount(Host, { global: { plugins: [i18n, naive, createPinia()] } });
    await flushPromises();

    expect("date" in (firstTaskItem()?.attrs ?? {})).toBe(false);
  });
});
