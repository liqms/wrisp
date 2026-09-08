// @vitest-environment node
import path from "path";
import { vi, describe, it, expect, beforeEach } from "vitest";

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

import { installedTemplateService } from "@/main/core/services/template-installed.service";
import type { RemoteManifest } from "@/shared/types/resource.types";

const remote: RemoteManifest = {
  version: "1.0.0",
  updatedAt: "2026-09-08T00:00:00Z",
  files: [
    { type: "slash", path: "slash/todo.json", version: "1.0.0", sha256: "h1" },
    {
      type: "page",
      path: "page/page-prd.json",
      version: "1.0.0",
      sha256: "h2",
    },
    {
      type: "skill",
      path: "skills/polish.skill.json",
      version: "1.0.0",
      sha256: "h3",
    },
  ],
};

describe("TemplateInstalledService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue("{}");
  });

  it("文件缺失时 load 返回空清单（三类）", () => {
    expect(installedTemplateService.load()).toEqual({
      slash: [],
      page: [],
      skill: [],
    });
  });
  it("loadWithSnapshot 文件缺失时按本地已存在文件快照并落盘", () => {
    mockFs.existsSync.mockImplementation(
      (p: string) =>
        p.endsWith(path.join("slash", "todo.json")) ||
        p.endsWith(path.join("skills", "polish.skill.json")),
    );
    const list = installedTemplateService.loadWithSnapshot(remote);
    expect(list).toEqual({ slash: ["todo"], page: [], skill: ["polish"] });
    expect(mockFs.writeFileSync).toHaveBeenCalled();
  });
  it("loadWithSnapshot 在文件存在时读取文件", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ slash: ["todo"], page: [], skill: [] }),
    );
    const list = installedTemplateService.loadWithSnapshot(remote);
    expect(list.slash).toEqual(["todo"]);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });
  it("save 落盘", () => {
    installedTemplateService.save({ slash: ["a"], page: [], skill: [] });
    expect(mockFs.writeFileSync).toHaveBeenCalled();
  });
  it("prune 移除已不在远程清单中的 id", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ slash: ["todo", "ghost"], page: [], skill: ["polish"] }),
    );
    installedTemplateService.prune(remote);
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('"slash": [\n    "todo"'),
      "utf-8",
    );
  });
});
