<template>
  <div class="journal-entry-composer">
    <n-input
      v-model:value="draft"
      type="textarea"
      :autosize="{ minRows: 2, maxRows: 12 }"
      :placeholder="t('TIPS.JOURNAL.APPEND_PLACEHOLDER')"
      @keydown="onKeydown"
      @update:value="onInput"
    />
    <!-- & 作品候选下拉 -->
    <div v-if="projectCandidates.length" class="project-candidates">
      <div
        v-for="p in projectCandidates"
        :key="p.id"
        class="candidate-item"
        @mousedown.prevent="pickProject(p.name)"
      >&{{ p.name }}</div>
    </div>
    <!-- 底部提示区：解析出的标签/作品，未匹配高亮 -->
    <div class="composer-hints">
      <template v-if="hintTags.length">
        <span class="hint-label">{{ t("TIPS.JOURNAL.ENTRY_TAGS_LABEL") }}：</span>
        <n-tag v-for="n in hintTags" :key="n" size="tiny" :bordered="false">#{{ n }}</n-tag>
      </template>
      <template v-if="hintProjects.length">
        <span class="hint-label">{{ t("TIPS.JOURNAL.ENTRY_PROJECTS_LABEL") }}：</span>
        <n-tag
          v-for="n in hintProjects"
          :key="n.name"
          size="tiny"
          :bordered="false"
          :type="chipType(n.status)"
        >&{{ n.name }}{{ n.status === "unmatched" ? `（${t("TIPS.JOURNAL.ENTRY_PROJECT_UNMATCHED")}）` : "" }}</n-tag>
      </template>
    </div>
    <n-flex justify="end">
      <n-button
        size="small"
        type="primary"
        :disabled="draft.trim() === '' || submitting"
        :loading="submitting"
        @click="submit"
      >{{ t("TIPS.JOURNAL.APPEND_ACTION") }}</n-button>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useFrontendNotification } from "@/renderer/composables/useNotification";
import { extractTagNames, extractProjectNames } from "@/shared/utils/text-tokens";
import { useJournal } from "@/renderer/composables/useJournal";

const { t } = useI18n();
const notify = useFrontendNotification({
  title: t("TIPS.JOURNAL.APPEND_ACTION"),
  content: "",
});
const { appendEntry } = useJournal();

const draft = ref("");
const submitting = ref(false);
const projectCandidates = ref<Array<{ id: string; name: string }>>([]);

/**
 * 作品匹配判定（裁定 T9-6）：key = 实际检索过的 &token，value = 结果集是否精确命中该名字。
 * 未检索（undefined）→ 中性；命中（true）→ info；确认落空（false）→ warning。
 * knownProjects 只由防抖检索结果填充，直接输入完整已存在名字但未触发候选列表时不得误判为黄色。
 */
const resolved = ref<Map<string, boolean>>(new Map());

const hintTags = computed(() => extractTagNames(draft.value));
const hintProjects = computed<Array<{ name: string; status: "matched" | "unmatched" | "unknown" }>>(() =>
  extractProjectNames(draft.value).map((name) => {
    const hit = resolved.value.get(name);
    return { name, status: hit === false ? "unmatched" : hit === true ? "matched" : "unknown" };
  }),
);

function chipType(status: "matched" | "unmatched" | "unknown"): "info" | "warning" | "default" {
  if (status === "unmatched") return "warning";
  if (status === "matched") return "info";
  return "default";
}

let projectSearchTimer: ReturnType<typeof setTimeout> | null = null;
let disposed = false;

/** 草稿尾部「正在输入的 &token」；无进行中 token 时返回 null */
function trailingProjectToken(): string | null {
  const m = /&([^\s&[\]]*)$/.exec(draft.value);
  return m ? m[1] : null;
}

function clearProjectSearchTimer() {
  if (projectSearchTimer) {
    clearTimeout(projectSearchTimer);
    projectSearchTimer = null;
  }
}

async function runProjectSearch(token: string) {
  let list: Array<{ id: string; name: string }> | null = null;
  try {
    const res = await window.electronAPI.project.searchByName(token);
    if (res.success && res.data) list = res.data as Array<{ id: string; name: string }>;
  } catch {
    // 检索失败（IPC reject / 业务失败）：丢弃候选，不得把上一个 token 的旧结果留在下拉里
    list = null;
  }
  // 竞态防护：响应回来时捕获的 token 必须仍是尾部 token，否则本次响应作废
  // （乱序的旧响应不得覆盖新候选列表，也不得误置 resolved 匹配判定）
  if (disposed || trailingProjectToken() !== token) return;
  if (!list) {
    projectCandidates.value = [];
    return;
  }
  projectCandidates.value = list;
  // 结果集是否包含与检索 token 完全同名的作品 → 精确命中判定
  resolved.value.set(token, list.some((p) => p.name === token));
}

function onInput() {
  // 光标处正在输入的 &token → 防抖 300ms 模糊检索作品
  clearProjectSearchTimer();
  const token = trailingProjectToken();
  if (token === null) {
    projectCandidates.value = [];
    return;
  }
  // 裸 `&` 不是 token：不发无意义的空串检索（主进程同样直接短路返回空）
  if (token === "") {
    projectCandidates.value = [];
    return;
  }
  projectSearchTimer = setTimeout(() => void runProjectSearch(token), 300);
}

onBeforeUnmount(() => {
  disposed = true;
  clearProjectSearchTimer();
});

function pickProject(name: string) {
  // 替换尾部进行中的 &token 为选中的作品名（含空格则方括号包裹）
  const wrapped = /\s/.test(name) ? `&[${name}]` : `&${name}`;
  draft.value = draft.value.replace(/&[^\s&[\]]*$/, `${wrapped} `);
  projectCandidates.value = [];
  resolved.value.set(name, true);
}

function onKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === "Enter") {
    e.preventDefault();
    void submit();
  }
}

async function submit() {
  if (submitting.value || draft.value.trim() === "") return;
  submitting.value = true;
  const id = await appendEntry({ content: draft.value });
  submitting.value = false;
  if (id) {
    // 追加成功后 store 已整体刷新 days（裁定 T9-7），此处不再重拉，仅清草稿与判定缓存
    draft.value = "";
    projectCandidates.value = [];
    resolved.value = new Map();
  } else {
    notify.error(t("TIPS.JOURNAL.APPEND_FAILED"), t("TIPS.JOURNAL.APPEND_FAILED_CONTENT"));
  }
}
</script>

<style lang="scss" scoped>
@use "@/renderer/styles/_variables" as *;

.journal-entry-composer {
  position: relative;
  padding: $spacing-sm 0;
}

.project-candidates {
  position: absolute;
  z-index: 10;
  margin-top: $spacing-xs;
  padding: $spacing-xs 0;
  background: var(--card-color, #fff);
  border: 1px solid var(--divider-color, #e0e0e6);
  border-radius: $radius-md;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.candidate-item {
  padding: $spacing-xs $spacing-md;
  font-size: $font-sm;
  cursor: pointer;

  &:hover {
    background: var(--hover-color, rgba(0, 0, 0, 0.04));
  }
}

.composer-hints {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $spacing-xs;
  margin-top: $spacing-xs;
  min-height: $spacing-lg;
}

.hint-label {
  font-size: $font-xs;
  color: var(--text-tertiary, #999);
}
</style>
