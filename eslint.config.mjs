import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import vueEslint from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import globals from "globals";

/** @type {import('eslint').Linter.Config[]} */
export default [
  // 基础 JavaScript 配置
  js.configs.recommended,

  // 全局环境变量配置
  {
    files: [
      "**/*.js",
      "**/*.jsx",
      "**/*.mjs",
      "**/*.cjs",
      "**/*.ts",
      "**/*.tsx",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },

  // TypeScript 配置
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.vue"],
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 2020,
      sourceType: "module",
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },
    rules: {
      ...typescriptEslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },

  // TS 文件由 TypeScript 编译器校验未定义标识符，关闭 JS 的 no-undef（避免类型引用、vitest 全局等误报）
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.vue"],
    rules: {
      "no-undef": "off",
    },
  },

  // 测试文件 - vitest 全局变量
  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },
  },

  // Vue 配置 - 使用 vue-eslint-parser 解析 SFC，script 块委托 TypeScript parser
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: typescriptParser,
        ecmaVersion: 2020,
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      vue: vueEslint,
    },
    rules: {
      ...(vueEslint.configs?.recommended?.rules || {}),
      ...(vueEslint.configs?.["vue3-recommended"]?.rules || {}),
      "vue/multi-word-component-names": "off",
      // 所有 v-html 用法（UpdatePrompt.vue / SlashMenu.vue）渲染前均经
      // src/renderer/utils/sanitize.ts 的 sanitizeHtml 白名单清洗，故关闭该规则
      "vue/no-v-html": "off",
    },
  },

  // 全局规则
  {
    files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx", "**/*.vue"],
    rules: {
      "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
      "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    },
  },

  // 忽略文件
  {
    ignores: [
      "dist-renderer/**",
      "dist-electron/**",
      "release/**",
      "node_modules/**",
      ".git/**",
    ],
  },
];
