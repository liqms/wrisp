import { describe, it, expect } from "vitest";
import {
  IMAGE_FILE_EXTENSIONS,
  isImageFileName,
} from "@/shared/types/attachment.types";

describe("isImageFileName 图片格式校验", () => {
  it.each([...IMAGE_FILE_EXTENSIONS])("%s（大写扩展名）判定为图片", (ext) => {
    expect(isImageFileName(`cover.${ext}`)).toBe(true);
  });

  it.each([
    "photo.PNG",
    "cover.JPEG",
    "icon.SVG",
  ])("%s 大小写不敏感判定为图片", (name) => {
    expect(isImageFileName(name)).toBe(true);
  });

  it.each([
    "note.txt",
    "report.pdf",
    "archive.zip",
    "script.exe",
    "无扩展名文件",
    ".gitignore",
    "data.json",
  ])("%s 判定为非图片", (name) => {
    expect(isImageFileName(name)).toBe(false);
  });

  it("仅点结尾（隐藏文件）判定为非图片", () => {
    expect(isImageFileName(".")).toBe(false);
  });
});
