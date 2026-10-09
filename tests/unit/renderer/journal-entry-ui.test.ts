import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { createI18n } from "vue-i18n";
import zhCNMessages from "@/shared/i18n/locales/zhCN";
import { naive } from "@/renderer/plugins/naive-ui";
import { ErrorCode } from "@/shared/enums";
import type { JournalDayView, JournalEntryView } from "@/shared/types";
import JournalEntryComposer from "@/renderer/components/editor/containers/JournalEntryComposer.vue";
import JournalEntryItem from "@/renderer/components/editor/containers/JournalEntryItem.vue";
import JournalBlock from "@/renderer/components/editor/containers/JournalBlock.vue";
import { useNotificationStore } from "@/renderer/store/notification.store";

// 捕获 naive-ui useDialog().warning 的入参，便于断言「经弹窗后再删除」的行为链路
const capturedDialog: { options: Record<string, unknown> | null } = { options: null };

vi.mock("naive-ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("naive-ui")>();
  return {
    ...actual,
    useDialog: () => ({
      warning: (opts: Record<string, unknown>) => {
        capturedDialog.options = opts;
      },
    }),
  };
});

function ok<T>(data: T) {
  return { success: true, data, code: ErrorCode.SUCCESS, timestamp: Date.now() };
}

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

let pinia: Pinia;

const listRecentDays = vi.fn().mockResolvedValue(ok<JournalDayView[]>([]));
const appendEntry = vi.fn().mockResolvedValue(ok("new-entry-id"));
const updateEntry = vi.fn().mockResolvedValue(ok(true));
const deleteEntry = vi.fn().mockResolvedValue(ok(true));
const importDayFile = vi.fn().mockResolvedValue(ok({ imported: 2, updated: 1, skipped: 3 }));
const searchByName = vi.fn().mockResolvedValue(ok<Array<{ id: string; name: string }>>([]));

function mountWith(component: Parameters<typeof mount>[0], props: Record<string, unknown>): VueWrapper {
  return mount(component, { props, global: { plugins: [pinia, i18n, naive] } });
}

function makeEntry(overrides: Partial<JournalEntryView> = {}): JournalEntryView {
  return {
    id: "e1",
    date: "2026-10-10",
    occurred_at: "2026-10-10T05:30:00.000Z",
    source: "desktop",
    type: "text",
    content: "原始内容",
    chunked_at: null,
    created_at: "2026-10-10T05:30:00.000Z",
    updated_at: "2026-10-10T05:30:00.000Z",
    deleted_at: null,
    tags: [],
    projects: [],
    ...overrides,
  };
}

beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
  capturedDialog.options = null;

  const api = window.electronAPI as unknown as Record<string, unknown>;
  api.journal = { listRecentDays, appendEntry, updateEntry, deleteEntry, importDayFile };
  api.project = { ...(api.project as object), searchByName };

  listRecentDays.mockClear();
  appendEntry.mockClear();
  updateEntry.mockClear();
  deleteEntry.mockClear();
  importDayFile.mockClear();
  searchByName.mockClear();
  listRecentDays.mockResolvedValue(ok<JournalDayView[]>([]));
  appendEntry.mockResolvedValue(ok("new-entry-id"));
  updateEntry.mockResolvedValue(ok(true));
  deleteEntry.mockResolvedValue(ok(true));
  importDayFile.mockResolvedValue(ok({ imported: 2, updated: 1, skipped: 3 }));
  searchByName.mockResolvedValue(ok([]));
});

