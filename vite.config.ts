import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    electron({
      entry: 'src/main/index.ts',
      onstart(options) {
        // 启动 Electron 应用
        options.startup()
      },
      vite: {
        build: {
          outDir: 'dist-electron',
          rollupOptions: {
            external: ['electron']
          }
        }
      }
    })
  ],
  server: {
    port: 5173,
    strictPort: true // 如果端口被占用，直接报错而不是自动切换到其他端口
  },
  build: {
    outDir: 'dist-renderer'
  }
})
