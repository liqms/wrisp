# 快捷键功能补全 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把快捷键从「只能配置、配置后无任何效果」的半成品，补全为「配置即生效」的完整功能：修复配置回显、新增全局快捷键分发，将「打开设置」「全局搜索」两个真实动作绑定到快捷键。

**Architecture:** 渲染进程侧全局 `keydown` 监听 + Pinia store（`shortcut.store.ts`）统一管理 UI 状态（设置弹窗 / 搜索弹窗可见性）与动作分发；快捷键映射由 `config.shortcuts`（合并默认值）驱动。`KeymapSettings.vue` 的配置回显、保存、冲突提示全部基于同一个 store 里的纯函数（`resolveShortcuts` / `normalizeKeys`），保证「设置页看到的 = 运行时生效的」。

**Tech Stack:** Vue 3 `<script setup>`、Pinia（composition 风格）、TypeScript strict、Vitest（happy-dom）、Naive UI、Vue i18n。

---

## 现状与关键决策

**现状（已核实）：**

- `KeymapSettings.vue` 声明了 `config` prop 但从未使用 → 配置回显失效（永远显示硬编码默认值）。
- `config.shortcuts` 只被写入、无任何消费方：主进程 `Menu.setApplicationMenu(null)`、无 `globalShortcut`、渲染进程无全局 keydown 监听。
- `GlobalSearch.vue` 组件存在但从未被挂载；搜索逻辑本身是 stub（`useSearch.ts` 里「搜索功能待实现」），**本次只负责「用快捷键打开搜索弹窗」，搜索的完整实现不在范围内**。
- `global.capture`（快速记录）功能已移除，是死配置。
- `global.copy` / `global.paste` 是系统原生能力（浏览器/编辑器原生处理），应用内重映射不可靠且会破坏预期行为。

**关键决策：**

1. 默认快捷键精简为 2 个真实动作：`settings`（`Ctrl+,`）、`search`（`Ctrl+Shift+F`）。移除 `capture`（功能已删）与 `copy`/`paste`（系统原生，不应重映射）。
2. 全局监听放在渲染进程（`App.vue` 挂载时注册），不引入主进程 `globalShortcut`/新 IPC——应用内全局快捷键已满足需求，且可在 happy-dom 中直接单测。
3. 配置合并采用**非破坏式**：`resolveShortcuts(saved, defaults)` 按 id 用已保存值覆盖默认值，未保存项回退默认。不主动写回 config，用户首次自定义时才写入。

---

## 文件结构

**新增文件：**

- `src/renderer/store/shortcut.store.ts` — 快捷键 store：默认项、纯函数（`resolveShortcuts`/`normalizeKeys`/`keysFromEvent`）、全局 keydown 分发、UI 状态（CREATE）
- `src/renderer/composables/useShortcut.ts` — 薄封装，与项目其他 composable 一致（CREATE）
- `tests/unit/renderer/shortcut.store.test.ts` — store 纯逻辑 + 分发逻辑单测（CREATE）

**修改文件：**

- `src/renderer/composables/index.ts` — 导出 `useShortcut`（MODIFY）
- `src/shared/i18n/locales/zhCN.ts`、`enUS.ts` — 更新 `SHORTCUT_SETTINGS` 键（MODIFY，必须成对）
- `src/renderer/components/settings/keymap/KeymapSettings.vue` — 配置回显 + 冲突提示 + 移除死项（MODIFY/REWRITE）
- `src/renderer/App.vue` — 挂载 `GlobalSearch` + 注册/注销全局监听（MODIFY）
- `src/renderer/components/AppHeader.vue` — 设置弹窗状态改用 store（MODIFY）

---

### Task 1: 新建 shortcut store + 纯函数

**Files:**

- Create: `src/renderer/store/shortcut.store.ts`
- Create: `src/renderer/composables/useShortcut.ts`
- Modify: `src/renderer/composables/index.ts`
- Test: `tests/unit/renderer/shortcut.store.test.ts`

- [ ] **Step 1: 编写纯函数与 store**

Create `src/renderer/store/shortcut.store.ts`:

```ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useConfigStore } from "./config.store";
import type { KeymapItem } from "@/shared/types";

/** 快捷键动作标识 */
export type ShortcutActionId = "settings" | "search";

/** 可配置快捷键项（含默认值 + i18n 标签 key） */
export interface ShortcutItem {
  id: ShortcutActionId;
  labelKey: string;
  defaultKeys: string;
  currentKeys: string;
}

/**
 * 默认快捷键列表。
 * 只包含应用真实拥有对应动作的快捷键：
 * - settings：打开设置弹窗
 * - search：打开全局搜索弹窗
 * （capture 功能已移除；copy/paste 为系统原生能力，不应在应用内重映射）
 */
export const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  {
    id: "settings",
    labelKey: "SETTINGS.SHORTCUT_SETTINGS.SETTINGS",
    defaultKeys: "Ctrl+,",
    currentKeys: "Ctrl+,",
  },
  {
    id: "search",
    labelKey: "SETTINGS.SHORTCUT_SETTINGS.SEARCH",
    defaultKeys: "Ctrl+Shift+F",
    currentKeys: "Ctrl+Shift+F",
  },
];

/**
 * 将已保存的快捷键配置与默认值合并。
 * 已保存的项按 id 覆盖默认值，未保存的项回退到默认值。
 */
export function resolveShortcuts(
  saved: KeymapItem[] | undefined,
  defaults: ShortcutItem[] = DEFAULT_SHORTCUTS,
): ShortcutItem[] {
  const savedMap = new Map<string, string>(
    (saved ?? []).map((s) => [s.id, s.keys]),
  );
  return defaults.map((d) => ({
    ...d,
    currentKeys: savedMap.get(d.id) ?? d.defaultKeys,
  }));
}

/** 规范化组合键字符串（小写 + 排序），用于比较 */
export function normalizeKeys(keys: string): string {
  return keys
    .split("+")
    .map((k) => k.trim().toLowerCase())
    .sort()
    .join("+");
}

/** 从键盘事件提取规范化的组合键字符串 */
export function keysFromEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.metaKey) parts.push("Meta");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  const modifierKeys = new Set(["Control", "Meta", "Alt", "Shift"]);
  if (e.key && !modifierKeys.has(e.key)) {
    parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
  }
  return normalizeKeys(parts.join("+"));
}

/**
 * 快捷键状态管理：
 * - 维护全局 UI 状态（设置弹窗 / 搜索弹窗可见性）
 * - 提供全局 keydown 分发（配置驱动）
 */
export const useShortcutStore = defineStore("shortcut", () => {
  const configStore = useConfigStore();

  /** 设置弹窗可见性（AppHeader 与快捷键共用） */
  const settingsVisible = ref(false);
  /** 全局搜索弹窗可见性 */
  const searchVisible = ref(false);

  /** 当前生效的快捷键（已保存配置合并默认值） */
  const effectiveShortcuts = computed<ShortcutItem[]>(() =>
    resolveShortcuts(configStore.config?.shortcuts),
  );

  /** 规范化组合键 -> 动作 映射 */
  const actionMap = computed(() => {
    const map = new Map<string, ShortcutActionId>();
    for (const item of effectiveShortcuts.value) {
      map.set(normalizeKeys(item.currentKeys), item.id);
    }
    return map;
  });

  function openSettings(): void {
    settingsVisible.value = true;
  }

  function closeSettings(): void {
    settingsVisible.value = false;
  }

  function toggleSettings(): void {
    settingsVisible.value = !settingsVisible.value;
  }

  function openSearch(): void {
    searchVisible.value = true;
  }

  function closeSearch(): void {
    searchVisible.value = false;
  }

  /** 全局 keydown 分发：命中已配置组合键时执行对应动作 */
  function handleKeydown(e: KeyboardEvent): void {
    const combo = keysFromEvent(e);
    if (!combo) return;
    const action = actionMap.value.get(combo);
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    if (action === "settings") {
      openSettings();
    } else if (action === "search") {
      openSearch();
    }
  }

  /** 注册全局监听（App.vue onMounted 调用） */
  function init(): void {
    window.addEventListener("keydown", handleKeydown, true);
  }

  /** 移除全局监听（App.vue onUnmounted 调用） */
  function dispose(): void {
    window.removeEventListener("keydown", handleKeydown, true);
  }

  return {
    settingsVisible,
    searchVisible,
    effectiveShortcuts,
    openSettings,
    closeSettings,
    toggleSettings,
    openSearch,
    closeSearch,
    init,
    dispose,
  };
});
```

