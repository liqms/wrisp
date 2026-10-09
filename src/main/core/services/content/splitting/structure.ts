import { FENCE_OPEN_RE, findFenceClose } from "./fence";
import type { CoarseBlock } from "./types";

/**
 * L1 结构感知切分（零模型调用）
 *
 * 显式结构边界：
 *   · ATX 标题（`#`~`######`）——标题行随块保留，作为块的 sectionTitle；
 *   · 独立时间戳行（`09:30` / `2026-10-06 09:30:00`，可裹 `**`）——Journal 的时间线单元；
 *   · `:::blockType` 围栏——作为**原子块**整体保留，后续层级都不再切它；
 *   · ``` / ~~~ 代码围栏内的内容不参与上述识别（避免代码块里的 `# 注释` 被当成标题）。
 */

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const CODE_FENCE_RE = /^\s*(`{3,}|~{3,})/;
/** 独立时间戳行：可选日期 + HH:mm(:ss)，允许 ** 包裹 */
const TIMESTAMP_RE =
  /^\s*(?:\*\*)?(?:\d{4}-\d{2}-\d{2}[ T])?\d{1,2}:\d{2}(?::\d{2})?(?:\*\*)?\s*$/;

interface Run {
  kind: "text";
  sectionTitle: string | null;
  startLine: number;
  lines: string[];
}

/** 标记处于代码围栏内（含围栏行本身）的行下标 */
export function markCodeFenceLines(lines: string[]): Set<number> {
  const inside = new Set<number>();
  let marker: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const match = CODE_FENCE_RE.exec(lines[i]);
    if (marker) {
      inside.add(i);
      if (match && match[1][0] === marker) marker = null;
      continue;
    }
    if (match) {
      marker = match[1][0];
      inside.add(i);
    }
  }

  return inside;
}

/** 裁掉首尾空行，行号随之收敛到实际内容；全空返回 null */
function trimRun(run: Run): CoarseBlock | null {
  const lines = [...run.lines];
  let startLine = run.startLine;

  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
    startLine += 1;
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  if (lines.length === 0) return null;

  return {
    kind: "text",
    blockType: null,
    sectionTitle: run.sectionTitle,
    startLine,
    endLine: startLine + lines.length - 1,
    lines,
  };
}

/**
 * 把 Markdown 切成 L1 粗块序列。
 * 粗块只保证"结构完整"，不保证长度——长度约束由 L2 负责。
 */
export function splitStructure(markdown: string): CoarseBlock[] {
  if (!markdown || markdown.trim() === "") return [];

  const lines = markdown.split(/\r?\n/);
  const inCodeFence = markCodeFenceLines(lines);
  const blocks: CoarseBlock[] = [];

  let sectionTitle: string | null = null;
  let run: Run | null = null;

  const flush = (): void => {
    if (!run) return;
    const block = trimRun(run);
    if (block) blocks.push(block);
    run = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inCodeFence.has(i)) {
      const heading = HEADING_RE.exec(line);
      if (heading) {
        flush();
        sectionTitle = heading[2].trim() || null;
        run = { kind: "text", sectionTitle, startLine: i + 1, lines: [line] };
        continue;
      }

      const fenceOpen = FENCE_OPEN_RE.exec(line);
      if (fenceOpen) {
        const closeIndex = findFenceClose(lines, i);
        if (closeIndex > -1) {
          flush();
          blocks.push({
            kind: "fence",
            blockType: fenceOpen[1],
            sectionTitle,
            startLine: i + 1,
            endLine: closeIndex + 1,
            lines: lines.slice(i, closeIndex + 1),
          });
          i = closeIndex;
          continue;
        }
        // 未闭合：不特殊处理，作为普通文本行继续累积
      }

      if (TIMESTAMP_RE.test(line)) {
        flush();
        run = { kind: "text", sectionTitle, startLine: i + 1, lines: [line] };
        continue;
      }
    }

    if (!run) {
      // 空行不开新块：否则块起始行号会落在空行上，与正文行区间错位
      if (line.trim() === "") continue;
      run = { kind: "text", sectionTitle, startLine: i + 1, lines: [] };
    }
    run.lines.push(line);
  }

  flush();
  return blocks;
}
