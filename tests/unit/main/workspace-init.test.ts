// @vitest-environment node
import path from "path";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.mock("@/main/utils/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}));
const mockGetWorkspace = vi.hoisted(() => vi.fn(() => "/tmp/wrisp-test-ws"));
vi.mock("@/main/core/services/config.service", () => ({
  configService: { getValue: mockGetWorkspace },
}));
vi.mock("electron", () => ({ app: { getAppPath: vi.fn(() => "/app") } }));

// 服务中 sourceDir = path.resolve(app.getAppPath(), "resources")，此处用同一表达式保持一致
const APP_RES = path.resolve("/app", "resources");

const files: Record<string, string> = {
  [path.join(APP_RES, "manifest.json")]: JSON.stringify({ version: "1.0.0" }),
  [path.join(APP_RES, "slash", "todo.json")]: JSON.stringify({
    id: "todo",
    profession: ["general"],
  }),
  [path.join(APP_RES, "slash", "article.json")]: JSON.stringify({
    id: "article",
    profession: ["writer"],
  }),
  [path.join(APP_RES, "skills", "polish.skill.json")]: JSON.stringify({
    id: "polish",
    name: { zh: "润色", en: "Polish" },
  }),
};

const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  readFileSync: vi.fn(),
  copyFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));
vi.mock("fs", () => ({
  __esModule: true,
  default: mockFs,
  existsSync: mockFs.existsSync,
  mkdirSync: mockFs.mkdirSync,
  readdirSync: mockFs.readdirSync,
  readFileSync: mockFs.readFileSync,
  copyFileSync: mockFs.copyFileSync,
  writeFileSync: mockFs.writeFileSync,
}));

import WorkspaceInitService from "@/main/core/services/base/workspace-init.service";

describe("WorkspaceInitService 首启复制过滤", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 走 dev 分支，使 sourceDir = path.resolve(app.getAppPath(), "resources")
    process.env.VITE_DEV_SERVER_URL = "http://localhost:5173";
    // existsSync 必须额外判定 sourceDir 本身存在，否则 ensureResourcesCopied 提前 return
    mockFs.existsSync.mockImplementation((p: string) =>
      Object.prototype.hasOwnProperty.call(files, p) || p === APP_RES,
    );
    mockFs.readFileSync.mockImplementation((p: string) => files[p]);
  });
  afterEach(() => {
    delete process.env.VITE_DEV_SERVER_URL;
  });

  it("ensureWorkspace 复制时跳过职业模板（writer）", async () => {
    // 服务使用 readdirSync(src, { withFileTypes: true })，需返回带 isDirectory 的 Dirent 结构
    const dirent = (name: string, isDir: boolean) => ({
      name,
      isDirectory: () => isDir,
    });
    mockFs.readdirSync.mockImplementation((p: string) => {
      if (p === APP_RES) {
        return [
          dirent("manifest.json", false),
          dirent("slash", true),
          dirent("skills", true),
        ];
      }
      if (p === path.join(APP_RES, "slash")) {
        return [dirent("todo.json", false), dirent("article.json", false)];
      }
      if (p === path.join(APP_RES, "skills")) {
        return [dirent("polish.skill.json", false)];
      }
      return [];
    });
    await WorkspaceInitService.getInstance().ensureWorkspace();
    // 通用模板 todo 被复制
    expect(mockFs.copyFileSync).toHaveBeenCalledWith(
      path.join(APP_RES, "slash", "todo.json"),
      expect.stringContaining(path.join("slash", "todo.json")),
    );
    // 职业模板 article 不被复制
    const calls = mockFs.copyFileSync.mock.calls.map((c: string[]) => c[0]);
    expect(calls).not.toContain(path.join(APP_RES, "slash", "article.json"));
    // 技能与 manifest 全量复制
    expect(calls).toContain(path.join(APP_RES, "skills", "polish.skill.json"));
    expect(calls).toContain(path.join(APP_RES, "manifest.json"));
  });
});
