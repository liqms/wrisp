import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useTemplateStore } from "@/renderer/store/template.store";
import { RESOURCE_TYPE } from "@/shared/enums/resource.enums";
import type {
  MarketplaceCatalog,
  MarketplaceItem,
} from "@/shared/types/template.types";

const item: MarketplaceItem = {
  id: "todo",
  type: RESOURCE_TYPE.SLASH,
  version: "1.0.0",
  title: { zh: "待办", en: "Todo" },
  description: { zh: "", en: "" },
  icon: "task_alt",
  tags: [],
  preview: { zh: "", en: "" },
  profession: ["general"],
  installed: false,
  installedVersion: "",
  updateAvailable: false,
};
const catalog: MarketplaceCatalog = { items: [item], offline: false };

const mockApi = {
  getMarketplace: vi.fn(async () => ({ success: true, data: catalog })),
  installMarketplace: vi.fn(async () => ({
    success: true,
    data: { ...item, installed: true, installedVersion: "1.0.0" },
  })),
  uninstallMarketplace: vi.fn(async () => ({
    success: true,
    data: { ...item, installed: false },
  })),
  getFile: vi.fn(async () => ({
    success: true,
    data: { customTemplates: [], disabledTemplateIds: [] },
  })),
  getBuiltIn: vi.fn(async () => ({ success: true, data: [] })),
};

(globalThis as Record<string, unknown>).window = {
  electronAPI: { template: mockApi },
} as unknown as Window;

describe("template store 市场", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });
  it("fetchMarketplace 填充目录", async () => {
    const store = useTemplateStore();
    await store.fetchMarketplace(RESOURCE_TYPE.SLASH);
    expect(store.marketplace[RESOURCE_TYPE.SLASH]?.items).toHaveLength(1);
  });
  it("installMarketplace 更新条目并刷新内置", async () => {
    const store = useTemplateStore();
    await store.fetchMarketplace(RESOURCE_TYPE.SLASH);
    const ok = await store.installMarketplace(RESOURCE_TYPE.SLASH, "todo");
    expect(ok).toBe(true);
    const updated = store.marketplace[RESOURCE_TYPE.SLASH]!.items[0];
    expect(updated.installed).toBe(true);
    expect(mockApi.getBuiltIn).toHaveBeenCalledWith(RESOURCE_TYPE.SLASH);
  });
});