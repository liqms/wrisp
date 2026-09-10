# 创作会话与确认门 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为创作智能体提供可中断、可恢复的"创作会话"，以及每步产出必经的"确认门"——含按步骤类型的委托与保守回退判定。

**Architecture:** 新增 `creation_sessions` 表（`init.sql`，`CREATE TABLE IF NOT EXISTS` 对存量库同样生效）+ `CreationSessionDao` + `CreationSessionService`（阶段推进、状态流转、可恢复会话查询）。确认门判定抽成纯函数 `decideGateOutcome`，按 `delegation` / `reviewStrictness` / 硬约束 / 置信度 / 历史校准决定 `approve` 或 `needs-user`（`reject` 来自 Reviewer 的内容判断，不属本策略）。用户写作偏好落 electron-store 配置。

**Tech Stack:** TypeScript（strict）、Electron main、better-sqlite3（`BaseDao`）、electron-store（`configService`）、Vitest。

**Spec:** `docs/superpowers/specs/2026-09-10-creation-agent-design.md`（§4.3 状态机、§4.5 存储落点、§6.1 确认门与委托、§6.4 中断与恢复、§7 I6/I7）

## Global Constraints

- Node.js 24+，包管理用 pnpm。
- TypeScript 严格模式：`noUnusedLocals` 与 `noUnusedParameters` 严格，未使用变量会导致 build 失败。
- 测试用 Vitest，`globals: true`、`environment: happy-dom`；放 `tests/unit/**` 或 `tests/integration/**`。
- **硬约束永不允许自动放行**（`taboos` / `WorkStyle.constraints` / `glossary` 命中即 `needs-user`）。
- 枚举遵循 `as const` 对象 + 类型派生模式。
- 新增表写入 `src/main/schemas/init.sql`，无需单独迁移文件。
- 单测环境无 Electron 运行时；导入链触及 `app` 时用 `vi.mock("electron", …)` 切断。

---

### Task 1: 创作会话类型与建表

**Files:**
- Modify: `src/main/schemas/init.sql`
- Create: `src/shared/types/creation-session.types.ts`
- Modify: `src/shared/types/index.ts`
- Test: `tests/unit/shared/creation-session-types.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `CreationScope`、`CreationStage`、`CreationSessionStatus`、`GateKind`、`GateDecision`、`CreationSession`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from "vitest";
import type { CreationSession } from "@/shared/types";

describe("CreationSession 类型", () => {
  it("可表达页面级会话与待确认步骤", () => {
    const session: CreationSession = {
      id: "s1",
      scope: "page",
      projectId: "p1",
      pageId: "pg1",
      stage: "page.outline_confirm",
      status: "awaiting-confirm",
      pendingKind: "outline",
      delegation: { section: true },
      createdAt: "t0",
      updatedAt: "t1",
    };
    expect(session.pendingKind).toBe("outline");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/shared/creation-session-types.test.ts`
Expected: FAIL —— `@/shared/types` 未导出 `CreationSession`

- [ ] **Step 3: 新增类型与建表语句**

```ts
// src/shared/types/creation-session.types.ts
/** 创作会话作用域 */
export type CreationScope = "work" | "page";

/** 创作阶段（与 spec §4.4 状态机一致） */
export type CreationStage =
  | "work.intake"
  | "work.skill_draft"
  | "work.structure"
  | "work.done"
  | "page.intake"
  | "page.outline_draft"
  | "page.outline_confirm"
  | "page.write"
  | "page.review"
  | "page.done";

export type CreationSessionStatus =
  | "active"
  | "awaiting-confirm"
  | "paused"
  | "completed"
  | "aborted";

/** 确认门步骤类型，也是委托开关的粒度 */
export type GateKind = "brief" | "skill" | "outline" | "section" | "review";

/** 确认门判定结果（reject 由 Reviewer 内容判断产生） */
export type GateDecision = "approve" | "reject" | "needs-user";

export interface CreationSession {
  id: string;
  scope: CreationScope;
  projectId: string;
  pageId?: string | null;
  stage: CreationStage;
  status: CreationSessionStatus;
  /** 当前等待确认的步骤类型；无待确认项为 null */
  pendingKind?: GateKind | null;
  /** 委托自动确认的逐项开关（缺省视为未委托） */
  delegation: Partial<Record<GateKind, boolean>>;
  createdAt: string;
  updatedAt: string;
}
```

