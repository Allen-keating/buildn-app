# 造 / Buildn — 开发文档

## 目录

1. [产品定义](#1-产品定义)
2. [系统架构](#2-系统架构)
3. [模块详细设计](#3-模块详细设计)
4. [开发里程碑](#4-开发里程碑)
5. [技术选型清单](#5-技术选型清单)
6. [目录结构](#6-目录结构)
7. [开发规范](#7-开发规范)
8. [风险与应对](#8-风险与应对)

---

## 1. 产品定义

### 1.1 一句话定义

用自然语言描述你的想法，Buildn 帮你把它变成可运行的 Web 应用。

### 1.2 目标用户

非技术用户（创业者、产品经理、设计师）——不会写代码，但需要快速把想法变成产品原型。

### 1.3 核心用户场景

| 场景       | 用户操作                                  | 系统行为                                          |
| ---------- | ----------------------------------------- | ------------------------------------------------- |
| 创建新应用 | 输入 "帮我做一个任务管理应用，有看板视图" | 生成完整的 React 项目，含看板组件、数据模型、样式 |
| 迭代修改   | 输入 "把配色改成深色主题，加一个日历视图" | 识别已有代码，仅修改相关文件，保留其他代码不变    |
| 实时预览   | 代码生成后自动刷新                        | iframe 热更新，用户立刻看到效果                   |
| 一键部署   | 点击 "发布" 按钮                          | 自动构建、部署到公网 URL                          |

### 1.4 MVP 范围（Phase 1 目标）

包含：

- 对话式交互界面（Chat UI）
- AI 生成纯前端 React 应用（无后端）
- 浏览器内实时预览（WebContainer）
- 基础文件浏览与代码查看
- 一键部署到 Netlify/Vercel

不包含（后续迭代）：

- 后端/数据库集成
- 多人协作
- 自定义域名
- 计费系统

---

## 2. 系统架构

### 2.1 架构总览

```
┌──────────────────────────────────────────────────────────┐
│                      客户端 (Browser)                     │
│                                                          │
│  ┌──────────┐  ┌───────────┐  ┌────────────────────────┐ │
│  │  Chat UI │  │ Code View │  │   Preview (iframe)     │ │
│  │          │  │  Monaco   │  │   WebContainer Runtime │ │
│  └────┬─────┘  └─────┬─────┘  └──────────┬─────────────┘ │
│       │              │                    │               │
│       └──────────────┼────────────────────┘               │
│                      │                                    │
│              ┌───────┴────────┐                           │
│              │  State Manager │                           │
│              │  (Zustand)     │                           │
│              └───────┬────────┘                           │
└──────────────────────┼───────────────────────────────────┘
                       │ REST / WebSocket
                       │
┌──────────────────────┼───────────────────────────────────┐
│                  API Server (Node.js)                     │
│                      │                                    │
│  ┌───────────────────┼───────────────────────────────┐   │
│  │            API Gateway / Router                    │   │
│  │  (认证 · 限流 · 请求分类)                           │   │
│  └──┬────────────┬──────────────┬───────────────┬────┘   │
│     │            │              │               │        │
│  ┌──┴──┐  ┌─────┴─────┐  ┌────┴────┐  ┌───────┴──────┐ │
│  │Chat │  │  AI Code  │  │ Project │  │   Deploy     │ │
│  │ API │  │  Engine   │  │ Service │  │   Service    │ │
│  │     │  │           │  │         │  │              │ │
│  │会话  │  │Prompt管线 │  │文件CRUD │  │构建+发布     │ │
│  │管理  │  │代码生成   │  │版本历史 │  │域名管理      │ │
│  │流式  │  │错误修复   │  │         │  │              │ │
│  └─────┘  └─────┬─────┘  └────┬────┘  └──────────────┘ │
│                 │              │                          │
│           ┌─────┴─────┐  ┌────┴──────────┐              │
│           │  LLM API  │  │  PostgreSQL   │              │
│           │  Claude   │  │  + Redis      │              │
│           └───────────┘  └───────────────┘              │
└──────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
用户输入 Prompt
    │
    ▼
[1] Prompt 预处理
    ├─ 意图分类（新建 / 修改 / 提问 / 部署）
    ├─ 提取关键实体（组件名、功能点、样式需求）
    └─ 敏感内容过滤
    │
    ▼
[2] 上下文组装
    ├─ 读取当前项目文件树
    ├─ 检索相关文件内容（按 token 预算裁剪）
    ├─ 拼接系统 prompt + 用户 prompt + 代码上下文
    └─ 选择目标 LLM（按复杂度路由）
    │
    ▼
[3] LLM 调用
    ├─ 流式输出 token
    ├─ 解析结构化输出（文件路径 + 代码内容）
    └─ 提取 file diff（新增/修改/删除哪些文件）
    │
    ▼
[4] 后处理管线
    ├─ TypeScript 类型检查
    ├─ ESLint 代码质量检查
    ├─ 构建测试（vite build 是否通过）
    ├─ 如果失败 → 自动将错误信息反馈给 LLM 重试（最多 3 次）
    └─ 通过 → 写入项目文件系统
    │
    ▼
[5] 实时预览更新
    ├─ WebContainer 检测文件变更
    ├─ Vite HMR 热更新
    └─ iframe 刷新展示最新效果
```

---

## 3. 模块详细设计

### 3.1 AI 代码生成引擎

这是产品的核心，拆分为以下子模块：

#### 3.1.1 Prompt 管线 (`packages/ai-engine/`)

```
src/ai-engine/
├── classifier/          # 意图分类器
│   ├── intent.ts        # 分类：create / modify / question / deploy
│   └── entity.ts        # 实体抽取：组件、样式、功能
├── context/             # 上下文管理
│   ├── assembler.ts     # 拼装完整 prompt
│   ├── retriever.ts     # 从项目中检索相关文件
│   └── budget.ts        # Token 预算管理（裁剪上下文）
├── generator/           # 代码生成
│   ├── llm-client.ts    # LLM API 调用（Claude / GPT）
│   ├── stream.ts        # 流式输出处理
│   └── parser.ts        # 解析 LLM 输出为文件操作
├── postprocess/         # 后处理
│   ├── typecheck.ts     # TypeScript 类型校验
│   ├── lint.ts          # ESLint 检查
│   ├── build-test.ts    # 构建验证
│   └── auto-fix.ts      # 自动修复（重试逻辑）
└── prompts/             # System Prompt 模板
    ├── system.md        # 基础系统指令
    ├── create-app.md    # 创建新应用的指令
    ├── modify-code.md   # 修改已有代码的指令
    └── fix-error.md     # 修复错误的指令
```

#### 3.1.2 关键设计决策

**Prompt 结构设计：**

```
[System Prompt]
你是 Buildn 的 AI 代码生成引擎。你的输出必须严格遵循以下格式：
---FILE: src/components/Button.tsx---
(文件内容)
---END FILE---

规则：
1. 只输出需要新增或修改的文件
2. 每个文件必须是完整内容，不要省略
3. 使用 React + TypeScript + Tailwind CSS
4. 组件使用函数式写法 + Hooks

[项目上下文]
当前文件树：(file tree)
相关文件内容：(truncated source)

[用户请求]
(user prompt)
```

**错误自动修复流程：**

```
生成代码 → tsc 检查 → 失败？
    │                      ├─ 是 → 将错误信息 + 原代码发给 LLM
    │                      │       → 重新生成（最多重试 3 次）
    │                      └─ 否 → ESLint 检查 → 失败？
    │                                              ├─ 是 → 自动 fix
    │                                              └─ 否 → vite build 测试
    │                                                        ├─ 通过 → 完成
    │                                                        └─ 失败 → 反馈给 LLM
    └────────────────────────────────────────────────────────────→ 写入文件
```

#### 3.1.3 开发任务清单

| #    | 任务                                     | 优先级 | 预估天数 | 依赖    |
| ---- | ---------------------------------------- | ------ | -------- | ------- |
| 1.1  | 实现基础 LLM 调用（Claude API 流式输出） | P0     | 2        | 无      |
| 1.2  | 设计 System Prompt 模板（create/modify） | P0     | 3        | 无      |
| 1.3  | 实现 LLM 输出解析器（提取文件操作）      | P0     | 3        | 1.1     |
| 1.4  | 实现项目文件树读取与上下文组装           | P0     | 3        | 无      |
| 1.5  | Token 预算管理（上下文裁剪策略）         | P1     | 2        | 1.4     |
| 1.6  | 意图分类器（create/modify/question）     | P1     | 2        | 无      |
| 1.7  | TypeScript 类型检查集成                  | P1     | 2        | 1.3     |
| 1.8  | ESLint 检查 + 自动修复                   | P1     | 1        | 1.3     |
| 1.9  | 构建验证（vite build）                   | P1     | 1        | 1.3     |
| 1.10 | 错误自动重试管线                         | P2     | 3        | 1.7-1.9 |

---

### 3.2 代码执行与预览（WebContainer 方案）

#### 3.2.1 架构设计

MVP 阶段采用 **WebContainer**（浏览器内 Node.js 运行时），避免服务端容器成本。

```
浏览器
├── WebContainer 实例
│   ├── 虚拟文件系统（内存中的项目文件）
│   ├── Node.js 运行时
│   ├── npm / pnpm（包安装）
│   └── Vite Dev Server（HMR）
│
├── Preview iframe
│   └── 指向 WebContainer 中 Vite 的 localhost 端口
│
└── 文件同步模块
    ├── AI 生成代码 → 写入 WebContainer 文件系统
    ├── 用户手动编辑 → 写入 WebContainer 文件系统
    └── 文件变更 → 触发 Vite HMR → iframe 刷新
```

#### 3.2.2 关键实现

```typescript
// 初始化 WebContainer
import { WebContainer } from '@webcontainer/api'

async function bootProject(files: FileSystemTree) {
  const wc = await WebContainer.boot()
  await wc.mount(files)

  // 安装依赖
  const install = await wc.spawn('npm', ['install'])
  await install.exit

  // 启动 Vite dev server
  const dev = await wc.spawn('npm', ['run', 'dev'])
  dev.output.pipeTo(
    new WritableStream({
      write(chunk) {
        console.log('[vite]', chunk)
      },
    }),
  )

  // 监听端口就绪
  wc.on('server-ready', (port, url) => {
    // 将 url 设置为 preview iframe 的 src
    previewIframe.src = url
  })

  return wc
}

// AI 生成代码后更新文件
async function updateFile(wc: WebContainer, path: string, content: string) {
  await wc.fs.writeFile(path, content)
  // Vite HMR 会自动检测变更并刷新预览
}
```

#### 3.2.3 开发任务清单

| #   | 任务                                   | 优先级 | 预估天数 | 依赖     |
| --- | -------------------------------------- | ------ | -------- | -------- |
| 2.1 | 集成 WebContainer API，实现基础启动    | P0     | 3        | 无       |
| 2.2 | 实现虚拟文件系统的 CRUD 操作           | P0     | 2        | 2.1      |
| 2.3 | 集成 Vite + HMR 实时预览               | P0     | 3        | 2.1      |
| 2.4 | AI 生成代码 → WebContainer 文件同步    | P0     | 2        | 2.2, 3.1 |
| 2.5 | npm 包安装与缓存优化                   | P1     | 2        | 2.1      |
| 2.6 | 错误捕获与展示（构建错误、运行时错误） | P1     | 2        | 2.3      |
| 2.7 | 多设备尺寸预览（桌面/平板/手机）       | P2     | 1        | 2.3      |

---

### 3.3 对话式交互界面

#### 3.3.1 页面布局

```
┌──────────────────────────────────────────────────────────┐
│  Logo   [项目名称 ▼]                    [发布] [设置]     │
├────────────┬──────────────────┬───────────────────────────┤
│            │                  │                           │
│  文件树     │   Chat / Code    │      Preview              │
│            │                  │                           │
│  src/      │  [切换Tab]        │   ┌───────────────────┐  │
│  ├─ App.tsx│  ┌────┬────┐     │   │                   │  │
│  ├─ main   │  │Chat│Code│     │   │   实时预览         │  │
│  └─ ...    │  └────┴────┘     │   │                   │  │
│            │                  │   │                   │  │
│            │  AI: 已为你创建了 │   │                   │  │
│            │  一个看板组件...  │   │                   │  │
│            │                  │   └───────────────────┘  │
│            │                  │   [Desktop][Tablet][Phone]│
│            │  ┌────────────┐  │                           │
│            │  │ 输入你的想法│  │                           │
│            │  └────────────┘  │                           │
├────────────┴──────────────────┴───────────────────────────┤
│  状态栏：生成中... │ 文件数：12 │ 构建：通过                 │
└──────────────────────────────────────────────────────────┘
```

#### 3.3.2 核心组件

```
src/components/
├── layout/
│   ├── AppShell.tsx           # 三栏主布局
│   ├── Header.tsx             # 顶部导航栏
│   └── StatusBar.tsx          # 底部状态栏
├── chat/
│   ├── ChatPanel.tsx          # 对话面板主容器
│   ├── MessageList.tsx        # 消息列表（支持流式渲染）
│   ├── MessageBubble.tsx      # 单条消息（支持 Markdown + 代码高亮）
│   ├── ChatInput.tsx          # 输入框（支持多行、快捷键）
│   └── CodeDiff.tsx           # 代码变更 diff 展示
├── editor/
│   ├── CodeEditor.tsx         # Monaco Editor 封装
│   ├── FileTree.tsx           # 文件树导航
│   └── FileTabs.tsx           # 文件 Tab 切换
├── preview/
│   ├── PreviewPanel.tsx       # 预览面板
│   ├── DeviceFrame.tsx        # 设备尺寸框架
│   └── ErrorOverlay.tsx       # 运行时错误蒙层
└── shared/
    ├── Button.tsx
    ├── Spinner.tsx
    └── Toast.tsx
```

#### 3.3.3 开发任务清单

| #   | 任务                                      | 优先级 | 预估天数 | 依赖 |
| --- | ----------------------------------------- | ------ | -------- | ---- |
| 3.1 | 三栏布局骨架（AppShell + 可拖拽分栏）     | P0     | 2        | 无   |
| 3.2 | Chat UI（消息列表 + 流式渲染 + Markdown） | P0     | 3        | 无   |
| 3.3 | 代码高亮与 diff 展示                      | P0     | 2        | 3.2  |
| 3.4 | 文件树组件                                | P0     | 2        | 无   |
| 3.5 | Monaco Editor 集成                        | P1     | 2        | 3.4  |
| 3.6 | Preview iframe 面板 + 设备尺寸切换        | P0     | 1        | 2.3  |
| 3.7 | 状态栏（构建状态、文件统计）              | P2     | 1        | 无   |

---

### 3.4 项目管理服务

#### 3.4.1 数据模型

```typescript
// 用户
interface User {
  id: string
  email: string
  name: string
  plan: 'free' | 'pro' | 'team'
  createdAt: Date
}

// 项目
interface Project {
  id: string
  userId: string
  name: string
  description: string
  template: 'blank' | 'dashboard' | 'landing' | 'ecommerce'
  status: 'draft' | 'published'
  deployUrl: string | null
  createdAt: Date
  updatedAt: Date
}

// 对话消息
interface Message {
  id: string
  projectId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  // AI 回复会携带文件操作
  fileOperations?: FileOperation[]
  createdAt: Date
}

// 文件操作
interface FileOperation {
  type: 'create' | 'modify' | 'delete'
  path: string
  content?: string
  diff?: string // unified diff format
}

// 版本快照
interface Snapshot {
  id: string
  projectId: string
  messageId: string // 关联到哪条对话
  files: Record<string, string> // 完整文件快照
  createdAt: Date
}
```

#### 3.4.2 API 设计

```
POST   /api/auth/login          # 登录
POST   /api/auth/register       # 注册

GET    /api/projects             # 项目列表
POST   /api/projects             # 创建项目
GET    /api/projects/:id         # 项目详情
DELETE /api/projects/:id         # 删除项目

GET    /api/projects/:id/files   # 获取文件树
GET    /api/projects/:id/files/* # 读取文件内容
PUT    /api/projects/:id/files/* # 更新文件内容

POST   /api/projects/:id/chat    # 发送对话（SSE 流式响应）
GET    /api/projects/:id/messages # 对话历史

POST   /api/projects/:id/deploy  # 部署项目
GET    /api/projects/:id/deploy/status  # 部署状态

GET    /api/projects/:id/snapshots      # 版本快照列表
POST   /api/projects/:id/snapshots/:sid/restore  # 回滚到快照
```

#### 3.4.3 开发任务清单

| #   | 任务                             | 优先级 | 预估天数 | 依赖     |
| --- | -------------------------------- | ------ | -------- | -------- |
| 4.1 | 数据库 Schema 设计 + 迁移脚本    | P0     | 1        | 无       |
| 4.2 | 用户认证（邮箱/GitHub OAuth）    | P0     | 3        | 4.1      |
| 4.3 | 项目 CRUD API                    | P0     | 2        | 4.1      |
| 4.4 | 文件读写 API                     | P0     | 2        | 4.3      |
| 4.5 | 对话 API（SSE 流式）             | P0     | 3        | 4.3, 1.1 |
| 4.6 | 版本快照（每次 AI 修改自动保存） | P1     | 2        | 4.4      |
| 4.7 | 快照回滚功能                     | P2     | 1        | 4.6      |

---

### 3.5 部署服务

#### 3.5.1 MVP 部署流程

```
用户点击 "发布"
    │
    ▼
[1] 从项目文件系统导出所有文件
    │
    ▼
[2] 执行 vite build 生成静态产物
    │
    ▼
[3] 调用 Netlify Deploy API
    ├─ 上传 dist/ 目录
    └─ 返回部署 URL
    │
    ▼
[4] 更新项目 deployUrl
    │
    ▼
[5] 用户获得公网可访问链接
```

#### 3.5.2 开发任务清单

| #   | 任务                              | 优先级 | 预估天数 | 依赖 |
| --- | --------------------------------- | ------ | -------- | ---- |
| 5.1 | Netlify API 集成（自动部署）      | P0     | 2        | 无   |
| 5.2 | 构建管线（vite build + 产物打包） | P0     | 1        | 2.1  |
| 5.3 | 部署状态追踪与展示                | P1     | 1        | 5.1  |
| 5.4 | Vercel 部署备选方案               | P2     | 2        | 无   |
| 5.5 | 自定义域名支持                    | P3     | 3        | 5.1  |

---

## 4. 开发里程碑

### Phase 1：核心可用（MVP）— 约 12 周

```
Week 1-2    ──── 基础设施搭建
                 ├─ 项目脚手架（Vite + React + TS）
                 ├─ Monorepo 结构搭建
                 ├─ CI/CD 基础管线
                 └─ 数据库 + 认证

Week 3-5    ──── AI 引擎 v1
                 ├─ Claude API 集成 + 流式输出
                 ├─ System Prompt 设计（create / modify）
                 ├─ LLM 输出解析器
                 └─ 基础上下文组装

Week 5-7    ──── 前端界面
                 ├─ 三栏布局
                 ├─ Chat UI（流式渲染）
                 ├─ 文件树 + 代码查看
                 └─ 代码 diff 展示

Week 6-8    ──── WebContainer 集成
                 ├─ WebContainer 启动 + 文件系统
                 ├─ Vite HMR 实时预览
                 └─ AI 代码 → 预览同步

Week 9-10   ──── 端到端串联
                 ├─ 用户输入 → AI 生成 → 预览更新 全链路
                 ├─ 项目保存/加载
                 └─ 错误处理与提示

Week 11-12  ──── 部署 + 打磨
                 ├─ Netlify 一键部署
                 ├─ Bug 修复 + 体验优化
                 └─ 内测发布
```

### Phase 2：产品增强 — 约 8 周

```
Week 13-14  ──── AI 引擎增强
                 ├─ 错误自动修复管线
                 ├─ TypeScript + ESLint 校验
                 └─ Token 预算优化

Week 15-16  ──── 后端集成
                 ├─ Supabase 数据库支持
                 ├─ AI 自动生成 Schema
                 └─ 用户认证模板

Week 17-18  ──── 版本管理
                 ├─ 快照保存与回滚
                 ├─ 操作历史时间线
                 └─ GitHub 导出

Week 19-20  ──── 体验优化
                 ├─ 应用模板库（Dashboard / Landing / SaaS）
                 ├─ 组件库集成（shadcn/ui）
                 └─ 移动端适配
```

### Phase 3：规模化 — 约 8 周

```
Week 21-24  ──── 多人协作 + 计费
                 ├─ WebSocket 实时协作
                 ├─ Stripe 订阅集成
                 └─ 用量限额与监控

Week 25-28  ──── 平台化
                 ├─ 自定义域名
                 ├─ 插件/扩展系统
                 ├─ API 开放
                 └─ 服务端沙箱（Fly.io）迁移
```

---

## 5. 技术选型清单

### 前端

| 用途       | 技术                        | 理由                                   |
| ---------- | --------------------------- | -------------------------------------- |
| 框架       | React 19 + TypeScript       | 生态成熟，AI 生成的代码也以 React 为主 |
| 构建工具   | Vite 6                      | 快速 HMR，与 WebContainer 兼容         |
| CSS        | Tailwind CSS 4              | AI 生成 utility class 比写 CSS 更可靠  |
| 状态管理   | Zustand                     | 轻量，比 Redux 简单                    |
| 代码编辑器 | Monaco Editor               | VS Code 核心，功能完整                 |
| 代码高亮   | Shiki                       | 支持 VS Code 主题                      |
| Diff 展示  | react-diff-viewer           | 现成的 unified diff UI                 |
| Markdown   | react-markdown + remark-gfm | Chat 消息渲染                          |
| 沙箱运行时 | @webcontainer/api           | 浏览器内 Node.js，零服务端成本         |
| UI 组件    | shadcn/ui                   | 可定制性强，不依赖特定样式库           |

### 后端

| 用途     | 技术                    | 理由                             |
| -------- | ----------------------- | -------------------------------- |
| 运行时   | Node.js 22 + TypeScript | 前后端统一语言                   |
| Web 框架 | Hono                    | 轻量高性能，支持 SSE             |
| 数据库   | PostgreSQL (Supabase)   | 开箱即用的 Auth/Storage/Realtime |
| 缓存     | Redis                   | 会话缓存、限流                   |
| ORM      | Drizzle                 | 类型安全，轻量                   |
| AI API   | Anthropic SDK (Claude)  | 主力模型，代码能力强             |
| 文件存储 | Supabase Storage / S3   | 项目文件持久化                   |

### 基础设施

| 用途             | 技术             | 理由                 |
| ---------------- | ---------------- | -------------------- |
| 部署（后端）     | Railway / Fly.io | 小团队友好，自动扩容 |
| 部署（用户应用） | Netlify API      | 静态站点部署最简方案 |
| CI/CD            | GitHub Actions   | 与仓库深度集成       |
| 监控             | Sentry           | 错误追踪             |
| 日志             | Axiom            | 轻量日志服务         |
| 分析             | PostHog          | 开源产品分析         |

---

## 6. 目录结构

```
buildn-app/
├── docs/                       # 项目文档
│   └── DEVELOPMENT.md          # 本文档
├── packages/                   # Monorepo 子包
│   ├── web/                    # 前端应用
│   │   ├── src/
│   │   │   ├── components/     # UI 组件
│   │   │   ├── hooks/          # 自定义 Hooks
│   │   │   ├── stores/         # Zustand 状态管理
│   │   │   ├── lib/            # 工具函数
│   │   │   ├── styles/         # 全局样式
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── public/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── server/                 # 后端 API
│   │   ├── src/
│   │   │   ├── routes/         # API 路由
│   │   │   ├── services/       # 业务逻辑
│   │   │   ├── db/             # 数据库模型 + 迁移
│   │   │   ├── middleware/     # 认证、限流等
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── ai-engine/              # AI 代码生成引擎
│   │   ├── src/
│   │   │   ├── classifier/     # 意图分类
│   │   │   ├── context/        # 上下文管理
│   │   │   ├── generator/      # 代码生成
│   │   │   ├── postprocess/    # 后处理管线
│   │   │   └── prompts/        # Prompt 模板
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── shared/                 # 共享类型与工具
│       ├── src/
│       │   ├── types/          # 共享 TypeScript 类型
│       │   └── utils/          # 共享工具函数
│       ├── tsconfig.json
│       └── package.json
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions CI
├── .gitignore
├── LICENSE
├── README.md
├── package.json                # Root package.json
├── pnpm-workspace.yaml         # pnpm workspace 配置
└── turbo.json                  # Turborepo 配置
```

---

## 7. 开发规范

### 7.1 代码规范

- 语言：全项目使用 TypeScript（strict mode）
- 格式化：Prettier（2 空格缩进，单引号，无分号）
- Lint：ESLint + @typescript-eslint
- 提交规范：Conventional Commits（`feat:` / `fix:` / `docs:` / `chore:`）
- 分支策略：`main`（生产）← `dev`（开发）← `feat/xxx`（功能分支）

### 7.2 Git 工作流

```
feat/chat-ui ──PR──→ dev ──PR──→ main ──→ 自动部署
                      │
feat/ai-engine ──PR──┘
```

### 7.3 环境变量

```env
# .env.example
ANTHROPIC_API_KEY=sk-ant-xxx        # Claude API Key
DATABASE_URL=postgresql://...        # PostgreSQL 连接
REDIS_URL=redis://...                # Redis 连接
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
NETLIFY_AUTH_TOKEN=xxx               # 部署用
```

---

## 8. 风险与应对

### 8.1 技术风险

| 风险                       | 概率 | 影响 | 应对策略                             |
| -------------------------- | ---- | ---- | ------------------------------------ |
| LLM 生成代码质量不稳定     | 高   | 高   | 后处理管线 + 自动重试 + 预设模板兜底 |
| WebContainer 浏览器兼容性  | 中   | 高   | 降级方案：服务端容器（Fly.io）       |
| Token 消耗过高导致成本失控 | 高   | 中   | 上下文裁剪 + 缓存 + 分级模型路由     |
| 大项目上下文溢出           | 高   | 中   | 文件级 RAG 检索，只传相关代码        |
| 实时预览性能问题           | 低   | 中   | Debounce 更新 + 增量 HMR             |

### 8.2 产品风险

| 风险                          | 概率 | 影响 | 应对策略                           |
| ----------------------------- | ---- | ---- | ---------------------------------- |
| 用户期望过高（AI 不是万能的） | 高   | 高   | 引导式 UI（模板 + 建议），降低期望 |
| 同类产品竞争激烈              | 高   | 高   | 找垂直切入点，差异化定位           |
| 用户留存低                    | 中   | 高   | 关注部署后的持续迭代体验           |

### 8.3 运营风险

| 风险                       | 概率 | 影响 | 应对策略                                |
| -------------------------- | ---- | ---- | --------------------------------------- |
| LLM API 成本随用户增长爆炸 | 高   | 高   | 分级计费 + 免费层限制 + 缓存常见 prompt |
| 用户代码安全/隐私问题      | 中   | 高   | WebContainer 本地执行 + 数据加密        |

---

> 最后更新：2026-03-18
> 版本：v0.1.0
