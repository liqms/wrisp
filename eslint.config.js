import js from '@eslint/js'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import vueEslint from 'eslint-plugin-vue'
import globals from 'globals'

/** @type {import('eslint').Linter.Config[]} */
export default [
  // 基础 JavaScript 配置
  js.configs.recommended,
  
  // 全局环境变量配置
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser
      }
    }
  },
  
  // TypeScript 配置
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.vue'],
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 2020,
      sourceType: 'module'
    },
    plugins: {
      '@typescript-eslint': typescriptEslint
    },
    rules: {
      ...typescriptEslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': 'warn'
    }
  },
  
  // Vue 配置 - 使用更安全的方式引用配置
  {
    files: ['**/*.vue'],
    plugins: {
      vue: vueEslint
    },
    rules: {
      ...(vueEslint.configs?.recommended?.rules || {}),
      ...(vueEslint.configs?.['vue3-recommended']?.rules || {}),
      'vue/multi-word-component-names': 'off'
    }
  },
  
  // 全局规则
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx', '**/*.vue'],
    rules: {
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off'
    }
  },
  
  // 忽略文件
  {
    ignores: [
      'dist-renderer/**',
      'dist-electron/**',
      'release/**',
      'node_modules/**',
      '.git/**'
    ]
  }
]