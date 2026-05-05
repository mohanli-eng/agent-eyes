# browser-eyes-mcp

> An MCP server giving AI coding agents eyes to see the browser runtime.
>
> 一个 MCP server,让 AI 编码 agent 拥有看见浏览器运行时的"眼睛"。

[English](#english) | [中文](#中文)

---

## English

### What it does

Exposes 4 tools to any MCP-compatible AI agent (Claude Code, Cursor, Codex CLI, etc.) that let the agent observe a deployed browser application:

- **`getConsoleErrors`** — capture and summarize console errors/warnings during page load
- **`getNetworkRequests`** *(coming soon)* — surface failed and slow network requests
- **`getDOMSnapshot`** *(coming soon)* — return compressed semantic DOM state
- **`getPerfMetrics`** *(coming soon)* — return Core Web Vitals and resource timing

All tools are designed with **token-aware truncation** so observations fit cleanly into agent context windows.

### Why this exists

AI coding agents can write code, run tests, and ship implementations. But once code is deployed, they can't see what actually happens in the browser. They write a React component, the unit tests pass — and then a `useEffect` infinite loop floods the console at runtime. The agent has no way to know.

This MCP server closes that loop by giving agents a way to actually look at deployed apps, not just compile output.

### Installation

#### As a Claude Code MCP server

Add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "browser-eyes": {
      "command": "npx",
      "args": ["-y", "@mohanli/browser-eyes-mcp"]
    }
  }
}
```

That's it. Claude Code will start the server on demand.

#### Local development

```bash
git clone https://github.com/mohanli/ai-coding-harness.git
cd ai-coding-harness/packages/browser-eyes-mcp
pnpm install
pnpm exec playwright install chromium
pnpm test
pnpm build
```

### Usage example

Once installed, your agent can call the tools natively:

```
You: "Check if the deployed app at https://auradiet.vercel.app has any console errors"

Claude Code: [calls getConsoleErrors with url='https://auradiet.vercel.app']
            → returns:
              {
                totalErrors: 3,
                uniqueErrors: [
                  { message: "Cannot read properties of undefined (reading 'user')",
                    count: 3,
                    source: "auth.tsx:42" }
                ]
              }
```

### Design principles

1. **Token-aware**: every output respects a `maxTokens` budget (default 2000)
2. **On-demand**: no background streaming, agents pull observations when needed
3. **Structured compression**: deduplicate, group, summarize before returning
4. **Stateless**: each tool call is independent; no session state to manage
5. **Public URL first**: MVP supports HTTPS URLs only; localhost and auth deferred

See [SPEC.md](./SPEC.md) for the complete design specification.

### Status

🚧 **MVP in progress.** Currently implementing `getConsoleErrors`. Track progress in the [parent monorepo](https://github.com/mohanli/ai-coding-harness).

### License

MIT

---

## 中文

### 它是做什么的

向任何兼容 MCP 的 AI agent(Claude Code、Cursor、Codex CLI 等)暴露 4 个工具,让 agent 能观测部署后的浏览器应用:

- **`getConsoleErrors`** — 捕获并汇总页面加载期间的 console 错误/警告
- **`getNetworkRequests`** *(即将推出)* — 暴露失败和缓慢的网络请求
- **`getDOMSnapshot`** *(即将推出)* — 返回压缩的语义化 DOM 状态
- **`getPerfMetrics`** *(即将推出)* — 返回 Core Web Vitals 和资源计时

所有工具都设计了 **token 感知截断**,确保观测结果能干净地放进 agent 的上下文窗口。

### 为什么做这个

AI 编码 agent 能写代码、跑测试、交付实现。但代码一旦部署,它们看不见浏览器里到底发生了什么。它们写出 React 组件,单元测试通过 — 然后 `useEffect` 死循环刷爆运行时 console。Agent 完全无从知晓。

这个 MCP server 通过让 agent 能真正"看到"部署后的应用,而不仅仅是编译输出来闭合这个反馈环。

### 安装

#### 作为 Claude Code MCP server

在你的 Claude Code MCP 配置中添加:

```json
{
  "mcpServers": {
    "browser-eyes": {
      "command": "npx",
      "args": ["-y", "@mohanli/browser-eyes-mcp"]
    }
  }
}
```

就这些。Claude Code 会按需启动服务。

#### 本地开发

```bash
git clone https://github.com/mohanli/ai-coding-harness.git
cd ai-coding-harness/packages/browser-eyes-mcp
pnpm install
pnpm exec playwright install chromium
pnpm test
pnpm build
```

### 使用示例

安装后,你的 agent 可以原生调用这些工具:

```
你: "检查一下 https://auradiet.vercel.app 有没有 console 错误"

Claude Code: [调用 getConsoleErrors,传入 url='https://auradiet.vercel.app']
            → 返回:
              {
                totalErrors: 3,
                uniqueErrors: [
                  { message: "Cannot read properties of undefined (reading 'user')",
                    count: 3,
                    source: "auth.tsx:42" }
                ]
              }
```

### 设计原则

1. **Token 感知**: 每次输出遵守 `maxTokens` 预算(默认 2000)
2. **按需**: 无后台流式传输,agent 需要时才拉取观测数据
3. **结构化压缩**: 去重、分组、摘要之后再返回
4. **无状态**: 每次工具调用相互独立,无需管理会话状态
5. **公网 URL 优先**: MVP 仅支持 HTTPS URL;localhost 和鉴权延后

详见 [SPEC.md](./SPEC.md) 获取完整设计规范。

### 状态

🚧 **MVP 开发中。** 正在实现 `getConsoleErrors`。在[父 monorepo](https://github.com/mohanli/ai-coding-harness) 中跟踪进度。

### License

MIT
