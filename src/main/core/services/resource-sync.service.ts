import * as fs from "fs";
import * as path from "path";
import { BrowserWindow } from "electron";
import { configService } from "@/main/core/services/config.service";
import { resourceHttpClient } from "@/main/core/services/resource-http.client";
import { parseManifest, compareManifests, computeFileHash } from "@/main/core/services/resource-manifest";
import { RESOURCE_REPO, RESOURCE_CONFIG } from "@/main/constants/resource.constants";
import { RESOURCES_DIR } from "@/main/constants/folder.constants";
import { Logger } from "@/main/utils/logger";
import type { RemoteManifest, LocalManifest, SyncStatus, SyncResult } from "@/shared/types/resource.types";
import type { ResourceType } from "@/shared/enums/resource.enums";
import { EMPTY_SYNC_STATUS } from "@/shared/types/resource.types";

class ResourceSyncService {
  private static instance: ResourceSyncService | null = null;
  private status: SyncStatus = { ...EMPTY_SYNC_STATUS };
  private constructor() {}
  public static getInstance(): ResourceSyncService {
    if (!ResourceSyncService.instance) ResourceSyncService.instance = new ResourceSyncService();
    return ResourceSyncService.instance;
  }

  public getStatus(): SyncStatus { return { ...this.status }; }

  private getWorkspaceResourcesDir(): string {
    const ws = (globalThis as Record<string, unknown>).__WRISP_WORKSPACE_PATH__ as string | undefined
      || configService.getValue<string>("workspace") || "";
    return path.join(ws, RESOURCES_DIR);
  }
  private rawUrl(relPath: string): string {
    return `${RESOURCE_REPO.rawBase}/${RESOURCE_REPO.owner}/${RESOURCE_REPO.repo}/${RESOURCE_REPO.branch}/${relPath}`;
  }
  private localManifestPath(): string { return path.join(this.getWorkspaceResourcesDir(), "manifest.json"); }

  private loadLocalManifest(): LocalManifest | null {
    try {
      const p = this.localManifestPath();
      if (!fs.existsSync(p)) return null;
      return parseManifest(fs.readFileSync(p, "utf-8"));
    } catch (err) { Logger.warn("读取本地 manifest 失败", { error: String(err) }); return null; }
  }
  private saveLocalManifest(m: RemoteManifest): void {
    try {
      fs.mkdirSync(this.getWorkspaceResourcesDir(), { recursive: true });
      fs.writeFileSync(this.localManifestPath(), JSON.stringify(m, null, 2), "utf-8");
    } catch (err) { Logger.error("保存本地 manifest 失败", { error: String(err) }); }
  }
  private writeResourceFile(relPath: string, content: string): void {
    const abs = path.join(this.getWorkspaceResourcesDir(), relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf-8");
  }
  private removeResourceFile(relPath: string): void {
    const abs = path.join(this.getWorkspaceResourcesDir(), relPath);
    try { if (fs.existsSync(abs)) fs.unlinkSync(abs); }
    catch (err) { Logger.warn("删除资源文件失败", { path: relPath, error: String(err) }); }
  }
  private broadcastUpdate(changedTypes: ResourceType[]): void {
    if (changedTypes.length === 0) return;
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send("resource:updated", changedTypes);
  }

  public async checkAndSync(): Promise<SyncResult> {
    if (this.status.syncing) {
      return { success: false, changedTypes: [], added: [], updated: [], error: "sync in progress" };
    }
    this.status = { ...this.status, syncing: true, lastError: null };
    try {
      const manifestUrl = this.rawUrl(RESOURCE_CONFIG.manifestPath);
      const manifestRes = await resourceHttpClient.fetchText(manifestUrl);
      if (!manifestRes.ok) return this.failSync(`拉取 manifest 失败: ${manifestRes.error}`);

      const remote = parseManifest(manifestRes.text);
      if (!remote) return this.failSync("远程 manifest 解析失败");

      const local = this.loadLocalManifest();
      const diff = compareManifests(local, remote);

      const added: string[] = [];
      const updated: string[] = [];
      const changedTypesSet = new Set<ResourceType>();

      for (const entry of [...diff.toAdd, ...diff.toUpdate]) {
        const url = this.rawUrl(`${RESOURCE_CONFIG.resourcesDir}/${entry.path}`);
        const res = await resourceHttpClient.fetchText(url);
        if (!res.ok) { Logger.warn("下载失败，跳过", { path: entry.path, error: res.error }); continue; }
        const actualHash = computeFileHash(res.text);
        if (actualHash !== entry.sha256) {
          Logger.warn("hash 校验失败，跳过", { path: entry.path, expected: entry.sha256, actual: actualHash });
          continue;
        }
        this.writeResourceFile(entry.path, res.text);
        if (diff.toAdd.includes(entry)) added.push(entry.path);
        else updated.push(entry.path);
        changedTypesSet.add(entry.type);
      }
      for (const relPath of diff.toRemove) this.removeResourceFile(relPath);

      this.saveLocalManifest(remote);
      const changedTypes = [...changedTypesSet];
      this.broadcastUpdate(changedTypes);

      this.status = { syncing: false, lastSyncAt: new Date().toISOString(), lastSyncSuccess: true, lastError: null };
      Logger.info("资源同步完成", { added: added.length, updated: updated.length, removed: diff.toRemove.length });
      return { success: true, changedTypes, added, updated };
    } catch (err) {
      return this.failSync(err instanceof Error ? err.message : String(err));
    }
  }
  private failSync(error: string): SyncResult {
    this.status = { syncing: false, lastSyncAt: new Date().toISOString(), lastSyncSuccess: false, lastError: error };
    Logger.error("资源同步失败", { error });
    return { success: false, changedTypes: [], added: [], updated: [], error };
  }
}

export const resourceSyncService = ResourceSyncService.getInstance();
