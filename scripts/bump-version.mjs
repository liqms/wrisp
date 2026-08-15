/**
 * 版本号一键升级脚本
 *
 * 用法：
 *   node scripts/bump-version.mjs 1.2.3     # 指定完整版本号
 *   node scripts/bump-version.mjs patch     # patch/minor/major 增量
 *
 * 同步修改（应用版本唯一权威来源为 package.json）：
 *   1. package.json  -> version
 *   2. src/main/constants/config.constants.ts  -> DEFAULT_APP_CONFIG.version
 *   3. src/main/constants/model.constants.ts   -> DEFAULT_MODEL_CONFIG.version
 *
 * 说明：
 *   - 数据库结构版本不属于应用版本域，由 src/main/schemas/migrations/ 下的迁移文件驱动，
 *     本脚本不修改 init.sql / 迁移文件。
 *   - 运行后请用 `pnpm typecheck && pnpm test` 验证。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

function readPkg() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
}

function resolveNextVersion(input, current) {
  if (SEMVER_RE.test(input)) {
    return input;
  }
  const [major, minor, patch] = current.split(".").map(Number);
  switch (input) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      return null;
  }
}

function replaceVersionInTs(filePath, version) {
  const abs = path.join(ROOT, filePath);
  let content = fs.readFileSync(abs, "utf8");
  const re = /(\s*version:\s*")[^"]+("\s*,)/;
  if (!re.test(content)) {
    throw new Error(`未在 ${filePath} 中找到 version 字段`);
  }
  content = content.replace(re, `$1${version}$2`);
  fs.writeFileSync(abs, content);
}

const arg = process.argv[2];
if (!arg) {
  console.error(
    "用法: node scripts/bump-version.mjs <X.Y.Z | patch|minor|major>",
  );
  process.exit(1);
}

const pkgPath = path.join(ROOT, "package.json");
const pkg = readPkg();
const next = resolveNextVersion(arg, pkg.version);
if (!next) {
  console.error(`无效版本号: ${arg}（应为 X.Y.Z 或 patch/minor/major）`);
  process.exit(1);
}

if (next === pkg.version) {
  console.log(`版本号未变化（当前已是 ${pkg.version}），无需修改`);
  process.exit(0);
}

const from = pkg.version;

// 1. package.json
pkg.version = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// 2/3. 常量文件
replaceVersionInTs("src/main/constants/config.constants.ts", next);
replaceVersionInTs("src/main/constants/model.constants.ts", next);

console.log(`版本号已更新: ${from} -> ${next}`);
console.log("  已同步:");
console.log("    - package.json");
console.log("    - src/main/constants/config.constants.ts");
console.log("    - src/main/constants/model.constants.ts");
console.log("");
console.log("后续步骤:");
console.log(
  "  1. 数据库结构有变更时，在 src/main/schemas/migrations/ 新增 {版本}_{说明}.sql 迁移文件",
);
console.log("  2. 更新 CHANGELOG（如有）");
console.log("  3. pnpm typecheck && pnpm test");
