import * as fs from "fs";
import * as path from "path";
import { BrowserWindow } from "electron";
import { configService } from "@/main/core/services/config.service";
import { resourceHttpClient } from "@/main/core/services/resource-http.client";
import {
  parseManifest,
  computeFileHash,
} from "@/main/core/services/resource-manifest";
import { installedTemplateService } from "@/main/core/services/template-installed.service";
import {
  RESOURCE_REPO,
  RESOURCE_CONFIG,
} from "@/main/constants/resource.constants";
import { RESOURCES_DIR } from "@/main/constants/folder.constants";
import {
  DEFAULT_TEMPLATE_ICON,
  isTemplateIconName,
} from "@/shared/enums/template.enums";
import {
  isResourceType,
  RESOURCE_TYPE,
  type ResourceType,
} from "@/shared/enums/resource.enums";
import { PROFESSION, type Profession } from "@/shared/enums/profession.enums";
import type {
  MarketplaceCatalog,
  MarketplaceItem,
} from "@/shared/types/template.types";
import type {
  ManifestEntry,
  RemoteManifest,
} from "@/shared/types/resource.types";
import {
  resourceIdFromPath,
  resourcePathFromId,
} from "@/shared/utils/resource";
import { compareVersions, VersionComparison } from "@/main/utils/version";
import { Logger } from "@/main/utils/logger";

/** 技能文件的最小结构（市场只消费其中部分字段） */
interface SkillFileMeta {
  id?: string;
  name?: { zh: string; en: string };
  description?: { zh: string; en: string };
  icon?: string;
  version?: string;
  tags?: { zh: string; en: string }[];
  promptTemplate?: { zh: string; en: string };
}

class TemplateMarketService {
  private static instance: TemplateMarketService | null = null;
  private constructor() { }
  public static getInstance(): TemplateMarketService {
    if (!TemplateMarketService.instance) {
      TemplateMarketService.instance = new TemplateMarketService();
    }
    return TemplateMarketService.instance;
  }

  private workspacePath(): string {
    const ws = (globalThis as Record<string, unknown>)
      .__WRISP_WORKSPACE_PATH__ as string | undefined;
    if (ws && ws.trim() !== "") return ws;
    return configService.getValue<string>("workspace") || "";
  }
  private rawUrl(relPath: string): string {
    return `${RESOURCE_REPO.rawBase}/${RESOURCE_REPO.owner}/${RESOURCE_REPO.repo}/${RESOURCE_REPO.branch}/${relPath}`;
  }
  private localManifestPath(): string {
    return path.join(this.workspacePath(), RESOURCES_DIR, "manifest.json");
  }
  private resourceAbsPath(type: string, id: string): string {
    return path.join(
      this.workspacePath(),
      RESOURCES_DIR,
      resourcePathFromId(type, id),
    );
  }

  private async fetchRemoteManifest(): Promise<RemoteManifest | null> {
    const res = await resourceHttpClient.fetchText(
      this.rawUrl(RESOURCE_CONFIG.manifestPath),
    );
    if (!res.ok) {
      Logger.warn("拉取远程 manifest 失败", { error: res.error });
      return null;
    }
    return parseManifest(res.text);
  }

  private loadLocalManifest(): RemoteManifest | null {
    try {
      const p = this.localManifestPath();
      if (!fs.existsSync(p)) return null;
      return parseManifest(fs.readFileSync(p, "utf-8"));
    } catch (err) {
      Logger.warn("读取本地 manifest 失败", { error: String(err) });
      return null;
    }
  }

  /** 读取本地资源原始 JSON（不存在返回 null） */
  private readLocalRaw(type: string, id: string): Record<string, unknown> | null {
    try {
      const p = this.resourceAbsPath(type, id);
      if (!fs.existsSync(p)) return null;
      const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, unknown>;
      return raw;
    } catch {
      return null;
    }
  }

