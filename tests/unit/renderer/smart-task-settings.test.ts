import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import SmartTaskSettings from "@/renderer/components/settings/smart-task/SmartTaskSettings.vue";
import { naive } from "@/renderer/plugins/naive-ui";
import zhCNMessages from "@/shared/i18n/locales/zhCN";
import { DEFAULT_SMART_TASK_CONFIG } from "@/shared/constants/smart-task.constants";

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

/** setup/renderer.ts 的 config 桩里没有 smartTask 块，正好覆盖「历史配置整块缺失」的兜底路径 */
function stubThreadBudget(data: unknown): void {
  const electronAPI = window.electronAPI as unknown as Record<string, Record<string, unknown>>;
  electronAPI.model = {
    ...electronAPI.model,
    getThreadBudget: vi.fn().mockResolvedValue({ success: true, data }),
  };
}

function mountPage(): VueWrapper {
  return mount(SmartTaskSettings, {
    global: { plugins: [createPinia(), i18n, naive] },
  });
}

beforeEach(() => {
  stubThreadBudget({
    logicalCores: 16,
    onnx: 4,
    llm: 6,
    onnxConfigured: false,
    llmConfigured: true,
  });
});

describe("SmartTaskSettings", () => {
  it("展示主进程回报的实际生效线程数", async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain("当前生效：嵌入 / 重排序 4 线程、本地大模型 6 线程（16 逻辑核）");
    expect(wrapper.text()).toContain("线程与并发的改动在模型重载后生效");
  });

  it("配置里缺 smartTask 块时按默认值渲染", async () => {
    const wrapper = mountPage();
    await flushPromises();

    const values = wrapper
      .findAll(".n-input-number input")
      .map((input) => Number((input.element as HTMLInputElement).value));
    expect(values).toContain(DEFAULT_SMART_TASK_CONFIG.semanticLinkConcurrency);
    expect(values).toContain(DEFAULT_SMART_TASK_CONFIG.annTopK);
    expect(values).toContain(DEFAULT_SMART_TASK_CONFIG.rerankTopK);
    expect(values).toContain(DEFAULT_SMART_TASK_CONFIG.conceptInputWindowChars);
  });

  it("渲染三个分组", async () => {
    const wrapper = mountPage();
    await flushPromises();

    for (const label of ["资源占用", "语义链接", "概念抽取"]) {
      expect(wrapper.text()).toContain(label);
    }
  });

  it("切换开关按 smartTask.<key> 路径写配置", async () => {
    const wrapper = mountPage();
    await flushPromises();

    // 第一个开关是「允许 CPU 密集模型并行」（线程行的自动开关在其后）
    await wrapper.find(".n-switch").trigger("click");
    await flushPromises();

    expect(window.electronAPI.config.setValue).toHaveBeenCalledWith(
      "smartTask.allowCpuBoundParallel",
      true,
    );
  });

  it("取不到线程预算时不渲染生效值行，页面仍可用", async () => {
    stubThreadBudget(null);
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).not.toContain("当前生效");
    expect(wrapper.text()).toContain("资源占用");
  });
});
