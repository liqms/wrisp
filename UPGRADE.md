# Wrisp 版本迭代升级操作指南

> 面向开发者的发版操作手册：改版本 → 发版 → 验证 → 用户自动更新。
> 当前机制的能力与缺口见文末「升级机制缺口清单」（后续版本迭代完善）。

---

## 0. 发版一句话流程

```bash
pnpm bump 1.2.3                                    # 1. 改版本号（唯一入口）
git add -A && git commit -m "release: v1.2.3"      # 2. 提交
git tag v1.2.3 && git push origin v1.2.3           # 3. 打 tag 并推送（触发 CI）
```

推送 `v*` tag 触发 [release.yml](.github/workflows/release.yml)，三平台构建并自动发布到 GitHub Releases，用户应用内即可自动更新。

---

## 1. 发版前

### 1.1 改版本号（唯一入口）

```bash
pnpm bump 1.2.3        # 指定版本
pnpm bump patch        # 或按 SemVer 增量：patch | minor | major
```

[`bump-version.mjs`](scripts/bump-version.mjs) 自动同步 `package.json` + config/model 默认版本。手动改时**仅 `package.json` 必改**，其余建议同步。应用/配置迁移目标版本运行时取自 `app.getVersion()`，数据库迁移目标由迁移文件自动派生，**无版本相关环境变量**。

### 1.2 结构变更 → 注册迁移（无结构变更则跳过）

| 域            | 操作                                                                                                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 数据库        | 在 `src/main/schemas/migrations/` 新增 `{版本}_{说明}.sql`（只写增量 SQL；版本须高于基线 0.1.0 与所有已执行版本）                                                                                   |
| 应用/模型配置 | 在 [`config.migration.ts`](src/main/core/migration/config.migration.ts) / [`model.migration.ts`](src/main/core/migration/model.migration.ts) 注册 `addMigration({ version, description, migrate })` |

### 1.3 写发布说明

GitHub Release 描述会被 electron-updater 读取为应用内更新弹窗的 `releaseNotes`，建议按「新增 / 修复 / 破坏性变更」整理后填入。

---

## 2. 发版

### 方式 A：CI 自动发布（推荐）

```bash
git push origin <branch>
git tag vX.Y.Z
git push origin vX.Y.Z
```

等待 Actions 三平台构建通过，产物自动上传 Releases（含 electron-updater 元数据 `latest*.yml`）。
macOS 签名/公证、Windows 代码签名需配置对应 secrets（`CSC_LINK`、`APPLE_*` 等），**未配置时 macOS 自动更新会受限**。

### 方式 B：本地手动发布

```powershell
$env:GH_TOKEN="你的_token"
pnpm prod --publish always
```

产物输出到 `release/`；`afterPack.js` 自动把 electron-rebuild 编译的 `better_sqlite3.node` 覆盖进产物，**不要删除**。

---

## 3. 用户侧自动更新

设置 → 常规 →「检查更新」→ 下载 →「立即安装」→ 重启（[update.service.ts](src/main/core/services/update.service.ts) / [GeneralSettings.vue](src/renderer/components/settings/GeneralSettings.vue) / [UpdatePrompt.vue](src/renderer/components/UpdatePrompt.vue)）。

生效前提：

- **tag 版本 == `package.json` version**，否则会反复提示或检测不到更新
- Release 包含 `latest.yml` / `latest-mac.yml` / `latest-linux.yml`

---

## 4. 发版后验证清单

- [ ] 旧版本能检测到新版本，正常下载、安装、重启
- [ ] 升级后配置保留（工作区 / 主题 / 模型）
- [ ] DB 迁移日志无 `failed`，`migrations_db` 状态为 `executed`
- [ ] 配置迁移日志出现「检测到版本升级」且 `config.version` 已更新
- [ ] 核心功能回归（日记 / 项目 / Wiki / 搜索）
- [ ] 设置页版本号显示 `Wrisp VX.Y.Z`