  /** 下载远程资源原始 JSON 并做 sha256 校验 */
  private async fetchRemoteRaw(
    entry: ManifestEntry,
  ): Promise<Record<string, unknown> | null> {
    const url = this.rawUrl(`${RESOURCE_CONFIG.resourcesDir}/${entry.path}`);
    const res = await resourceHttpClient.fetchText(url);
    if (!res.ok) {
      Logger.warn("拉取资源文件失败", { path: entry.path, error: res.error });
      return null;
    }
    if (computeFileHash(res.text) !== entry.sha256) {
      Logger.warn("资源文件 hash 校验失败", { path: entry.path });
      return null;
    }
    try {
      return JSON.parse(res.text) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /** 按类型把原始 JSON 归一化为市场条目主体（不含安装状态） */
  private toItemBody(
    raw: Record<string, unknown>,
    id: string,
    type: ResourceType,
    version: string,
  ): Omit<MarketplaceItem, "installed" | "installedVersion" | "updateAvailable"> | null {
    if (type === RESOURCE_TYPE.SKILL) {
      const s = raw as SkillFileMeta;
      return {
        id,
        type,
        version,
        title: s.name ?? { zh: id, en: id },
        description: s.description ?? { zh: "", en: "" },
        icon: typeof s.icon === "string" && s.icon.trim() !== "" ? s.icon : "✨",
        tags: Array.isArray(s.tags) ? s.tags : [],
        preview: s.promptTemplate ?? { zh: "", en: "" },
        profession: [],
      };
    }
    return {
      id,
      type,
      version,
      title: (raw.title as MarketplaceItem["title"]) ?? { zh: id, en: id },
      description: (raw.description as MarketplaceItem["description"]) ?? { zh: "", en: "" },
      icon: isTemplateIconName(raw.icon) ? raw.icon : DEFAULT_TEMPLATE_ICON,
      tags: Array.isArray(raw.tags) ? (raw.tags as MarketplaceItem["tags"]) : [],
      preview: (raw.markdown as MarketplaceItem["preview"]) ?? { zh: "", en: "" },
      profession: Array.isArray(raw.profession)
        ? (raw.profession as Profession[]).filter(
          (p) => typeof p === "string" && p !== PROFESSION.CUSTOM,
        )
        : [PROFESSION.GENERAL],
    };
  }

  private async buildEntry(
    entry: ManifestEntry,
    offline: boolean,
  ): Promise<MarketplaceItem | null> {
    if (!isResourceType(entry.type)) return null;
    const type = entry.type;
    const id = resourceIdFromPath(entry.path, type);
    const localRaw = this.readLocalRaw(type, id);
    const raw =
      localRaw ?? (offline ? null : await this.fetchRemoteRaw(entry));
    if (!raw) {
      // 在线时远程内容拉取失败：仍以清单元数据产出未安装的骨架条目
      if (offline) return null;
      const isSkill = type === RESOURCE_TYPE.SKILL;
      return {
        id,
        type,
        version: entry.version,
        title: { zh: id, en: id },
        description: { zh: "", en: "" },
        icon: isSkill ? "✨" : DEFAULT_TEMPLATE_ICON,
        tags: [],
        preview: { zh: "", en: "" },
        profession: isSkill ? [] : [PROFESSION.GENERAL],
        installed: false,
        installedVersion: "",
        updateAvailable: false,
      };
    }
    const body = this.toItemBody(raw, id, type, entry.version);
    if (!body) return null;
    const installedVersion =
      typeof localRaw?.version === "string" ? localRaw.version : "";
    return {
      ...body,
      installed: localRaw !== null,
      installedVersion,
      updateAvailable:
        localRaw !== null &&
        compareVersions(installedVersion, entry.version) ===
        VersionComparison.OLDER,
    };
  }

  /** 拉取模板市场目录 */
  public async getCatalog(
    type: ResourceType,
    _force = false,
  ): Promise<MarketplaceCatalog> {
    const remote = await this.fetchRemoteManifest();
    const manifest = remote ?? this.loadLocalManifest();
    if (!manifest) return { items: [], offline: true };

    const entries = manifest.files.filter((e) => e.type === type);
    const items = await Promise.all(
      entries.map((e) => this.buildEntry(e, remote === null)),
    );
    return {
      items: items.filter((e): e is MarketplaceItem => e !== null),
      offline: remote === null,
    };
  }

  /** 安装：下载 + hash 校验 + 写入文件 + 加入已安装清单 */
  public async install(
    type: ResourceType,
    id: string,
  ): Promise<MarketplaceItem> {
    const manifest =
      (await this.fetchRemoteManifest()) ?? this.loadLocalManifest();
    const entry = manifest?.files.find(
      (e) => e.type === type && resourceIdFromPath(e.path, e.type) === id,
    );
    if (!entry) throw new Error("资源不存在于远程清单");

    const url = this.rawUrl(`${RESOURCE_CONFIG.resourcesDir}/${entry.path}`);
    const res = await resourceHttpClient.fetchText(url);
    if (!res.ok) throw new Error(`下载资源失败: ${res.error}`);
    if (computeFileHash(res.text) !== entry.sha256)
      throw new Error("资源文件 hash 校验失败");

    const abs = this.resourceAbsPath(type, id);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, res.text, "utf-8");

    const installed = installedTemplateService.load();
    installed[type] = [...new Set([...(installed[type] ?? []), id])];
    installedTemplateService.save(installed);

    this.broadcastUpdate([type]);
    const item = await this.buildEntry(entry, false);
    if (!item) throw new Error("安装后资源读取失败");
    return item;
  }

  /** 卸载：从清单移除 + 删除本地文件 */
  public async uninstall(
    type: ResourceType,
    id: string,
  ): Promise<MarketplaceItem> {
    const installed = installedTemplateService.load();
    installed[type] = (installed[type] ?? []).filter((v) => v !== id);
    installedTemplateService.save(installed);

    const abs = this.resourceAbsPath(type, id);
    try {
      fs.unlinkSync(abs);
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
        Logger.warn("删除资源文件失败", { path: abs, error: String(err) });
      }
    }

    this.broadcastUpdate([type]);
    const list = await this.getCatalog(type, true);
    const found = list.items.find((i) => i.id === id);
    if (found) return found;
    // 离线且本地文件已删除的兜底：返回最小条目
    const manifest = this.loadLocalManifest();
    const entry = manifest?.files.find(
      (e) => e.type === type && resourceIdFromPath(e.path, e.type) === id,
    );
    return {
      id,
      type,
      version: entry?.version ?? "",
      title: { zh: id, en: id },
      description: { zh: "", en: "" },
      icon: type === RESOURCE_TYPE.SKILL ? "✨" : DEFAULT_TEMPLATE_ICON,
      tags: [],
      preview: { zh: "", en: "" },
      profession: type === RESOURCE_TYPE.SKILL ? [] : [PROFESSION.GENERAL],
      installed: false,
      installedVersion: "",
      updateAvailable: false,
    };
  }

  private broadcastUpdate(types: ResourceType[]): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("resource:updated", types);
    }
  }
}

export const templateMarketService = TemplateMarketService.getInstance();