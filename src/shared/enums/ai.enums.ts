export enum CHAT_MESSAGE_ROLE {
  USER = "user",
  ASSISTANT = "assistant",
  SYSTEM = "system",
}

/**
 * 聊天消息角色联合类型
 * 从 ChatMessageRole 枚举派生，取枚举的值类型
 */
export type ChatMessageRole =
  (typeof CHAT_MESSAGE_ROLE)[keyof typeof CHAT_MESSAGE_ROLE];

/**
 * 聊天附件类型枚举
 * 用于标识聊天附件的类型
 */
export enum CHAT_ATTACHMENT_TYPE {
  IMAGE = "image",
  DOCUMENT = "document",
  AUDIO = "audio",
  VIDEO = "video",
  OTHER = "other",
}

/**
 * 聊天附件类型联合类型
 * 从 ChatAttachmentType 枚举派生，取枚举的值类型
 */
export type ChatAttachmentType =
  (typeof CHAT_ATTACHMENT_TYPE)[keyof typeof CHAT_ATTACHMENT_TYPE];
