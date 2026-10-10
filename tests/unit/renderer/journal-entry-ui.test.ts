import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { createI18n } from "vue-i18n";
import { defineComponent, h, nextTick } from "vue";
import { NAlert, NTag } from "naive-ui";
import zhCNMessages from "@/shared/i18n/locales/zhCN";
import enUSMessages from "@/shared/i18n/locales/enUS";
import { naive } from "@/renderer/plugins/naive-ui";
import { ErrorCode } from "@/shared/enums";
import type { JournalDayView, JournalEntryView } from "@/shared/types";
import { TimeUtil } from "@/shared/utils";
import JournalEntryComposer from "@/renderer/components/editor/containers/JournalEntryComposer.vue";
import JournalEntryItem from "@/renderer/components/editor/containers/JournalEntryItem.vue";
import JournalBlock from "@/renderer/components/editor/containers/JournalBlock.vue";
import JournalView from "@/renderer/views/JournalView.vue";
import { useJournalStore } from "@/renderer/store/journal.store";
import { useConfigStore } from "@/renderer/store/config.store";
import { useNotificationStore } from "@/renderer/store/notification.store";
import { getErrorMessage } from "@/renderer/utils/error.utils";

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

/** 真失败响应：store 会写 errorCode + 按 ErrorCode 本地化的 errorMessage */
function fail(code: ErrorCode) {
  return { success: false, data: undefined, code, timestamp: Date.now() };
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

// 占位符转义断言需分别用两种语言渲染同一份组件
const i18nEn = createI18n({
  legacy: false,
  locale: "enUS",
  fallbackLocale: "enUS",
  messages: { enUS: enUSMessages },
  globalInjection: true,
  allowComposition: true,
  missingWarn: false,
  fallbackWarn: false,
});

let pinia: Pinia;

/**
 * 「写库成功但整窗刷新失败」的中性文案：断言渲染后的字符串（不是 locale 源串），
 * 否则 enUS/zhCN 里打错字、或vue-i18n 转义层级出错时套件仍会全绿。
 */
const SAVED_REFRESH_TITLE_ZH = "内容已写入，但时间线刷新失败，请稍后重新打开或翻页重试";
const SAVED_REFRESH_TITLE_EN =
  "Saved, but the timeline could not refresh. Reopen or scroll later to retry.";

const listRecentDays = vi.fn().mockResolvedValue(ok<JournalDayView[]>([]));
const appendEntry = vi.fn().mockResolvedValue(ok("new-entry-id"));
const updateEntry = vi.fn().mockResolvedValue(ok(true));
const deleteEntry = vi.fn().mockResolvedValue(ok(true));
const importDayFile = vi.fn().mockResolvedValue(ok({ imported: 2, updated: 1, skipped: 3 }));
const searchByName = vi.fn().mockResolvedValue(ok<Array<{ id: string; name: string }>>([]));

function mountWith(
  component: Parameters<typeof mount>[0],
  props: Record<string, unknown>,
  extras: { i18nInstance?: typeof i18n; stubs?: Record<string, unknown> } = {},
): VueWrapper {
  return mount(component, {
    props,
    global: {
      plugins: [pinia, extras.i18nInstance ?? i18n, naive],
      stubs: extras.stubs ?? {},
    },
  });
}

/** 可控完成的 Promise，用于构造「乱序返回的检索响应」 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** 取提示区里某个作品 token 对应的 chip（用于钉住 :type 绑定而非仅文案） */
function chipFor(wrapper: VueWrapper, name: string) {
  return wrapper.findAllComponents(NTag).find((node) => node.text().replace(/^&/, "").startsWith(name));
}

// JournalView 滚动行为的可观测替身：记录所有 scrollTo 调用（偏移恢复的唯一出口）
const scrollToCalls: Array<{ top?: number }> = [];
const FakeScrollbar = defineComponent({
  name: "NScrollbar",
  methods: {
    scrollTo(options: { top?: number } | number): void {
      scrollToCalls.push(typeof options === "number" ? { top: options } : options);
    },
  },
  setup(_props, { slots }) {
    return () => h("div", { class: "fake-scrollbar" }, slots.default?.());
  },
});

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

  listRecentDays.mockReset();
  appendEntry.mockReset();
  updateEntry.mockReset();
  deleteEntry.mockReset();
  importDayFile.mockReset();
  searchByName.mockReset();
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

  it("确认落空的作品 token 渲染未匹配提示，并以 warning chip 呈现", async () => {
    searchByName.mockResolvedValue(ok([]));
    const wrapper = mountWith(JournalEntryComposer, {});
    const input = wrapper.find("textarea");
    await input.setValue("&Nonexistent");

    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    const hints = wrapper.find(".composer-hints");
    expect(hints.text()).toContain("Nonexistent");
    expect(hints.text()).toContain("未匹配作品");
    // 裁定 T9-6：确认落空 → warning（仅断言文案不足以钉住 chipType 的三态绑定）
    expect(chipFor(wrapper, "Nonexistent")?.props("type")).toBe("warning");
  });

  it("检索精确命中的作品 token 以 info chip 呈现（不误报未匹配）", async () => {
    searchByName.mockResolvedValue(ok([{ id: "p1", name: "Bar" }]));
    const wrapper = mountWith(JournalEntryComposer, {});
    const input = wrapper.find("textarea");
    await input.setValue("&Bar");

    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(chipFor(wrapper, "Bar")?.props("type")).toBe("info");
    expect(wrapper.find(".composer-hints").text()).not.toContain("未匹配作品");
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
    // 裁定 T9-6：未检索过 → default 中性，既非 warning 也非 info
    expect(chipFor(wrapper, "Bar Baz")?.props("type")).toBe("default");
  });

  it("裸 &（空 token）不发起检索", async () => {
    const wrapper = mountWith(JournalEntryComposer, {});
    const input = wrapper.find("textarea");
    await input.setValue("&");

    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(searchByName).not.toHaveBeenCalled();
    expect(wrapper.findAll(".candidate-item")).toHaveLength(0);
  });

  it("组件卸载后挂起的防抖检索不再发起", async () => {
    const wrapper = mountWith(JournalEntryComposer, {});
    await wrapper.find("textarea").setValue("&My");
    // 尚未到 300ms 防抖窗口即卸载（I-1 修复后时间线不再整体卸载，composer 卸载是常态路径）
    wrapper.unmount();

    await vi.advanceTimersByTimeAsync(1000);
    await flushPromises();

    expect(searchByName).not.toHaveBeenCalled();
  });

  it("检索被拒绝（IPC reject）时丢弃候选，不残留上一 token 的结果", async () => {
    searchByName.mockResolvedValueOnce(ok([{ id: "p1", name: "My Project" }]));
    const wrapper = mountWith(JournalEntryComposer, {});
    const input = wrapper.find("textarea");
    await input.setValue("&My");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(wrapper.findAll(".candidate-item")).toHaveLength(1);

    searchByName.mockRejectedValueOnce(new Error("ipc down"));
    await input.setValue("&MyProj");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    // 失败必须被捕获（否则为 unhandled rejection），且旧候选不得留存
    expect(wrapper.findAll(".candidate-item")).toHaveLength(0);
    expect(wrapper.find("textarea").exists()).toBe(true);
  });

  it("乱序返回的旧检索响应不得覆盖新候选列表与匹配判定", async () => {
    const stale = deferred<ReturnType<typeof ok>>();
    const current = deferred<ReturnType<typeof ok>>();
    searchByName.mockReturnValueOnce(stale.promise).mockReturnValueOnce(current.promise);

    const wrapper = mountWith(JournalEntryComposer, {});
    const input = wrapper.find("textarea");
    // 输入 &ab → 请求 A（token=ab）在途
    await input.setValue("&ab");
    await vi.advanceTimersByTimeAsync(300);
    // 继续输入成 "&ab &abc" → 请求 B（token=abc）在途
    await input.setValue("&ab &abc");
    await vi.advanceTimersByTimeAsync(300);

    // B 先回：abc 无匹配 → 确认落空
    current.resolve(ok([]));
    await flushPromises();
    expect(wrapper.findAll(".candidate-item")).toHaveLength(0);

    // A 后回（过期）：ab 命中 → 不得覆盖候选，也不得把仍在草稿里的 ab 误置为已命中
    stale.resolve(ok([{ id: "p1", name: "ab" }]));
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(wrapper.findAll(".candidate-item")).toHaveLength(0);
    expect(chipFor(wrapper, "abc")?.props("type")).toBe("warning");
    expect(chipFor(wrapper, "ab")?.props("type")).toBe("default");
  });

  it("占位符在两种语言下都渲染出裸 @（无多余反斜杠）", async () => {
    const zh = mountWith(JournalEntryComposer, {});
    const zhPlaceholder = zh.find("textarea").attributes("placeholder") ?? "";
    expect(zhPlaceholder).toContain("@");
    expect(zhPlaceholder).not.toContain("\\");
    zh.unmount();

    const en = mountWith(JournalEntryComposer, {}, { i18nInstance: i18nEn });
    const enPlaceholder = en.find("textarea").attributes("placeholder") ?? "";
    expect(enPlaceholder).toContain("@");
    expect(enPlaceholder).not.toContain("\\");
    en.unmount();
  });
  it("追加已落库但动作后的整窗刷新失败 ⇒ 恰好一次 warn「内容已写入」，绝不报「追加失败」", async () => {
    // appendEntry 仍返回 id（条目已落库），只有 loadRecentDays 写了 errorCode。
    // 承重：报 error「追加失败」+ 草稿已清空 ⇒ 用户以为没写进去而重新输入 ⇒ 写出重复条目
    listRecentDays.mockResolvedValue(fail(ErrorCode.JOURNAL_GET_FAILED));
    const spy = vi.spyOn(useNotificationStore(), "addNotification");

    const wrapper = mountWith(JournalEntryComposer, {});
    const input = wrapper.find("textarea");
    await input.setValue("#测试 记一条");
    await input.trigger("keydown", { ctrlKey: true, key: "Enter" });
    await vi.runAllTimersAsync();
    await flushPromises();

    // 非空转守卫：条目确实写进了库（返回 id 的 IPC 往返真的发生了）
    expect(appendEntry).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].level).toBe("warning");
    expect(spy.mock.calls[0][0].title).toBe(SAVED_REFRESH_TITLE_ZH);
    expect(spy.mock.calls[0][0].content).toBe(getErrorMessage(ErrorCode.JOURNAL_GET_FAILED));
    // error 口径一次都不许出现
    expect(spy.mock.calls.filter((c) => c[0].level === "error")).toHaveLength(0);
    // clearError 已执行，错误态不残留给下一次动作
    expect(useJournalStore().errorCode).toBeNull();
    // 成功路径的清理动作照常（草稿已清空）
    expect(wrapper.find("textarea").element.value).toBe("");
    spy.mockRestore();
  });

  it("追加失败 ⇒ 恰好一次提示，不得与刷新失败分支叠成两次", async () => {
    appendEntry.mockResolvedValue(fail(ErrorCode.JOURNAL_CREATE_FAILED));
    const spy = vi.spyOn(useNotificationStore(), "addNotification");

    const wrapper = mountWith(JournalEntryComposer, {});
    const input = wrapper.find("textarea");
    await input.setValue("#测试 记一条");
    await input.trigger("keydown", { ctrlKey: true, key: "Enter" });
    await vi.runAllTimersAsync();
    await flushPromises();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].level).toBe("error");
    expect(spy.mock.calls[0][0].title).toBe("追加失败");
    expect(spy.mock.calls[0][0].content).toBe("日志条目未能保存，请重试。");
    // 真失败路径不得被分级成 warn（回退守护）
    expect(spy.mock.calls.filter((c) => c[0].level === "warning")).toHaveLength(0);
    spy.mockRestore();
  });
});

