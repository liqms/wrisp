// @vitest-environment node
import { describe, it, expect } from "vitest";
import { getTaskLayers, getTaskDependencies, TASK_EXECUTION_ORDER, MVP_TASK_DAG } from "@/main/core/smart-tasks/task-dag";

describe("getTaskLayers", () => {
  it("返回按依赖分层的数组", () => {
    const layers = getTaskLayers();
    expect(layers).toBeInstanceOf(Array);
    expect(layers.length).toBeGreaterThan(0);
  });

  it("第 0 层为无依赖任务", () => {
    const layers = getTaskLayers();
    const layer0 = layers[0];
    expect(layer0).toContain("chunk-summary");
    expect(layer0).toContain("chunk-vectorize");
  });

  it("每层任务不依赖同层其他任务", () => {
    const layers = getTaskLayers();
    for (const layer of layers) {
      for (const task of layer) {
        const deps = getTaskDependencies(task);
        for (const dep of deps) {
          expect(layer).not.toContain(dep);
        }
      }
    }
  });

  it("所有任务都被分配到某层", () => {
    const layers = getTaskLayers();
    const allInLayers = layers.flat();
    for (const task of TASK_EXECUTION_ORDER) {
      expect(allInLayers).toContain(task);
    }
  });

  it("第 1 层依赖 chunk-vectorize", () => {
    const layers = getTaskLayers();
    const layer1 = layers[1];
    expect(layer1).toContain("semantic-link");
  });

  it("第 2 层包含 topic-detection", () => {
    const layers = getTaskLayers();
    const layer2 = layers[2];
    expect(layer2).toContain("topic-detection");
  });
});

describe("getTaskLayers 精确分层", () => {
  it("semantic-link 与 concept-extract 同层并行", () => {
    const layers = getTaskLayers();
    const layer1 = layers[1];
    expect(layer1).toContain("semantic-link");
    expect(layer1).toContain("concept-extract");
  });

  it("topic-detection 在 concept-extract 之后层", () => {
    const layers = getTaskLayers();
    const idxConcept = layers.findIndex((l) => l.includes("concept-extract"));
    const idxTopic = layers.findIndex((l) => l.includes("topic-detection"));
    expect(idxTopic).toBeGreaterThan(idxConcept);
  });

  it("topic-summary 在 topic-detection 之后层", () => {
    const layers = getTaskLayers();
    const idxDetection = layers.findIndex((l) => l.includes("topic-detection"));
    const idxSummary = layers.findIndex((l) => l.includes("topic-summary"));
    expect(idxSummary).toBeGreaterThan(idxDetection);
  });

  it("层总数与 MVP_DAG 最长链深度一致（无 break 退化）", () => {
    const layers = getTaskLayers();
    // 现有 DAG 最长链 = summary -> concept-extract -> topic-detection -> topic-summary = 4 层
    expect(layers.length).toBe(4);
  });

  it("每层节点全部来自 MVP_TASK_DAG", () => {
    const layers = getTaskLayers();
    const allNames = new Set(MVP_TASK_DAG.map((n) => n.name));
    for (const layer of layers) {
      for (const task of layer) {
        expect(allNames.has(task)).toBe(true);
      }
    }
  });
});
