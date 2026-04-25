# Pentip 笔触

"笔触"是一款跨平台桌面应用，为作者提供自动化和智能化创作辅助软件，致力于成为作者最懂作品的AI创作伙伴。支持小说、文章、剧本、图文、视频、音频等多种创作形式。

## 🚀 项目特性

- **创作智能体** - 根据作品动态生成创作智能体，深度理解作品世界观和角色关系
- **语义搜索** - 基于LanceDB向量数据库的智能内容检索
- **本地存储** - 作品数据本地存储，数据安全可控
- **多系统支持** - 支持Windows、macOS、Linux等多个操作系统

## ✨ 核心功能

- **智能创作** - 基于AI的创作智能体，提供创作辅助功能
- **知识库RAG** - 基于向量数据库的知识库，存储和检索作品知识，深度理解角色、世界观、情节线

## 创作类型

- 文本创作：支持小说、文章、剧本等网文创作，提供智能创作辅助功能
- 图文创作：支持小红书图文、公众号图文等形式的创作，提供输入主题自动创作功能
- 视频创作：支持视频创作，根据主题自动生成视频脚本，自动生成视频素材
- 音频创作：支持音频创作，根据主题自动生成口播稿和真人语音

## 版本计划

- **v1.0.0** 核心功能
    - 集成主流AI大模型，提供免费智能对话功能
    - 知识库RAG，存储和检索作品知识
    - 多系统支持，包括Windows、macOS、Linux等
    - 本地存储，作品数据本地存储，数据安全可控
    - 多语言支持，包括中文、英文等常用语言
    - 支持公众号文章创作，根据主题自动生成文章内容

## 🛠️ 如何使用

### 📦 如何使用软件

1. **下载安装**：从 [项目主页](https://github.com/liqms/PenTip) 下载对应平台的安装包并安装
2. **配置AI服务商**：在设置页面配置AI服务商的API密钥
3. **创建作品**：点击「新建作品」按钮，建立你的项目
4. **开始创作**：使用AI辅助功能进行创作，享受智能创作体验

### 🚀 快速开始

#### 环境要求

- Node.js 24+
- pnpm (推荐) 或 npm
- Git

#### 安装依赖

```bash
# 克隆项目
git clone https://github.com/liqms/PenTip.git
cd PenTip

# 安装依赖（使用 pnpm）
pnpm install

# 或者使用 npm
# npm install
```

#### 开发环境

```bash
# 启动开发服务器（同时启动 Electron 和 Vite 开发服务器）
pnpm dev

# 或者使用 npm
# npm run dev
```

#### 构建应用

```bash
# 构建应用
pnpm build

# 启动应用（先构建后启动）
pnpm start

# 生产构建（生成可执行文件）
pnpm prod

# 或者使用 npm
# npm run build
# npm start
# npm run prod
```

#### 代码检查

```bash
# 运行 ESLint 检查
pnpm lint

# 运行 TypeScript 类型检查
pnpm typecheck

# 清理构建文件
pnpm clean

# 或者使用 npm
# npm run lint
# npm run typecheck
# npm run clean
```

### 🤝 如何贡献代码

如果这个项目对你有帮助,欢迎给个 Star ⭐

欢迎贡献代码！请遵循以下步骤：

1. **Fork 仓库**：Fork 并克隆到您的本地机器
2. **创建分支**：为您的更改创建分支
3. **提交更改**：提交并推送您的更改
4. **打开 Pull Request**：描述您的更改和原因

### 📁 项目结构

```
PenTip/
├── src/                    # 源代码目录
│   ├── main/              # Electron 主进程代码
│   │   ├── types/         # 类型定义
│   │   ├── core/          # 核心业务逻辑
│   │   ├── constants/     # 常量定义
│   │   ├── ipcMain/       # IPC 主进程定义
│   │   ├── schema/        # 数据库模式定义
│   │   ├── utils/         # 工具函数
│   │   ├── preload/       # 预加载脚本目录
│   │   ├── index.ts       # 主进程入口
│   │   └── preload.ts     # 预加载脚本
│   ├── renderer/          # 渲染进程代码（Vue 3）
│   │   ├── components/    # Vue 组件
│   │   ├── composposables/ # Vue 组件可组合函数
│   │   ├── layouts/       # 布局组件
│   │   ├── plugins        # 插件目录
│   │   ├── views/         # 页面视图
│   │   ├── router/        # 路由配置
│   │   ├── store/         # Pinia 状态管理
│   │   ├── utils/         # 工具函数
│   │   ├── styles/        # 样式文件
│   │   ├── main.ts        # 应用入口
│   │   └── app.vue        # 应用入口组件
│   └── shared/            # 共享代码
│       ├── types/         # TypeScript 类型定义
│       ├── enums/         # 枚举定义
│       ├── helper/        # 辅助函数
│       ├── i18n/         # 本地化配置
│       └── utils/         # 工具函数
├── static/                # 静态资源目录
│   ├── images/            # 图片资源
│   ├── fonts/             # 字体文件
│   ├── logos/             # 应用图标
│   └── icons/             # 应用图标
├── dist/                  # 构建输出目录
├── release/               # 打包输出目录
└── script/                # 脚本目录
```

### 🔧 技术栈

- **前端框架**: Vue 3 + TypeScript + Composition API
- **构建工具**: Vite
- **桌面框架**: Electron
- **状态管理**: Pinia
- **路由**: Vue Router
- **UI 组件**: Native UI
- **代码规范**: ESLint + TypeScript
- **打包工具**: electron-builder
- **数据库**: LanceDB + SQLite

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

- 📧 Email: liqms@msn.cn
- 💬 微信: iclassink（微信添加好友后请备注：Pentip商业授权）

默子会根据你的具体使用场景提供灵活的商业授权方案。

### 免责声明

本软件按"原样"提供，不提供任何形式的明示或暗示担保，包括但不限于适销性、特定用途的适用性和非侵权性的担保。在任何情况下，作者或版权持有人均不对任何索赔、损害或其他责任负责。

## 📞 作者

果果（iclassink） - AI创业者

- 位置: 中国上海
- 邮箱: liqms@msn.cn
- 微信: iclassink（私人微信不解答任何技术问题）
- 项目主页: https://github.com/liqms/PenTip
- 问题反馈: https://github.com/liqms/PenTip/issues

## 🙏 致谢

感谢所有为本项目做出贡献的开发者！

**如果这个项目帮到了你,欢迎分享给更多人!**
