import { protocol, net } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'
import { Logger } from '@/main/utils/logger'
import { configService } from '@/main/core/services/config.service'

/**
 * 注册自定义协议处理器
 * 实现类似 file:// 协议的本地文件访问功能
 * 
 * 使用方式:
 * - app://xxx -> 访问应用静态资源
 * - app://cache/xxx  -> 访问用户缓存资源
 */
export function registerProtocolHandler(): void {
  try {
    protocol.handle('app', (request) => {
      const urlStr = request.url

      // 移除协议前缀 app://
      const filePath = urlStr.slice('app://'.length)

      // 根据路径前缀确定基础目录
      let basePath = ''
      let remainingPath = filePath

      if (filePath.startsWith('cache/')) {
        // 用户缓存资源
        basePath = configService.getStaticPath('userData')
        remainingPath = filePath.slice('cache/'.length)
      } else {
        // 默认使用应用静态资源
        basePath = configService.getStaticPath()
        remainingPath = filePath
      }

      // 安全检查：防止路径遍历攻击
      const resolvedPath = path.resolve(basePath, remainingPath)
      const relativePath = path.relative(basePath, resolvedPath)
      const isSafe = relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)

      if (!isSafe) {
        Logger.warn('路径遍历尝试被阻止:', { filePath, resolvedPath })
        return new Response('Bad Request', {
          status: 400,
          headers: { 'content-type': 'text/plain' }
        })
      }

      // 使用 net.fetch 提供文件
      return net.fetch(pathToFileURL(resolvedPath).toString())
    })
    Logger.info('自定义协议 app:// 注册成功')
  } catch (error) {
    Logger.error('注册自定义协议失败', { error })
  }
}
