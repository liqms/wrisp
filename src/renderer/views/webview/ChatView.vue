<template>
  <n-flex class="chat-view">
    <!-- 小程序导航栏 -->
    <n-flex class="mini-program-nav">
      <MiniProgramBar v-for="mp in miniProgramsReady" :key="mp.id" :icon="mp.icon" :label="mp.name"
        :selected="selectedMiniProgramId === mp.id" @click="selectMiniProgram(mp.id)" />
    </n-flex>

    <!-- 等待系统信息加载完成后再渲染 WebView -->
    <template v-if="isSystemReady && currentMiniProgramReady">
      <WebView :url="currentMiniProgramReady?.url" :autoAdjustBounds="true" />
    </template>
    <!-- 加载状态提示 -->
    <n-flex v-else class="loading-container">
      <n-spin size="medium">
        <template #description>
          {{
            isSystemReady
              ? $t("TIPS.LOADING.WEBVIEW_LOADING")
              : $t("TIPS.LOADING.SYSTEM_INFO_LOADING")
          }}
        </template>
      </n-spin>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed, watch, watchEffect, onMounted } from "vue";
import WebView from "@/renderer/components/WebView.vue";
import MiniProgramBar from "@/renderer/components/MiniProgramBar.vue";
import { useConfig, useSystem } from "@/renderer/composables";
import type { MiniProgram } from "@/shared/types";
import { logger } from "@/renderer/utils/logger.utils";
// import { useRouter } from "vue-router";
import { validateUrl } from "@/shared/utils/validate";

const { systemInfo, init: initSystemInfo } = useSystem();
const { miniPrograms, defaultMiniProgramId, init: initConfig } = useConfig();

// const router = useRouter();

// 系统信息是否准备就绪
const isSystemReady = ref(false);

const webviewBounds = ref({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
});
// 是否是侧边栏模式
const isAside = ref(false);

// 响应式数据
const selectedMiniProgramId = ref<string>("");

// 计算属性
const miniProgramsReady = computed(() => {
  if (!miniPrograms.value) return [];
  return miniPrograms.value.map((mp: MiniProgram) => ({
    ...mp,
    icon: validateUrl(mp.icon) ? mp.icon : "app://" + mp.icon,
  }));
});

const currentMiniProgramReady = computed(() => {
  if (!selectedMiniProgramId.value) return null;
  return miniProgramsReady.value.find(
    (mp: MiniProgram) => mp.id === selectedMiniProgramId.value,
  );
});

// 设置默认小程序
function setDefaultMiniProgram() {
  if (defaultMiniProgramId.value) {
    selectedMiniProgramId.value = defaultMiniProgramId.value;
    logger.debug("已设置默认小程序", { id: defaultMiniProgramId.value });
  } else if (miniProgramsReady.value.length > 0) {
    selectedMiniProgramId.value = miniProgramsReady.value[0].id;
    logger.debug("已设置第一个小程序为默认", {
      id: miniProgramsReady.value[0].id,
    });
  }
}

// 选择小程序
function selectMiniProgram(id: string) {
  selectedMiniProgramId.value = id;
  logger.debug("选择小程序", { id });
}

// 监听配置变化
watch(
  () => defaultMiniProgramId.value,
  (newDefault, oldDefault) => {
    // 当旧值不存在但新值存在时，表示配置刚加载完成
    if (!oldDefault && newDefault) {
      logger.debug("配置加载完成，设置默认小程序", { newDefault });
      setDefaultMiniProgram();
    }
  },
);

// 监听小程序列表变化
watch(
  () => miniProgramsReady.value,
  (newList) => {
    // 如果还没有选中的小程序，设置默认值
    if (!selectedMiniProgramId.value && newList.length > 0) {
      setDefaultMiniProgram();
    }
  },
  { deep: true },
);

// 监听系统信息变化，更新 webviewBounds
// 使用 watchEffect 监听，确保能捕获到初始值
watchEffect(() => {
  const currentSystemInfo = systemInfo.value;
  if (currentSystemInfo?.viewSize) {
    if (isAside.value) {
      webviewBounds.value = {
        x: currentSystemInfo.viewSize[0] - 400,
        y: 42 + 30,
        width: 400,
        height: currentSystemInfo.viewSize[1] - 42 - 30,
      };
    } else {
      webviewBounds.value = {
        x: 64,
        y: 42 + 30,
        width: currentSystemInfo.viewSize[0] - 64,
        height: currentSystemInfo.viewSize[1] - 42 - 30,
      };
    }
    logger.debug("系统信息更新，WebView 尺寸已调整", {
      x: webviewBounds.value.x,
      y: webviewBounds.value.y,
      width: webviewBounds.value.width,
      height: webviewBounds.value.height,
    });
    // 标记系统信息已准备就绪
    isSystemReady.value = true;
  }
});

// 生命周期
onMounted(async () => {
  try {
    logger.debug("开始初始化系统信息和配置");
    // 并行初始化系统信息和配置
    await Promise.all([initSystemInfo(), initConfig()]);
    logger.debug("系统信息和配置初始化完成");

    // 设置默认小程序
    setDefaultMiniProgram();
  } catch (error) {
    logger.error("系统信息初始化失败", { error: String(error) });
  }
});
</script>

<style lang="scss" scoped>
@use "@/renderer/styles/_variables.scss" as *;

.chat-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary);
}

.mini-program-nav {
  display: flex;
  gap: $spacing-xs !important;
  padding: $spacing-xs;
  border-bottom: 1px solid var(--border-color);
  width: 100%;
  height: 42px;
  flex-wrap: wrap;
}

.loading-container {
  flex: 1;
  justify-content: center;
  align-items: center;
}
</style>
