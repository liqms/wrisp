import { shallowRef } from "vue";
import type { WrispBlockEditRequest } from "../registry";

/**
 * 弹窗编辑总线：NodeView 发起编辑请求，全局唯一的 BlockEditHost 响应。
 * 全进程单例状态，避免每个 NodeView 挂载一份 modal。
 */
const editRequest = shallowRef<WrispBlockEditRequest | null>(null);

/** 当前编辑请求（宿主组件只读消费） */
export const blockEditState = editRequest;

/** NodeView 触发：打开指定块节点的编辑弹窗 */
export function openBlockEditor(request: WrispBlockEditRequest): void {
  editRequest.value = request;
}

/** 关闭弹窗（取消或保存后调用） */
export function closeBlockEditor(): void {
  editRequest.value = null;
}
