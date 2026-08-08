import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import type { Extensions } from "@tiptap/core";

export function getExtensions(placeholder?: string): Extensions {
  const exts: Extensions = [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
      // tiptap v3 StarterKit 已内置 link 和 underline，此处关闭以去重
      link: false,
      underline: false,
    }),
    Link.configure({
      openOnClick: true,
      HTMLAttributes: {
        target: "_blank",
        rel: "noopener noreferrer",
      },
    }),
    Underline,
    Image.configure({
      inline: false,
      allowBase64: true,
    }),
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    Highlight.configure({
      multicolor: true,
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Placeholder.configure({
      placeholder: placeholder || "开始输入...",
    }),
    Markdown,
  ];

  // 内部去重：按扩展 name 去重，避免重复注册同名扩展
  function dedupeExtensions(e: Extensions): Extensions {
    const map = new Map<string, any>();
    for (const ex of e) {
      const name = (ex as any)?.name || (ex as any)?.options?.name || String(ex);
      if (!map.has(name)) {
        map.set(name, ex);
      }
    }
    return Array.from(map.values()) as Extensions;
  }

  return dedupeExtensions(exts);
}

/**
 * 创建编辑器扩展的工厂（公用接口）
 * - 返回去重后的扩展数组
 * - 可传入 `custom` 以在默认扩展后追加自定义扩展（并去重）
 */
export function createEditorExtensions(placeholder?: string, custom?: Extensions): Extensions {
  const base = getExtensions(placeholder);
  if (!custom || custom.length === 0) return base;
  const merged = [...base, ...custom];
  // 重用内部去重逻辑 from getExtensions by reusing function: recreate here
  const map = new Map<string, any>();
  for (const ex of merged) {
    const name = (ex as any)?.name || (ex as any)?.options?.name || String(ex);
    if (!map.has(name)) map.set(name, ex);
  }
  return Array.from(map.values()) as Extensions;
}