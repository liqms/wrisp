import { Scheduler } from './scheduler'

export { Scheduler } from './scheduler'
export { BackupTask } from './backup.task'
export type { BackupConfig } from './backup.task'

export const scheduler = Scheduler.getInstance()

export default scheduler