describe("JournalEntryItem 动作失败提示（判据 = store.errorCode）", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** 进入编辑态并点击保存 */
  async function saveEditOf(wrapper: VueWrapper) {
    await wrapper.find(".entry-content").trigger("dblclick");
    await flushPromises();
    await wrapper.find("textarea").setValue("改后的内容");
    const saveBtn = wrapper.findAll("button").find((b) => b.text().includes("保存"));
    expect(saveBtn).toBeTruthy();
    await saveBtn!.trigger("click");
    await flushPromises();
  }

  it("更新真失败（success:false ⇒ errorCode 已置）⇒ 恰好一次「更新条目失败」", async () => {
    updateEntry.mockResolvedValue(fail(ErrorCode.JOURNAL_UPDATE_FAILED));
    const spy = vi.spyOn(useNotificationStore(), "addNotification");

    const wrapper = mountWith(JournalEntryItem, { entry: makeEntry() });
    await saveEditOf(wrapper);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].level).toBe("error");
    // 断言渲染后的字符串，不是 locale 源串
    expect(spy.mock.calls[0][0].title).toBe("更新条目失败");
    expect(spy.mock.calls[0][0].content).toBe(getErrorMessage(ErrorCode.JOURNAL_UPDATE_FAILED));
    // 真失败（未落库）不得被分级成 warn
    expect(spy.mock.calls.filter((c) => c[0].level === "warning")).toHaveLength(0);
    expect(useJournalStore().errorCode).toBeNull(); // clearError 已执行
    // 失败时停留在编辑态（原行为，不得回退）
    expect(wrapper.find("textarea").exists()).toBe(true);
    spy.mockRestore();
  });

  it("更新已落库但整窗刷新失败（ok=true + errorCode 已置）⇒ 恰好一次 warn，error 零次", async () => {
    // updateEntry 返回 true（行已更新），失败只发生在动作成功后的 loadRecentDays
    listRecentDays.mockResolvedValue(fail(ErrorCode.JOURNAL_GET_FAILED));
    const spy = vi.spyOn(useNotificationStore(), "addNotification");

    const wrapper = mountWith(JournalEntryItem, { entry: makeEntry() });
    await saveEditOf(wrapper);

    expect(updateEntry).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].level).toBe("warning");
    expect(spy.mock.calls[0][0].title).toBe(SAVED_REFRESH_TITLE_ZH);
    expect(spy.mock.calls[0][0].content).toBe(getErrorMessage(ErrorCode.JOURNAL_GET_FAILED));
    // 承重：绝不能再弹「更新条目失败」——草稿已提交，error 口径会诱导用户重填造成重复条目
    expect(spy.mock.calls.filter((c) => c[0].level === "error")).toHaveLength(0);
    expect(useJournalStore().errorCode).toBeNull(); // clearError 已执行
    // 写库成功 ⇒ 退出编辑态
    expect(wrapper.find("textarea").exists()).toBe(false);
    spy.mockRestore();
  });

  it("更新完全成功且整窗刷新正常 ⇒ error 与 warn 都零次", async () => {
    const spy = vi.spyOn(useNotificationStore(), "addNotification");

    const wrapper = mountWith(JournalEntryItem, { entry: makeEntry() });
    await saveEditOf(wrapper);

    expect(updateEntry).toHaveBeenCalledTimes(1);
    expect(listRecentDays).toHaveBeenCalledTimes(1);
    expect(useJournalStore().errorCode).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    expect(wrapper.find("textarea").exists()).toBe(false);
    spy.mockRestore();
  });

  it("更新真失败的标题在 enUS 下渲染为 Failed to update entry", async () => {
    updateEntry.mockResolvedValue(fail(ErrorCode.JOURNAL_UPDATE_FAILED));
    const spy = vi.spyOn(useNotificationStore(), "addNotification");

    const wrapper = mountWith(JournalEntryItem, { entry: makeEntry() }, { i18nInstance: i18nEn });
    await wrapper.find(".entry-content").trigger("dblclick");
    await flushPromises();
    await wrapper.find("textarea").setValue("edited");
    const saveBtn = wrapper.findAll("button").find((b) => b.text().includes("Save"));
    expect(saveBtn).toBeTruthy();
    await saveBtn!.trigger("click");
    await flushPromises();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].title).toBe("Failed to update entry");
    spy.mockRestore();
  });

  it("刷新失败的 warn 标题在 enUS 下渲染为 Saved, but the timeline could not refresh…", async () => {
    listRecentDays.mockResolvedValue(fail(ErrorCode.JOURNAL_GET_FAILED));
    const spy = vi.spyOn(useNotificationStore(), "addNotification");

    const wrapper = mountWith(JournalEntryItem, { entry: makeEntry() }, { i18nInstance: i18nEn });
    await wrapper.find(".entry-content").trigger("dblclick");
    await flushPromises();
    await wrapper.find("textarea").setValue("edited");
    const saveBtn = wrapper.findAll("button").find((b) => b.text().includes("Save"));
    expect(saveBtn).toBeTruthy();
    await saveBtn!.trigger("click");
    await flushPromises();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].level).toBe("warning");
    expect(spy.mock.calls[0][0].title).toBe(SAVED_REFRESH_TITLE_EN);
    spy.mockRestore();
  });

  it("删除真失败的标题在 enUS 下渲染为 Failed to delete entry", async () => {
    deleteEntry.mockResolvedValueOnce(fail(ErrorCode.JOURNAL_DELETE_FAILED));
    const spy = vi.spyOn(useNotificationStore(), "addNotification");

    const wrapper = mountWith(JournalEntryItem, { entry: makeEntry() }, { i18nInstance: i18nEn });
    const deleteBtn = wrapper.findAll("button").find((b) => b.text().includes("Delete"));
    expect(deleteBtn).toBeTruthy();
    await deleteBtn!.trigger("click");
    await flushPromises();
    await (capturedDialog.options!.onPositiveClick as () => unknown)();
    await flushPromises();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].level).toBe("error");
    expect(spy.mock.calls[0][0].title).toBe("Failed to delete entry");
    spy.mockRestore();
  });

  it("并发删除自愈（success:true + data:false、errorCode 为 null）⇒ 一次提示都不弹", async () => {
    // 承重断言：若实现按「返回 false」弹提示，本用例即红（会被 notify 调用 1 次击穿）
    updateEntry.mockResolvedValue(ok(false));
    const store = useJournalStore();
    store.days = [{ date: "2026-10-10", has_legacy_file: false, entries: [makeEntry()] }];
    const spy = vi.spyOn(useNotificationStore(), "addNotification");

    const wrapper = mountWith(JournalEntryItem, { entry: makeEntry() });
    await saveEditOf(wrapper);

    expect(store.errorCode).toBeNull();
    // 本地按 DB 真值自愈移除该条目，且不撒谎说「更新失败」
    expect(store.days[0].entries).toHaveLength(0);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("删除真失败 ⇒ 恰好一次「删除条目失败」且 clearError 生效（下次成功不再重复弹）", async () => {
    deleteEntry.mockResolvedValueOnce(fail(ErrorCode.JOURNAL_DELETE_FAILED));
    const spy = vi.spyOn(useNotificationStore(), "addNotification");

    const wrapper = mountWith(JournalEntryItem, { entry: makeEntry() });
    const deleteBtn = wrapper.findAll("button").find((b) => b.text().includes("删除"));
    await deleteBtn!.trigger("click");
    await flushPromises();

    const onPositive = capturedDialog.options!.onPositiveClick as () => unknown;
    await onPositive();
    await flushPromises();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].level).toBe("error");
    expect(spy.mock.calls[0][0].title).toBe("删除条目失败");
    expect(spy.mock.calls[0][0].content).toBe(getErrorMessage(ErrorCode.JOURNAL_DELETE_FAILED));
    expect(useJournalStore().errorCode).toBeNull(); // clearError 已执行

    // 同一条目重试成功：不得再弹（错误态已被清理）
    await onPositive();
    await flushPromises();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("删除返回 data:false（已被并发软删、errorCode 未置）⇒ 不弹提示", async () => {
    deleteEntry.mockResolvedValue(ok(false));
    const spy = vi.spyOn(useNotificationStore(), "addNotification");

    const wrapper = mountWith(JournalEntryItem, { entry: makeEntry() });
    const deleteBtn = wrapper.findAll("button").find((b) => b.text().includes("删除"));
    await deleteBtn!.trigger("click");
    await flushPromises();
    await (capturedDialog.options!.onPositiveClick as () => unknown)();
    await flushPromises();

    // 非空转守卫：删除请求真的发出去了（否则「不弹提示」可能只是因为压根没调用）
    expect(deleteEntry).toHaveBeenCalledWith("e1");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("JournalEntryItem 编辑与删除", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("只读正文经 sanitizeHtml 白名单清洗（去掉事件属性与脚本标签）", () => {
    const wrapper = mountWith(JournalEntryItem, {
      entry: makeEntry({ content: '<img src=x onerror="window.__pwned=1">\n<script>window.__pwned=2</script>' }),
    });

    const html = wrapper.find(".entry-content").html();
    // img 属白名单标签应保留，但 onerror 事件属性必须被剥掉；script 标签被解包
    expect(html).toContain("<img");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<script");
  });

  it("多行正文保留用户换行（marked breaks: true）", () => {
    const wrapper = mountWith(JournalEntryItem, {
      entry: makeEntry({ content: "第一行\n第二行" }),
    });

    const html = wrapper.find(".entry-content").html();
    expect(html).toContain("<br");
    expect(wrapper.find(".entry-content").text()).toContain("第一行");
    expect(wrapper.find(".entry-content").text()).toContain("第二行");
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
    // 裁定 T9-2：通知必须是「标题 + 正文」两段式，标题取导入标题 key
    const title = spy.mock.calls[0][0].title ?? "";
    expect(title).toContain("导入日志");
    const content = spy.mock.calls[0][0].content ?? "";
    expect(content).toContain("2");
    expect(content).toContain("1");
    expect(content).toContain("3");
    spy.mockRestore();
  });

  it("导入已落库但整窗刷新失败 ⇒ success 一次且 warn 一次，error 零次", async () => {
    // importDayFile 返回计数对象（导入已完成），只有其后的 loadRecentDays 写了 errorCode
    listRecentDays.mockResolvedValue(fail(ErrorCode.JOURNAL_GET_FAILED));
    const spy = vi.spyOn(useNotificationStore(), "addNotification");
    const day: JournalDayView = { date: "2020-01-06", has_legacy_file: true, entries: [] };

    const wrapper = mountWith(JournalBlock, { day });
    const importBtn = wrapper.findAll("button").find((b) => b.text().includes("导入此文件"));
    await importBtn!.trigger("click");
    await flushPromises();

    expect(importDayFile).toHaveBeenCalledTimes(1);
    // 两条提示说的是两件事（导入了多少条 / 时间线没刷新），先后各一条、不合并
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0][0].level).toBe("success");
    expect(spy.mock.calls[1][0].level).toBe("warning");
    expect(spy.mock.calls[1][0].title).toBe(SAVED_REFRESH_TITLE_ZH);
    expect(spy.mock.calls[1][0].content).toBe(getErrorMessage(ErrorCode.JOURNAL_GET_FAILED));
    expect(spy.mock.calls.filter((c) => c[0].level === "error")).toHaveLength(0);
    expect(useJournalStore().errorCode).toBeNull(); // clearError 已执行
    spy.mockRestore();
  });

  it("导入失败（res 为 null 且 errorCode 置位）⇒ 恰好一次「导入失败」", async () => {
    importDayFile.mockResolvedValue(fail(ErrorCode.JOURNAL_CREATE_FAILED));
    const spy = vi.spyOn(useNotificationStore(), "addNotification");
    const day: JournalDayView = { date: "2020-01-05", has_legacy_file: true, entries: [] };

    const wrapper = mountWith(JournalBlock, { day });
    const importBtn = wrapper.findAll("button").find((b) => b.text().includes("导入此文件"));
    await importBtn!.trigger("click");
    await flushPromises();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].level).toBe("error");
    expect(spy.mock.calls[0][0].title).toBe("导入失败");
    expect(spy.mock.calls[0][0].content).toBe(getErrorMessage(ErrorCode.JOURNAL_CREATE_FAILED));
    // 真失败（未导入）不得被分级成 warn
    expect(spy.mock.calls.filter((c) => c[0].level === "warning")).toHaveLength(0);
    expect(useJournalStore().errorCode).toBeNull(); // clearError 已执行
    // 重试成功不再弹错误提示（只保留成功 toast）
    importDayFile.mockResolvedValue(ok({ imported: 1, updated: 0, skipped: 0 }));
    await importBtn!.trigger("click");
    await flushPromises();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[1][0].level).toBe("success");
    spy.mockRestore();
  });

  it("导入真失败的标题在 enUS 下渲染为 Import failed", async () => {
    importDayFile.mockResolvedValue(fail(ErrorCode.JOURNAL_CREATE_FAILED));
    const spy = vi.spyOn(useNotificationStore(), "addNotification");
    const day: JournalDayView = { date: "2020-01-07", has_legacy_file: true, entries: [] };

    const wrapper = mountWith(JournalBlock, { day }, { i18nInstance: i18nEn });
    const importBtn = wrapper.findAll("button").find((b) => b.text().includes("Import this file"));
    expect(importBtn).toBeTruthy();
    await importBtn!.trigger("click");
    await flushPromises();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].level).toBe("error");
    expect(spy.mock.calls[0][0].title).toBe("Import failed");
    spy.mockRestore();
  });

  it("legacy 提示以解析成功的 NAlert 组件渲染（本地 import 生效，裁定 T9-1）", () => {
    const day: JournalDayView = { date: "2020-01-03", has_legacy_file: true, entries: [] };
    const wrapper = mountWith(JournalBlock, { day });

    // 未解析的 <n-alert> 会退化成自定义元素并照样渲染插槽文本，故必须按组件定义断言而非文本
    expect(wrapper.findComponent(NAlert).exists()).toBe(true);
    expect(wrapper.text()).toContain("检测到旧版整篇日志");
  });

  it("无 legacy 文件时不渲染 NAlert", () => {
    const day: JournalDayView = { date: "2020-01-04", has_legacy_file: false, entries: [] };
    const wrapper = mountWith(JournalBlock, { day });
    expect(wrapper.findComponent(NAlert).exists()).toBe(false);
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

describe("JournalView 时间线装载与滚动状态", () => {
  afterEach(() => {
    scrollToCalls.length = 0;
    vi.useRealTimers();
  });

  it("条目动作的重拉期间不卸载时间线（spinner 仅用于首屏空列表）", async () => {
    const today = TimeUtil.getLocalDateString();
    const day: JournalDayView = { date: today, has_legacy_file: false, entries: [makeEntry()] };
    listRecentDays.mockResolvedValue(ok([day]));

    const wrapper = mountWith(JournalView, {}, { stubs: { "n-scrollbar": FakeScrollbar } });
    await flushPromises();

    expect(wrapper.findAll(".journal-block")).toHaveLength(1);
    const composer = wrapper.find(".journal-entry-composer textarea");
    expect(composer.exists()).toBe(true);

    // 追加条目会让 store 内部整窗重拉（daysLoading=true），此处故意挂起该 IPC 往返
    const pending = deferred<ReturnType<typeof ok>>();
    listRecentDays.mockImplementationOnce(() => pending.promise);

    await composer.setValue("#测试 记一条");
    await composer.trigger("keydown", { ctrlKey: true, key: "Enter" });
    await flushPromises();

    expect(useJournalStore().daysLoading).toBe(true);
    // 回归点：重拉期间不得把列表换成 spinner（否则整列闪烁 + 编辑草稿被静默丢弃 + 滚动恢复竞态）
    expect(wrapper.findAll(".journal-block")).toHaveLength(1);
    expect(wrapper.find(".journal-entry-composer textarea").exists()).toBe(true);

    pending.resolve(ok([day]));
    await flushPromises();
    wrapper.unmount();
  });

  it("切换工作区时丢弃上一个工作区的滚动偏移", async () => {
    const today = TimeUtil.getLocalDateString();
    const day: JournalDayView = { date: today, has_legacy_file: false, entries: [makeEntry()] };
    listRecentDays.mockResolvedValue(ok([day]));

    const wrapper = mountWith(JournalView, {}, { stubs: { "n-scrollbar": FakeScrollbar } });
    await flushPromises();

    const journalStore = useJournalStore();
    const configStore = useConfigStore();
    expect(configStore.config).not.toBeNull();
    journalStore.hasMoreDays = false; // 避免触底自动翻页干扰观测

    const scroller = wrapper.find(".fake-scrollbar");
    expect(scroller.exists()).toBe(true);
    Object.defineProperty(scroller.element, "scrollTop", { configurable: true, value: 640 });
    await scroller.trigger("scroll");
    await flushPromises();

    // 观测有效性前提：同一工作区内 days 更新时应恢复用户自己的偏移
    await journalStore.loadRecentDays(5);
    await flushPromises();
    expect(scrollToCalls.some((c) => c.top === 640)).toBe(true);

    const callsBeforeSwitch = scrollToCalls.length;
    configStore.config!.workspace = "/mock/other-workspace";
    await flushPromises();
    await nextTick();
    await flushPromises();

    // 回归点：切换后不得把旧工作区的 640 恢复到新时间线（只允许归零）
    const afterSwitch = scrollToCalls.slice(callsBeforeSwitch);
    expect(afterSwitch.every((c) => (c.top ?? 0) === 0)).toBe(true);
    wrapper.unmount();
  });
});
