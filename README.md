# AI Coding Harness

> A modular harness for AI coding agents — giving Claude Code eyes to see the browser runtime.

[English](#english) | [中文](#中文)

---

## English

### Why this exists

Modern AI coding agents (Claude Code, Cursor, Codex CLI) can write code, run tests, and ship implementations. But they share a structural blind spot: **once code is deployed, they can't see what actually happens in the browser at runtime**. They write a React component, the unit tests pass, the build succeeds — and then a `useEffect` infinite loop floods the console, an API call returns 500, or a CSS rule silently breaks the layout. The agent has no way to know.

This project builds a harness that closes that loop.

### What's in this repo

This is a **pnpm monorepo** with two packages that work together:

```
┌─────────────────────────────────────────────────────────┐
│  Claude Code (the agent runtime — provided by Anthropic) │
└─────────────────────────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
┌────────────────────────┐  ┌────────────────────────┐
│  vibe-delivery         │  │  browser-eyes-mcp      │
│  (Claude Code Skill)   │  │  (MCP Server)          │
│                        │  │                        │
│  Workflow orchestration│  │  Runtime observation   │
│  /prd /plan /test ...  │  │  - getConsoleErrors    │
│  Hybrid workflow+agent │  │  - getNetworkRequests  │
│  state machine         │  │  - getDOMSnapshot      │
│                        │  │  - getPerfMetrics      │
└────────────────────────┘  └────────────────────────┘
              │                       │
              └───────────┬───────────┘
                          ▼
               Your deployed application
                  (any public URL)
```

**`packages/vibe-delivery`** — A Claude Code Skill that orchestrates code delivery through 9 stages (`/prd` → `/prototype` → `/plan` → `/test-plan` → `/setup-test` → `/gen-test` → `/implement` → `/test` → `/ship`). The outer 9-stage flow is a **workflow** (predictable, stateful, recoverable). The inner `/implement` and `/test` stages are **agent loops** (the agent decides what to do based on environment feedback).

**`packages/browser-eyes-mcp`** — An MCP server that gives any AI agent the ability to observe a deployed browser application. Built on Playwright. Designed with token-aware truncation so observations fit cleanly into agent context windows.

### The architectural insight

This repo is a deliberate exploration of when to use **workflows** vs **agents**, following [Anthropic's Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) framework:

- Stages with predictable steps (PRD writing, test plan generation, archival) → **workflow**
- Stages with unpredictable iteration count (compile-fix loop, test-fix loop) → **agent loop**

The `browser-eyes-mcp` is the tool that gives the inner agent loops their environmental ground truth — without it, the `/test` stage's agent loop is blind beyond unit test output.

### Installation

#### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`npm install -g pnpm` if you don't have it)
- Claude Code CLI installed and working

#### Step 1: Clone and bootstrap

```bash
git clone https://github.com/mohanli/ai-coding-harness.git
cd ai-coding-harness
pnpm install
```

#### Step 2: Build browser-eyes-mcp

```bash
cd packages/browser-eyes-mcp
pnpm exec playwright install chromium
pnpm build
cd ../..
```

This produces `packages/browser-eyes-mcp/dist/index.js` — the executable MCP server entry point.

#### Step 3: Install vibe-delivery skill

```bash
bash packages/vibe-delivery/install.sh
```

**What this does**: copies `SKILL.md` and `references/` to `~/.claude/skills/vibe-delivery/`.

**Optional flags**:
- `--link` — use symlinks instead of copies, so edits to `packages/vibe-delivery/SKILL.md` take effect immediately. Best for active development.
- `--project` — also install as a project-level skill in the current working directory's `.claude/skills/`. Useful when dogfooding inside this repo itself.
- `bash install.sh --link --project` — the recommended combo when you're actively iterating on the skill.

#### Step 4: Register browser-eyes-mcp

Edit `~/.claude.json` (create if missing) and add:

```json
{
  "mcpServers": {
    "browser-eyes": {
      "command": "node",
      "args": ["/absolute/path/to/ai-coding-harness/packages/browser-eyes-mcp/dist/index.js"]
    }
  }
}
```

Replace `/absolute/path/to/` with the real absolute path to your clone.


#### Step 5: Restart Claude Code

Both skill loading and MCP server registration only happen at Claude Code startup. Quit and reopen.

#### Step 6: Verify

In a Claude Code session, run:

```
/prd Test that vibe-delivery is loaded
```

If vibe-delivery is correctly installed, Claude Code will follow the `/prd` stage flow. If not, it will say it doesn't know that command.

To verify browser-eyes-mcp:

```
You: Use the getConsoleErrors tool to check https://example.com
```

Claude Code should call the tool and return a structured report with 0 errors.

#### How `claude init` fits in (optional)

For projects where you want Claude Code to follow specific rules (e.g., "this monorepo uses pnpm not npm", "tests live in `packages/*/tests/`"), use:

```bash
cd <your-project>
claude init
```

This creates `<your-project>/.claude/` and `<your-project>/CLAUDE.md`. Edit `CLAUDE.md` to encode project rules.

**Important**: `claude init` is independent from skill/MCP installation. You don't need to run it for vibe-delivery or browser-eyes-mcp to work. Only run it if you want project-specific Claude Code guidance.

### Status

🚧 **Active development.** First public commit: May 2026.

- [x] Monorepo scaffold
- [x] vibe-delivery Skill (workflow + agent hybrid architecture)
- [ ] browser-eyes-mcp: `getConsoleErrors` (MVP)
- [ ] browser-eyes-mcp: `getNetworkRequests`
- [ ] browser-eyes-mcp: `getDOMSnapshot`
- [ ] browser-eyes-mcp: `getPerfMetrics`
- [ ] End-to-end demo: vibe-delivery + browser-eyes-mcp building AuraDiet

### Design philosophy

Inspired by [OpenAI's harness research](https://openai.com/index/) and [Anthropic's effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents). The core thesis: **agent capability emerges from tools + feedback + loops, not from increasingly elaborate prompts**.

### License

MIT

---

## 中文

### 为什么做这个

现在的 AI 编码智能体(Claude Code、Cursor、Codex CLI)能写代码、跑测试、交付实现。但它们有一个结构性盲点:**代码部署后,它们看不见浏览器运行时到底发生了什么**。它们写出一个 React 组件,单元测试通过、编译成功——然后 `useEffect` 死循环刷爆控制台、某个 API 调用返回 500、某条 CSS 规则悄悄破坏布局。Agent 完全无从知晓。

这个项目就是为了闭合这个反馈环。

### 仓库内容

这是一个 **pnpm monorepo**,包含两个协同工作的包:

(架构图与英文版相同,见上)

**`packages/vibe-delivery`** — 一个 Claude Code Skill,通过 9 个阶段编排代码交付(`/prd` → `/prototype` → `/plan` → `/test-plan` → `/setup-test` → `/gen-test` → `/implement` → `/test` → `/ship`)。外层 9 阶段是 **workflow**(可预测、有状态、可恢复);内层 `/implement` 和 `/test` 阶段是 **agent loop**(agent 根据环境反馈自主决定下一步动作)。

**`packages/browser-eyes-mcp`** — 一个 MCP server,让任何 AI agent 都能观测部署后的浏览器应用。基于 Playwright 构建。带 token-aware 截断设计,确保观测结果能干净地放进 agent 的上下文窗口。

### 架构思想

这个仓库是对 **workflow vs agent** 选择问题的一次刻意实践,遵循 [Anthropic 的 Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) 框架:

- 步骤可预测的阶段(PRD 写作、测试计划生成、归档) → **workflow**
- 迭代次数不可预测的阶段(编译-修复循环、测试-修复循环) → **agent loop**

`browser-eyes-mcp` 这个工具给内层 agent loop 提供了环境的 ground truth ——没有它,`/test` 阶段的 agent loop 除了单元测试输出就是瞎的。

### 安装指南

#### 前置条件

- Node.js ≥ 20
- pnpm ≥ 9(如果没有,运行 `npm install -g pnpm`)
- Claude Code CLI 已安装并正常工作

#### 第 1 步:克隆并初始化

```bash
git clone https://github.com/mohanli/ai-coding-harness.git
cd ai-coding-harness
pnpm install
```

#### 第 2 步:构建 browser-eyes-mcp

```bash
cd packages/browser-eyes-mcp
pnpm exec playwright install chromium
pnpm build
cd ../..
```

这会生成 `packages/browser-eyes-mcp/dist/index.js` — 可执行的 MCP server 入口文件。

#### 第 3 步:安装 vibe-delivery skill

```bash
bash packages/vibe-delivery/install.sh
```

**这做了什么**:将 `SKILL.md` 和 `references/` 复制到 `~/.claude/skills/vibe-delivery/`。

**可选参数**:
- `--link` — 使用符号链接而非复制,这样对 `packages/vibe-delivery/SKILL.md` 的修改会立即生效。适合活跃开发。
- `--project` — 同时安装为当前工作目录下 `.claude/skills/` 中的项目级 skill。适合在本仓库内自用。
- `bash install.sh --link --project` — 活跃迭代 skill 时的推荐组合。

#### 第 4 步:注册 browser-eyes-mcp

编辑 `~/.claude.json`(如不存在则新建),添加:

```json
{
  "mcpServers": {
    "browser-eyes": {
      "command": "node",
      "args": ["/absolute/path/to/ai-coding-harness/packages/browser-eyes-mcp/dist/index.js"]
    }
  }
}
```

将 `/absolute/path/to/` 替换为你克隆仓库的实际绝对路径。


#### 第 5 步:重启 Claude Code

Skill 加载和 MCP server 注册都只在 Claude Code 启动时进行。退出并重新打开。

#### 第 6 步:验证

在 Claude Code 会话中运行:

```
/prd Test that vibe-delivery is loaded
```

如果 vibe-delivery 安装正确,Claude Code 将按照 `/prd` 阶段流程执行。否则,它会提示不认识该命令。

验证 browser-eyes-mcp:

```
你: 使用 getConsoleErrors 工具检查 https://example.com
```

Claude Code 应该调用该工具并返回结构化报告,显示 0 个错误。

#### `claude init` 的作用(可选)

如果你希望 Claude Code 在特定项目中遵循特定规则(例如"此 monorepo 使用 pnpm 而非 npm"、"测试文件位于 `packages/*/tests/`"),可以使用:

```bash
cd <your-project>
claude init
```

这会在 `<your-project>/` 下创建 `.claude/` 和 `CLAUDE.md`。编辑 `CLAUDE.md` 来编写项目规则。

**重要**:`claude init` 独立于 skill/MCP 安装。不需要运行它也能使用 vibe-delivery 或 browser-eyes-mcp。仅在需要项目专属的 Claude Code 指导时才运行。

### 状态

🚧 **活跃开发中。** 首次公开提交:2026 年 5 月。

- [x] Monorepo 脚手架
- [x] vibe-delivery Skill(workflow + agent 混合架构)
- [ ] browser-eyes-mcp:`getConsoleErrors`(MVP)
- [ ] browser-eyes-mcp:`getNetworkRequests`
- [ ] browser-eyes-mcp:`getDOMSnapshot`
- [ ] browser-eyes-mcp:`getPerfMetrics`
- [ ] 端到端演示:vibe-delivery + browser-eyes-mcp 构建 AuraDiet

### 设计理念

灵感来自 [OpenAI 的 harness 研究](https://openai.com/index/) 和 [Anthropic 关于 AI agents 上下文工程的文章](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)。核心论点:**agent 的能力来自工具 + 反馈 + 循环,不是来自越来越复杂的 prompt**。

### License

MIT
