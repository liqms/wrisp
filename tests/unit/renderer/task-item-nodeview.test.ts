import { describe, it, expect, afterEach, vi } from "vitest";
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
import { pickDate } from "@/renderer/components/editor/slash/commands/datePicker";
import { WrispTaskItem } from "@/renderer/components/editor/features/task-item/task-item-extension";
import zhCNMessages from "@/shared/i18n/locales/zhCN";

// mock 掉日期浮层（真实实现会挂载 NDatePicker 并等待用户交互，单测中不可用）。
// 必须有 vi.mock 工厂调用，vi.mocked() 仅提供类型，不产生 mock。
vi.mock("@/renderer/components/editor/slash/commands/datePicker", () => ({
  pickDate: vi.fn(),
}));

const pickDateMock = vi.mocked(pickDate);

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
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="true" data-date="2026-09-06"><p>完成报告</p></li></ul>',
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
  pickDateMock.mockReset();
});

describe("任务节点 NodeView", () => {
  it("编辑态渲染勾选框 + 日期药丸（[[双链]]样式）+ 内容", async () => {
    wrapper = mount(Host, { global: { plugins: [i18n, naive, createPinia()] } });
    await flushPromises();

    expect(wrapper.find(".task-item-node").exists()).toBe(true);
    const input = wrapper.find(".task-item-checkbox input");
    expect((input.element as HTMLInputElement).checked).toBe(true);
    // 药丸显示 [[YYYY-MM-DD]]（括号符号弱化 span）
    const pill = wrapper.find(".task-item-date");
    expect(pill.text()).toBe("[[2026-09-06]]");
    expect(pill.find(".inline-sem-symbol").exists()).toBe(true);
    // title 走全局 i18n（EDITOR.TASK_ITEM 键位正确时为中文）
    expect(pill.attributes("title")).toBe("修改日期");
    expect(wrapper.find(".task-item-text").text()).toContain("完成报告");
    // 有日期时不显示占位药丸
    expect(wrapper.find(".task-item-date-placeholder").exists()).toBe(false);
    // 无清除按钮（日期只能修改不能删除）
    expect(wrapper.find(".task-item-date-clear").exists()).toBe(false);
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

  it("点击日期药丸调用 pickDate 并写入返回值", async () => {
    pickDateMock.mockResolvedValue("2026-10-01");
    wrapper = mount(Host, { global: { plugins: [i18n, naive, createPinia()] } });
    await flushPromises();

    await wrapper.find(".task-item-date").trigger("click");
    await flushPromises();
    expect(pickDateMock).toHaveBeenCalledTimes(1);
    expect(firstTaskItem()?.attrs.date).toBe("2026-10-01");
  });

  it("日期选择取消（空串返回）不修改属性", async () => {
    pickDateMock.mockResolvedValue("");
    wrapper = mount(Host, { global: { plugins: [i18n, naive, createPinia()] } });
    await flushPromises();

    await wrapper.find(".task-item-date").trigger("click");
    await flushPromises();
    expect(firstTaskItem()?.attrs.date).toBe("2026-09-06");
  });

  it("无日期任务：渲染占位药丸（[[日期]]），点击调用 pickDate 并写入", async () => {
    pickDateMock.mockResolvedValue("2026-11-11");
    wrapper = mount(Host, { global: { plugins: [i18n, naive, createPinia()] } });
    await flushPromises();
    getEditor().commands.setContent(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>普通任务</p></li></ul>',
    );
    await flushPromises();

    // 占位药丸显示 [[日期]]（复用双链样式，悬浮任务行时可见性由 CSS 控制）
    const placeholder = wrapper.find(".task-item-date-placeholder");
    expect(placeholder.exists()).toBe(true);
    expect(placeholder.text()).toContain("日期");
    await placeholder.trigger("click");
    await flushPromises();
    expect(pickDateMock).toHaveBeenCalledTimes(1);
    expect(firstTaskItem()?.attrs.date).toBe("2026-11-11");
  });
});
