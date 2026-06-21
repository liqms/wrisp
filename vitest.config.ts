import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'webview',
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: [
      'tests/unit/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      'tests/integration/**/*.{test,spec}.?(c|m)[jt]s?(x)',
    ],
    exclude: ['node_modules', 'dist', 'dist-electron', 'dist-renderer', 'release'],
    setupFiles: ['tests/setup/renderer.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.vue'],
      exclude: [
        'src/**/*.{test,spec}.?(c|m)[jt]s?(x)',
        'src/main/preload/**',
        'src/main/types/**',
        'src/shared/enums/**',
        'tests/**',
      ],
    },
    server: {
      deps: {
        inline: ['@vue', 'vue', 'naive-ui', '@element-plus/icons-vue', 'better-sqlite3'],
      },
    },
  },
})
