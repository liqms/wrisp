// @vitest-environment node
import { vi, describe, it, expect } from "vitest";

// ── Mocks（隔离 electron / config / logger 依赖，仅测纯函数）──
vi.mock("electron", () => ({ dialog: { showOpenDialog: vi.fn() } }))
vi.mock("@/main/core/services/config.service", () => ({
  configService: { getWorkspacePath: vi.fn(() => "/mock/ws") },
  default: vi.fn(),
}))
vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock("@/main/utils/i18n", () => ({ t: (key: string) => key }))

import { buildTimestampName } from "@/main/core/services/attachment.service"

describe("buildTimestampName 时间戳文件名", () => {
  it("按 YYYYMMDDHHmmssSSS 生成 17 位主干", () => {
    expect(buildTimestampName(new Date(2026, 7, 29, 9, 30, 45, 123))).toBe(
      "20260829093045123",
    )
  })

  it("月/日/时/分/秒/毫秒补零到固定宽度", () => {
    expect(buildTimestampName(new Date(2026, 0, 5, 3, 7, 9, 42))).toBe(
      "20260105030709042",
    )
    expect(buildTimestampName(new Date(2026, 11, 31, 23, 59, 59, 999))).toBe(
      "20261231235959999",
    )
  })

  it("默认取当前时间且为纯数字字符串", () => {
    const name = buildTimestampName()
    expect(name).toMatch(/^\d{17}$/)
    // 解析回时间应接近当前（毫秒精度往返）
    const parsed = new Date(
      Number(name.slice(0, 4)),
      Number(name.slice(4, 6)) - 1,
      Number(name.slice(6, 8)),
      Number(name.slice(8, 10)),
      Number(name.slice(10, 12)),
      Number(name.slice(12, 14)),
      Number(name.slice(14, 17)),
    )
    expect(Math.abs(Date.now() - parsed.getTime())).toBeLessThan(2000)
  })
})
