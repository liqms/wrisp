import { Id, Timestamp, Ensure, NonEmptyString, Name, Description, Checksum, ErrorMessage, VersionString, QueryParams } from '@/shared/types'

export type MigrationId = Id

export type MigrationStatus = 'pending' | 'executed' | 'failed'

export interface MigrationDb {
  id: MigrationId
  version: VersionString
  name: Name
  description: Description
  sql_statement: string
  status: MigrationStatus
  executed_at: Timestamp
  execution_time: number | null
  checksum: Checksum
  error_message: ErrorMessage
  created_at: Timestamp
  updated_at: Timestamp
}

export interface MigrationDbCreate {
  id?: MigrationId
  version: VersionString
  name: Name
  sql_statement: string
  description?: Description
  checksum?: Checksum
  status?: MigrationStatus
  executed_at?: Timestamp | null
  execution_time?: number | null
  error_message?: ErrorMessage
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface MigrationDbUpdate {
  version?: VersionString
  name?: Name
  sql_statement?: string
  description?: Description
  checksum?: Checksum
  status?: MigrationStatus
  executed_at?: Timestamp | null
  execution_time?: number | null
  error_message?: ErrorMessage
  updated_at?: Timestamp
}

export type StrictMigrationDbCreate = Ensure<MigrationDbCreate, {
  id: NonEmptyString<MigrationId>
  version: NonEmptyString<VersionString>
  name: NonEmptyString<Name>
  sql_statement: NonEmptyString<string>
}>

export interface MigrationDbQuery extends QueryParams {
  version?: VersionString
  name?: Name
  status?: MigrationStatus
}

export interface MigrationHistory {
  id: MigrationId
  version: VersionString
  name: Name
  status: MigrationStatus
  executed_at: Timestamp | null
  execution_time: number | null
  error_message: ErrorMessage
}
