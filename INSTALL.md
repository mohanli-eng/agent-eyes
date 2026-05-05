# Installation Guide / 安装指南

> How to install vibe-delivery and browser-eyes-mcp into Claude Code.
>
> 如何将 vibe-delivery 和 browser-eyes-mcp 安装到 Claude Code。

[English](#english) | [中文](#中文)

---

## English

This repository contains two distinct artifacts that integrate with Claude Code through **two different mechanisms**. Many people conflate them, so let's make the distinction crisp before you install.

### The two mechanisms

| Artifact | Type | Mechanism | Where it lives |
| --- | --- | --- | --- |
| `vibe-delivery` | Procedural knowledge | **Skill** | `~/.claude/skills/vibe-delivery/` |
| `browser-eyes-mcp` | External tool | **MCP server** | Configured in `~/.claude/mcp.json`, runs as a subprocess |

`claude init` is a **third, unrelated thing** — it initializes a project-level config (`<project>/.claude/`, `CLAUDE.md`). Running `claude init` does NOT install skills or register MCP servers.

You'll likely use all three mechanisms together, but each is installed separately.

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`npm install -g pnpm` if you don't have it)
- Claude Code CLI installed and working

### Step 1: Clone and bootstrap

```bash
git clone https://github.com/mohanli/ai-coding-harness.git
cd ai-coding-harness
pnpm install
```

### Step 2: Build browser-eyes-mcp

```bash
cd packages/browser-eyes-mcp
pnpm exec playwright install chromium
pnpm build
cd ../..
```

This produces `packages/browser-eyes-mcp/dist/index.js` — the executable MCP server entry point.

### Step 3: Install vibe-delivery skill

```bash
bash packages/vibe-delivery/install.sh
```

**What this does**: copies `SKILL.md` and `references/` to `~/.claude/skills/vibe-delivery/`.

**Optional flags**:
- `--link` — use symlinks instead of copies, so edits to `packages/vibe-delivery/SKILL.md` take effect immediately. Best for active development.
- `--project` — also install as a project-level skill in the current working directory's `.claude/skills/`. Useful when dogfooding inside this repo itself.
- `bash install.sh --link --project` — the recommended combo when you're actively iterating on the skill.

### Step 4: Register browser-eyes-mcp

Edit `~/.claude/mcp.json` (create if missing) and add:

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

**Alternatively**, once the package is published to npm:

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

### Step 5: Restart Claude Code

Both skill loading and MCP server registration only happen at Claude Code startup. Quit and reopen.

### Step 6: Verify

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

### How `claude init` fits in (optional)

For projects where you want Claude Code to follow specific rules (e.g., "this monorepo uses pnpm not npm", "tests live in `packages/*/tests/`"), use:

```bash
cd <your-project>
claude init
```

This creates `<your-project>/.claude/` and `<your-project>/CLAUDE.md`. Edit `CLAUDE.md` to encode project rules.

**Important**: `claude init` is independent from skill/MCP installation. You don't need to run it for vibe-delivery or browser-eyes-mcp to work. Only run it if you want project-specific Claude Code guidance.

### Troubleshooting

**Skill not detected after install**: Verify with `ls ~/.claude/skills/vibe-delivery/SKILL.md`. If missing, re-run `install.sh`. If present but Claude Code doesn't see it, fully quit and restart Claude Code (a tab reload isn't enough).

**MCP server fails to start**: Check the absolute path in `~/.claude/mcp.json` is correct. Run the command manually to see errors:

```bash
node /absolute/path/to/dist/index.js
# Should print: [browser-eyes-mcp] Server started on stdio
# (Then it'll wait for input — Ctrl+C to exit)
```

**Skill works but `getConsoleErrors` fails**: Make sure you ran `pnpm exec playwright install chromium` in `packages/browser-eyes-mcp`. Without the browser binary, Playwright can't launch.

---

## 中文

这个仓库包含两个不同的产物,通过**两种不同机制**与 Claude Code 集成。很多人容易混为一谈,所以在安装前我们先厘清这个区别。

### 两种机制

