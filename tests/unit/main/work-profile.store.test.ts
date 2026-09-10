import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// 单测环境无 Electron 运行时（Logger 等模块在导入期可能触及 app）
vi.mock("electron", () => ({
  app: {
    getAppPath: () => process.cwd(),
    getPath: () => process.cwd(),
  },
}));

import { workProfileStore } from "@/main/core/services/work-profile.store";

describe("workProfileStore", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "wrisp-work-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("未写入时返回空档案", () => {
    expect(workProfileStore.read(dir)).toEqual({});
  });

  it("写入简报后可读回", () => {
    workProfileStore.write(dir, {
      brief: {
        name: "测试作品",
        type: "novel",
        audience: "青年读者",
        tone: "克制",
        themes: ["成长"],
      },
    });
    const profile = workProfileStore.read(dir);
    expect(profile.brief?.name).toBe("测试作品");
    expect(profile.brief?.themes).toEqual(["成长"]);
  });

  it("写入不会触碰 project.json", () => {
    fs.writeFileSync(path.join(dir, "project.json"), '{"id":"p1"}', "utf-8");
    workProfileStore.write(dir, { brief: { name: "x", type: "novel" } });

    const raw = fs.readFileSync(path.join(dir, "project.json"), "utf-8");
    expect(raw).toBe('{"id":"p1"}');
  });

  it("文件损坏时返回空档案而不抛错", () => {
    fs.writeFileSync(path.join(dir, "work-profile.json"), "{not json", "utf-8");
    expect(workProfileStore.read(dir)).toEqual({});
  });
});