在 `src/shared/types/index.ts` 追加一行：

```ts
export * from "./creation-session.types";
```

在 `src/main/schemas/init.sql` 的 `skill_executions` 建表语句之后追加：

```sql
-- 创作会话（可中断、可恢复）
CREATE TABLE IF NOT EXISTS creation_sessions (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL,
    project_id TEXT NOT NULL,
    page_id TEXT,
    stage TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    pending_kind TEXT,
    delegation TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (scope IN ('work', 'page')),
    CHECK (status IN ('active', 'awaiting-confirm', 'paused', 'completed', 'aborted'))
);

CREATE INDEX IF NOT EXISTS idx_creation_sessions_project
    ON creation_sessions(project_id, status);
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/shared/creation-session-types.test.ts`
Expected: PASS

- [ ] **Step 5: 类型检查**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: 提交**

```bash
git add src/shared/types/creation-session.types.ts src/shared/types/index.ts src/main/schemas/init.sql tests/unit/shared/creation-session-types.test.ts
git commit -m "feat: 新增创作会话类型与 creation_sessions 表"
```

---

### Task 2: `CreationSessionDao`

**Files:**
- Create: `src/main/core/db/creationSession.dao.ts`
- Modify: `src/main/core/db/index.ts`
- Test: `tests/unit/main/creation-session.dao.test.ts`

**Interfaces:**
- Consumes: Task 1 的类型
- Produces: `creationSessionDao.insert/findSessionById/updateSession/listResumable`

> 注意：**不要**把方法命名为 `findById` —— `BaseDao.findById` 返回的是行类型 `T`，而 DAO 对外暴露的是领域对象 `CreationSession`，覆盖会触发 `TS2416`。（执行时实际踩到，已改名。）

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, vi } from "vitest";

// 只测行<->对象映射，用桩替掉 BaseDao 的数据库访问
vi.mock("@/main/core/db/base.dao", () => ({
  BaseDao: class {
    protected tableName: string;
    constructor(tableName: string) {
      this.tableName = tableName;
    }
  },
}));

import { CreationSessionDao } from "@/main/core/db/creationSession.dao";