describe("JournalEntryComposer 追加与记号提示", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("Ctrl+Enter 触发追加、清空草稿", async () => {
    const wrapper = mountWith(JournalEntryComposer, {});
    const input = wrapper.find("textarea");
    await input.setValue("#测试 记一条");

    await input.trigger("keydown", { ctrlKey: true, key: "Enter" });
    await vi.runAllTimersAsync();
    await flushPromises();

    expect(appendEntry).toHaveBeenCalledWith(expect.objectContaining({ content: "#测试 记一条" }));
    expect(wrapper.find("textarea").element.value).toBe("");
  });

  it("& 防抖检索弹出候选，点选带空格名字回填为 &[name]", async () => {
    searchByName.mockResolvedValue(ok([{ id: "p1", name: "My Project" }]));
    const wrapper = mountWith(JournalEntryComposer, {});
    const input = wrapper.find("textarea");
    await input.setValue("&My");

    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    const candidates = wrapper.findAll(".candidate-item");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].text()).toContain("My Project");

    await candidates[0].trigger("mousedown");
    await flushPromises();

    expect(wrapper.find("textarea").element.value).toBe("&[My Project] ");
  });

  it("确认落空的作品 token 渲染未匹配提示", async () => {
    searchByName.mockResolvedValue(ok([]));
    const wrapper = mountWith(JournalEntryComposer, {});
    const input = wrapper.find("textarea");
    await input.setValue("&Nonexistent");

    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    const hints = wrapper.find(".composer-hints");
    expect(hints.text()).toContain("Nonexistent");
    expect(hints.text()).toContain("未匹配作品");
  });

  it("未检索的方括号作品 token 保持中性（不误报未匹配）", async () => {
    const wrapper = mountWith(JournalEntryComposer, {});
    const input = wrapper.find("textarea");
    // 尾部带 ] → 防抖正则不匹配，从不触发检索 → 判定应为中性
    await input.setValue("&[Bar Baz]");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(searchByName).not.toHaveBeenCalled();
    const hints = wrapper.find(".composer-hints");
    expect(hints.text()).toContain("Bar Baz");
    expect(hints.text()).not.toContain("未匹配作品");
  });
});

describe("JournalEntryItem 编辑与删除", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("双击进入编辑，保存调用 updateEntry", async () => {
    const wrapper = mountWith(JournalEntryItem, { entry: makeEntry() });

    await wrapper.find(".entry-content").trigger("dblclick");
    await flushPromises();

    const input = wrapper.find("textarea");
    expect(input.exists()).toBe(true);
    await input.setValue("编辑后的内容");

    const saveBtn = wrapper.findAll("button").find((b) => b.text().includes("保存"));
    expect(saveBtn).toBeTruthy();
    await saveBtn!.trigger("click");
    await flushPromises();

    expect(updateEntry).toHaveBeenCalledWith({ id: "e1", content: "编辑后的内容" });
  });

  it("删除先经确认弹窗，确认后调用 requestDeleteEntry", async () => {
    const wrapper = mountWith(JournalEntryItem, { entry: makeEntry() });

    const deleteBtn = wrapper.findAll("button").find((b) => b.text().includes("删除"));
    expect(deleteBtn).toBeTruthy();
    await deleteBtn!.trigger("click");
    await flushPromises();

    // 弹窗尚未确认前不应删除
    expect(capturedDialog.options).not.toBeNull();
    expect(deleteEntry).not.toHaveBeenCalled();

    const onPositive = capturedDialog.options!.onPositiveClick as () => unknown;
    onPositive();
    await flushPromises();

    expect(deleteEntry).toHaveBeenCalledWith("e1");
  });
});

describe("JournalBlock 日容器与旧文件导入", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("has_legacy_file 日渲染导入按钮，点击后调用导入并 toast 计数", async () => {
    const day: JournalDayView = { date: "2020-01-01", has_legacy_file: true, entries: [] };
    const spy = vi.spyOn(useNotificationStore(), "addNotification");

    const wrapper = mountWith(JournalBlock, { day });

    const importBtn = wrapper.findAll("button").find((b) => b.text().includes("导入此文件"));
    expect(importBtn).toBeTruthy();
    await importBtn!.trigger("click");
    await flushPromises();

    expect(importDayFile).toHaveBeenCalledWith("2020-01-01", undefined);
    expect(spy).toHaveBeenCalledTimes(1);
    const content = spy.mock.calls[0][0].content ?? "";
    expect(content).toContain("2");
    expect(content).toContain("1");
    expect(content).toContain("3");
  });

  it("渲染条目卡片", () => {
    const day: JournalDayView = {
      date: "2020-01-02",
      has_legacy_file: false,
      entries: [makeEntry({ id: "a", content: "第一条" }), makeEntry({ id: "b", content: "第二条" })],
    };
    const wrapper = mountWith(JournalBlock, { day });
    expect(wrapper.findAll(".journal-entry-item")).toHaveLength(2);
  });
});
