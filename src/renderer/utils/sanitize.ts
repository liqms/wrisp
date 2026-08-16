/**
 * 轻量 HTML 清洗工具（白名单策略）
 * 在 v-html 渲染前移除脚本、事件属性、javascript: 链接等风险内容。
 * 仅保留常见的安全排版标签，非白名单标签会被「解包」，保留其文本内容。
 */

const ALLOWED_TAGS = new Set<string>([
  "a", "b", "blockquote", "br", "code", "del", "div", "em", "h1", "h2", "h3",
  "h4", "h5", "h6", "hr", "i", "img", "li", "ol", "p", "pre", "s", "span",
  "strong", "sub", "sup", "table", "tbody", "td", "th", "thead", "tr", "u",
  "ul", "details", "summary",
]);

const ALLOWED_ATTRS = new Set<string>([
  "href", "title", "alt", "src", "target", "rel",
]);

/** 移除 HTML 中的风险内容，返回安全的 HTML 字符串 */
export function sanitizeHtml(input: string): string {
  if (typeof document === "undefined") return input;
  const doc = new DOMParser().parseFromString(input, "text/html");

  for (const el of Array.from(doc.body.querySelectorAll("*"))) {
    const tag = el.tagName.toLowerCase();

    // 非白名单标签：解包，仅保留其文本内容
    if (!ALLOWED_TAGS.has(tag)) {
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }

    // 白名单标签：仅保留安全属性
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = (attr.value || "").trim();
      const unsafe =
        name.startsWith("on") ||
        !ALLOWED_ATTRS.has(name) ||
        ((name === "href" || name === "src") && /^\s*javascript:/i.test(value));
      if (unsafe) el.removeAttribute(attr.name);
    }
  }

  return doc.body.innerHTML;
}
