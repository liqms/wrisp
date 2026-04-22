/**
 * 前端加密和安全工具类
 * 专门为 Vue 3 渲染进程（浏览器环境）设计的加密工具
 * 提供最常用的加密、哈希、编码等安全相关的静态方法
 */

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const DIGITS = '0123456789'

// 浏览器环境中的 crypto 对象访问器
const getCrypto = (): Crypto | undefined => {
  if (typeof window !== 'undefined' && typeof window.crypto !== 'undefined') {
    return window.crypto
  }
  return undefined
}

const getSubtle = (): SubtleCrypto | undefined => {
  const crypto = getCrypto()
  return crypto?.subtle
}

export class BrowserCryptoUtil {
  /**
   * 生成 SHA256 哈希
   * @param data - 要哈希的数据
   * @returns SHA256 哈希值
   */
  static async sha256(data: string): Promise<string> {
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    const subtle = getSubtle()
    if (!subtle) {
      throw new Error('Web Crypto API not available in this browser')
    }
    
    const hashBuffer = await subtle.digest('SHA-256', dataBuffer)
    return this.arrayBufferToHex(hashBuffer)
  }

  /**
   * 生成 HMAC 哈希
   * @param data - 要哈希的数据
   * @param key - 密钥
   * @param algorithm - 哈希算法（默认 SHA-256）
   * @returns HMAC 哈希值
   */
  static async hmac(data: string, key: string, algorithm: string = 'SHA-256'): Promise<string> {
    const encoder = new TextEncoder()
    const keyBuffer = encoder.encode(key)
    const dataBuffer = encoder.encode(data)
    const subtle = getSubtle()
    if (!subtle) {
      throw new Error('Web Crypto API not available in this browser')
    }
    
    const cryptoKey = await subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: algorithm },
      false,
      ['sign']
    )
    
    const signature = await subtle.sign('HMAC', cryptoKey, dataBuffer)
    return this.arrayBufferToHex(signature)
  }

  /**
   * 生成随机字符串
   * @param length - 字符串长度
   * @param charset - 字符集（默认字母数字）
   * @returns 随机字符串
   */
  static generateRandomString(length: number = 32, charset: string = ALPHANUMERIC): string {
    let result = ''
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    return result
  }

  /**
   * 生成随机字节
   * @param length - 字节长度
   * @returns 随机字节（十六进制字符串）
   */
  static generateRandomBytes(length: number = 16): string {
    const array = new Uint8Array(length)
    const cryptoObj = getCrypto()
    if (!cryptoObj?.getRandomValues) {
      throw new Error('Crypto.getRandomValues not available in this browser')
    }
    cryptoObj.getRandomValues(array)
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * 生成 UUID v4
   * @returns UUID v4 字符串
   */
  static generateUUID(): string {
    const cryptoObj = getCrypto()
    if (cryptoObj?.randomUUID) {
      return cryptoObj.randomUUID()
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  /**
   * Base64 编码
   * @param data - 要编码的数据
   * @returns Base64 编码字符串
   */
  static base64Encode(data: string): string {
    return btoa(unescape(encodeURIComponent(data)))
  }

  /**
   * Base64 解码
   * @param data - Base64 编码字符串
   * @returns 解码后的字符串
   */
  static base64Decode(data: string): string {
    return decodeURIComponent(escape(atob(data)))
  }

  /**
   * URL Base64 编码（替换 + 和 /）
   * @param data - 要编码的数据
   * @returns URL Base64 编码字符串
   */
  static base64UrlEncode(data: string): string {
    return this.base64Encode(data)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }

  /**
   * URL Base64 解码
   * @param data - URL Base64 编码字符串
   * @returns 解码后的字符串
   */
  static base64UrlDecode(data: string): string {
    let base64 = data.replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4) {
      base64 += '='
    }
    return this.base64Decode(base64)
  }

  /**
   * 十六进制编码
   * @param data - 要编码的数据
   * @returns 十六进制字符串
   */
  static hexEncode(data: string): string {
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    return Array.from(dataBuffer).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * 十六进制解码
   * @param data - 十六进制字符串
   * @returns 解码后的字符串
   */
  static hexDecode(data: string): string {
    const bytes = []
    for (let i = 0; i < data.length; i += 2) {
      bytes.push(parseInt(data.substr(i, 2), 16))
    }
    const decoder = new TextDecoder()
    return decoder.decode(new Uint8Array(bytes))
  }

  /**
   * 生成 JWT（简化版）
   * @param payload - 载荷
   * @param secret - 密钥
   * @returns JWT 字符串
   */
  static async generateJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' }
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header))
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload))
    const signature = await this.hmac(`${encodedHeader}.${encodedPayload}`, secret, 'SHA-256')
    return `${encodedHeader}.${encodedPayload}.${signature}`
  }

  /**
   * 验证 JWT（简化版）
   * @param token - JWT 字符串
   * @param secret - 密钥
   * @returns 验证结果
   */
  static async verifyJwt(token: string, secret: string): Promise<{ valid: boolean; payload?: Record<string, unknown> }> {
    try {
      const [encodedHeader, encodedPayload, signature] = token.split('.')
      if (!encodedHeader || !encodedPayload || !signature) {
        return { valid: false }
      }
      
      const computedSignature = await this.hmac(`${encodedHeader}.${encodedPayload}`, secret, 'SHA-256')
      if (computedSignature !== signature) {
        return { valid: false }
      }
      
      const payload = JSON.parse(this.base64UrlDecode(encodedPayload)) as Record<string, unknown>
      return { valid: true, payload }
    } catch {
      return { valid: false }
    }
  }

  /**
   * 生成 CSRF Token
   * @returns CSRF Token
   */
  static generateCsrfToken(): string {
    return this.generateRandomBytes(32)
  }

  /**
   * 生成 API Key
   * @param prefix - 前缀（默认 'sk'）
   * @returns API Key
   */
  static generateApiKey(prefix: string = 'sk'): string {
    return `${prefix}_${this.generateRandomBytes(32)}`
  }

  /**
   * 生成验证码
   * @param length - 长度
   * @returns 验证码
   */
  static generateVerificationCode(length: number = 6): string {
    return this.generateRandomString(length, DIGITS)
  }

  /**
   * 掩码敏感信息
   * @param value - 值
   * @param visibleChars - 可见字符数
   * @param maskChar - 掩码字符
   * @returns 掩码后的字符串
   */
  static maskSensitiveInfo(value: string, visibleChars: number = 4, maskChar: string = '*'): string {
    if (value.length <= visibleChars) {
      return maskChar.repeat(value.length)
    }
    return value.substring(0, visibleChars) + maskChar.repeat(value.length - visibleChars)
  }

  /**
   * 掩码邮箱
   * @param email - 邮箱
   * @param visibleChars - 可见字符数
   * @returns 掩码后的邮箱
   */
  static maskEmail(email: string, visibleChars: number = 3): string {
    const [localPart, domain] = email.split('@')
    if (!localPart || !domain) return email
    
    const visibleLocal = localPart.substring(0, visibleChars)
    const maskedLocal = visibleLocal + '*'.repeat(localPart.length - visibleChars)
    
    return `${maskedLocal}@${domain}`
  }

  /**
   * ArrayBuffer 转十六进制字符串
   */
  private static arrayBufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
}