| 产物 | 类型 | 机制 | 存放位置 |
| --- | --- | --- | --- |
| `vibe-delivery` | 流程性知识 | **Skill** | `~/.claude/skills/vibe-delivery/` |
| `browser-eyes-mcp` | 外部工具 | **MCP server** | 在 `~/.claude/mcp.json` 中配置,作为子进程运行 |

`claude init` 是**第三个、不相关的东西** — 它初始化项目级配置(`<project>/.claude/`、`CLAUDE.md`)。运行 `claude init` **不会**安装 skill 或注册 MCP server。

你大概率三者都会用到,但每个都需要单独安装。

### 前置条件

- Node.js ≥ 20
- pnpm ≥ 9 (如果没有,执行 `npm install -g pnpm`)
- Claude Code CLI 已安装并正常工作

### 第1步:克隆并初始化

```bash
git clone https://github.com/mohanli/ai-coding-harness.git
cd ai-coding-harness
pnpm install
```

### 第2步:构建 browser-eyes-mcp

```bash
cd packages/browser-eyes-mcp
pnpm exec playwright install chromium
pnpm build
cd ../..
```

这会产出 `packages/browser-eyes-mcp/dist/index.js` — 可执行的 MCP server 入口。

### 第3步:安装 vibe-delivery skill

```bash
bash packages/vibe-delivery/install.sh
```

**这做了什么**:将 `SKILL.md` 和 `references/` 复制到 `~/.claude/skills/vibe-delivery/`。

**可选参数**:
- `--link` — 使用符号链接代替复制,这样对 `packages/vibe-delivery/SKILL.md` 的编辑会立即生效。适合活跃开发。
- `--project` — 同时也安装为当前工作目录 `.claude/skills/` 下的项目级 skill。适合在本仓库内自举(dogfooding)时使用。
- `bash install.sh --link --project` — 当你在积极迭代 skill 时推荐的组合。

### 第4步:注册 browser-eyes-mcp

编辑 `~/.claude/mcp.json`(如果不存在则创建),添加:

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

将 `/absolute/path/to/` 替换为你实际 clone 的绝对路径。

**或者**,当包发布到 npm 后:

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

### 第5步:重启 Claude Code

Skill 加载和 MCP server 注册都只在 Claude Code 启动时生效。退出并重新打开。

### 第6步:验证

在 Claude Code 会话中执行:

```
/prd Test that vibe-delivery is loaded
```

如果 vibe-delivery 安装正确,Claude Code 会按照 `/prd` 阶段流程执行。如果没有,它会说不知道这个命令。

验证 browser-eyes-mcp:

```
你: 用 getConsoleErrors 工具检查 https://example.com
```

Claude Code 应该调用该工具并返回一个 0 错误的结构化报告。

### `claude init` 如何配合(可选)

对于你希望 Claude Code 遵循特定规则的项目(例如"这个 monorepo 用 pnpm 而非 npm"、"测试在 `packages/*/tests/` 下"),使用:

```bash
cd <your-project>
claude init
```

这会创建 `<your-project>/.claude/` 和 `<your-project>/CLAUDE.md`。编辑 `CLAUDE.md` 来编码项目规则。

**重要**:`claude init` 独立于 skill/MCP 安装。你不需要运行它来让 vibe-delivery 或 browser-eyes-mcp 工作。只有在你想要项目专属的 Claude Code 指引时才运行它。

### 故障排查

**安装后 skill 未被检测到**: 用 `ls ~/.claude/skills/vibe-delivery/SKILL.md` 验证。如果文件缺失,重新运行 `install.sh`。如果文件存在但 Claude Code 看不到,彻底退出并重启 Claude Code(只刷新标签页不够)。

**MCP server 无法启动**: 检查 `~/.claude/mcp.json` 中的绝对路径是否正确。手动运行命令查看错误:

```bash
node /absolute/path/to/dist/index.js
# 应该打印: [browser-eyes-mcp] Server started on stdio
# (然后它会等待输入 — Ctrl+C 退出)
```

**Skill 正常工作但 `getConsoleErrors` 失败**: 确认你在 `packages/browser-eyes-mcp` 中执行过 `pnpm exec playwright install chromium`。没有浏览器二进制文件,Playwright 无法启动。
