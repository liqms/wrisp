<template>
  <n-select
    v-model:value="currentLocale"
    :options="localeOptions"
    size="small"
    style="width: 120px"
    @update:value="handleLocaleChange"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NSelect } from 'naive-ui'

type LocaleOption = {
  label: string
  value: string
}

const localeOptions: LocaleOption[] = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
  { label: '日本語', value: 'ja-JP' }
]

const currentLocale = ref('zh-CN')

const handleLocaleChange = (value: string) => {
  console.log('Locale changed to:', value)
  // 这里可以添加切换语言的逻辑
  // 例如：i18n.global.locale = value
}
</script>

<style scoped>
/* 语言选择器样式 */
</style>