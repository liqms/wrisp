import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import path from 'path'
import fs from 'fs'

function copySchemas() {
  const srcPath = path.resolve(__dirname, 'src/main/schemas')
  const destPath = path.resolve(__dirname, 'dist-electron/schemas')

  if (fs.existsSync(srcPath)) {
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true })
    }

    const files = fs.readdirSync(srcPath)
    files.forEach(file => {
      const srcFile = path.join(srcPath, file)
      const destFile = path.join(destPath, file)
      fs.copyFileSync(srcFile, destFile)
      console.log(`Copied: ${srcFile} -> ${destFile}`)
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
              external: ['electron'],
              output: {
                format: 'cjs'
              }
            },
            target: 'node18',
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
            target: 'node18',
            lib: {
              entry: 'src/main/preload.ts',
              formats: ['cjs'],
              fileName: () => 'preload.js'
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
