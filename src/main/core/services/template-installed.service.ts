import fs from "fs";
import path from "path";
import { configService } from "@/main/core/services/config.service";
import { RESOURCES_DIR } from "@/main/constants/folder.constants";
import {
  isResourceType,
  RESOURCE_TYPES,
} from "@/shared/enums/resource.enums";
import type { InstalledResourceList } from "@/shared/types/template.types";
import type { RemoteManifest } from "@/shared/types/resource.types";
import {
  resourceIdFromPath,
  resourcePathFromId,
} from "@/shared/utils/resource";
import { Logger } from "@/main/utils/logger";

const EMPTY: InstalledResourceList = {
  slash: [],
  page: [],
  skill: [],
};

class TemplateInstalledService {
  private static instance: TemplateInstalledService | null = null;
  private constructor() { }
  public static getInstance(): TemplateInstalledService {
    if (!TemplateInstalledService.instance) {
      TemplateInstalledService.instance = new TemplateInstalledService();
    }
    return TemplateInstalledService.instance;
  }

  private workspacePath(): string {
    const ws = (globalThis as Record<string, unknown>)
      .__WRISP_WORKSPACE_PATH__ as string | undefined;
    if (ws && ws.trim() !== "") return ws;
    return configService.getValue<string>("workspace") || "";
  }

  private filePath(): string {
    return path.join(this.workspacePath(), RESOURCES_DIR, "installed.json");
  }

  private resourcePath(type: string, id: string): string {
    return path.join(
      this.workspacePath(),
      RESOURCES_DIR,
      resourcePathFromId(type, id),
    );
  }

  /** 读取已安装清单；文件缺失返回空清单 */
  public load(): InstalledResourceList {
    try {
      const p = this.filePath();
      if (!fs.existsSync(p)) return { ...EMPTY };
      const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as Record<
        string,
        unknown
      >;
      const list: InstalledResourceList = {};
      for (const [key, value] of Object.entries(raw)) {
        if (isResourceType(key) && Array.isArray(value)) {
          list[key] = value.filter((v): v is string => typeof v === "string");
        }
      }
      for (const type of RESOURCE_TYPES) list[type] ??= [];
      return list;
    } catch (err) {
      Logger.warn("读取已安装清单失败", { error: String(err) });
      return { ...EMPTY };
    }
  }

  /**
   * 首次同步快照：installed.json 不存在时，把「本地已存在的资源文件」快照为已安装并落盘。
   * 打包只含通用模板 + 全部技能 → 职业模板默认未安装；老用户升级时本地已有文件不会丢失。
   */
  public loadWithSnapshot(remote: RemoteManifest): InstalledResourceList {
    if (!fs.existsSync(this.filePath())) {
      const list = this.snapshotFromLocal(remote);
      this.save(list);
      return list;
    }
    return this.load();
  }

  private snapshotFromLocal(remote: RemoteManifest): InstalledResourceList {
    const list: InstalledResourceList = {};
    for (const type of RESOURCE_TYPES) {
      list[type] = remote.files
        .filter((e) => e.type === type)
        .map((e) => resourceIdFromPath(e.path, e.type))
        .filter((id) => fs.existsSync(this.resourcePath(type, id)));
    }
    return list;
  }

  /** 清理已不在远程 manifest 中的 id（资源被上游下架） */
  public prune(remote: RemoteManifest): void {
    const list = this.load();
    const known = new Set(
      remote.files
        .filter((e) => isResourceType(e.type))
        .map((e) => resourceIdFromPath(e.path, e.type)),
    );
    let changed = false;
    for (const type of RESOURCE_TYPES) {
      const before = list[type] ?? [];
      list[type] = before.filter((id) => known.has(id));
      if (list[type].length !== before.length) changed = true;
    }
    if (changed) this.save(list);
  }

  public save(list: InstalledResourceList): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath()), { recursive: true });
      fs.writeFileSync(this.filePath(), JSON.stringify(list, null, 2), "utf-8");
    } catch (err) {
      Logger.error("保存已安装清单失败", { error: String(err) });
    }
  }
}

export const installedTemplateService = TemplateInstalledService.getInstance();
