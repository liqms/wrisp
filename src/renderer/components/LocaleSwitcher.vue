<template>
  <div class="locale-switcher">
    <select v-model="currentLocale" @change="handleLocaleChange" class="locale-select">
      <option v-for="locale in SUPPORTED_LOCALES" :key="locale" :value="locale">
        {{ getLocaleDisplayName(locale) }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useLocale, SUPPORTED_LOCALES, type SupportedLocale } from '../../shared/local'

const { locale, setLocale } = useLocale()
const currentLocale = ref<SupportedLocale>(locale.value)

// 获取语言显示名称
function getLocaleDisplayName(locale: SupportedLocale): string {
  const names: Record<SupportedLocale, string> = {
    'zh-CN': '中文',
    'en-US': 'English'
  }
  return names[locale]
}

// 处理语言切换
function handleLocaleChange(event: Event) {
  const target = event.target as HTMLSelectElement
  const newLocale = target.value as SupportedLocale
  setLocale(newLocale)
}

// 监听语言变化
onMounted(() => {
  currentLocale.value = locale.value
})
</script>

<style scoped>
.locale-switcher {
  display: inline-block;
}

.locale-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 14px;
  cursor: pointer;
  outline: none;
}

.locale-select:focus {
  border-color: #4CAF50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
}

.locale-select:hover {
  border-color: #ccc;
}
</style>