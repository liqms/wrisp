import { Scheduler } from './scheduler'

export { Scheduler } from './scheduler'
export { BackupTask } from './backup.task'
export { CleanupTask } from './cleanup.task'
export type { BackupFileInfo } from './backup.task'

export const scheduler = Scheduler.getInstance()

export default scheduler