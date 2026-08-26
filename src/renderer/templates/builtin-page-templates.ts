import type { BuiltInTemplateDef } from "@/shared/types/template.types";

/**
 * 内置页面模板清单（文档模板）。
 * 用于「新建页面」弹窗：选中后模板 Markdown 作为新页面的初始内容。
 * 与 slash 内置模板一致采用 { zh, en } 双语字面量；profession 仅用于设置页归类展示，
 * 新建页面弹窗不按职业过滤（文档模板对所有职业通用）。
 */
export const builtinPageTemplates: BuiltInTemplateDef[] = [
  {
    id: "page-prd",
    profession: "pm",
    title: { zh: "产品需求说明书", en: "Product Requirements Document" },
    description: {
      zh: "标准 PRD 文档骨架",
      en: "Standard PRD document skeleton",
    },
    icon: "fact_check",
    markdown: {
      zh: `# 产品需求说明书（PRD）

## 文档信息

- 产品名称：{产品名称}
- 作者：{姓名}
- 日期：{日期}
- 版本：v0.1

## 背景与目标

### 背景

### 目标

### 非目标

## 用户与场景

- 目标用户：
- 核心场景：

## 功能需求

| 编号 | 功能 | 优先级 | 描述 |
| --- | --- | --- | --- |
| F1 |  | P0 |  |

### 功能详情：F1 {功能名称}

- 用户故事：作为{角色}，我希望{功能}，以便{价值}
- 交互流程：
- 边界条件：

## 非功能需求

- 性能：
- 兼容性：
- 安全：

## 里程碑

| 阶段 | 内容 | 时间 |
| --- | --- | --- |
|  |  |  |

## 开放问题

- [ ] 
`,
      en: `# Product Requirements Document (PRD)

## Document Info

- Product: {product name}
- Author: {name}
- Date: {date}
- Version: v0.1

## Background & Goals

### Background

### Goals

### Non-Goals

## Users & Scenarios

- Target users:
- Key scenarios:

## Functional Requirements

| ID | Feature | Priority | Description |
| --- | --- | --- | --- |
| F1 |  | P0 |  |

### Feature Detail: F1 {feature name}

- User story: As a {role}, I want {feature}, so that {value}
- Interaction flow:
- Edge cases:

## Non-Functional Requirements

- Performance:
- Compatibility:
- Security:

## Milestones

| Phase | Scope | Date |
| --- | --- | --- |
|  |  |  |

## Open Questions

- [ ] 
`,
    },
  },
  {
    id: "page-tech-design",
    profession: "developer",
    title: { zh: "技术设计文档", en: "Technical Design Document" },
    description: {
      zh: "技术方案与接口设计骨架",
      en: "Technical solution and API design skeleton",
    },
    icon: "code",
    markdown: {
      zh: `# 技术设计文档

## 背景与目标

- 需求：
- 目标：

## 总体方案

- 方案概述：
- 备选方案对比：

## 详细设计

### 模块划分

### 数据结构

### 接口设计

| 接口 | 方法 | 入参 | 出参 | 说明 |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

### 关键流程

## 异常与兼容

- 异常处理：
- 兼容性：

## 测试计划

- [ ] 单元测试：
- [ ] 集成测试：

## 上线计划
`,
      en: `# Technical Design Document

## Background & Goals

- Requirement:
- Goals:

## Overall Solution

- Summary:
- Alternatives:

## Detailed Design

### Modules

### Data Structures

### API Design

| API | Method | Input | Output | Notes |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

### Key Flows

## Errors & Compatibility

- Error handling:
- Compatibility:

## Test Plan

- [ ] Unit tests:
- [ ] Integration tests:

## Release Plan
`,
    },
  },
  {
    id: "page-weekly-report",
    profession: "general",
    title: { zh: "项目周报", en: "Weekly Report" },
    description: {
      zh: "周进展与风险汇报骨架",
      en: "Weekly progress and risk report skeleton",
    },
    icon: "summarize",
    markdown: {
      zh: `# 项目周报

- 周期：{起始日期} ~ {结束日期}
- 汇报人：

## 本周进展

| 事项 | 状态 | 说明 |
| --- | --- | --- |
|  | 进行中 |  |

## 数据与指标

## 问题与风险

- 风险：
- 需要的支持：

## 下周计划

- [ ] 

## 备注
`,
      en: `# Weekly Report

- Period: {start date} ~ {end date}
- Reporter:

## Progress This Week

| Item | Status | Notes |
| --- | --- | --- |
|  | In progress |  |

## Metrics

## Issues & Risks

- Risks:
- Support needed:

## Plan for Next Week

- [ ] 

## Notes
`,
    },
  },
  {
    id: "page-reading-notes",
    profession: "general",
    title: { zh: "阅读笔记", en: "Reading Notes" },
    description: {
      zh: "书籍阅读记录与摘录骨架",
      en: "Book notes with excerpts skeleton",
    },
    icon: "note_alt",
    markdown: {
      zh: `# 阅读笔记：《{书名}》

- 作者：
- 阅读日期：
- 评分：⭐⭐⭐⭐⭐

## 一句话总结

## 核心观点

1. 
2. 
3. 

## 摘录与批注

> {原文摘录}

批注：

## 读后感

## 行动清单

- [ ] 
`,
      en: `# Reading Notes: {Book Title}

- Author:
- Date:
- Rating: ⭐⭐⭐⭐⭐

## One-Sentence Summary

## Key Ideas

1. 
2. 
3. 

## Excerpts & Comments

> {excerpt}

Comment:

## Reflections

## Action Items

- [ ] 
`,
    },
  },
  {
    id: "page-project-plan",
    profession: "pm",
    title: { zh: "项目计划书", en: "Project Plan" },
    description: {
      zh: "项目目标、里程碑与分工骨架",
      en: "Project goals, milestones and staffing skeleton",
    },
    icon: "task_alt",
    markdown: {
      zh: `# 项目计划书

## 项目概述

- 项目名称：
- 项目目标：
- 关键成功指标：

## 范围

- 包含：
- 不包含：

## 里程碑计划

| 里程碑 | 交付物 | 截止日期 | 负责人 |
| --- | --- | --- | --- |
| M1 |  |  |  |

## 资源与分工

| 成员 | 职责 |
| --- | --- |
|  |  |

## 风险与应对

| 风险 | 影响 | 应对措施 |
| --- | --- | --- |
|  |  |  |

## 沟通机制

- 周会：
- 文档：
`,
      en: `# Project Plan

## Overview

- Project name:
- Goals:
- Key success metrics:

## Scope

- In scope:
- Out of scope:

## Milestones

| Milestone | Deliverable | Due Date | Owner |
| --- | --- | --- | --- |
| M1 |  |  |  |

## Team & Responsibilities

| Member | Responsibility |
| --- | --- |
|  |  |

## Risks & Mitigation

| Risk | Impact | Mitigation |
| --- | --- | --- |
|  |  |  |

## Communication

- Weekly meeting:
- Documentation:
`,
    },
  },
];
