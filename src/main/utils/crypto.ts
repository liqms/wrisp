/**
 * 后端加密和安全工具类
 * 专门为 Electron 主进程（Node.js 环境）设计的加密工具
 * 提供最常用的加密、哈希、编码等安全相关的静态方法
 */

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, scryptSync } from 'crypto'

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const DIGITS = '0123456789'

export class NodeCryptoUtil {
  /**
   * 生成 MD5 哈希
   * @param data - 要哈希的数据
   * @returns MD5 哈希值
   */
  static md5(data: string): string {
    return createHash('md5').update(data).digest('hex')
  }

  /**
   * 生成 SHA256 哈希
   * @param data - 要哈希的数据
   * @returns SHA256 哈希值
   */
  static sha256(data: string): string {
    return createHash('sha256').update(data).digest('hex')
  }

  /**
   * 生成 HMAC 哈希
   * @param data - 要哈希的数据
   * @param key - 密钥
   * @param algorithm - 哈希算法（默认 sha256）
   * @returns HMAC 哈希值
   */
  static hmac(data: string, key: string, algorithm: string = 'sha256'): string {
    return createHmac(algorithm, key).update(data).digest('hex')
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
    return randomBytes(length).toString('hex')
  }

  /**
   * 生成 UUID v4
   * @returns UUID v4 字符串
   */
  static generateUUID(): string {
    return randomUUID({ disableEntropyCache: true })
  }

  /**
   * Base64 编码
   * @param data - 要编码的数据
   * @returns Base64 编码字符串
   */
  static base64Encode(data: string): string {
    return Buffer.from(data).toString('base64')
  }

  /**
   * Base64 解码
   * @param data - Base64 编码字符串
   * @returns 解码后的字符串
   */
  static base64Decode(data: string): string {
    return Buffer.from(data, 'base64').toString('utf-8')
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
    return Buffer.from(data).toString('hex')
  }

  /**
   * 十六进制解码
   * @param data - 十六进制字符串
   * @returns 解码后的字符串
   */
  static hexDecode(data: string): string {
    return Buffer.from(data, 'hex').toString('utf-8')
  }

  /**
   * AES 加密（CBC 模式）
   * @param plaintext - 明文
   * @param key - 密钥（32 字节 hex）
   * @param iv - 初始化向量（16 字节 hex）
   * @returns 加密后的字符串（十六进制）
   */
  static aesEncrypt(plaintext: string, key: string, iv: string): string {
    const cipher = createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'))
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return encrypted
  }

  /**
   * AES 解密（CBC 模式）
   * @param ciphertext - 密文（十六进制）
   * @param key - 密钥（32 字节 hex）
   * @param iv - 初始化向量（16 字节 hex）
   * @returns 解密后的字符串
   */
  static aesDecrypt(ciphertext: string, key: string, iv: string): string {
    const decipher = createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'))
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }

  /**
   * 生成 AES 密钥
   * @returns 32 字节的密钥（十六进制）
   */
  static generateAesKey(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * 生成 AES 初始化向量
   * @returns 16 字节的 IV（十六进制）
   */
  static generateAesIv(): string {
    return randomBytes(16).toString('hex')
  }

  /**
   * 密码哈希（使用 scrypt）
   * @param password - 密码
   * @param salt - 盐值
   * @returns 哈希值
   */
  static hashPassword(password: string, salt: string): string {
    return scryptSync(password, salt, 64).toString('hex')
  }

  /**
   * 生成密码盐值
   * @returns 盐值
   */
  static generateSalt(): string {
    return randomBytes(16).toString('hex')
  }

  /**
   * 验证密码
   * @param password - 密码
   * @param salt - 盐值
   * @param hash - 哈希值
   * @returns 是否匹配
   */
  static verifyPassword(password: string, salt: string, hash: string): boolean {
    const newHash = this.hashPassword(password, salt)
    return newHash === hash
  }

  /**
   * 生成 JWT（简化版）
   * @param payload - 载荷
   * @param secret - 密钥
   * @returns JWT 字符串
   */
  static generateJwt(payload: Record<string, unknown>, secret: string): string {
    const header = { alg: 'HS256', typ: 'JWT' }
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header))
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload))
    const signature = this.hmac(`${encodedHeader}.${encodedPayload}`, secret, 'sha256')
    return `${encodedHeader}.${encodedPayload}.${signature}`
  }

  /**
   * 验证 JWT（简化版）
   * @param token - JWT 字符串
   * @param secret - 密钥
   * @returns 验证结果
   */
  static verifyJwt(token: string, secret: string): { valid: boolean; payload?: Record<string, unknown> } {
    try {
      const [encodedHeader, encodedPayload, signature] = token.split('.')
      if (!encodedHeader || !encodedPayload || !signature) {
        return { valid: false }
      }
      
      const computedSignature = this.hmac(`${encodedHeader}.${encodedPayload}`, secret, 'sha256')
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
   * 掩码手机号
   * @param phone - 手机号
   * @param visibleStart - 开头可见位数（默认3）
   * @param visibleEnd - 结尾可见位数（默认4）
   * @param maskChar - 掩码字符（默认*）
   * @returns 掩码后的手机号
   */
  static maskPhoneNumber(phone: string, visibleStart: number = 3, visibleEnd: number = 4, maskChar: string = '*'): string {
    // 移除所有非数字字符
    const cleanPhone = phone.replace(/\D/g, '')
    
    if (cleanPhone.length < visibleStart + visibleEnd) {
      return maskChar.repeat(cleanPhone.length)
    }
    
    const start = cleanPhone.substring(0, visibleStart)
    const end = cleanPhone.substring(cleanPhone.length - visibleEnd)
    const middle = maskChar.repeat(cleanPhone.length - visibleStart - visibleEnd)
    
    return `${start}${middle}${end}`
  }

  /**
   * 掩码身份证号
   * @param idCard - 身份证号
   * @param visibleStart - 开头可见位数（默认6）
   * @param visibleEnd - 结尾可见位数（默认4）
   * @param maskChar - 掩码字符（默认*）
   * @returns 掩码后的身份证号
   */
  static maskIdCard(idCard: string, visibleStart: number = 6, visibleEnd: number = 4, maskChar: string = '*'): string {
    // 移除所有非数字和字母X字符
    const cleanIdCard = idCard.replace(/[^0-9Xx]/g, '')
    
    if (cleanIdCard.length < visibleStart + visibleEnd) {
      return maskChar.repeat(cleanIdCard.length)
    }
    
    const start = cleanIdCard.substring(0, visibleStart)
    const end = cleanIdCard.substring(cleanIdCard.length - visibleEnd)
    const middle = maskChar.repeat(cleanIdCard.length - visibleStart - visibleEnd)
    
    return `${start}${middle}${end}`
  }


}