Create `src/renderer/composables/useShortcut.ts`:

```ts
import { useShortcutStore } from "@/renderer/store/shortcut.store";

/**
 * 快捷键相关组合函数（薄封装，与项目其他 composable 保持一致）
 */
export function useShortcut() {
  return useShortcutStore();
}

export type UseShortcutReturn = ReturnType<typeof useShortcut>;
```

- [ ] **Step 2: 编写失败测试**

Create `tests/unit/renderer/shortcut.store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import {
  useShortcutStore,
  resolveShortcuts,
  normalizeKeys,
  keysFromEvent,
} from "@/renderer/store/shortcut.store";

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("resolveShortcuts", () => {
  it("saved 为空时回退到默认值", () => {
    const result = resolveShortcuts([]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("settings");
    expect(result[0].currentKeys).toBe("Ctrl+,");
    expect(result[1].id).toBe("search");
    expect(result[1].currentKeys).toBe("Ctrl+Shift+F");
  });

  it("按 id 用已保存值覆盖默认值，其余保留默认", () => {
    const result = resolveShortcuts([{ id: "settings", keys: "Alt+S" }]);
    expect(result.find((s) => s.id === "settings")?.currentKeys).toBe("Alt+S");
    expect(result.find((s) => s.id === "search")?.currentKeys).toBe("Ctrl+Shift+F");
  });

  it("saved 为 undefined 时也返回默认值", () => {
    expect(resolveShortcuts(undefined)).toHaveLength(2);
  });
});

describe("normalizeKeys", () => {
  it("忽略大小写并排序修饰键", () => {
    expect(normalizeKeys("Ctrl+Shift+C")).toBe("ctrl+c+shift");
    expect(normalizeKeys("Shift+Ctrl+C")).toBe("ctrl+c+shift");
  });
});

describe("keysFromEvent", () => {
  it("提取 Ctrl+Shift+F", () => {
    const e = new KeyboardEvent("keydown", {
      key: "f",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(keysFromEvent(e)).toBe("ctrl+f+shift");
  });

  it("纯修饰键不产生组合键", () => {
    const e = new KeyboardEvent("keydown", { key: "Control", ctrlKey: true });
    expect(keysFromEvent(e)).toBe("");
  });
});

describe("useShortcutStore", () => {
  it("命中默认 Ctrl+, 时打开设置弹窗", () => {
    const store = useShortcutStore();
    const e = new KeyboardEvent("keydown", { key: ",", ctrlKey: true });
    store.handleKeydown(e);
    expect(store.settingsVisible).toBe(true);
  });

  it("命中默认 Ctrl+Shift+F 时打开搜索弹窗", () => {
    const store = useShortcutStore();
    const e = new KeyboardEvent("keydown", {
      key: "f",
      ctrlKey: true,
      shiftKey: true,
    });
    store.handleKeydown(e);
    expect(store.searchVisible).toBe(true);
  });

  it("未配置的组合键不触发任何动作", () => {
    const store = useShortcutStore();
    const e = new KeyboardEvent("keydown", { key: "z", ctrlKey: true });
    store.handleKeydown(e);
    expect(store.settingsVisible).toBe(false);
    expect(store.searchVisible).toBe(false);
  });
});
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `pnpm test tests/unit/renderer/shortcut.store.test.ts`
Expected: FAIL —— `Cannot find module '@/renderer/store/shortcut.store'`（文件尚不存在）。

- [ ] **Step 4: 注册 composable 导出**

Modify `src/renderer/composables/index.ts` —— 追加一行：

```ts
export * from "./useShortcut";
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `pnpm test tests/unit/renderer/shortcut.store.test.ts`
Expected: PASS（7 个用例全绿）。

- [ ] **Step 6: 提交**

