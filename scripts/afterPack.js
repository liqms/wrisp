/**
 * electron-builder afterPack hook.
 *
 * 做两件与打包平台相关的清理/修正：
 *
 * 1. better-sqlite3 ABI：electron-builder 取的是 pnpm store 里的预编译产物，其
 *    NODE_MODULE_VERSION 与目标 Electron 不匹配，安装后应用启动即崩溃。这里把顶层
 *    node_modules 中已用 electron-rebuild 正确编译的二进制覆盖进 app.asar.unpacked。
 * 2. onnxruntime-node 体积：transformers.js v4 依赖的该包会为三平台各带一份原生
 *    二进制（约 288MB），而 asarUnpack 是按整包解出的。只保留当前目标平台那一份，
 *    其余从产物里删除（安装包里不会再出现）。
 */
const fs = require("fs");
const path = require("path");

/** onnxruntime-node 原生二进制相对包根的路径段 */
const ORT_BIN_RELATIVE = path.join(
  "node_modules",
  "onnxruntime-node",
  "bin",
  "napi-v6",
);

/** electron-builder 的 electronPlatformName → onnxruntime-node 的平台目录名 */
const ORT_PLATFORM_DIR = {
  win32: "win32",
  darwin: "darwin",
  linux: "linux",
};

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

/** 递归统计目录内文件总字节数（用于报告释放了多少体积） */
function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(full) : fs.statSync(full).size;
  }
  return total;
}

/**
 * 定位打包产物中的 resources 目录。
 * macOS 下 app 是 <productName>.app 目录，resources 在其 Contents 下；
 * Windows/Linux 下 resources 直接位于 appOutDir 下。
 */
function resolveResourcesDir(appOutDir, electronPlatformName) {
  if (electronPlatformName === "darwin") {
    const appDir = fs
      .readdirSync(appOutDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.endsWith(".app"))
      .map((entry) => entry.name)
      .shift();
    if (appDir) {
      return path.join(appOutDir, appDir, "Contents", "Resources");
    }
  }
  return path.join(appOutDir, "resources");
}

/**
 * 删除非目标平台/架构的 onnxruntime-node 原生二进制目录。
 * 每一步都先确认「要保留的那一份」真实存在再动手：目标架构在该包里无产物时
 * （例如 darwin 只有 arm64）保留整层，避免把唯一可用的 binding 删掉。
 */
function pruneOnnxRuntimeBinaries(resourcesDir, context) {
  const platform = ORT_PLATFORM_DIR[context.electronPlatformName];
  const ortBinDir = path.join(resourcesDir, "app.asar.unpacked", ORT_BIN_RELATIVE);

  if (!platform || !fs.existsSync(ortBinDir)) {
    console.warn(
      "[afterPack] 未找到 onnxruntime-node 原生二进制目录，跳过裁剪:",
      ortBinDir,
    );
    return;
  }

  const keepArch = resolveArchDirName(context.arch);
  let freedBytes = 0;

  for (const entry of fs.readdirSync(ortBinDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(ortBinDir, entry.name);
    if (entry.name !== platform) {
      freedBytes += dirSize(full);
      fs.rmSync(full, { recursive: true, force: true });
      console.log("[afterPack] 已裁剪非本平台推理引擎二进制:", entry.name);
      continue;
    }
    if (!keepArch || !fs.existsSync(path.join(full, keepArch))) {
      console.log(`[afterPack] 保留 ${entry.name} 全部架构产物（目标架构 ${keepArch ?? "未知"} 无对应二进制）`);
      continue;
    }
    for (const archEntry of fs.readdirSync(full, { withFileTypes: true })) {
      if (!archEntry.isDirectory() || archEntry.name === keepArch) continue;
      const stale = path.join(full, archEntry.name);
      freedBytes += dirSize(stale);
      fs.rmSync(stale, { recursive: true, force: true });
      console.log("[afterPack] 已裁剪非本架构推理引擎二进制:", `${entry.name}/${archEntry.name}`);
    }
  }
  console.log(`[afterPack] onnxruntime-node 共释放 ${(freedBytes / 1048576).toFixed(0)} MB`);
}

/**
 * Arch 枚举值 → onnxruntime-node 的架构目录名。
 * 只认该包确实提供产物的两种架构，其余取值（ia32/armv7l/universal）返回 null。
 */
function resolveArchDirName(arch) {
  let name;
  try {
    name = require("app-builder-lib").Arch?.[arch];
  } catch {
    return null;
  }
  return name === "x64" || name === "arm64" ? name : null;
}

exports.default = async function afterPack(context) {
  const { appOutDir, electronPlatformName } = context;
  const resourcesDir = resolveResourcesDir(appOutDir, electronPlatformName);

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
  } else {
    const targets = findFiles(resourcesDir, "better_sqlite3.node");
    if (targets.length === 0) {
      console.warn("[afterPack] 打包目录中未找到 better_sqlite3.node:", resourcesDir);
    }
    for (const target of targets) {
      fs.copyFileSync(src, target);
      console.log("[afterPack] 已覆盖正确的 better_sqlite3.node ->", target);
    }
  }

  pruneOnnxRuntimeBinaries(resourcesDir, context);
};