describe("CreationSessionDao 行映射", () => {
  it("toEntityForTest 把 snake_case 行映射为对象", () => {
    const dao = new CreationSessionDao();
    const entity = dao.toEntityForTest({
      id: "s1",
      scope: "page",
      project_id: "p1",
      page_id: "pg1",
      stage: "page.write",
      status: "active",
      pending_kind: "section",
      delegation: '{"section":true}',
      created_at: "t0",
      updated_at: "t1",
    });
    expect(entity.projectId).toBe("p1");
    expect(entity.delegation.section).toBe(true);
  });

  it("toRowForTest 把对象映射为行，delegation 存 JSON 字符串", () => {
    const dao = new CreationSessionDao();
    const row = dao.toRowForTest({
      id: "s1",
      scope: "work",
      projectId: "p1",
      pageId: null,
      stage: "work.intake",
      status: "active",
      pendingKind: null,
      delegation: {},
      createdAt: "t0",
      updatedAt: "t1",
    });
    expect(row.project_id).toBe("p1");
    expect(row.delegation).toBe("{}");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/creation-session.dao.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现 DAO**

```ts
// src/main/core/db/creationSession.dao.ts
import { BaseDao } from "./base.dao";
import type {
  CreationSession,
  CreationScope,
  CreationStage,
  CreationSessionStatus,
  GateKind,
} from "@/shared/types";

interface CreationSessionRow {
  id: string;
  scope: string;
  project_id: string;
  page_id: string | null;
  stage: string;
  status: string;
  pending_kind: string | null;
  delegation: string;
  created_at: string;
  updated_at: string;
}

export class CreationSessionDao extends BaseDao<
  CreationSessionRow,
  CreationSessionRow,
  Partial<CreationSessionRow>
> {
  constructor() {
    super("creation_sessions", { enabled: false }); // 时间戳由服务层管理
  }

  public insert(session: CreationSession): void {
    this.create(this.toRow(session));
  }

  public findById(id: string): CreationSession | null {
    const row = this.queryOne(
      `SELECT * FROM ${this.tableName} WHERE id = ?`,
      [id],
    ) as CreationSessionRow | null;
    return row ? this.toEntity(row) : null;
  }

  public updateSession(session: CreationSession): void {
    this.update(session.id, this.toRow(session));
  }

  /** 可恢复的会话（供"继续上次创作"提示） */
  public listResumable(): CreationSession[] {
    const rows = this.query(
      `SELECT * FROM ${this.tableName}
       WHERE status IN ('active', 'awaiting-confirm', 'paused')
       ORDER BY updated_at DESC`,
    ) as CreationSessionRow[];
    return rows.map((r) => this.toEntity(r));
  }

  public toEntityForTest(row: CreationSessionRow): CreationSession {
    return this.toEntity(row);
  }

  public toRowForTest(session: CreationSession): CreationSessionRow {
    return this.toRow(session);
  }

  private toRow(s: CreationSession): CreationSessionRow {
    return {
      id: s.id,
      scope: s.scope,
      project_id: s.projectId,
      page_id: s.pageId ?? null,
      stage: s.stage,
      status: s.status,
      pending_kind: s.pendingKind ?? null,
      delegation: JSON.stringify(s.delegation ?? {}),
      created_at: s.createdAt,
      updated_at: s.updatedAt,
    };
  }

  private toEntity(row: CreationSessionRow): CreationSession {
    return {
      id: row.id,
      scope: row.scope as CreationScope,
      projectId: row.project_id,
      pageId: row.page_id,
      stage: row.stage as CreationStage,
      status: row.status as CreationSessionStatus,
      pendingKind: (row.pending_kind as GateKind | null) ?? null,
      delegation: JSON.parse(row.delegation || "{}"),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const creationSessionDao = new CreationSessionDao();
```

在 `src/main/core/db/index.ts` 追加：

```ts
export * from './creationSession.dao'
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/creation-session.dao.test.ts`
Expected: PASS（2 个用例）

- [ ] **Step 5: 类型检查**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: 提交**

```bash
git add src/main/core/db/creationSession.dao.ts src/main/core/db/index.ts tests/unit/main/creation-session.dao.test.ts
git commit -m "feat: 新增创作会话 DAO"
```

---

### Task 3: 确认门策略（纯函数，保守回退）

**Files:**
- Create: `src/main/core/skills/gate-policy.ts`
- Test: `tests/unit/main/gate-policy.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `GateKind`
- Produces: `GateContext`、`ReviewStrictness`、`decideGateOutcome(ctx): "approve" | "needs-user"`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from "vitest";
import { decideGateOutcome } from "@/main/core/skills/gate-policy";

const base = {
  kind: "section" as const,
  delegated: true,
  reviewStrictness: "normal" as const,
  hitHardConstraint: false,
  confidence: 0.9,
  calibrated: true,
};

describe("decideGateOutcome", () => {
  it("未委托时交回人工", () => {
    expect(decideGateOutcome({ ...base, delegated: false })).toBe("needs-user");
  });

  it("命中硬约束时永不自动放行（即使 lenient 且高置信）", () => {
    expect(
      decideGateOutcome({
        ...base,
        hitHardConstraint: true,
        reviewStrictness: "lenient",
        confidence: 0.99,
      }),
    ).toBe("needs-user");
  });

  it("尚无历史校准时保守回退", () => {
    expect(decideGateOutcome({ ...base, calibrated: false })).toBe("needs-user");
  });

  it("normal 档：0.79 回退，0.8 放行", () => {
    expect(decideGateOutcome({ ...base, confidence: 0.79 })).toBe("needs-user");
    expect(decideGateOutcome({ ...base, confidence: 0.8 })).toBe("approve");
  });

  it("strict 档阈值更高（0.9 回退，0.95 放行）", () => {
    expect(
      decideGateOutcome({ ...base, reviewStrictness: "strict", confidence: 0.9 }),
    ).toBe("needs-user");
    expect(
      decideGateOutcome({ ...base, reviewStrictness: "strict", confidence: 0.95 }),
    ).toBe("approve");
  });

  it("lenient 档阈值更低（0.6 放行）", () => {
    expect(
      decideGateOutcome({ ...base, reviewStrictness: "lenient", confidence: 0.6 }),
    ).toBe("approve");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/gate-policy.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现策略**

```ts
// src/main/core/skills/gate-policy.ts
import type { GateKind } from "@/shared/types";

export type ReviewStrictness = "lenient" | "normal" | "strict";

export interface GateContext {
  kind: GateKind;
  /** 用户是否为该步骤类型开启了委托 */
  delegated: boolean;
  reviewStrictness: ReviewStrictness;
  /** 是否命中硬约束（taboos / constraints / glossary / 事实一致性） */
  hitHardConstraint: boolean;
  /** Reviewer 的置信度 0..1 */
  confidence: number;
  /** 该类步骤是否已有历史校准 */
  calibrated: boolean;
}

const CONFIDENCE_THRESHOLD: Record<ReviewStrictness, number> = {
  strict: 0.95,
  normal: 0.8,
  lenient: 0.6,
};

/**
 * 确认门策略：决定"可自动放行"还是"必须交回人工"。
 * 保守基调——任何不确定都回退人工；硬约束命中永不自动放行。
 * reject 由 Reviewer 的内容判断产生，不属本函数职责。
 */
export function decideGateOutcome(
  ctx: GateContext,
): "approve" | "needs-user" {
  if (!ctx.delegated) return "needs-user";
  if (ctx.hitHardConstraint) return "needs-user";
  if (!ctx.calibrated) return "needs-user";
  if (ctx.confidence < CONFIDENCE_THRESHOLD[ctx.reviewStrictness]) {
    return "needs-user";
  }
  return "approve";
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/gate-policy.test.ts`
Expected: PASS（6 个用例）

- [ ] **Step 5: 类型检查**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: 提交**

```bash
git add src/main/core/skills/gate-policy.ts tests/unit/main/gate-policy.test.ts
git commit -m "feat: 新增确认门策略（保守回退）"
```

---

### Task 4: 创作会话服务与用户写作偏好配置项

**Files:**
- Create: `src/main/core/services/creation-session.service.ts`
- Modify: `src/shared/types/config.types.ts`
- Modify: `src/main/constants/config.constants.ts`
- Test: `tests/unit/main/creation-session.service.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `creationSessionDao`
- Produces: `creationSessionService.start/advance/openGate/resolveGate/setDelegation/listResumable`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, vi } from "vitest";

const store = new Map<string, unknown>();
vi.mock("@/main/core/db", () => ({
  creationSessionDao: {
    insert: (s: { id: string }) => store.set(s.id, { ...s }),
    findSessionById: (id: string) => store.get(id) ?? null,
    updateSession: (s: { id: string }) => store.set(s.id, { ...s }),
    listResumable: () => [...store.values()],
  },
}));

import { creationSessionService } from "@/main/core/services/creation-session.service";

describe("CreationSessionService", () => {
  it("start 创建 active 会话，初始阶段按作用域决定", () => {
    const s = creationSessionService.start("page", "p1", "pg1");
    expect(s.status).toBe("active");
    expect(s.stage).toBe("page.intake");
    expect(s.delegation).toEqual({});
  });

  it("openGate 置为 awaiting-confirm 并记录 pendingKind", () => {
    const s = creationSessionService.start("page", "p2", "pg2");
    const gated = creationSessionService.openGate(s.id, "outline");
    expect(gated.status).toBe("awaiting-confirm");
    expect(gated.pendingKind).toBe("outline");
  });

  it("resolveGate(approve) 清除待确认并回到 active", () => {
    const s = creationSessionService.start("page", "p3", "pg3");
    creationSessionService.openGate(s.id, "outline");
    const resolved = creationSessionService.resolveGate(s.id, "approve");
    expect(resolved.status).toBe("active");
    expect(resolved.pendingKind).toBeNull();
  });

  it("setDelegation 记录逐项委托开关", () => {
    const s = creationSessionService.start("page", "p4", "pg4");
    const updated = creationSessionService.setDelegation(s.id, "section", true);
    expect(updated.delegation.section).toBe(true);
  });

  it("对不存在的会话操作会抛错", () => {
    expect(() => creationSessionService.advance("nope", "page.write")).toThrow(
      "CREATION_SESSION_NOT_FOUND",
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/creation-session.service.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现服务与配置项**

```ts
// src/main/core/services/creation-session.service.ts
import { creationSessionDao } from "@/main/core/db";
import { TimeUtil } from "@/shared/utils";
import type {
  CreationSession,
  CreationScope,
  CreationStage,
  GateKind,
} from "@/shared/types";

const INITIAL_STAGE: Record<CreationScope, CreationStage> = {
  work: "work.intake",
  page: "page.intake",
};

class CreationSessionService {
  private static instance: CreationSessionService | null = null;

  public static getInstance(): CreationSessionService {
    if (!CreationSessionService.instance) {
      CreationSessionService.instance = new CreationSessionService();
    }
    return CreationSessionService.instance;
  }

  public start(
    scope: CreationScope,
    projectId: string,
    pageId?: string,
  ): CreationSession {
    const now = TimeUtil.toISOString(Date.now());
    const session: CreationSession = {
      id: `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      scope,
      projectId,
      pageId: pageId ?? null,
      stage: INITIAL_STAGE[scope],
      status: "active",
      pendingKind: null,
      delegation: {},
      createdAt: now,
      updatedAt: now,
    };
    creationSessionDao.insert(session);
    return session;
  }

  public advance(id: string, stage: CreationStage): CreationSession {
    return this.mutate(id, (s) => ({ ...s, stage }));
  }

  public openGate(id: string, kind: GateKind): CreationSession {
    return this.mutate(id, (s) => ({
      ...s,
      status: "awaiting-confirm",
      pendingKind: kind,
    }));
  }

  public resolveGate(
    id: string,
    _decision: "approve" | "needs-user",
  ): CreationSession {
    return this.mutate(id, (s) => ({
      ...s,
      status: "active",
      pendingKind: null,
    }));
  }

  public setDelegation(
    id: string,
    kind: GateKind,
    delegated: boolean,
  ): CreationSession {
    return this.mutate(id, (s) => ({
      ...s,
      delegation: { ...s.delegation, [kind]: delegated },
    }));
  }

  public listResumable(): CreationSession[] {
    return creationSessionDao.listResumable();
  }

  private mutate(
    id: string,
    fn: (s: CreationSession) => CreationSession,
  ): CreationSession {
    const existing = creationSessionDao.findSessionById(id);
    if (!existing) throw new Error(`CREATION_SESSION_NOT_FOUND: ${id}`);
    const next: CreationSession = {
      ...fn(existing),
      updatedAt: TimeUtil.toISOString(Date.now()),
    };
    creationSessionDao.updateSession(next);
    return next;
  }
}

export const creationSessionService = CreationSessionService.getInstance();
```

在 `src/shared/types/config.types.ts` 的 `AppConfig` 中新增（与 `general` 同级）：

```ts
  /** 用户写作偏好（跨作品，创作智能体使用） */
  writingPreference: {
    sentenceStyle?: string;
    tone?: string;
    pov?: string;
    pacing?: string;
    vocabulary?: string[];
    taboos?: string[];
    reviewStrictness: "lenient" | "normal" | "strict";
  };
```

在 `src/main/constants/config.constants.ts` 的 `DEFAULT_APP_CONFIG` 中新增：

```ts
  writingPreference: {
    taboos: [],
    vocabulary: [],
    reviewStrictness: "normal",
  },
```

> **执行时的两处偏离（已落地）**：
> 1. `writingPreference` 在 `AppConfig` 中设为**可选**（`writingPreference?`），而非计划写的必填——必填会迫使所有构造 `AppConfig` 的位置补字段；消费方（偏好记忆计划的 `writingPreferenceService.read()`）本就会合并默认值，`DEFAULT_APP_CONFIG` 仍会为新装用户播种。
> 2. 该类型抽到 **`src/shared/types/writing-preference.types.ts`**（连同 `ReviewStrictness`），因为 `config.types.ts` 属 shared，不能从 main 侧导入。**后续"偏好与风格记忆"计划应改为从 shared 导入此类型，不要重复声明。**

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/creation-session.service.test.ts`
Expected: PASS（5 个用例）

- [ ] **Step 5: 类型检查**

Run: `pnpm typecheck`
Expected: 通过（若其他构造 `AppConfig` 处报缺字段，一并补齐）

- [ ] **Step 6: 提交**

```bash
git add src/main/core/services/creation-session.service.ts src/shared/types/config.types.ts src/main/constants/config.constants.ts tests/unit/main/creation-session.service.test.ts
git commit -m "feat: 新增创作会话服务与用户写作偏好配置项"
```

---

## 后续计划（本计划不含）

| 计划 | 覆盖 spec 条目 |
|---|---|
| 模板页面级技能 | I5、§6.5 |
| P1 作品采集向导 + P2 作品技能派生 | §5.1、§6.2 |
| P4 页面大纲与分步创作 | §5.2、§6.6 |
| P3 偏好与风格记忆 | §6.3 |
| P5 审核与委托 | §6.1 |

**已识别但延后的项**：

- **启动恢复的 UI 提示**（"继续上次创作"）：`listResumable()` 已就绪，交互入口随 P1/P4 接入（参照 task-queue 的 resume-on-start 范式）。
- **Reviewer 的 LLM 调用**：本计划只落地 Gate 的策略判定（纯函数）；产出 `confidence` 与硬约束命中的模型部分属 P5。
- **IPC 通道**：会话与 Gate 目前无渲染层消费方，随第一个真正消费它的计划（P1）一并接入四层。

## 风险与开放问题

| 风险 | 说明 | 缓解 |
|---|---|---|
| `AppConfig` 新增必填字段 | 其他构造 `AppConfig` 的位置可能报缺字段 | T4 Step 5 要求一并补齐 |
| 配置迁移 | 老用户 `app.json` 无 `writingPreference` | 先依赖默认值兜底；若 `configService` 不自动合并默认值，需补 `config.migration.ts`（执行时先验证） |
| 会话表无清理 | 完成后会话累积 | 后续接入清理（可复用 scheduler 的 cleanup 任务） |
| 单测无 Electron 运行时 | 导入链触及 `app` 会崩 | T2 mock `base.dao`、T4 mock `@/main/core/db` 切断 |
| `BaseDao` 构造签名 | 本计划假定 `super(table, { enabled: false })` 可用 | 已对照 `skill-execution.dao.ts` 的真实写法（同一签名） |
