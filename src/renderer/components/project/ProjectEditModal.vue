<template>
    <n-modal
        :show="show"
        :title="isEditing ? t('ACTION.EDIT.EDIT_PROJECT') : t('ACTION.NEW.PROJECT')"
        preset="card"
        style="width: 520px"
        :mask-closable="false"
        @update:show="handleUpdateShow"
    >
        <n-form ref="formRef" :model="formData" :rules="formRules" label-placement="top">
            <n-form-item :label="t('TIPS.PROJECT.PROJECT_NAME')" path="name">
                <n-input v-model:value="formData.name" :placeholder="t('TIPS.PROJECT.INPUT_PROJECT_NAME')" />
            </n-form-item>
            <n-form-item :label="t('TIPS.PROJECT.PROJECT_TYPE')" path="type">
                <n-select v-model:value="formData.type" :options="typeOptions"
                    :placeholder="t('TIPS.PROJECT.SELECT_PROJECT_TYPE')" />
            </n-form-item>
            <n-form-item :label="t('TIPS.PROJECT.PROJECT_DESCRIPTION')" path="description">
                <n-input v-model:value="formData.description" type="textarea"
                    :placeholder="t('TIPS.PROJECT.INPUT_PROJECT_DESCRIPTION')" :rows="3" />
            </n-form-item>
        </n-form>
        <template #footer>
            <n-flex justify="flex-end" :gap="12">
                <n-button @click="handleUpdateShow(false)">{{ t('ACTION.COMMON.CANCEL') }}</n-button>
                <n-button type="primary" :loading="submitting" @click="handleSubmit">
                    {{ isEditing ? t('ACTION.COMMON.SAVE') : t('ACTION.COMMON.CREATE') }}
                </n-button>
            </n-flex>
        </template>
    </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useMessage } from "naive-ui";
import type { FormInst, FormRules } from "naive-ui";
import { useI18n } from "vue-i18n";
import { useProject } from "@/renderer/composables/useProject";
import { PROJECT_TYPE, type ProjectType } from "@/shared/enums";
import type { ProjectCreate, ProjectUpdate, ProjectDetail } from "@/main/types/db";

const props = defineProps<{
    show: boolean;
    /** 编辑时传入的作品详情；为 null 表示新建 */
    project: ProjectDetail | null;
}>();

const emit = defineEmits<{
    (e: "update:show", show: boolean): void;
    (e: "saved"): void;
}>();

const { t } = useI18n();
const message = useMessage();
const { createProject, updateProject, checkNameExists } = useProject();

const isEditing = computed(() => !!props.project);

const submitting = ref(false);
const formRef = ref<FormInst | null>(null);

const formData = ref<{ name: string; type: string; description: string }>({
    name: "",
    type: PROJECT_TYPE.NOVEL,
    description: "",
});

const formRules: FormRules = {
    name: [
        { required: true, message: t('TIPS.PROJECT.INPUT_PROJECT_NAME'), trigger: "blur" },
        { min: 1, max: 100, message: t('TIPS.PROJECT.PROJECT_NAME_LENGTH_LIMIT'), trigger: "blur" },
    ],
    type: [{ required: true, message: t('TIPS.PROJECT.SELECT_PROJECT_TYPE'), trigger: "change" }],
};

// 类型映射
const typeOptions = computed(() => [
    { label: t('APP.PROJECT_TYPE.NOVEL'), value: PROJECT_TYPE.NOVEL },
    { label: t('APP.PROJECT_TYPE.SERIES'), value: PROJECT_TYPE.SERIES },
    { label: t('APP.PROJECT_TYPE.BOOK'), value: PROJECT_TYPE.BOOK },
    { label: t('APP.PROJECT_TYPE.RESEARCH'), value: PROJECT_TYPE.RESEARCH },
    { label: t('APP.PROJECT_TYPE.PRODUCT'), value: PROJECT_TYPE.PRODUCT },
]);

const handleUpdateShow = (value: boolean) => emit("update:show", value);

// 打开弹窗时重置表单：编辑模式回填，新建模式清空
watch(
    () => props.show,
    (visible) => {
        if (!visible) return;
        formData.value = props.project
            ? {
                name: props.project.name,
                type: props.project.type,
                description: props.project.description || "",
            }
            : { name: "", type: PROJECT_TYPE.NOVEL, description: "" };
    },
);

const handleSubmit = async () => {
    try {
        await formRef.value?.validate();
    } catch {
        return;
    }

    submitting.value = true;
    try {
        if (isEditing.value && props.project) {
            const nameExists = await checkNameExists(formData.value.name, props.project.id);
            if (nameExists) {
                message.error(t('NOTIFICATION.PROJECT_NAME_EXISTS'));
                return;
            }

            const updateData: ProjectUpdate = {
                name: formData.value.name,
                type: formData.value.type as ProjectType,
                description: formData.value.description || undefined,
            };
            const success = await updateProject(props.project.id, updateData);
            if (success) {
                message.success(t('NOTIFICATION.SUCCESS'));
                emit("update:show", false);
                emit("saved");
            } else {
                message.error(t('NOTIFICATION.ERROR'));
            }
        } else {
            const nameExists = await checkNameExists(formData.value.name);
            if (nameExists) {
                message.error(t('NOTIFICATION.PROJECT_NAME_EXISTS'));
                return;
            }

            const createData: ProjectCreate = {
                name: formData.value.name,
                type: formData.value.type as ProjectType,
                description: formData.value.description || undefined,
            };
            const id = await createProject(createData);
            if (id) {
                message.success(t('NOTIFICATION.SUCCESS'));
                emit("update:show", false);
                emit("saved");
            } else {
                message.error(t('NOTIFICATION.ERROR'));
            }
        }
    } finally {
        submitting.value = false;
    }
};
</script>
