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
 * - app://workspace/xxx -> 访问工作空间文件（含 attachments 附件）
 */
export function registerProtocolHandler(): void {
  try {
    protocol.handle('app', (request) => {
      const urlStr = request.url

      // 移除协议前缀 app://
      const filePath = urlStr.slice('app://'.length)

      // 根据路径前缀确定基础目录
      let basePath: string
      let remainingPath: string

      if (filePath.startsWith('cache/')) {
        // 用户缓存资源
        basePath = configService.getStaticPath('userData')
        remainingPath = filePath.slice('cache/'.length)
      } else if (filePath.startsWith('workspace/')) {
        // 工作空间文件（附件等）。URL 中非 ASCII 文件名会被百分号编码，需解码。
        basePath = configService.getWorkspacePath()
        if (!basePath) {
          Logger.warn('app://workspace 访问失败：工作空间未配置')
          return new Response('Not Found', {
            status: 404,
            headers: { 'content-type': 'text/plain' }
          })
        }
        try {
          remainingPath = decodeURIComponent(filePath.slice('workspace/'.length))
        } catch {
          // 非法编码序列：按原样使用
          remainingPath = filePath.slice('workspace/'.length)
        }
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
