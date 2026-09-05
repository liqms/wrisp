import {
  Id,
  Timestamp,
  Ensure,
  NonEmptyString,
  Name,
  Description,
  QueryParams,
} from "@/shared/types";

export type CharacterId = Id;

/** 人物归属类型：contact=联系人（现实中的人）/ project=作品人物（owner_id 指向作品） */
export type CharacterOwnerType = "contact" | "project";

/** 人物元信息（metadata JSON 的结构约定，均为可选扩展字段） */
export interface CharacterMetadata {
  /** 别名列表 */
  aliases?: string[];
  /** 性别 */
  gender?: string;
  /** 出生日期（自由格式） */
  birthday?: string;
  /** 其他扩展信息 */
  [key: string]: unknown;
}

export interface Character {
  id: CharacterId;
  name: Name;
  owner_type: CharacterOwnerType;
  /** 归属作品 ID；owner_type='contact' 时为 null */
  owner_id: CharacterId | null;
  description: Description;
  /** 元信息 JSON 字符串（CharacterMetadata 序列化） */
  metadata: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CharacterCreate {
  id?: CharacterId;
  name: Name;
  owner_type?: CharacterOwnerType;
  owner_id?: CharacterId | null;
  description?: Description;
  metadata?: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

export interface CharacterUpdate {
  name?: Name;
  owner_type?: CharacterOwnerType;
  owner_id?: CharacterId | null;
  description?: Description;
  metadata?: string;
  updated_at?: Timestamp;
}

export type StrictCharacterCreate = Ensure<
  CharacterCreate,
  {
    id: NonEmptyString<CharacterId>;
    name: NonEmptyString<Name>;
  }
>;

export interface CharacterQuery extends QueryParams {
  name?: Name;
  owner_type?: CharacterOwnerType;
  owner_id?: CharacterId | null;
}
