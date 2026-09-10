import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// 单测环境没有 Electron 运行时：skillSchemaValidator 在导入期会调用
// app.getAppPath()（schema 路径解析），不 mock 会抛
// "Cannot read properties of undefined (reading 'getAppPath')"。
vi.mock("electron", () => ({
  app: {
    getAppPath: () => process.cwd(),
    getPath: () => process.cwd(),
  },
}));

import {
  projectSkillStore,
  getProjectSkillsDir,
} from "@/main/core/skills/project-skill.store";
import type { SkillDefinition } from "@/shared/types/skill.types";

function makeSkill(id: string): SkillDefinition {
  return {
    id,
    name: { zh: id, en: id },
    description: { zh: "", en: "" },
    icon: "📝",
    version: "1.0.0",
    author: "test",
    category: ["writing"],
    enabled: true,
    promptTemplate: { zh: "{{text}}", en: "{{text}}" },
    sourceTemplateId: "outline",
    sourceTemplateVersion: "1.0.0",
  };
}

describe("ProjectSkillStore", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "wrisp-proj-"));
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it("技能目录位于作品文件夹下的 skills/", () => {
    expect(getProjectSkillsDir(projectDir)).toBe(path.join(projectDir, "skills"));
  });

  it("写入后可读回，且保留来源元数据", () => {
    projectSkillStore.write(projectDir, makeSkill("work-outline"));
    const read = projectSkillStore.read(projectDir, "work-outline");
    expect(read?.sourceTemplateId).toBe("outline");
    expect(read?.sourceTemplateVersion).toBe("1.0.0");
  });

  it("目录不存在时 list 返回空数组", () => {
    expect(projectSkillStore.list(path.join(projectDir, "nope"))).toEqual([]);
  });

  it("remove 删除对应文件", () => {
    projectSkillStore.write(projectDir, makeSkill("work-outline"));
    projectSkillStore.remove(projectDir, "work-outline");
    expect(projectSkillStore.read(projectDir, "work-outline")).toBeNull();
  });
});
