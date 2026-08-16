import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from "axios";
import fs from "fs";
import { createHash } from "crypto";
import { Logger } from "@/main/utils/logger";

import type {
  HttpClientConfig,
  DownloadOptions,
} from "@/main/types/http.types";

/**
 * HTTP 客户端工具
 * 基于 axios 封装，提供统一的网络请求接口、日志记录、错误处理和文件下载功能
 */
export class HttpClient {
  private instance: AxiosInstance;
  private config: HttpClientConfig;

  /**
   * 创建 HttpClient 实例
   * @param config 客户端配置，包含超时、重试、日志等选项
   */
  constructor(config: HttpClientConfig = {}) {
    this.config = {
      timeout: 60000,
      retryCount: 2,
      retryDelay: 1000,
      enableLogging: true,
      ...config,
    };

    this.instance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
    });

    this.setupInterceptors();
  }

  /**
   * 设置请求和响应拦截器
   * 请求拦截器记录开始时间和请求信息
   * 响应拦截器统一记录日志、处理错误和格式化异常
   */
  private setupInterceptors() {
    this.instance.interceptors.request.use((config) => {
      config.headers["X-Request-Start-Time"] = Date.now().toString();
      if (this.config.enableLogging) {
        Logger.debug("HTTP 请求", {
          method: config.method?.toUpperCase(),
          url: config.url,
        });
      }
      return config;
    });

    this.instance.interceptors.response.use(
      (response) => {
        if (this.config.enableLogging) {
          const startTime = parseInt(
            response.config.headers["X-Request-Start-Time"]?.toString() || "0",
            10,
          );
          const duration = startTime > 0 ? Date.now() - startTime : 0;
          Logger.logHttpRequest(
            response.config.method?.toUpperCase() || "GET",
            response.config.url || "",
            response.status,
            duration,
          );
        }
        return response;
      },
      async (error: AxiosError) => {
        const config = error.config;
        if (this.config.enableLogging && config) {
          const startTime = parseInt(
            config.headers["X-Request-Start-Time"]?.toString() || "0",
            10,
          );
          const duration = startTime > 0 ? Date.now() - startTime : 0;
          const statusCode = error.response?.status;
          Logger.error("HTTP 请求失败", {
            method: config.method?.toUpperCase(),
            url: config.url,
            status: statusCode,
            duration: `${duration}ms`,
            error: error.message,
          });
        }
        throw this.normalizeError(error);
      },
    );
  }

  /**
   * 将 axios 错误转换为统一的内部错误类型
   * @param error axios 错误对象
   * @returns 标准化的 Error 实例
   */
  private normalizeError(error: AxiosError): Error {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as Record<string, unknown>;
      if (status === 401)
        return new Error(
          `Authentication failed: ${(data?.error as Record<string, unknown>)?.message || "Invalid API key"}`,
        );
      if (status === 429)
        return new Error(`Rate limit exceeded. Please try later.`);
      if (status >= 500)
        return new Error(`Server error (${status}). Please try again.`);
      return new Error(
        `API error: ${(data?.error as Record<string, unknown>)?.message || error.message}`,
      );
    }
    if (error.code === "ECONNABORTED")
      return new Error(`Request timeout after ${this.config.timeout}ms`);
    if (error.code === "ERR_NETWORK")
      return new Error(`Network error: ${error.message}`);
    return new Error(error.message);
  }

  /**
   * 发送 HTTP 请求
   * @param config axios 请求配置
   * @returns 响应数据
   */
  async request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.request<T>(config);
    return response.data;
  }

  /**
   * 发送 GET 请求
   * @param url 请求地址
   * @param params 查询参数
   * @returns 响应数据
   */
  async get<T = unknown>(
    url: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    return this.request<T>({ method: "GET", url, params });
  }

  /**
   * 发送 POST 请求
   * @param url 请求地址
   * @param data 请求体数据
   * @param config 附加 axios 配置
   * @returns 响应数据
   */
  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return this.request<T>({ method: "POST", url, data, ...config });
  }

  /**
   * 流式下载，返回可读流（由调用方自行处理流消费）
   * @param url 下载 URL
   * @param options 配置项（超时、AbortSignal、请求头等）
   * @returns 包含可读流和文件总大小的信息
   */
  async downloadStream(
    url: string,
    options?: {
      signal?: AbortSignal;
      timeout?: number;
      headers?: Record<string, string>;
    },
  ): Promise<{
    stream: NodeJS.ReadableStream;
    totalBytes: number;
  }> {
    const response = await this.instance.get(url, {
      responseType: "stream",
      timeout: options?.timeout ?? this.config.timeout,
      signal: options?.signal,
      headers: options?.headers,
    });
    const totalBytes = parseInt(
      String(response.headers["content-length"] || "0"),
      10,
    );
    return { stream: response.data, totalBytes };
  }

  /**
   * 下载文件（支持断点续传、进度回调、重试）
   * @param options 下载选项，包含 URL、目标路径、进度回调、重试策略等
   * @returns 下载完成后的本地文件路径
   */
  async downloadFile(options: DownloadOptions): Promise<string> {
    const {
      url,
      destPath,
      onProgress,
      retryCount = 3,
      retryDelay = 2000,
      timeout = 30 * 60 * 1000,
    } = options;

    Logger.info("开始下载文件", { url, destPath });

    let startByte = 0;
    let writeStream: fs.WriteStream;

    if (fs.existsSync(destPath)) {
      const stat = fs.statSync(destPath);
      startByte = stat.size;
      onProgress?.({ downloaded: startByte, total: 0, percent: 0 });
      writeStream = fs.createWriteStream(destPath, { flags: "r+" });
    } else {
      writeStream = fs.createWriteStream(destPath);
    }

    const attempt = async (retry: number): Promise<string> => {
      try {
        const { stream, totalBytes } = await this.downloadStream(url, {
          timeout,
          headers: startByte > 0 ? { Range: `bytes=${startByte}-` } : {},
        });
        const totalLength = totalBytes + startByte;

        let downloaded = startByte;
        stream.on("data", (chunk: Buffer) => {
          downloaded += chunk.length;
          onProgress?.({
            downloaded,
            total: totalLength,
            percent: totalLength > 0 ? (downloaded / totalLength) * 100 : 0,
          });
        });

        await new Promise<void>((resolve, reject) => {
          writeStream.on("finish", () => resolve());
          writeStream.on("error", reject);
          stream.pipe(writeStream, { end: true });
        });

        if (options.verifyChecksum) {
          await this.verifyFileChecksum(destPath, options.verifyChecksum);
        }

        Logger.info("文件下载成功", { url, destPath, size: downloaded });
        return destPath;
      } catch (error) {
        writeStream.end();
        if (retry > 0) {
          Logger.warn("下载失败，等待重试", { url, retry, delay: retryDelay });
          await this.delay(retryDelay);
          const newStat = fs.statSync(destPath);
          startByte = newStat.size;
          writeStream = fs.createWriteStream(destPath, { flags: "r+" });
          return await attempt(retry - 1);
        }
        Logger.error("文件下载失败", { url, error: String(error) });
        throw error;
      }
    };

    return attempt(retryCount);
  }

  /**
   * 校验文件的 SHA256 校验和
   * @param filePath 文件路径
   * @param expectedSha256 期望的 SHA256 值
   */
  private async verifyFileChecksum(
    filePath: string,
    expectedSha256: string,
  ): Promise<void> {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(filePath);
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    const actual = hash.digest("hex");
    if (actual !== expectedSha256) {
      Logger.error("校验和不匹配", {
        filePath,
        expected: expectedSha256,
        actual,
      });
      throw new Error(
        `Checksum mismatch: expected ${expectedSha256}, got ${actual}`,
      );
    }
  }

  /**
   * 延迟等待
   * @param ms 等待毫秒数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
