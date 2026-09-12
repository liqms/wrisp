# 用户数据

> 文档版本：v2

## 概述

本文件描述了 PenTip 的用户数据目录结构。存储架构设计详见 [`storage.md`](storage.md)。

---

## 应用数据目录（pentip）

用途：存储应用全局数据，包括配置、数据库、向量库、模型缓存等。独立于工作空间，不受 workspace 切换影响。

```
pentip/
├── config/              # 配置文件目录
│   ├── app.json         # 应用主配置
│   ├── window.json      # 窗口配置
│   └── model.json          # 模型配置文件
├── sqlite/
│   └── main.db          # SQLite 索引库（AI 处理结果）
├── vectors/              # LanceDB 向量库
│   ├── chunk_embeddings/
│   ├── concept_embeddings/
│   ├── topic_embeddings/
│   └── pages_embeddings/
├── models/               # 本地 AI 模型缓存
│   ├── jina-embeddings-v3/
│   ├── bge-reranker-v2-m3/
│   └── qwen3.5-4b/
├── cache/                # AI 中间结果缓存
├── sync_lock             # 同步锁（防止并发同步冲突）
├── plugins/              # 本地插件（预留）
└── logs/                 # 日志目录
    ├── error.log         # 错误日志
    └── info.log          # 信息日志
```

---

## 工作空间目录结构

用途：工作空间是用户数据的核心，所有用户内容以 Markdown 文件组织。
工作空间默认路径为用户的 Documents 目录（`~/Documents/PenTip`），用户可在设置中修改。

```
{workspace}/
├── journal/                     # 日志流（按天）
│   ├── 2026-06-27.md           # 用户日常记录，标准 Markdown 格式
│   ├── 2026-06-26.md
│   └── ...
├── projects/                    # 创作项目
│   ├── 项目A/
│   │   ├── index.md            # 项目入口
│   │   ├── 01-背景.md          # 按章节组织的项目文件
│   │   └── ...
│   └── 项目B/
│       └── ...
└── assets/                      # 附件/图片
    ├── images/
    └── files/
```

---

## 职责划分

### 文件系统：用户数据的真实来源（Source of Truth）

- `journal/`：用户日常记录，按日期组织，每个文件为当天完整记录。
- `projects/`：创作项目，按项目组织目录，支持多文件。
- 用户可用 Obsidian、VS Code 等任何工具直接编辑。
- 所有内容均为标准 Markdown 格式，不依赖 PenTip 即可读写。

### 数据库：AI 智能索引层

- SQLite 索引库不存储原始内容，仅存储文件元数据和 AI 处理结果。
- 文件变更时自动同步更新索引。
- AI 处理结果不回写到 .md 文件，保持用户文件纯净。
