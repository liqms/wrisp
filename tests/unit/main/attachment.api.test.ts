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

// ── Mock attachmentService（隔离 electron dialog / fs 依赖）──
const mockAttachmentService = vi.hoisted(() => ({
  pickImageFile: vi.fn(),
  copyImageToWorkspace: vi.fn(),
}))

vi.mock("@/main/core/services/attachment.service", () => ({
  attachmentService: mockAttachmentService,
  default: vi.fn(() => mockAttachmentService),
}))

import { importImage } from "@/main/core/apis/attachment.api"
import { ErrorCode } from "@/shared/enums"

describe("Attachment API - importImage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("用户取消选择时返回 success 且 data 为 null", async () => {
    mockAttachmentService.pickImageFile.mockResolvedValue(null)

    const res = await importImage()

    expect(res.success).toBe(true)
    expect(res.data).toBeNull()
    expect(mockAttachmentService.copyImageToWorkspace).not.toHaveBeenCalled()
  })

  it("选中图片文件时复制到工作空间并返回 app:// URL", async () => {
    mockAttachmentService.pickImageFile.mockResolvedValue("D:/photos/cat.png")
    mockAttachmentService.copyImageToWorkspace.mockResolvedValue({
      url: "app://workspace/attachments/images/cat.png",
      fileName: "cat.png",
    })

    const res = await importImage()

    expect(res.success).toBe(true)
    expect(res.data).toEqual({
      url: "app://workspace/attachments/images/cat.png",
      fileName: "cat.png",
    })
    expect(mockAttachmentService.copyImageToWorkspace).toHaveBeenCalledWith("D:/photos/cat.png")
  })

  it("选中非图片格式时拒绝并返回格式错误码（不复制）", async () => {
    mockAttachmentService.pickImageFile.mockResolvedValue("D:/docs/note.txt")

    const res = await importImage()

    expect(res.success).toBe(false)
    expect(res.code).toBe(ErrorCode.ATTACHMENT_INVALID_IMAGE_FORMAT)
    expect(mockAttachmentService.copyImageToWorkspace).not.toHaveBeenCalled()
  })

  it("复制失败时返回导入失败错误码", async () => {
    mockAttachmentService.pickImageFile.mockResolvedValue("D:/photos/cat.png")
    mockAttachmentService.copyImageToWorkspace.mockRejectedValue(new Error("disk full"))

    const res = await importImage()

    expect(res.success).toBe(false)
    expect(res.code).toBe(ErrorCode.ATTACHMENT_IMPORT_IMAGE_FAILED)
  })
})
