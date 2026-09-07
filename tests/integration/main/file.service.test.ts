// @vitest-environment node
import { vi, describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/tmp"),
    getVersion: vi.fn(() => "1.0.0"),
    getName: vi.fn(() => "Wrisp"),
    on: vi.fn(),
  },
  BrowserWindow: vi.fn(),
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
}));
vi.mock("@/main/utils/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}));
vi.mock("@/main/utils", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  NodeCryptoUtil: {
    sha256: vi.fn(() => "hash"),
  },
}));

// getValue 惰性读取：mock 工厂执行时只创建闭包，workspace 在 beforeAll 赋值
let workspace = "";
vi.mock("@/main/core/services/config.service", () => ({
  configService: {
    getValue: vi.fn((key: string) =>
      key === "workspace" ? workspace : undefined,
    ),
  },
}));

import { fileService } from "@/main/core/services/base/file.service";

const WORKSPACE = path.join(
  os.tmpdir(),
  `wrisp-file-svc-test-${process.pid}-${Date.now()}`,
);

beforeAll(() => {
  workspace = WORKSPACE;
});

afterAll(() => {
  fs.rmSync(WORKSPACE, { recursive: true, force: true });
});

describe("FileService.writeFile 末尾空行规范化", () => {
  it("md 无尾换行：写盘后末尾恰好一个空行", () => {
    const rel = path.join("journal", "2026-09-05.md");
    fileService.writeFile(rel, "# 标题\n\n正文");
    expect(fs.readFileSync(path.join(WORKSPACE, rel), "utf-8")).toBe(
      "# 标题\n\n正文\n\n",
    );
  });

  it("md 已有单个尾换行：规范化为恰好一个空行", () => {
    const rel = "journal/single-nl.md";
    fileService.writeFile(rel, "内容\n");
    expect(fs.readFileSync(path.join(WORKSPACE, rel), "utf-8")).toBe(
      "内容\n\n",
    );
  });

  it("md 已有多个尾换行：压缩为恰好一个空行", () => {
    const rel = "journal/multi-nl.md";
    fileService.writeFile(rel, "内容\n\n\n\n");
    expect(fs.readFileSync(path.join(WORKSPACE, rel), "utf-8")).toBe(
      "内容\n\n",
    );
  });

  it("md 尾换行前带 CRLF：同样压缩（兼容 Windows 行尾历史文件）", () => {
    const rel = "journal/crlf.md";
    fileService.writeFile(rel, "内容\r\n\r\n");
    expect(fs.readFileSync(path.join(WORKSPACE, rel), "utf-8")).toBe(
      "内容\n\n",
    );
  });

  it("md 空内容：保持空文件不追加", () => {
    const rel = "journal/empty.md";
    fileService.writeFile(rel, "");
    expect(fs.readFileSync(path.join(WORKSPACE, rel), "utf-8")).toBe("");
  });

  it("非 md 文件（json）：不做规范化", () => {
    const rel = "project.json";
    const content = '{"a":1}';
    fileService.writeFile(rel, content);
    expect(fs.readFileSync(path.join(WORKSPACE, rel), "utf-8")).toBe(content);
  });

  it("大写 .MD 扩展名：同样规范化", () => {
    const rel = "journal/upper.MD";
    fileService.writeFile(rel, "内容");
    expect(fs.readFileSync(path.join(WORKSPACE, rel), "utf-8")).toBe(
      "内容\n\n",
    );
  });
});
