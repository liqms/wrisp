/**
 * 生成 resources/manifest.json
 * 用法: node scripts/generate-manifest.mjs
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resourcesDir = path.resolve(__dirname, "..", "resources");
const manifestPath = path.join(resourcesDir, "manifest.json");

function typeFromPath(relPath) {
  const top = relPath.split("/")[0];
  if (top === "slash") return "slash";
  if (top === "page") return "page";
  if (top === "skills") return "skill";
  throw new Error(`无法识别的资源类型: ${relPath}`);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function readVersion(filePath) {
  const c = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  if (typeof c.version !== "string") throw new Error(`缺少 version: ${filePath}`);
  return c.version;
}

function walk(dir, base = "") {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (fs.statSync(abs).isDirectory()) out.push(...walk(abs, rel));
    // manifest 自身与 *.schema.json 不纳入清单：schema 是应用规范（validator 从应用包读取），
    // 数据资源才走远程同步；schema 升级随应用版本发布
    else if (name.endsWith(".json") && name !== "manifest.json" && !name.endsWith(".schema.json"))
      out.push({ absPath: abs, relPath: rel });
  }
  return out;
}

const entries = walk(resourcesDir)
  .map(({ absPath, relPath }) => ({
    type: typeFromPath(relPath),
    path: relPath.replace(/\\/g, "/"),
    version: readVersion(absPath),
    sha256: sha256(absPath),
  }))
  .sort((a, b) => a.path.localeCompare(b.path));

const manifest = { version: "1.0.0", updatedAt: new Date().toISOString(), files: entries };
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
console.log(`Generated manifest.json with ${entries.length} entries`);