```bash
git add src/renderer/store/shortcut.store.ts src/renderer/composables/useShortcut.ts src/renderer/composables/index.ts tests/unit/renderer/shortcut.store.test.ts
git commit -m "feat: 新增快捷键 store 与全局分发纯函数"
```

---

### Task 2: 更新 i18n 键

**Files:**

- Modify: `src/shared/i18n/locales/zhCN.ts`
- Modify: `src/shared/i18n/locales/enUS.ts`
- Test: `tests/unit/shared/locale-keys.test.ts`（现有回归测试，必须保持绿）

- [ ] **Step 1: 修改 zhCN.ts**

把 `SHORTCUT_SETTINGS` 段（约 L288-293）替换为：

```ts
    SHORTCUT_SETTINGS: {
      RECORDING_HINT: "按下组合键...",
      CONFLICT_WARNING: "快捷键冲突，请重新设置",
      PRESS_KEY: "点击修改",
      CANCEL_RECORD: "取消",
      SETTINGS: "打开设置",
      SEARCH: "全局搜索",
      SAVE_FAILED: "保存失败，请重试",
    },
```

（删除不再使用的 `COPY: "复制"` 与 `PASTE: "粘贴"`。）

- [ ] **Step 2: 修改 enUS.ts**

把 `SHORTCUT_SETTINGS` 段（约 L296-301）替换为：

```ts
    SHORTCUT_SETTINGS: {
      RECORDING_HINT: "Press key combination...",
      CONFLICT_WARNING: "Shortcut conflict, please re-record",
      PRESS_KEY: "Click to edit",
      CANCEL_RECORD: "Cancel",
      SETTINGS: "Open Settings",
      SEARCH: "Global Search",
      SAVE_FAILED: "Failed to save, please retry",
    },
```

（删除不再使用的 `COPY: "Copy"` 与 `PASTE: "Paste"`。）

- [ ] **Step 3: 运行 i18n 一致性测试**

Run: `pnpm test tests/unit/shared/locale-keys.test.ts`
Expected: PASS —— 两语言键集合仍完全一致。

- [ ] **Step 4: 提交**

```bash
git add src/shared/i18n/locales/zhCN.ts src/shared/i18n/locales/enUS.ts
git commit -m "feat: 更新快捷键设置 i18n 键"
```

---

### Task 3: 重写 KeymapSettings（配置回显 + 冲突提示）

**Files:**

- Rewrite: `src/renderer/components/settings/keymap/KeymapSettings.vue`

- [ ] **Step 1: 重写组件**

Create（覆盖）`src/renderer/components/settings/keymap/KeymapSettings.vue`:

