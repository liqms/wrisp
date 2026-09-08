import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import path from 'path'
import fs from 'fs'

function copyRecursive(src: string, dest: string) {
  const stat = fs.statSync(src)

  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true })
    }

    const files = fs.readdirSync(src)
    files.forEach(file => {
      copyRecursive(path.join(src, file), path.join(dest, file))
    })
  } else {
    fs.copyFileSync(src, dest)
    console.log(`Copied: ${src} -> ${dest}`)
  }
}

function copySchemas() {
  const srcPath = path.resolve(import.meta.dirname, 'src/main/schemas')
  const destPath = path.resolve(import.meta.dirname, 'dist-electron/schemas')

  if (fs.existsSync(srcPath)) {
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true })
    }

    const files = fs.readdirSync(srcPath)
    files.forEach(file => {
      copyRecursive(path.join(srcPath, file), path.join(destPath, file))
    })
  }
}

/** 仅打包通用模板：slash/page 下 profession 含 general（或缺失/为空）的文件；skills/schemas/manifest 全量 */
function isBundledResourceFile(src: string): boolean {
  const rel = path.relative(
    path.resolve(import.meta.dirname, 'resources'),
    src,
  )
  const type = rel.split(path.sep)[0]
  if (type !== 'slash' && type !== 'page') return true
  if (!src.endsWith('.json')) return false
  try {
    const parsed = JSON.parse(fs.readFileSync(src, 'utf-8')) as {
      profession?: unknown
    }
    const profession = Array.isArray(parsed.profession)
      ? parsed.profession
      : []
    return profession.length === 0 || profession.includes('general')
  } catch {
    return false
  }
}

function copyResources() {
  const srcPath = path.resolve(import.meta.dirname, 'resources')
  const destPath = path.resolve(import.meta.dirname, 'dist-electron/resources')

  if (!fs.existsSync(srcPath)) return
  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(destPath, { recursive: true })
  }

  const files = fs.readdirSync(srcPath)
  files.forEach(file => {
    const src = path.join(srcPath, file)
    const stat = fs.statSync(src)
    if (stat.isDirectory()) {
      copyDirFiltered(src, path.join(destPath, file), isBundledResourceFile)
    } else {
      copyRecursive(src, path.join(destPath, file))
    }
  })
}

/** 递归复制并按谓词过滤文件 */
function copyDirFiltered(
  src: string,
  dest: string,
  filter: (src: string) => boolean,
) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry)
    const d = path.join(dest, entry)
    if (fs.statSync(s).isDirectory()) {
      copyDirFiltered(s, d, filter)
    } else if (filter(s)) {
      copyRecursive(s, d)
    }
  }
}

copySchemas()
copyResources()

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'webview',
        },
      },
    }),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: [
                'electron',
                'better-sqlite3',
                '@lancedb/lancedb',
                /@lancedb\/.*/,
                'apache-arrow',
                '@xenova/transformers',
                'electron-updater',
              ],
              output: {
                format: 'cjs'
              }
            },
            target: 'node22',
            lib: {
              entry: 'src/main/index.ts',
              formats: ['cjs'],
              fileName: () => 'index.js'
            }
          }
        }
      },
      {
        entry: 'src/main/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs'
              }
            },
            target: 'node22',
            lib: {
              entry: 'src/main/preload.ts',
              formats: ['cjs'],
              fileName: () => 'preload.js'
            }
          }
        }
      },
      {
        // Local AI Worker 线程入口，独立打包为 CJS 供 worker_threads 加载
        entry: 'src/main/core/model-gateway/local-gateway/worker/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron', '@xenova/transformers'],
              output: {
                format: 'cjs'
              }
            },
            target: 'node22',
            lib: {
              entry: 'src/main/core/model-gateway/local-gateway/worker/index.ts',
              formats: ['cjs'],
              fileName: () => 'local-ai-worker.js'
            }
          }
        }
      }
    ]),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src')
    }
  },
  server: {
    port: 5173,
    strictPort: true // 如果端口被占用，直接报错而不是自动切换到其他端口
  },
  publicDir: 'static',
  build: {
    outDir: 'dist-renderer'
  }
})