**失败回滚**：DB 迁移失败 → 修复 SQL 重启重试，或从备份恢复后装旧版；配置迁移失败 → 回退默认配置（保留原文件副本）。备份任务见 [backup.task.ts](src/main/core/scheduler/backup.task.ts)。

---

## 5. 升级机制缺口清单（后续版本迭代完善）

| #   | 类别        | 缺口                                    | 现状                                      | 建议                                                | 优先级 |
| --- | ----------- | --------------------------------------- | ----------------------------------------- | --------------------------------------------------- | ------ |
| 1   | CI 质量门禁 | 发布前不跑 typecheck/lint/test          | `release.yml` 仅 install→rebuild→publish  | 构建前加 `pnpm typecheck && pnpm lint && pnpm test` | 高     |
| 2   | CI 一致性   | tag 与 package.json 版本无强制校验      | 靠人工保证，不一致会反复提示/检测不到更新 | 加脚本校验 `git tag` 版本 == package.json version   | 高     |
| 3   | 迁移健壮性  | 配置/模型/DB 迁移均无自动化测试         | 无单测覆盖                                | 为每次迁移补测试                                    | 高     |
| 4   | 迁移健壮性  | 迁移前无强制备份                        | 仅定时备份任务                            | 迁移执行前自动备份 DB / 配置                        | 高     |
| 5   | 签名与安全  | macOS 签名/公证、Windows 代码签名未强制 | 仅配置 secrets 时启用                     | 配齐签名与公证，规避 SmartScreen / 自动更新受限     | 高     |
| 6   | 发布说明    | 无 CHANGELOG，Release 描述常为空        | 更新弹窗 `releaseNotes` 为空              | 维护 `CHANGELOG.md`；bump 脚本生成草稿              | 中     |
| 7   | 更新体验    | 无启动自动检查更新                      | 需手动点「检查更新」                      | 启动静默检查，有更新时通知/角标                     | 中     |
| 8   | 更新体验    | 无 beta/alpha 通道分流                  | 固定 stable                               | electron-updater channel + GitHub pre-release       | 低     |
| 9   | 迁移健壮性  | 迁移失败无一键重试/降级入口             | 靠重启重试/手动恢复备份                   | 失败 UI 提示 + 重试按钮                             | 中     |
| 10  | 回滚        | 无发布后一键回滚 / 降级保护             | electron-updater 默认禁止降级             | 发布前备份清单 + 手动装旧版方案                     | 中     |
| 11  | 监控        | 无发布后崩溃/错误监控                   | 无                                        | 接入崩溃上报 + 启动健康检查                         | 低     |

> 优先级说明：1–5 建议在首个正式版本发布前补齐（影响发布质量与安全）；6–9 提升发布与更新体验；10–11 属运营能力，可延后。

---

## 6. 参考文件索引

| 功能                     | 文件                                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 版本号一键升级           | [`scripts/bump-version.mjs`](scripts/bump-version.mjs)（`pnpm bump`）                                                                          |
| 应用版本读取             | [`src/main/utils/version.ts`](src/main/utils/version.ts)                                                                                       |
| 数据库迁移（含目标派生） | [`src/main/core/migration/database.migration.ts`](src/main/core/migration/database.migration.ts)                                               |
| 数据库初始化             | [`src/main/schemas/init.sql`](src/main/schemas/init.sql)                                                                                       |
| 配置 / 模型配置迁移      | [`config.migration.ts`](src/main/core/migration/config.migration.ts) / [`model.migration.ts`](src/main/core/migration/model.migration.ts)      |
| 更新服务 / IPC           | [`update.service.ts`](src/main/core/services/update.service.ts) / [`update.api.ts`](src/main/core/apis/update.api.ts)                          |
| 更新 UI                  | [`UpdatePrompt.vue`](src/renderer/components/UpdatePrompt.vue) / [`GeneralSettings.vue`](src/renderer/components/settings/GeneralSettings.vue) |
| 备份任务                 | [`backup.task.ts`](src/main/core/scheduler/backup.task.ts)                                                                                     |
| CI 发布工作流            | [`.github/workflows/release.yml`](.github/workflows/release.yml)                                                                               |
