# Pentip 笔触

基于 Electron 和 Vue 3的跨平台桌面应用，为创作者提供自动化和智能化创作。

## 🚀 项目特性

- **AI对话** - 集成主流AI大模型，提供免费智能对话功能
- **动态智能体** - 根据作品动态生成智能体，更精准的进行创作
- **语义搜索** - 基于LanceDB向量数据库的智能内容检索
- **本地存储** - 作品数据存储，数据安全可控
- **多系统支持** - 支持Windows、macOS、Linux等多个操作系统

## ✨ 核心功能

- **创作智能体** - 基于AI的创作智能体，提供创作辅助功能
- **作品知识库** - 基于向量数据库的作品知识存储，用户可以根据作品内容进行搜索

## 📁 创作类型

- **公众号文章** - 支持微信公众号文章创作
- **小红书笔记** - 支持小红书笔记创作
- **GEO软文** - 支持AI友好的推广软文

## 版本计划

- **v1.0.0** - 集成主流AI大模型，提供免费智能对话功能

## 🛠️ 如何使用

### 📦 如何使用软件

1. **下载安装**：从 [项目主页](https://github.com/liqms/PenTip) 下载对应平台的安装包并安装
2. **配置AI服务商**：在设置页面配置AI服务商的API密钥
3. **创建作品**：点击「新建作品」按钮，选择创作类型
4. **开始创作**：使用AI辅助功能进行创作，享受智能创作体验

### 🚀 快速开始

#### 环境要求

- Node.js 22+
- npm
- Git

#### 安装依赖

```bash
# 克隆项目
git clone https://github.com/liqms/PenTip.git
cd PenTip

# 安装依赖
npm install
```

#### 开发环境

```bash
# 启动开发服务器（同时启动 Electron 和 Vite 开发服务器）
npm run dev
```

#### 构建应用

```bash
# 构建应用
npm run build

# 启动应用（先构建后启动）
npm start

# 打包应用（生成可执行文件）
npm run dist
```

#### 代码检查

```bash
# 运行 ESLint 检查
npm run lint

# 运行 TypeScript 类型检查
npm run typecheck
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
│   │   ├── index.ts       # 主进程入口
│   │   └── preload.ts     # 预加载脚本
│   ├── renderer/          # 渲染进程代码（Vue 3）
│   │   ├── components/    # Vue 组件
│   │   ├── plugins        # 插件目录
│   │   ├── views/         # 页面视图
│   │   ├── router/        # 路由配置
│   │   ├── store/         # Pinia 状态管理
│   │   └── styles/        # 样式文件
│   └── shared/            # 共享代码
│       ├── types/         # TypeScript 类型定义
│       ├── helper/        # 辅助函数
│       ├── local/         # 本地化配置
│       └── utils/         # 工具函数
├── static/                # 静态资源目录
│   ├── images/            # 图片资源
│   ├── fonts/             # 字体文件
│   └── icons/             # 应用图标
├── public/                # 公共资源目录
├── dist/                  # 构建输出目录
└── release/               # 打包输出目录
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