```vue
<template>
  <n-card size="small" :title="t('SETTINGS.KEYMAP')" tabindex="0" @keydown="handleKeyDown">
    <n-list>
      <n-list-item v-for="item in shortcuts" :key="item.id">
        <n-flex align="center" justify="space-between" class="shortcut-row">
          <n-text>{{ t(item.labelKey) }}</n-text>
          <n-flex align="center" :size="8">
            <template v-if="recordingId === item.id">
              <n-tag type="info">{{ t('SETTINGS.SHORTCUT_SETTINGS.RECORDING_HINT') }}</n-tag>
              <n-button size="tiny" type="warning" @click.stop="cancelRecording">
                {{ t('SETTINGS.SHORTCUT_SETTINGS.CANCEL_RECORD') }}
              </n-button>
            </template>
            <template v-else>
              <n-tag size="small" :bordered="false">{{ formatKeys(item.currentKeys) }}</n-tag>
              <n-button size="tiny" ghost type="primary" @click.stop="startRecording(item.id)">
                {{ t('SETTINGS.SHORTCUT_SETTINGS.PRESS_KEY') }}
              </n-button>
            </template>
          </n-flex>
        </n-flex>
      </n-list-item>
    </n-list>
  </n-card>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useMessage } from "naive-ui";
import type { AppConfig } from "@/shared/types";
import {
  resolveShortcuts,
  normalizeKeys,
  type ShortcutItem,
} from "@/renderer/store/shortcut.store";
import { useConfig } from "@/renderer/composables/useConfig";

const props = defineProps<{ config: AppConfig | null }>();

const { t } = useI18n();
const message = useMessage();
const { setValue } = useConfig();

const shortcuts = ref<ShortcutItem[]>(resolveShortcuts(props.config?.shortcuts));
const recordingId = ref<string | null>(null);

// 配置变化（如外部修改 / 重开设置）时同步回显
watch(
  () => props.config?.shortcuts,
  (saved) => {
    shortcuts.value = resolveShortcuts(saved);
    recordingId.value = null;
  },
  { immediate: true },
);

const startRecording = (id: string) => {
  recordingId.value = id;
};

const cancelRecording = () => {
  recordingId.value = null;
};

const isConflict = (keys: string, excludeId: string) => {
  const normalized = normalizeKeys(keys);
  return shortcuts.value.some(
    (s) => s.id !== excludeId && normalizeKeys(s.currentKeys) === normalized,
  );
};

const handleKeyDown = async (e: KeyboardEvent) => {
  if (!recordingId.value) return;
  e.preventDefault();
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");
  const key =
    e.key === "Control" || e.key === "Alt" || e.key === "Shift" || e.key === "Meta"
      ? ""
      : e.key.length === 1
        ? e.key.toUpperCase()
        : e.key;
  if (key) parts.push(key);
  if (parts.length < 2) return;

  const newKeys = parts.join("+");
  const target = shortcuts.value.find((s) => s.id === recordingId.value);
  if (!target) return;

  if (isConflict(newKeys, target.id)) {
    message.warning(t("SETTINGS.SHORTCUT_SETTINGS.CONFLICT_WARNING"));
    return;
  }

  target.currentKeys = newKeys;
  const saved = shortcuts.value.map(({ id, currentKeys }) => ({ id, keys: currentKeys }));
  const ok = await setValue("shortcuts", saved);
  if (!ok) {
    message.error(t("SETTINGS.SHORTCUT_SETTINGS.SAVE_FAILED"));
  }
  recordingId.value = null;
};

const formatKeys = (keys: string) => keys.replace(/\+/g, " + ");
</script>

<style scoped lang="scss">
.shortcut-row {
  width: 100%;
  padding: 4px 0;
}
</style>
```

- [ ] **Step 2: 类型检查**

Run: `pnpm typecheck`
Expected: PASS —— 无未使用变量（`props` 已在 watch 中消费，`shortcuts`/`recordingId` 均在模板使用）。

- [ ] **Step 3: 运行现有测试确保无回归**

Run: `pnpm test`
Expected: PASS。

- [ ] **Step 4: 提交**

```bash
git add src/renderer/components/settings/keymap/KeymapSettings.vue
git commit -m "feat: 修复快捷键配置回显并增加冲突提示"
```

---

### Task 4: 挂载全局搜索 + 注册全局监听

**Files:**

- Modify: `src/renderer/App.vue`

- [ ] **Step 1: 修改 App.vue**

（a）模板：在 `<n-modal-provider>` 内、`<notification-toast />` 旁挂载全局搜索：

```html
        <n-modal-provider>
            <router-view />
            <notification-toast />
            <global-search v-model:visible="shortcut.searchVisible" />
        </n-modal-provider>
```

（b）script：新增 import：

```ts
import GlobalSearch from "@/renderer/components/GlobalSearch.vue";
import { useShortcut } from "@/renderer/composables/useShortcut";
```

（c）script：在组合式区域新增实例（放在 `downloadStore` 之后）：

```ts
const shortcut = useShortcut();
```

（d）`onMounted` 末尾（`downloadStore.setupListeners()` 之后）注册全局监听：

```ts
  // 注册全局快捷键监听
  shortcut.init();
```

（e）`onUnmounted` 中注销监听：

```ts
onUnmounted(() => {
  shortcut.dispose();
  downloadStore.destroyListeners();
});
```

- [ ] **Step 2: 类型检查**

Run: `pnpm typecheck`
Expected: PASS。

- [ ] **Step 3: 手动验证**

Run: `pnpm dev`
验证：在任意页面按 `Ctrl+,` → 设置弹窗打开；按 `Ctrl+Shift+F` → 全局搜索弹窗打开；按 Esc 关闭。

