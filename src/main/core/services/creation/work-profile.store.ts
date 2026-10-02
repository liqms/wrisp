import * as fs from "fs";
import * as path from "path";
import { Logger } from "@/main/utils/logger";
import type { WorkProfile } from "@/shared/types";

export const WORK_PROFILE_FILE = "work-profile.json";

export function getWorkProfilePath(projectFilePath: string): string {
  return path.join(projectFilePath, WORK_PROFILE_FILE);
}

/**
 * 作品档案读写。
 *
 * 独立于 project.json —— 后者由 project.service.syncProjectJson() 用数据库记录
 * 整份覆盖，把智能体数据写在里面会在下次同步时被清掉。
 */
class WorkProfileStore {
  public read(projectFilePath: string): WorkProfile {
    const file = getWorkProfilePath(projectFilePath);
    try {
      if (!fs.existsSync(file)) return {};
      return JSON.parse(fs.readFileSync(file, "utf-8")) as WorkProfile;
    } catch (error) {
      Logger.warn("[WorkProfileStore] 读取作品档案失败", {
        file,
        error: String(error),
      });
      return {};
    }
  }

  public write(projectFilePath: string, profile: WorkProfile): void {
    const file = getWorkProfilePath(projectFilePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(profile, null, 2), "utf-8");
  }

  /** 合并写入（保留未提供的部分） */
  public merge(projectFilePath: string, patch: WorkProfile): WorkProfile {
    const merged: WorkProfile = { ...this.read(projectFilePath), ...patch };
    this.write(projectFilePath, merged);
    return merged;
  }
}

export const workProfileStore = new WorkProfileStore();
