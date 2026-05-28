# PenTip

> Capture Freely. Crystallize Automatically.  
> 自由记录，自动结晶

PenTip 是一个让思维自动结晶为长期知识系统的 **AI-native Cognitive OS（认知操作系统）**，基于 Electron + Vue3 + TypeScript 构建，专注于 **Local-first** 理念，让你的文档、Prompt、模板完全保存在本地，隐私安全无忧。

## ✨ 核心卖点

| 特性 | 描述 |
|------|------|
| **Block First** | 最小单位不是文档，而是 Block（块），一切都是 Block |
| **AI Native** | AI 不是插件，而是工作流本身，语义理解、自动关联、聚类、提炼 |
| **Local-first** | 用户数据完全保存在本地，隐私安全，信任、离线能力、数据可迁移 |
| **Temporal Knowledge** | 知识在时间流中演化，追踪观点变化、兴趣变化、思维轨迹 |
| **语义链接** | AI 自动建立知识关联，无需手动双链 |
| **自动结晶** | 思维流自动结晶为结构化主题和知识体系 |

## 🎯 目标用户

- **创作者**：内容生产者、自媒体作者
- **产品经理**：需求分析、产品规划
- **AI 从业者**：研究员、开发者、Prompt 工程师
- **研究者**：学者、学生、知识工作者
- **写作者**：作家、专栏作者
- **创业者**：Founder、决策者

## 🚀 MVP 核心功能

### Block Capture（块捕获）
- 灵感、想法、Todo、语音、长文的快速捕获
- 无限流、Block First、零组织压力

### Semantic Linking（语义链接）
- AI 自动生成 Embedding 和概念提取
- 语义层面的自动知识连接
- 相似性搜索

### Topic Generation（主题生成）
- AI 自动检测高频主题、重复概念、长期兴趣
- 生成 Topic（主题）、Summary（摘要）、Timeline（时间线）
- Concept Page（概念页）

### Reflection Feed（反思流）
- 系统自动发现模式、矛盾、重复、长期变化
- 具备元认知能力的思考伙伴

### 数据存储
- 本地 SQLite 数据库 + Vector Index（向量索引）
- Blocks、Concepts、Topics 本地保存

## 🛠️ 技术栈

- **前端框架**: Vue 3 + TypeScript + Composition API
- **构建工具**: Vite
- **桌面框架**: Electron
- **状态管理**: Pinia
- **路由**: Vue Router
- **UI 组件**: Naive UI
- **代码规范**: ESLint + TypeScript
- **打包工具**: electron-builder
- **数据库**: SQLite + LanceDB

## � 快速开始

### 环境要求

- Node.js 24+
- pnpm
- Git

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/liqms/PenTip.git
cd PenTip

# 安装依赖
pnpm install
```

### 开发环境

```bash
# 启动开发服务器（Electron + Vite）
pnpm dev
```

### 构建应用

```bash
# 构建应用
pnpm build

# 启动应用（先构建后启动）
pnpm start

# 生产构建（生成可执行文件）
pnpm prod
```

### 代码检查

```bash
# ESLint 检查
pnpm lint

# TypeScript 类型检查
pnpm typecheck

# 清理构建文件
pnpm clean
```

## 📁 项目结构

```
PenTip/
├── src/
│   ├── main/              # Electron 主进程
│   │   ├── core/          # 核心业务逻辑
│   │   ├── ipcMain/       # IPC 主进程处理
│   │   ├── preload/       # 预加载脚本
│   │   ├── utils/         # 工具函数
│   │   └── index.ts       # 主进程入口
│   ├── renderer/          # Vue 3 渲染进程
│   │   ├── views/         # 页面视图
│   │   ├── components/    # 组件
│   │   ├── store/         # Pinia 状态管理
│   │   ├── router/        # 路由配置
│   │   └── main.ts        # 应用入口
│   └── shared/            # 共享代码
│       ├── types/         # 类型定义
│       ├── enums/         # 枚举
│       └── i18n/          # 国际化
├── .env                   # 环境变量
└── package.json
```

## 🔧 命令参考

| 命令 | 描述 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 构建应用 |
| `pnpm prod` | 生产构建（生成安装包） |
| `pnpm start` | 启动已构建的应用 |
| `pnpm lint` | ESLint 检查 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm clean` | 清理构建文件 |
| `pnpm rebuild` | 重建 native 依赖（better-sqlite3） |

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. **Fork 仓库**：Fork 并克隆到本地
2. **创建分支**：为你的更改创建分支
3. **提交更改**：提交并推送你的更改
4. **打开 Pull Request**：描述你的更改和原因

## 📄 许可证

### 个人使用

本项目采用 [GNU Affero General Public License v3.0 (AGPLv3)](LICENSE) 开源。
你可以自由地：

- ✅ 个人使用 - 用于学习、研究、个人项目
- ✅ 分享 - 在任何媒介以任何形式复制、发行本作品
- ✅ 修改 - 修改、转换或以本作品为基础进行创作

但需要遵守以下条款：

- 📝 署名 - 必须给出适当的署名，提供指向本协议的链接，同时标明是否对原始作品作了修改
- 🚫 非商业性使用 - 不得将本作品用于商业目的
- 🔄 相同方式共享 - 如果你修改、转换或以本作品为基础进行创作，你必须以相同的协议分发你的作品

### 商业授权

如果你希望将本项目用于商业目的（包括但不限于）：

- 提供付费服务
- 集成到商业产品
- 作为 SaaS 服务运营
- 其他盈利性用途
- 请联系作者获取商业授权：

### 免责声明

本软件按"原样"提供，不提供任何形式的明示或暗示担保，包括但不限于适销性、特定用途的适用性和非侵权性的担保。在任何情况下，作者或版权持有人均不对任何索赔、损害或其他责任负责。

## 📞 作者

## 📞 联系方式

- 项目主页: https://github.com/liqms/PenTip
- 问题反馈: https://github.com/liqms/PenTip/issues
- 邮箱: liqms@msn.cn

---

**Made with ❤️ for writers everywhere**