- [ ] **Step 4: 提交**

```bash
git add src/renderer/App.vue
git commit -m "feat: 挂载全局搜索并注册全局快捷键监听"
```

---

### Task 5: AppHeader 设置弹窗改用 store 状态

**Files:**

- Modify: `src/renderer/components/AppHeader.vue`

- [ ] **Step 1: 修改 AppHeader.vue**

（a）script 新增 import：

```ts
import { useShortcut } from "@/renderer/composables/useShortcut";
```

（b）将 `const showSettings = ref(false);`（原 L99）替换为 store 驱动：

```ts
const shortcut = useShortcut();
const showSettings = computed({
  get: () => shortcut.settingsVisible,
  set: (value: boolean) => {
    shortcut.settingsVisible = value;
  },
});
```

（c）更新两个 handler：

```ts
function handleSettingsClick(): void {
  shortcut.openSettings();
}

function handleCloseSettings(): void {
  shortcut.closeSettings();
}
```

说明：模板中 `v-model:show="showSettings"` 与 `@close="handleCloseSettings"` 无需改动，`showSettings` 仍是可写 computed。

- [ ] **Step 2: 类型检查**

Run: `pnpm typecheck`
Expected: PASS（`ref` 仍被其他状态使用，`computed` 已在 import 中）。

- [ ] **Step 3: 手动验证**

Run: `pnpm dev`
验证：点击标题栏设置按钮 → 设置弹窗打开（行为不变）；再按 `Ctrl+,` → 同样能打开/已打开时保持打开。

- [ ] **Step 4: 提交**

```bash
git add src/renderer/components/AppHeader.vue
git commit -m "feat: 设置弹窗状态迁移至 shortcut store"
```

---

### Task 6: 全量验证与收尾

**Files:**

- （无新增/修改）

- [ ] **Step 1: 全量测试**

Run: `pnpm test`
Expected: 全部 PASS，含 `shortcut.store.test.ts` 与 `locale-keys.test.ts`。

- [ ] **Step 2: 类型检查与 Lint**

Run: `pnpm typecheck && pnpm lint`
Expected: 无错误、无 warning。

- [ ] **Step 3: 构建冒烟**

Run: `pnpm build`
Expected: `vue-tsc && vite build` 成功。

- [ ] **Step 4: 自查清单**

- `Ctrl+,` 在任意页面可打开设置弹窗。
- `Ctrl+Shift+F` 在任意页面可打开全局搜索弹窗。
- 设置 → 快捷键 页显示已保存的按键组合（重开设置后不回退默认）。
- 修改快捷键保存后，重启应用仍生效（`app.json` 中 `shortcuts` 已写入）。
- 录制到冲突组合键时出现「快捷键冲突」提示。
- `快速记录`、`复制`、`粘贴` 三项已从快捷键列表移除。

- [ ] **Step 5: 提交（如前面步骤有遗漏改动）**

```bash
git status
git add -A
git commit -m "chore: 快捷键功能补全收尾"
```

---

## 自审记录

- **Spec 覆盖**：配置回显（Task 3 + store 纯函数 Task 1）、全局分发（Task 1 `handleKeydown` + Task 4 注册）、设置/搜索动作绑定（Task 4/5）、移除死项（Task 1 默认项 + Task 2/3 i18n/UI）、冲突提示（Task 3）、重启持久化（store 读取 `config.shortcuts`，已有 config store `setValue` 支持，无需新 IPC）。
- **无占位符**：所有改动均含完整代码。
- **类型一致性**：`ShortcutActionId` / `ShortcutItem` / `resolveShortcuts` / `normalizeKeys` / `keysFromEvent` / `effectiveShortcuts` / `openSettings` / `closeSettings` / `openSearch` / `closeSearch` / `init` / `dispose` 在 store、composable、KeymapSettings、App.vue、AppHeader.vue 中的引用一致。
- **明确不在本次范围**：`GlobalSearch` 内的实际搜索逻辑（`useSearch.ts` 仍为 stub）属于独立功能，本次仅打通「快捷键 → 打开搜索弹窗」。
