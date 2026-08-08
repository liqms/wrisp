import {
  Id,
  Timestamp,
  Ensure,
  NonEmptyString,
  FilePath,
  FileSize,
  HashValue,
  Name,
  QueryParams,
} from "@/shared/types";

export type FileIndexId = Id;

export type SyncStatus = "pending" | "synced" | "failed" | "deleted";

export interface FileIndex {
  id: FileIndexId;
  file_path: FilePath;
  file_hash: HashValue;
  file_size: FileSize;
  date: string | null;
  name: Name;
  last_synced: Timestamp | null;
  sync_status: SyncStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface FileIndexCreate {
  id?: FileIndexId;
  file_path: FilePath;
  file_hash: HashValue;
  file_size?: FileSize;
  date?: string | null;
  name?: Name;
  last_synced?: Timestamp | null;
  sync_status?: SyncStatus;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

export interface FileIndexUpdate {
  file_path?: FilePath;
  file_hash?: HashValue;
  file_size?: FileSize;
  date?: string | null;
  name?: Name;
  last_synced?: Timestamp | null;
  sync_status?: SyncStatus;
  updated_at?: Timestamp;
}

export type StrictFileIndexCreate = Ensure<
  FileIndexCreate,
  {
    file_path: NonEmptyString<FilePath>;
    file_hash: NonEmptyString<HashValue>;
  }
>;

export interface FileIndexQuery extends QueryParams {
  file_path?: FilePath;
  sync_status?: SyncStatus;
  file_hash?: HashValue;
  date?: string;
  name?: Name;
}