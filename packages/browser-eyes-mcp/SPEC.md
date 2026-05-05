# browser-eyes-mcp 设计规范

> 版本: 0.1.0 (MVP)
> 最后更新: 2026-05-05
> 状态: 设计阶段,待实现 MVP

---

## 1. 问题陈述

像 Claude Code 这样的 AI 编码 agent 可以编写、测试和部署前端代码,但它们无法观测**浏览器运行时内部**发生了什么。这造成了一个结构性盲点:

| Agent 能看到什么 | Agent 目前看不到什么 |
| --- | --- |
| 编译器错误 | 运行时 console 错误 |
| 单元测试输出 | 网络请求失败(4xx/5xx) |
| E2E 测试通过/失败(布尔值) | 动态渲染后的 DOM 状态 |
| 静态类型错误 | 性能退化(LCP、CLS) |

当 vibe-delivery 的 `/test` 阶段 agent loop 只能看到单元测试输出时,它可能宣布"所有测试通过",而部署后的应用在生产环境中悄悄地坏着。这个 MCP server 就是为了弥合这个鸿沟。

## 2. 设计原则

1. **默认 token 感知**: 每个工具都会截断输出,使其整洁地放入 agent 的上下文窗口。每次调用默认预算: 2000 token。
2. **按需暴露**: 工具仅在请求时返回原始观测数据。没有后台流式传输。
3. **结构化压缩**: 对重复错误去重,按来源分组,呈现计数而非完整负载。
4. **无状态调用**: 每次工具调用相互独立。浏览器会话是短生命周期的(打开 → 观测 → 关闭),除非显式保持活跃。
5. **公网 URL 优先**: MVP 支持任意公开 HTTPS URL。鉴权和 localhost 延后处理。

## 3. 架构

```
┌────────────────────────────────────────────────────┐
│  MCP Client (Claude Code)                          │
└────────────────────────────────────────────────────┘
                       │ 基于 stdio 的 JSON-RPC
                       ▼
┌────────────────────────────────────────────────────┐
│  browser-eyes-mcp server (本包)                     │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ 工具层                                       │  │
│  │  - getConsoleErrors  (MVP)                   │  │
│  │  - getNetworkRequests                        │  │
│  │  - getDOMSnapshot                            │  │
│  │  - getPerfMetrics                            │  │
│  └──────────────────────────────────────────────┘  │
│                       │                            │
│  ┌──────────────────────────────────────────────┐  │
│  │ 浏览器会话管理器                             │  │
│  │  - Playwright BrowserContext 生命周期         │  │
│  │  - Headless Chromium                         │  │
│  └──────────────────────────────────────────────┘  │
│                       │                            │
│  ┌──────────────────────────────────────────────┐  │
│  │ 截断与压缩工具                               │  │
│  │  - Token 估算                                │  │
│  │  - 错误去重                                  │  │
│  │  - 结构化摘要                                │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
                       │
                       ▼
              公网 URL 部署的应用
```

## 4. 工具规范

### 4.1 `getConsoleErrors` (MVP — 优先实现)

**目的**: 在 headless Chromium 中打开一个 URL,等待页面稳定,然后返回在该窗口内观测到的所有 console 错误和警告的压缩报告。

**输入 schema**:

```typescript
{
  url: string;              // 要观测的公网 HTTPS URL
  waitMs?: number;          // 页面加载后额外等待的毫秒数。默认: 5000
  includeWarnings?: boolean;// 是否包含 level=warning。默认: false
  maxTokens?: number;       // 输出 token 预算。默认: 2000
}
```

**输出 schema**:

```typescript
{
  url: string;
  observedFor: number;      // 实际观测的毫秒数
  totalErrors: number;      // 去重前的错误总数
  totalWarnings: number;
  uniqueErrors: Array<{
    level: 'error' | 'warning';
    message: string;        // 截断到 500 字符
    source?: string;        // 文件名:行号(如有)
    count: number;          // 这个确切错误触发了多少次
    firstSeenMs: number;    // 页面加载后首次出现的毫秒数
  }>;
  truncated: boolean;       // 输出是否被 maxTokens 截断
  notes?: string[];         // 例如 "另有5个唯一错误被省略"
}
```

**行为**:
1. 在 headless Chromium 中启动一个新的 `BrowserContext`
2. 在导航**之前**挂载 console 监听器
3. `page.goto(url, { waitUntil: 'networkidle' })`
4. 导航后额外等待 `waitMs` 毫秒(默认 5000ms)
5. 收集所有 `level` 属于 `['error']`(或包含 `['error', 'warning']` 如果 `includeWarnings=true`)的 console 消息
6. 按 `(level, message)` 元组去重,保留计数
7. 按计数降序排列
8. 截断输出以适应 `maxTokens` 预算
9. 关闭 `BrowserContext`

