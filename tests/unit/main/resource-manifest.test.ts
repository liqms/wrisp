// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  parseManifest,
  computeFileHash,
  compareManifests,
} from "@/main/core/services/resource-manifest";
import type { RemoteManifest, LocalManifest } from "@/shared/types/resource.types";

const entry = (path: string, version: string, sha256: string) => ({
  type: "slash" as const, path, version, sha256,
});

describe("parseManifest", () => {
  it("合法 JSON 返回对象", () => {
    const r = parseManifest(JSON.stringify({
      version: "1.0.0", updatedAt: "2026-08-31T10:00:00Z",
      files: [entry("slash/a.json", "1.0.0", "abc")],
    }));
    expect(r).not.toBeNull();
    expect(r!.files).toHaveLength(1);
  });
  it("非法 JSON 返回 null", () => {
    expect(parseManifest("bad")).toBeNull();
  });
  it("缺少 files 返回 null", () => {
    expect(parseManifest(JSON.stringify({ version: "1.0.0" }))).toBeNull();
  });
});

describe("computeFileHash", () => {
  it("相同内容相同 hash", () => {
    expect(computeFileHash("hello")).toBe(computeFileHash("hello"));
  });
  it("返回 64 字符 hex", () => {
    expect(computeFileHash("test")).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("compareManifests", () => {
  const remote: RemoteManifest = {
    version: "1.0.0", updatedAt: "2026-08-31T10:00:00Z",
    files: [
      entry("a.json", "1.0.0", "ha"),
      entry("b.json", "1.0.0", "hb2"),
      entry("c.json", "1.0.0", "hc"),
    ],
  };
  it("local null 时全部 toAdd", () => {
    const d = compareManifests(null, remote);
    expect(d.toAdd).toHaveLength(3);
    expect(d.toUpdate).toHaveLength(0);
    expect(d.toRemove).toHaveLength(0);
  });
  it("version 不一致 → toUpdate", () => {
    const local: LocalManifest = {
      version: "0.9.0", updatedAt: "",
      files: [entry("a.json", "1.0.0", "ha"), entry("b.json", "0.9.0", "hb1")],
    };
    const d = compareManifests(local, remote);
    expect(d.toAdd[0].path).toBe("c.json");
    expect(d.toUpdate[0].path).toBe("b.json");
  });
  it("sha256 不一致 → toUpdate", () => {
    const local: LocalManifest = {
      version: "1.0.0", updatedAt: "",
      files: [entry("a.json", "1.0.0", "different")],
    };
    const d = compareManifests(local, remote);
    expect(d.toUpdate[0].path).toBe("a.json");
  });
  it("本地多余 → toRemove", () => {
    const local: LocalManifest = {
      version: "1.0.0", updatedAt: "",
      files: [entry("a.json", "1.0.0", "ha"), entry("old.json", "0.8", "ho")],
    };
    const d = compareManifests(local, remote);
    expect(d.toRemove).toEqual(["old.json"]);
  });
  it("完全一致时空", () => {
    const d = compareManifests(JSON.parse(JSON.stringify(remote)), remote);
    expect(d.toAdd).toHaveLength(0);
    expect(d.toUpdate).toHaveLength(0);
    expect(d.toRemove).toHaveLength(0);
  });
});
