import { describe, it, expect } from "vitest";
import { isCalibrated } from "@/main/core/services/gate-calibration";
import type { GateHistoryEntry } from "@/main/core/services/gate-calibration";

const h = (
  kind: GateHistoryEntry["kind"],
  outcome: GateHistoryEntry["outcome"],
): GateHistoryEntry => ({ kind, outcome });

describe("isCalibrated", () => {
  it("历史不足阈值时为 false（首次执行必须人工）", () => {
    expect(isCalibrated("section", [h("section", "approved")])).toBe(false);
    expect(
      isCalibrated("section", [
        h("section", "approved"),
        h("section", "approved"),
      ]),
    ).toBe(false);
  });

  it("连续放行达到阈值时为 true", () => {
    expect(
      isCalibrated("section", [
        h("section", "approved"),
        h("section", "approved"),
        h("section", "approved"),
      ]),
    ).toBe(true);
  });

  it("出现过重写即清零，只看最近的连续放行", () => {
    expect(
      isCalibrated("section", [
        h("section", "approved"),
        h("section", "approved"),
        h("section", "approved"),
        h("section", "revised"),
        h("section", "approved"),
        h("section", "approved"),
      ]),
    ).toBe(false);
  });

  it("只统计同类步骤，不受其它步骤类型影响", () => {
    expect(
      isCalibrated("section", [
        h("outline", "approved"),
        h("outline", "approved"),
        h("outline", "approved"),
        h("section", "approved"),
      ]),
    ).toBe(false);
  });

  it("阈值可配置", () => {
    expect(isCalibrated("section", [h("section", "approved")], 1)).toBe(true);
  });
});