**失败模式**:
- URL 不可达 → 返回 `{ error: 'NETWORK_ERROR', message: '...' }`
- 页面加载超时(>30s) → 返回 `{ error: 'TIMEOUT', message: '...' }`
- 观测期间崩溃 → 返回崩溃前收集到的内容 + error 标记

**验收标准**:
- AC-01: 给定一个 0 个 console 错误的 URL,返回 `totalErrors: 0` 和 `uniqueErrors: []`
- AC-02: 给定一个抛出 `TypeError` 50 次的 URL,返回 `totalErrors: 50, uniqueErrors[0].count: 50`
- AC-03: 给定一个有 100 个不同错误的 URL,输出被截断且 `truncated: true, notes` 存在
- AC-04: 给定一个不可达的 URL,在 30s 内返回结构化错误
- AC-05: 所有输出都在声明的 `maxTokens` 预算之内(由 token 计数器验证)

### 4.2 `getNetworkRequests` (二期)

**目的**: 捕获页面加载期间的所有网络请求,暴露失败(4xx/5xx)和慢请求。

输出应按请求 URL 模式分组,而非原始 URL(例如 `/api/users/123` 和 `/api/users/456` 合并为 `/api/users/:id`)。

**将在 MVP 完成后详细规范。**

### 4.3 `getDOMSnapshot` (二期)

**目的**: 返回渲染后 DOM 的压缩语义快照(可见文本 + 无障碍树 + 关键交互元素)。

**将在 MVP 完成后详细规范。**

### 4.4 `getPerfMetrics` (二期)

**目的**: 返回 Core Web Vitals(LCP、CLS、INP)和资源计时摘要。

**将在 MVP 完成后详细规范。**

## 5. Token 感知的截断策略

每个工具**必须**遵守 `maxTokens` 参数。实现方式:

```typescript
// 伪代码
function truncateToTokenBudget<T>(items: T[], budget: number, formatter: (T) => string): T[] {
  let usedTokens = 0;
  const kept: T[] = [];
  for (const item of items) {
    const estimated = estimateTokens(formatter(item));
    if (usedTokens + estimated > budget) break;
    kept.push(item);
    usedTokens += estimated;
  }
  return kept;
}
```

Token 估算: 使用 `gpt-tokenizer` 或类似的轻量库。MVP 阶段可用近似值 `字符数 / 4`。

## 6. 浏览器会话管理

MVP 阶段,每次工具调用完全隔离:
1. 创建新的 `BrowserContext`
2. 执行工作
3. 关闭 `BrowserContext`

未来优化(二期): 允许 agent 通过 session token 跨调用保持会话活跃。MVP 不做。

## 7. MCP server 骨架

本 server 使用 `@modelcontextprotocol/sdk`(TypeScript)。入口在 `src/index.ts`,注册所有工具并启动 stdio transport。

```typescript
// src/index.ts (草图)
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getConsoleErrorsHandler } from './tools/get-console-errors.js';

const server = new Server(
  { name: 'browser-eyes-mcp', version: '0.0.1' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(/* ... */);

const transport = new StdioServerTransport();
await server.connect(transport);
```

## 8. 测试策略

- **单元测试** (`tests/unit/`): mock Playwright,测试截断逻辑、去重、schema 校验
- **集成测试** (`tests/integration/`): 用真实浏览器对着 fixture 启动(位于 `tests/fixtures/pages/` 的本地静态 HTML 文件)
- **手动冒烟测试**: 对着 `https://example.com`、AuraDiet 的 Vercel 预览以及已知有问题的页面(故意抛错)运行

## 9. 分发

- 发布到 npm 为 `@mohanli/browser-eyes-mcp`
- 用户通过 `pnpm add -g @mohanli/browser-eyes-mcp` 安装,或通过 `npx` 按需运行
- Claude Code MCP 配置文件中的配置:

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

## 10. 待解决问题(V1.0 前需要明确)

- [ ] 是否应该暴露 `screenshot` 工具?(增加价值但大幅提高 token 成本 — 可能推迟)
- [ ] 如何处理延迟加载的 SPA?(`waitMs` 是个粗糙的旋钮 — 考虑暴露 `waitForSelector` 选项)
- [ ] 鉴权: cookies、localStorage seed、OAuth — MVP 不做,但需要规划路径
- [ ] 沙箱安全: 是否应该验证 URL 为 HTTPS?是否需要拦截已知恶意模式?
