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
  const srcPath = path.resolve(__dirname, 'src/main/schemas')
  const destPath = path.resolve(__dirname, 'dist-electron/schemas')

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

copySchemas()

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
      '@': path.resolve(__dirname, './src')
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