import { describe, it, expect } from "vitest";
import {
  sanitizeFieldValue,
  sanitizeAttrs,
  serializeFields,
  serializeFence,
  parseFence,
  kebabCase,
  escapeHtmlAttr,
} from "@/renderer/components/editor/blocks/engine/md-codec";
import { metricCardBlock } from "@/renderer/components/editor/blocks/definitions/metric";

const fields = metricCardBlock.fields;
const labelField = fields.find((f) => f.key === "label")!;
const trendField = fields.find((f) => f.key === "trend")!;
const trendDirField = fields.find((f) => f.key === "trendDir")!;

describe("自定义块字段编解码", () => {
  describe("sanitizeFieldValue 校验回退", () => {
    it("非字符串输入回退默认值", () => {
      expect(sanitizeFieldValue(undefined, labelField)).toBe("");
      expect(sanitizeFieldValue(123, labelField)).toBe("");
    });

    it("text 空值保留空串", () => {
      expect(sanitizeFieldValue("", labelField)).toBe("");
      expect(sanitizeFieldValue("   ", labelField)).toBe("");
    });

    it("超长文本按 maxLength 截断", () => {
      expect(sanitizeFieldValue("a".repeat(30), labelField)).toHaveLength(
        labelField.maxLength!,
      );
    });

    it("pattern 不匹配回退默认值", () => {
      expect(sanitizeFieldValue("abc", trendField)).toBe("");
      expect(sanitizeFieldValue("12.5.3", trendField)).toBe("");
    });

    it("pattern 匹配的合法值保留", () => {
      expect(sanitizeFieldValue("+12.5%", trendField)).toBe("+12.5%");
      expect(sanitizeFieldValue("-3", trendField)).toBe("-3");
      expect(sanitizeFieldValue("8%", trendField)).toBe("8%");
    });

    it("枚举词表外值回退默认值", () => {
      expect(sanitizeFieldValue("sideways", trendDirField)).toBe("up");
    });

    it("枚举合法值保留，空枚举回退默认值", () => {
      expect(sanitizeFieldValue("down", trendDirField)).toBe("down");
      expect(sanitizeFieldValue("", trendDirField)).toBe("up");
    });
  });

  describe("sanitizeAttrs 全字段清洗", () => {
    it("未知字段丢弃、字段集与 schema 对齐", () => {
      const clean = sanitizeAttrs(
        { label: "DAU", foo: "bar", trendDir: "xxx" },
        fields,
      );
      expect(Object.keys(clean).sort()).toEqual(
        fields.map((f) => f.key).sort(),
      );
      expect(clean.label).toBe("DAU");
      expect(clean.trendDir).toBe("up");
    });
  });

  describe("parseFence 围栏解析", () => {
    it("解析 key: value 字段行", () => {
      const parsed = parseFence(
        [":::metric", "label: DAU", "value: 123", ":::"],
        0,
      );
      expect(parsed?.fields).toEqual({ label: "DAU", value: "123" });
      expect(parsed?.endLine).toBe(3);
    });

    it("忽略非字段格式的行（容错外部手改）", () => {
      const parsed = parseFence(
        [":::metric", "乱写一行", "label: DAU", ":::"],
        0,
      );
      expect(parsed?.fields).toEqual({ label: "DAU" });
    });

    it("未闭合围栏返回 null", () => {
      expect(parseFence([":::metric", "label: DAU"], 0)).toBeNull();
    });

    it("多冒号闭合围栏（::::）同样识别", () => {
      const parsed = parseFence([":::metric", "label: A", "::::"], 0);
      expect(parsed?.fields).toEqual({ label: "A" });
    });
  });

  describe("serializeFence 确定性序列化", () => {
    it("空值与默认值字段省略", () => {
      const out = serializeFence(
        "metric",
        { label: "DAU", trendDir: "up" },
        fields,
      );
      expect(out).toBe(":::metric\nlabel: DAU\n:::");
    });

    it("按 schema 字段顺序输出", () => {
      const out = serializeFence(
        "metric",
        { trend: "-3%", label: "留存", value: "45" },
        fields,
      );
      expect(out.indexOf("label:")).toBeLessThan(out.indexOf("value:"));
      expect(out.indexOf("value:")).toBeLessThan(out.indexOf("trend:"));
    });

    it("全默认值输出空围栏", () => {
      const defaults: Record<string, string> = {};
      for (const f of fields) defaults[f.key] = String(f.default);
      expect(serializeFence("metric", defaults, fields)).toBe(
        ":::metric\n:::",
      );
    });
  });

  describe("serializeFields / 编解码工具", () => {
    it("serializeFields 输出字段行数组", () => {
      expect(
        serializeFields({ label: "DAU", value: "" }, fields),
      ).toEqual(["label: DAU"]);
    });

    it("kebabCase 与 escapeHtmlAttr", () => {
      expect(kebabCase("trendDir")).toBe("trend-dir");
      expect(escapeHtmlAttr(`a"b<c>&`)).toBe(
        "a&quot;b&lt;c&gt;&amp;",
      );
    });
  });

  describe("round-trip 幂等", () => {
    it("序列化 → 解析 → 清洗 → 再序列化结果一致", () => {
      const attrs = { label: "日活", value: "1.2万", trendDir: "down", trend: "-3%" };
      const md = serializeFence("metric", attrs, fields);
      const parsed = parseFence(md.split("\n"), 0)!;
      const clean = sanitizeAttrs(parsed.fields, fields);
      expect(serializeFence("metric", clean, fields)).toBe(md);
    });

    it("字段值含冒号时仍可往返", () => {
      const attrs = { label: "比率: 活跃" };
      const md = serializeFence("metric", attrs, fields);
      // `key: value` 行按第一个冒号切分，值中的冒号保留
      const parsed = parseFence(md.split("\n"), 0)!;
      expect(parsed.fields.label).toBe("比率: 活跃");
    });
  });
});
