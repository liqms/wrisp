// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";

// ── Mocks ──
vi.mock("@/main/utils/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}))
vi.mock("winston", () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  format: { combine: vi.fn(), timestamp: vi.fn(), printf: vi.fn(), colorize: vi.fn(), simple: vi.fn(), json: vi.fn() },
  transports: { Console: vi.fn(), File: vi.fn() },
  addColors: vi.fn(),
}))
vi.mock("winston-daily-rotate-file", () => ({ default: vi.fn() }))

// ── Mock templateService ──
const mockTemplateService = vi.hoisted(() => {
  const file = {
    customTemplates: [
      {
        id: "custom_1",
        title: "我的模板",
        description: "自定义模板",
        icon: "📄",
        markdown: "# 自定义",
        profession: "pm",
        enabled: true,
      },
    ],
    disabledTemplateIds: ["todo"],
  } as const

  return {
    getSlashTemplatesFile: vi.fn(() => file),
    upsertCustomTemplate: vi.fn(() => file),
    deleteCustomTemplate: vi.fn(() => file),
    setTemplateEnabled: vi.fn(() => file),
  }
})

vi.mock("@/main/core/services/template.service", () => ({
  templateService: mockTemplateService,
  default: vi.fn(() => mockTemplateService),
}))

import {
  getFile,
  upsertCustom,
  deleteCustom,
  setEnabled,
} from "@/main/core/apis/template.api"
import { ErrorCode } from "@/shared/enums"
import type { CustomTemplate } from "@/shared/types/template.types"

describe("Template API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("getFile 返回成功响应与文件数据", async () => {
    const res = await getFile()
    expect(res.success).toBe(true)
    expect(res.data).toEqual(mockTemplateService.getSlashTemplatesFile())
  })

  it("upsertCustom 调用 service 并返回成功响应", async () => {
    const tpl: CustomTemplate = {
      id: "custom_new",
      title: "新模板",
      description: "",
      icon: "📄",
      markdown: "# 新",
      profession: "writer",
      enabled: true,
    }
    const res = await upsertCustom(tpl)
    expect(mockTemplateService.upsertCustomTemplate).toHaveBeenCalledWith(tpl)
    expect(res.success).toBe(true)
  })

  it("deleteCustom 调用 service 并返回成功响应", async () => {
    const res = await deleteCustom("custom_1")
    expect(mockTemplateService.deleteCustomTemplate).toHaveBeenCalledWith("custom_1")
    expect(res.success).toBe(true)
  })

  it("setEnabled 调用 service 并返回成功响应", async () => {
    const res = await setEnabled("todo", true, false)
    expect(mockTemplateService.setTemplateEnabled).toHaveBeenCalledWith("todo", true, false)
    expect(res.success).toBe(true)
  })

  it("service 抛错时 getFile 返回模板错误码", async () => {
    mockTemplateService.getSlashTemplatesFile.mockImplementation(() => {
      throw new Error("boom")
    })
    const res = await getFile()
    expect(res.success).toBe(false)
    expect(res.code).toBe(ErrorCode.TEMPLATE_GET_FAILED)
  })
})
