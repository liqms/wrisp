// 主 preload 入口文件 - 已迁移到模块化结构
// 此文件已废弃，请使用 ./preload/index.ts

import { electronAPI } from './preload/index'
import type { ElectronAPI } from './preload/types'

// 保持向后兼容性
export { electronAPI }
export type { ElectronAPI }