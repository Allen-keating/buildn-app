<div align="center">

# 造 / Buildn

**Describe what you want. Buildn creates it.**

**用自然语言描述你的想法，Buildn 帮你把它变成真实的应用。**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![Hono](https://img.shields.io/badge/Hono-4-e36002?logo=hono&logoColor=white)](https://hono.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

</div>

---

## What is Buildn? / 什么是 Buildn？

Buildn is an AI-powered web application builder. You describe your idea in natural language, and Buildn generates a complete, runnable React application — with live preview, code editing, and one-click deployment.

Buildn 是一个 AI 驱动的 Web 应用构建器。你只需用自然语言描述想法，Buildn 就能生成完整可运行的 React 应用 —— 支持实时预览、代码编辑和一键部署。

<div align="center">

```
 ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │  Chat with   │ ──> │  AI Generates │ ──> │ Live Preview │
 │     AI       │     │     Code      │     │  in Browser  │
 └──────────────┘     └──────────────┘     └──────────────┘
```

</div>

## Features / 功能特性

| Feature | Description |
|---------|-------------|
| **Conversational UI** / 对话式交互 | Chat with AI to create and iterate on your app / 通过对话创建并迭代你的应用 |
| **Real-time Preview** / 实时预览 | See changes instantly via in-browser WebContainer / 通过浏览器内 WebContainer 即时查看效果 |
| **Code Editor** / 代码编辑 | Built-in Monaco Editor with syntax highlighting / 内置 Monaco 编辑器，支持语法高亮 |
| **File Management** / 文件管理 | Browse, edit, and manage project files / 浏览、编辑和管理项目文件 |
| **One-Click Deploy** / 一键部署 | Publish to Netlify with a single click / 一键发布到 Netlify |
| **Version Snapshots** / 版本快照 | Auto-save snapshots on every AI change, rollback anytime / 每次 AI 修改自动保存快照，随时回滚 |

## Tech Stack / 技术栈

### Frontend / 前端

| Technology | Purpose |
|-----------|---------|
| [React 19](https://react.dev/) | UI framework / UI 框架 |
| [TypeScript](https://www.typescriptlang.org/) | Type safety / 类型安全 |
| [Vite 6](https://vite.dev/) | Build tool + HMR / 构建工具 |
| [Tailwind CSS 4](https://tailwindcss.com/) | Styling / 样式 |
| [Zustand](https://zustand.docs.pmnd.rs/) | State management / 状态管理 |
| [Monaco Editor](https://microsoft.github.io/monaco-editor/) | Code editor / 代码编辑器 |
| [@webcontainer/api](https://webcontainers.io/) | In-browser Node.js sandbox / 浏览器内沙箱 |

### Backend / 后端

| Technology | Purpose |
|-----------|---------|
| [Hono](https://hono.dev/) | Web framework / Web 框架 |
| [Drizzle ORM](https://orm.drizzle.team/) | Database ORM / 数据库 ORM |
| [PostgreSQL](https://www.postgresql.org/) | Database / 数据库 |
| [Redis](https://redis.io/) | Caching & rate limiting / 缓存与限流 |
| [Anthropic SDK](https://docs.anthropic.com/) | AI code generation / AI 代码生成 |

### Infrastructure / 基础设施

| Technology | Purpose |
|-----------|---------|
| [Turborepo](https://turbo.build/) | Monorepo build orchestration / Monorepo 构建编排 |
| [pnpm](https://pnpm.io/) | Package manager / 包管理器 |
| [Netlify](https://www.netlify.com/) | User app deployment / 用户应用部署 |
| [GitHub Actions](https://github.com/features/actions) | CI/CD |

## Project Structure / 项目结构

```
buildn-app/
├── packages/
│   ├── web/            # Frontend React app / 前端 React 应用
│   ├── server/         # Backend API server / 后端 API 服务
│   ├── ai-engine/      # AI code generation pipeline / AI 代码生成管线
│   └── shared/         # Shared TypeScript types / 共享类型定义
├── docs/               # Documentation / 项目文档
│   ├── DEVELOPMENT.md  # Development guide / 开发文档
│   └── superpowers/
│       ├── specs/      # Module specifications / 模块设计文档
│       └── plans/      # Implementation plans / 实现计划
└── scripts/            # Utility scripts / 工具脚本
```

## Getting Started / 快速开始

### Prerequisites / 环境要求

- **Node.js** >= 22
- **pnpm** >= 9
- **PostgreSQL** (or [Supabase](https://supabase.com/))
- **Redis**

### Installation / 安装

```bash
# Clone the repository / 克隆仓库
git clone https://github.com/Allen-keating/buildn-app.git
cd buildn-app

# Install dependencies / 安装依赖
pnpm install

# Copy environment variables / 复制环境变量
cp .env.example .env
# Edit .env with your actual values / 编辑 .env 填入真实值
```

### Configuration / 配置

Edit `.env` with the following: / 编辑 `.env` 填入以下配置：

```env
ANTHROPIC_API_KEY=sk-ant-xxx        # Claude API Key
DATABASE_URL=postgresql://...        # PostgreSQL connection / PostgreSQL 连接
REDIS_URL=redis://localhost:6379     # Redis connection / Redis 连接
JWT_SECRET=your-secret-here          # JWT signing secret / JWT 签名密钥
NETLIFY_AUTH_TOKEN=xxx               # For deployment / 部署用
```

### Development / 开发

```bash
# Run database migrations / 运行数据库迁移
cd packages/server && pnpm db:migrate

# Start all services / 启动所有服务
pnpm dev

# Or start individually / 或者分别启动
cd packages/server && pnpm dev    # API server at http://localhost:3001
cd packages/web && pnpm dev       # Frontend at http://localhost:5173
```

### Build / 构建

```bash
# Build all packages / 构建所有包
pnpm build

# Type check / 类型检查
pnpm typecheck

# Lint / 代码检查
pnpm lint

# Format / 格式化
pnpm format
```

## Architecture / 系统架构

```
Browser                              API Server
┌─────────────────────┐              ┌─────────────────────┐
│  Chat UI            │   REST/SSE   │  Hono Router        │
│  Monaco Editor      │ <==========> │  Auth Middleware     │
│  WebContainer       │              │  Rate Limiter        │
│  Preview (iframe)   │              ├─────────────────────┤
│  Zustand Store      │              │  Chat Service ──────┼──> AI Engine
└─────────────────────┘              │  Project Service     │    ├─ Classifier
                                     │  File Service        │    ├─ Context Assembly
                                     │  Deploy Service      │    ├─ LLM Client (Claude)
                                     │  Snapshot Service    │    ├─ Output Parser
                                     └────────┬────────────┘    └─ Post-processing
                                              │
                                     ┌────────┴────────────┐
                                     │  PostgreSQL + Redis  │
                                     └─────────────────────┘
```

### Data Flow / 数据流

1. **User Input** / 用户输入 — User describes what they want in the chat / 用户在聊天中描述需求
2. **AI Generation** / AI 生成 — Server calls AI engine, which classifies intent, assembles context, and streams code from Claude / 服务端调用 AI 引擎，分类意图、组装上下文、流式调用 Claude 生成代码
3. **Post-processing** / 后处理 — TypeScript type check + auto-retry on errors / TypeScript 类型检查 + 错误自动重试
4. **Live Preview** / 实时预览 — Files sync to WebContainer, Vite HMR updates the preview iframe / 文件同步到 WebContainer，Vite HMR 更新预览

## Roadmap / 开发路线

- [x] **Phase 1: MVP** — Chat UI, AI generation, live preview, one-click deploy
- [ ] **Phase 2: Enhancement** — Error auto-fix pipeline, backend/database integration, version management
- [ ] **Phase 3: Scale** — Multi-user collaboration, billing, plugin system

See [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for the full development guide.

完整开发文档请参阅 [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)。

## Contributing / 贡献

Contributions are welcome! Please read the development guide before submitting PRs.

欢迎贡献！提交 PR 前请先阅读开发文档。

## License / 许可证

[MIT](./LICENSE) &copy; 2026 Buildn
