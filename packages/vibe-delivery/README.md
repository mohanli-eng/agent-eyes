# vibe-delivery

> A Claude Code skill for end-to-end code delivery — hybrid workflow + agent architecture.
>
> 一个 Claude Code skill,用于端到端代码交付 — 混合 workflow + agent 架构。

[English](#english) | [中文](#中文)

---

## English

### What it does

`vibe-delivery` is a Claude Code skill that orchestrates code delivery through 9 stages, from requirement to shipped code:

```
/prd → /prototype → /plan → /test-plan → /setup-test → /gen-test → /implement → /test → /ship
```

Each stage produces a structured artifact (saved to `references/`) that drives the next stage. State is persisted in `references/workflow-state.json` so work can be resumed across Claude Code sessions.

### The architectural insight

Most "AI coding workflow" tools are either pure workflows (rigid, predictable) or pure agents (flexible, unpredictable). `vibe-delivery` is **deliberately hybrid**:

- **Outer 9 stages = workflow**: ordered, stateful, recoverable, predictable steps
- **Inner `/implement` and `/test` stages = agent loops**: agent decides what to do based on environment feedback (compile errors, test results, runtime observations)

This follows [Anthropic's Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) framework: use workflows for predictable steps, agents for open-ended iteration.

The killer feature: the `/test` stage's agent loop can call `browser-eyes-mcp` to observe deployed apps' runtime state — closing the feedback loop that other AI coding tools leave open.

### Installation

```bash
# From the ai-coding-harness root
bash packages/vibe-delivery/install.sh
```

Or manually:

```bash
mkdir -p ~/.claude/skills/vibe-delivery
cp packages/vibe-delivery/SKILL.md ~/.claude/skills/vibe-delivery/
```

For the runtime-observation features in `/test`, also install [`browser-eyes-mcp`](../browser-eyes-mcp).

### Usage

In any Claude Code session, just invoke a stage:

```
You: /prd I want to build a markdown blog with comments

Claude Code: [reads SKILL.md, generates references/prd-markdown-blog.md, asks for confirmation]
```

Stages can run end-to-end automatically, or be invoked individually for partial workflows.

### Why this exists

I'm a frontend developer who got tired of AI coding tools that either:
- Produce code that "looks right" but explodes at runtime
- Or require so much hand-holding the agent isn't actually autonomous

`vibe-delivery` is my answer: structured enough to be predictable, autonomous enough where it matters, and connected to real runtime feedback through MCP.

### License

MIT

---

## 中文

### 它是做什么的

`vibe-delivery` 是一个 Claude Code skill,通过 9 个阶段编排代码交付,从需求到交付代码:

```
/prd → /prototype → /plan → /test-plan → /setup-test → /gen-test → /implement → /test → /ship
```

每个阶段产出一个结构化产物(保存在 `references/` 中),驱动下一阶段。状态持久化在 `references/workflow-state.json` 中,工作可以在 Claude Code 会话之间恢复。

### 架构思想

大多数"AI 编码工作流"工具要么是纯粹的 workflow(僵化、可预测),要么是纯粹的 agent(灵活、不可预测)。`vibe-delivery` **刻意采用混合架构**:

- **外层 9 个阶段 = workflow**: 有序、有状态、可恢复、可预测的步骤
- **内层 `/implement` 和 `/test` 阶段 = agent loop**: agent 根据环境反馈(编译错误、测试结果、运行时观测)自主决定下一步

这遵循了 [Anthropic 的 Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) 框架:可预测的步骤用 workflow,开放式迭代用 agent。

杀手级特性:`/test` 阶段的 agent loop 可以调用 `browser-eyes-mcp` 观测部署后应用的运行时状态 — 闭合了其他 AI 编码工具所遗漏的反馈环。

### 安装

```bash
# 从 ai-coding-harness 根目录
bash packages/vibe-delivery/install.sh
```

或手动安装:

```bash
mkdir -p ~/.claude/skills/vibe-delivery
cp packages/vibe-delivery/SKILL.md ~/.claude/skills/vibe-delivery/
```

要使用 `/test` 中的运行时观测功能,还需要安装 [`browser-eyes-mcp`](../browser-eyes-mcp)。

### 使用方式

在任何 Claude Code 会话中,直接调用阶段:

```
你: /prd 我想做一个带评论功能的 markdown 博客

Claude Code: [读取 SKILL.md,生成 references/prd-markdown-blog.md,请求确认]
```

各阶段可以端到端自动运行,也可以单独调用来执行部分工作流。

### 为什么做这个

我是一个前端开发者,厌倦了 AI 编码工具要么:
- 产出"看起来对"但一运行就炸的代码
- 要么需要太多手把手指导,agent 根本没有真正自主

`vibe-delivery` 是我的答案:足够结构化以保证可预测性,在关键处足够自主,并且通过 MCP 连接到真实的运行时反馈。

### License

MIT
