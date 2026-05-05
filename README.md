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

### Quick start

```bash
# Clone and install
git clone https://github.com/mohanli/agent-eyes.git
cd agent-eyes
pnpm install

# Install browser-eyes-mcp into your Claude Code config
# (see packages/browser-eyes-mcp/README.md for details)

# Install vibe-delivery skill
bash packages/vibe-delivery/install.sh
```

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

### 设计理念

灵感来自 [OpenAI 的 harness 研究](https://openai.com/index/) 和 [Anthropic 关于 AI agents 上下文工程的文章](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)。核心论点:**agent 的能力来自工具 + 反馈 + 循环,不是来自越来越复杂的 prompt**。

### License

MIT
