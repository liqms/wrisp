<template>
  <n-card size="small" :title="t('SETTINGS.PROVIDER_MODELS')">
    <n-list v-if="providers.length > 0">
      <n-list-item v-for="provider in providers" :key="provider.id">
        <n-thing :title="provider.name">
          <template #description>{{ provider.models.length }} models</template>
        </n-thing>
      </n-list-item>
    </n-list>
    <n-empty v-else :description="t('TIPS.SEARCH.NO_CREATION')" />
  </n-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { AppConfig, AIProvider } from "@/shared/types";

const props = defineProps<{ config: AppConfig | null }>();
const { t } = useI18n();

const providers = computed<AIProvider[]>(() => props.config?.aiProviders ?? []);
</script>