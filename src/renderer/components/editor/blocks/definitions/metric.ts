import type { WrispBlockDefinition } from "../registry";
import { BarChartFilled } from "@vicons/material";
import MetricCardView from "../components/MetricCardView.vue";
import MetricGroupView from "../components/MetricGroupView.vue";

/** 变化幅度的合法格式：可选正负号 + 数字 + 可选百分号（如 +12.5、-3、8%） */
const TREND_PATTERN = /^[+-]?\d+(\.\d+)?%?$/;

/**
 * 指标卡片块：结构化数据卡片，字段全部受控（弹窗编辑 + 校验回退）。
 * md 形态：
 * ```md
 * :::metric
 * label: 日活跃用户
 * value: 1.2万
 * trend: +8%
 * trendDir: up
 * :::
 * ```
 * 连续多张卡片（无空行分隔）自动归入同一分栏容器。
 */
export const metricCardBlock: WrispBlockDefinition = {
  type: "metric",
  mdName: "metric",
  titleKey: "EDITOR.BLOCKS.METRIC.TITLE",
  descKey: "EDITOR.BLOCKS.METRIC.DESC",
  slashIcon: BarChartFilled,
  cardView: MetricCardView,
  groupView: MetricGroupView,
  fields: [
    {
      key: "label",
      type: "text",
      labelKey: "EDITOR.BLOCKS.METRIC.FIELDS.LABEL",
      default: "",
      required: true,
      maxLength: 20,
    },
    {
      key: "value",
      type: "text",
      labelKey: "EDITOR.BLOCKS.METRIC.FIELDS.VALUE",
      default: "",
      required: true,
      maxLength: 20,
    },
    {
      key: "unit",
      type: "text",
      labelKey: "EDITOR.BLOCKS.METRIC.FIELDS.UNIT",
      default: "",
      maxLength: 10,
    },
    {
      key: "trend",
      type: "text",
      labelKey: "EDITOR.BLOCKS.METRIC.FIELDS.TREND",
      default: "",
      maxLength: 10,
      pattern: TREND_PATTERN,
    },
    {
      key: "trendDir",
      type: "enum",
      labelKey: "EDITOR.BLOCKS.METRIC.FIELDS.TREND_DIR",
      default: "up",
      enumValues: [
        { value: "up", labelKey: "EDITOR.BLOCKS.METRIC.TREND_DIR.UP" },
        { value: "down", labelKey: "EDITOR.BLOCKS.METRIC.TREND_DIR.DOWN" },
        { value: "flat", labelKey: "EDITOR.BLOCKS.METRIC.TREND_DIR.FLAT" },
      ],
    },
  ],
};
