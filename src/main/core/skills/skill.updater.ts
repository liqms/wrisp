import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { configService } from '@/main/core/services/config.service';
import { skillManager } from './skill.manager';
import { Logger } from '@/main/utils/logger';
import { compareVersions, VersionComparison } from '@/main/utils/version';
import type { SkillUpdateItem, SkillDefinition } from '@/shared/types/skill.types';

const REMOTE = 'remote';

interface RemoteManifestEntry {
  id: string;
  name: string;
  version: string;
}

interface RemoteManifest {
  skills: RemoteManifestEntry[];
}

class SkillUpdater {
  private static instance: SkillUpdater | null = null;

  private constructor() {}

  public static getInstance(): SkillUpdater {
    if (!SkillUpdater.instance) {
      SkillUpdater.instance = new SkillUpdater();
    }
    return SkillUpdater.instance;
  }

  private getSkillsDir(): string {
    const workspacePath = (globalThis as Record<string, unknown>).__WRISP_WORKSPACE_PATH__ as string;
    if (workspacePath && workspacePath.trim() !== '') {
      return path.join(workspacePath, 'skills');
    }
    return path.join(app.getPath('userData'), 'skills');
  }

  private getRemoteDir(): string {
    return path.join(this.getSkillsDir(), REMOTE);
  }

  async checkForUpdates(): Promise<SkillUpdateItem[]> {
    try {
      const appConfig = configService.getConfig();
      const { skillsConfig } = appConfig;

      if (!skillsConfig.remoteUpdateEnabled) {
        Logger.info('Skill remote update is disabled');
        return [];
      }

      if (!skillsConfig.remoteUpdateUrl) {
        Logger.warn('remoteUpdateUrl is empty');
        return [];
      }

      const manifestUrl = `${skillsConfig.remoteUpdateUrl}/manifest.json`;
      let response: Response;
      try {
        response = await fetch(manifestUrl);
      } catch (error) {
        Logger.error('Failed to fetch remote skill manifest', { error: String(error), url: manifestUrl });
        return [];
      }

      if (!response.ok) {
        Logger.error(`Remote manifest fetch failed with status ${response.status}`, { url: manifestUrl });
        return [];
      }

      let remoteManifest: RemoteManifest;
      try {
        remoteManifest = await response.json() as RemoteManifest;
      } catch (error) {
        Logger.error('Failed to parse remote skill manifest', { error: String(error) });
        return [];
      }

      if (!remoteManifest.skills || !Array.isArray(remoteManifest.skills)) {
        Logger.error('Remote manifest has invalid skills array');
        return [];
      }

      const remoteSkillMap = new Map<string, RemoteManifestEntry>();
      for (const skill of remoteManifest.skills) {
        remoteSkillMap.set(skill.id, skill);
      }

      const remoteSkillIds = new Set(remoteSkillMap.keys());

      const localSkills = this.getLocalRemoteSkills();
      const localSkillIds = new Set(localSkills.keys());

      const updateItems: SkillUpdateItem[] = [];

      for (const remoteId of remoteSkillIds) {
        const remoteSkill = remoteSkillMap.get(remoteId)!;
        if (!localSkillIds.has(remoteId)) {
          updateItems.push({
            skillId: remoteSkill.id,
            name: remoteSkill.name,
            action: 'add',
            version: remoteSkill.version,
          });
        } else {
          const localSkill = localSkills.get(remoteId)!;
          if (compareVersions(remoteSkill.version, localSkill.version) === VersionComparison.NEWER) {
            updateItems.push({
              skillId: remoteSkill.id,
              name: remoteSkill.name,
              action: 'update',
              version: remoteSkill.version,
            });
          }
        }
      }

      for (const localId of localSkillIds) {
        if (!remoteSkillIds.has(localId)) {
          const localSkill = localSkills.get(localId)!;
          updateItems.push({
            skillId: localSkill.id,
            name: localSkill.name,
            action: 'remove',
            version: localSkill.version,
          });
        }
      }

      Logger.info('Skill update check complete', { updateCount: updateItems.length });
      return updateItems;
    } catch (error) {
      Logger.error('Unexpected error during skill update check', { error: String(error) });
      return [];
    }
  }

  private getLocalRemoteSkills(): Map<string, { id: string; name: string; version: string }> {
    const result = new Map<string, { id: string; name: string; version: string }>();
    const remoteDir = this.getRemoteDir();

    if (!fs.existsSync(remoteDir)) {
      return result;
    }

    let files: string[];
    try {
      files = fs.readdirSync(remoteDir).filter(f => f.endsWith('.skill.json'));
    } catch {
      Logger.warn(`Failed to read remote skills directory: ${remoteDir}`);
      return result;
    }

    for (const file of files) {
      const filePath = path.join(remoteDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const skill: SkillDefinition = JSON.parse(content);
        result.set(skill.id, { id: skill.id, name: skill.name, version: skill.version });
      } catch (error) {
        Logger.warn(`Failed to load remote skill file: ${filePath}`, { error: String(error) });
      }
    }

    return result;
  }

  async applyUpdates(): Promise<void> {
    try {
      const updateItems = await this.checkForUpdates();

      if (updateItems.length === 0) {
        Logger.info('No skill updates to apply');
        return;
      }

      const appConfig = configService.getConfig();
      const { skillsConfig } = appConfig;
      const remoteDir = this.getRemoteDir();

      fs.mkdirSync(remoteDir, { recursive: true });

      for (const item of updateItems) {
        try {
          if (item.action === 'add' || item.action === 'update') {
            const downloadUrl = `${skillsConfig.remoteUpdateUrl}/skills/${item.skillId}.skill.json`;
            let response: Response;
            try {
              response = await fetch(downloadUrl);
            } catch (error) {
              Logger.error(`Failed to download skill: ${item.skillId}`, { error: String(error), url: downloadUrl });
              continue;
            }

            if (!response.ok) {
              Logger.error(`Skill download failed with status ${response.status}`, { skillId: item.skillId, url: downloadUrl });
              continue;
            }

            let skillContent: string;
            try {
              skillContent = await response.text();
            } catch (error) {
              Logger.error(`Failed to read skill content: ${item.skillId}`, { error: String(error) });
              continue;
            }

            const filePath = path.join(remoteDir, `${item.skillId}.skill.json`);
            try {
              fs.writeFileSync(filePath, skillContent, 'utf-8');
              Logger.info(`Skill ${item.action}d: ${item.skillId} (v${item.version})`);
            } catch (error) {
              Logger.error(`Failed to save skill: ${item.skillId}`, { error: String(error), filePath });
              continue;
            }
          } else if (item.action === 'remove') {
            const filePath = path.join(remoteDir, `${item.skillId}.skill.json`);
            try {
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                Logger.info(`Skill removed: ${item.skillId}`);
              } else {
                Logger.warn(`Skill file not found for removal: ${item.skillId}`);
              }
            } catch (error) {
              Logger.error(`Failed to remove skill: ${item.skillId}`, { error: String(error), filePath });
              continue;
            }
          }
        } catch (error) {
          Logger.error(`Unexpected error applying update for skill: ${item.skillId}`, { error: String(error) });
          continue;
        }
      }

      skillManager.reload();
      Logger.info('Skill updates applied successfully', { updateCount: updateItems.length });
    } catch (error) {
      Logger.error('Unexpected error during skill update application', { error: String(error) });
    }
  }
}

export const skillUpdater = SkillUpdater.getInstance();
export default SkillUpdater;