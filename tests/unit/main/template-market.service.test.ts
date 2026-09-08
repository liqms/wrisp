// @vitest-environment node
import path from "path";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/main/utils/logger", () => ({
  Logger: {
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn(),
  },
}));
vi.mock("electron", () => ({
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}));
const mockGetWorkspace = vi.hoisted(() => vi.fn(() => "/tmp/wrisp-test-ws"));
vi.mock("@/main/core/services/config.service", () => ({
  configService: { getValue: mockGetWorkspace },
}));
const mockFetchText = vi.hoisted(() => vi.fn());
vi.mock("@/main/core/services/resource-http.client", () => ({
  resourceHttpClient: { fetchText: mockFetchText },
}));
const mockParse = vi.hoisted(() => vi.fn());
const mockHash = vi.hoisted(() => vi.fn(() => "h"));
vi.mock("@/main/core/services/resource-manifest", () => ({
  parseManifest: mockParse,
  computeFileHash: mockHash,
  compareManifests: vi.fn(() => ({ toAdd: [], toUpdate: [], toRemove: [] })),
}));
const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));
vi.mock("fs", () => ({
  __esModule: true,
  default: mockFs,
  existsSync: mockFs.existsSync,
  mkdirSync: mockFs.mkdirSync,
  readFileSync: mockFs.readFileSync,
  writeFileSync: mockFs.writeFileSync,
  unlinkSync: mockFs.unlinkSync,
}));

import { templateMarketService } from "@/main/core/services/template-market.service";
import type { RemoteManifest } from "@/shared/types/resource.types";

const remote: RemoteManifest = {
  version: "1.0.0",
  updatedAt: "2026-09-08T00:00:00Z",
  files: [
    { type: "slash", path: "slash/todo.json", version: "1.0.0", sha256: "h1" },
    { type: "slash", path: "slash/article.json", version: "1.1.0", sha256: "h2" },
    { type: "skill", path: "skills/polish.skill.json", version: "1.0.0", sha256: "h3" },
  ],
};

const localTodo = JSON.stringify({
  id: "todo",
  version: "1.0.0",
  title: { zh: "待办清单", en: "Todo List" },
  description: { zh: "插入待办清单框架", en: "Insert todo list skeleton" },
  icon: "task_alt",
  markdown: { zh: "## 待办", en: "## Todos" },
  profession: ["general"],
  tags: [{ zh: "计划", en: "planning" }],
  enabled: true,
});

describe("TemplateMarketService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    mockFetchText.mockResolvedValue({ ok: true, text: "manifest" });
    mockParse.mockReturnValue(remote);
  });

  it("模板目录：已安装带版本，远程较新则 updateAvailable", async () => {
    mockFs.existsSync.mockImplementation(
      (p: string) =>
        p.endsWith("installed.json") || p.endsWith(path.join("slash", "todo.json")),
    );
    mockFs.readFileSync.mockImplementation((p: string) =>
      p.endsWith("installed.json")
        ? JSON.stringify({ slash: ["todo"], page: [], skill: [] })
        : localTodo,
    );
    const cat = await templateMarketService.getCatalog("slash");
    expect(cat.offline).toBe(false);
    expect(cat.items).toHaveLength(2);
    const todo = cat.items.find((i) => i.id === "todo")!;
    expect(todo.installed).toBe(true);
    expect(todo.installedVersion).toBe("1.0.0");
    expect(todo.preview.zh).toContain("待办");
    const article = cat.items.find((i) => i.id === "article")!;
    expect(article.installed).toBe(false);
    expect(article.updateAvailable).toBe(false);
  });

  it("技能目录：name→title、promptTemplate→preview、emoji 图标、无职业", async () => {
    mockFs.existsSync.mockImplementation(
      (p: string) =>
        p.endsWith("installed.json") ||
        p.endsWith(path.join("skills", "polish.skill.json")),
    );
    mockFs.readFileSync.mockImplementation((p: string) =>
      p.endsWith("installed.json")
        ? JSON.stringify({ slash: [], page: [], skill: ["polish"] })
        : JSON.stringify({
            id: "polish",
            version: "1.0.0",
            name: { zh: "润色", en: "Polish" },
            description: { zh: "优化文本表达", en: "Refine wording" },
            icon: "✨",
            promptTemplate: {
              zh: "请润色：{{text}}",
              en: "Please polish: {{text}}",
            },
            tags: [{ zh: "润色", en: "polish" }],
          }),
    );
    const cat = await templateMarketService.getCatalog("skill");
    const polish = cat.items.find((i) => i.id === "polish")!;
    expect(polish.title.zh).toBe("润色");
    expect(polish.icon).toBe("✨");
    expect(polish.profession).toEqual([]);
    expect(polish.preview.en).toContain("polish");
    expect(polish.installed).toBe(true);
  });

  it("离线降级：远程 manifest 拉取失败时用本地清单，仅返回本地已知条目", async () => {
    mockFetchText.mockResolvedValueOnce({ ok: false, error: "net" });
    mockFs.existsSync.mockImplementation(
      (p: string) =>
        p.endsWith("manifest.json") || p.endsWith(path.join("slash", "todo.json")),
    );
    mockFs.readFileSync.mockImplementation((p: string) =>
      p.endsWith("manifest.json") ? JSON.stringify(remote) : localTodo,
    );
    const cat = await templateMarketService.getCatalog("slash");
    expect(cat.offline).toBe(true);
    expect(cat.items.every((i) => i.installed)).toBe(true);
  });

  it("安装：下载 + hash 校验 + 写入文件 + 更新清单", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ slash: [], page: [], skill: [] }),
    );
    mockFetchText.mockResolvedValue({ ok: true, text: "article-content" });
    mockHash.mockReturnValue("h2");
    const item = await templateMarketService.install("slash", "article");
    expect(item.installed).toBe(true);
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("article-content"),
      "utf-8",
    );
  });

  it("卸载：删除文件并更新清单", async () => {
    mockFs.existsSync.mockImplementation(
      (p: string) =>
        p.endsWith("installed.json") || p.endsWith("manifest.json"),
    );
    mockFs.readFileSync.mockImplementation((p: string) =>
      p.endsWith("installed.json")
        ? JSON.stringify({ slash: ["todo"], page: [], skill: [] })
        : JSON.stringify(remote),
    );
    mockFetchText.mockResolvedValue({ ok: false, error: "offline" });
    const item = await templateMarketService.uninstall("slash", "todo");
    expect(item.installed).toBe(false);
    expect(mockFs.unlinkSync).toHaveBeenCalled();
  });
});