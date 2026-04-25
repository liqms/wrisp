// 字符串工具函数
// 文件路径拼接
export function joinPath(basePath: string, relativePath: string) {
    // 去掉basePath的后导斜杠
    const normalizedBasePathEnd = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
    const normalizedRelativePath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath
    return `${normalizedBasePathEnd}/${normalizedRelativePath}`.replace(/\\/g, '/')
}

