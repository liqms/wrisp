import { createHash } from "crypto";
import type {
  RemoteManifest, LocalManifest, ManifestEntry,
} from "@/shared/types/resource.types";

export interface ManifestDiff {
  toAdd: ManifestEntry[];
  toUpdate: ManifestEntry[];
  toRemove: string[];
}

export function parseManifest(json: string): RemoteManifest | null {
  try {
    const p = JSON.parse(json) as unknown;
    if (typeof p !== "object" || p === null) return null;
    const o = p as Record<string, unknown>;
    if (typeof o.version !== "string") return null;
    if (typeof o.updatedAt !== "string") return null;
    if (!Array.isArray(o.files)) return null;
    const files: ManifestEntry[] = [];
    for (const f of o.files) {
      if (!f || typeof f !== "object") return null;
      const e = f as Record<string, unknown>;
      if (typeof e.type !== "string") return null;
      if (typeof e.path !== "string") return null;
      if (typeof e.version !== "string") return null;
      if (typeof e.sha256 !== "string") return null;
      files.push({
        type: e.type as ManifestEntry["type"],
        path: e.path, version: e.version, sha256: e.sha256,
      });
    }
    return { version: o.version, updatedAt: o.updatedAt, files };
  } catch { return null; }
}

export function computeFileHash(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

export function compareManifests(
  local: LocalManifest | null, remote: RemoteManifest,
): ManifestDiff {
  const remoteMap = new Map(remote.files.map((f) => [f.path, f]));
  if (!local) return { toAdd: [...remote.files], toUpdate: [], toRemove: [] };
  const localMap = new Map(local.files.map((f) => [f.path, f]));
  const toAdd: ManifestEntry[] = [];
  const toUpdate: ManifestEntry[] = [];
  const toRemove: string[] = [];
  for (const [path, r] of remoteMap) {
    const l = localMap.get(path);
    if (!l) toAdd.push(r);
    else if (l.version !== r.version || l.sha256 !== r.sha256) toUpdate.push(r);
  }
  for (const path of localMap.keys()) if (!remoteMap.has(path)) toRemove.push(path);
  return { toAdd, toUpdate, toRemove };
}
