/**
 * electron-builder afterPack hook.
 *
 * 背景：electron-builder 打包原生模块 better-sqlite3 时，取的是 pnpm store 里的
 * 预编译产物（Node ABI 127），与 Electron 41 所需 ABI（145）不匹配，导致安装后
 * 应用启动即崩溃。这里在打包完成后，把顶层 node_modules 中已用 electron-rebuild
 * 正确编译的二进制（ABI 145）覆盖进 app.asar.unpacked，确保产物 ABI 匹配。
 */
const fs = require("fs");
const path = require("path");

/**
 * 递归查找目录下所有匹配文件名的文件。
 */
function findFiles(dir, fileName, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findFiles(full, fileName, results);
    } else if (entry.isFile() && entry.name === fileName) {
      results.push(full);
    }
  }
  return results;
}

exports.default = async function afterPack(context) {
  const { appOutDir, electronPlatformName } = context;
  const src = path.join(
    process.cwd(),
    "node_modules",
    "better-sqlite3",
    "build",
    "Release",
    "better_sqlite3.node",
  );

  if (!fs.existsSync(src)) {
    console.warn("[afterPack] 源 better_sqlite3.node 不存在，跳过:", src);
    return;
  }

  // macOS 下 app 是 <productName>.app 目录，resources 在其 Contents 下；
  // Windows/Linux 下 resources 直接位于 appOutDir 下。
  let resourcesDir = path.join(appOutDir, "resources");
  if (electronPlatformName === "darwin") {
    const appDir = fs
      .readdirSync(appOutDir)
      .find((name) => name.endsWith(".app"));
    if (appDir) {
      resourcesDir = path.join(appOutDir, appDir, "Contents", "Resources");
    }
  }

  const targets = findFiles(resourcesDir, "better_sqlite3.node");

  if (targets.length === 0) {
    console.warn("[afterPack] 打包目录中未找到 better_sqlite3.node:", resourcesDir);
    return;
  }

  for (const target of targets) {
    fs.copyFileSync(src, target);
    console.log("[afterPack] 已覆盖正确的 better_sqlite3.node ->", target);
  }
};
