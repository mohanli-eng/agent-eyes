---
name: vibe-delivery
description: 端到端交付级代码生成工作流，将需求转化为经过测试的可交付代码。当用户输入 /prd、/prototype、/plan、/tdd、/test-plan、/implement、/test、/ship 等指令时立即触发。当用户表达"帮我做个 app/功能/系统/页面"、“用生码skills/vibe-delivery做xxx”、"从xxx需求写代码"、"实现xxxx功能/交互/效果"、"做技术方案/coding plan"、“修复xxx”、“有xxx问题”等意图时也应触发。每个指令对应独立工作阶段，支持完整流水线顺序执行或单阶段独立调用。
---

# Vibe Delivery — 端到端交付工作流

代码交付流水线.
每个阶段产出正式文档驱动下一阶段，用户采纳开发方案后先写测试再写实现，确保交付代码符合业务标准、可维护、具有健壮性。

## 指令总览

| 指令          | 阶段            | 核心产出                                 | 前置条件                                                                                            | 合法的下一步执行                 |
| ------------- | --------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------- |
| `/prd`        | 需求规格        | `references/prd-{id}.md`                 | 用户需求描述                                                                                        | 建议执行 `/prototype` 或 `/plan` |
| `/prototype`  | 交互原型        | `references/interaction-prototype-{id}/` | PRD文件`references/prd-{id}.md` 存在                                                                | 建议执行 `/plan`                 |
| `/plan`       | 技术方案        | `references/coding-plan-{id}.md`         | PRD文件`references/prd-{id}.md` 存在                                                                | 建议执行   `/test-plan`          |
| `/test-plan`  | 测试规格        | `references/test-plan-{id}.md`           | PRD文件`references/prd-{id}.md` 存在 + Coding Plan `references/coding-plan-{id}.md` 存在            | 建议执行 `/setup-test`           |
| `/setup-test` | 测试框架配置    | 测试框架 + 配置文件 + 测试目录结构       | Coding Plan`references/coding-plan-{id}.md` 存在                                                    | 建议执行 `/gen-test`             |
| `/gen-test`   | 测试代码生成    | `tests/` 目录下的测试文件                | Test Plan `references/test-plan-{id}.md`  + 测试依赖框架与配置存在                                  | 建议执行 `/implement`            |
| `/implement`  | 实现 + 编译循环 | 编译通过的实现代码                       | `references/coding-plan-{id}.md`、Test Plan `references/test-plan-{id}.md`、`tests/` 下存在测试文件 | 建议执行 `/test`                 |
| `/test`       | 测试-修复循环   | 全量通过的测试报告                       | `tests/` 下存在测试文件  + 实现代码存在                                                             | 建议执行 `/ship`                 |
| `/ship`       | 交付收尾        | 更新后的业务文档与编码指导文档           | `references/test-report-{id}-round-{N}.md`（最后一轮测试全部通过）                                  | 交付完成                         |
 

---

## 工作流编排

### 工作流总览
 
以下是从头开始的完整工作流：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    完整交付工作流                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. /prd ────────────────────────────────────────────────────────►  │
│     ↓                                                                │
│  2. /prototype ──────────────────────────────────────────────────►  │
│     ↓                                                                │
│  3. /plan ────────────────────────────────────────────────────────►  │
│     ↓                                                                │
│  4. /test-plan ───────────────────────────────────────────────────►  │
│     ↓                                                                │
│  5. /setup-test ──────────────────────────────────────────────────►  │
│     ↓                                                                │
│  6. /gen-test ────────────────────────────────────────────────────►  │
│     ↓                                                                │
│  7. /implement ───────────────────────────────────────────────────►  │
│     ↓                                                                │
│  8. /test ────────────────────────────────────────────────────────►  │
│     ↓                                                                │
│  9. /ship ────────────────────────────────────────────────────────►  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

**执行规则**：

- **意图识别匹配阶段**：识别用户意图，用户可以从中间某个阶段开始，则直接进入对应阶段进行前置检查、执行、输出
- **顺序执行**：每个阶段完成后，自动进入下一阶段
- **用户确认**：每个阶段产出后，呈现结果并等待用户确认
- **遇阻必问**：逻辑冲突或业务无法闭环时，暂停并询问用户
- **状态恢复**：支持从任意阶段恢复执行
 

### 单阶段独立调用

当用户明确指定某个指令时，只执行该阶段


### 强制执行规则（所有指令共同适用）

执行任何指令的**第一步**，必须按顺序完成以下检查。**状态校验失败则立即终止，输出标准错误提示，不得继续执行任何后续步骤**：

1. 读取 `references/workflow-state.json`：
   - **文件存在**：加载状态，进入第 2 步
   - **文件不存在**：扫描 `references/` 目录，查找未归档的工作流产物：
     - 若发现 `prd-*.md`、`coding-plan-*.md`、`test-plan-*.md` 等文件，推断最后到达的阶段（存在哪些文件则已完成对应阶段），按以下格式提示用户：
       ```
       ⚠️ 检测到 references/ 中存在未归档的工作产物：
       {发现的文件列表}
       推断已完成阶段：{推断阶段列表}
       
       是否从中断处继续执行？
       - 输入 Y / 是：从推断的下一阶段继续
       - 输入 N / 否：忽略，按当前指令执行新任务
       ```
       等待用户选择后，按用户意图继续
     - 若未发现任何工作流产物，初始化为 `{ "taskId": "", "currentStage": "init", "completedStages": [] }`
2. **（中断恢复检查）** 若 `workflow-state.json` 存在，且 `currentStage` 不为 `completed`，则展示中断任务信息并询问用户意图：
   ```
   ⚠️ 检测到未完成的工作流任务：{taskId}
   当前进度：已完成 {completedStages} → 待执行：{currentStage}
   
   是否从中断处继续执行？
   - 输入 Y / 是：从 /{currentStage} 继续
   - 输入 N / 否：忽略中断，按当前指令执行新任务
   - 输入 /ship：先归档旧任务，再开始新任务
   ```
   等待用户选择后，按用户意图继续；选择忽略或开始新任务时，不更改旧任务状态，直接按当前指令推进。
3. 检查目标指令是否在 `validTransitions` 列表中
4. 检查该指令所需的 `requiredInputs` 是否全部存在于 `references/` 目录中

**工作流状态转换规则表**：

| 当前状态     | 可转换到                                    | 必须存在的前置文件                                            |
| ------------ | ------------------------------------------- | ------------------------------------------------------------- |
| `init`       | `prd`                                       | 用户需求描述（在消息中）                                      |
| `prd`        | `prototype`、`plan`                         | —                                                             |
| `prototype`  | `plan`                                      | `references/prd-{id}.md`                                      |
| `plan`       | `test-plan`                                 | `references/prd-{id}.md`                                      |
| `test-plan`  | `setup-test`                                | `references/prd-{id}.md`、`references/coding-plan-{id}.md`    |
| `setup-test` | `gen-test`                                  | `references/coding-plan-{id}.md`                              |
| `gen-test`   | `implement`                                 | `references/test-plan-{id}.md`、测试依赖配置存在              |
| `implement`  | `test`                                      | `references/coding-plan-{id}.md`、`tests/` 下存在测试文件     |
| `test`       | `ship`（全部通过时）、`implement`（失败时） | `tests/` 下存在测试文件                                       |
| `ship`       | `completed`                                 | `references/test-report-{id}-round{N}.md`（最后一轮全部通过） |

**状态转换失败的输出格式**（严格使用此格式，不得自行发挥）：

```
❌ 无法执行 /{指令}

当前状态：{currentState}
缺少前置条件：{具体缺失项}
建议：{下一步指令提示}
```

每个指令执行**完成后**，必须更新 `workflow-state.json` 的 `currentState` 与 `completedStages`，再输出结果。

---

### 状态管理与恢复

#### 工作流状态记录

每个阶段完成后，在 `references/` 目录下创建状态文件（已存在该文件时更新内容即可）：

```json
// references/workflow-state.json
{
  "taskId": "user-auth",
  "currentStage": "plan",
  "completedStages": ["prd", "prototype"],
  "documents": {
    "prd": "references/prd-user-auth.md",
    "prototype": "references/interaction-prototype-user-auth/",
    "plan": "references/coding-plan-user-auth.md"
  },
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

#### 从任意阶段恢复

当用户指定从某个阶段开始时：

1. 读取 `references/workflow-state.json`
2. 检查前置条件是否满足
3. 满足则从该阶段继续执行
4. 不满足则提示用户需要先完成哪些前置阶段

**示例**：

```
用户输入：/implement

Agent 执行：
1. 读取 workflow-state.json
2. 检查前置条件：
   - Coding Plan 存在？✓
   - Test Plan 存在？✗
   - 测试代码存在？✗
3. 提示用户：
   "检测到缺少 Test Plan 和测试代码。
    建议执行 /test-plan 和 /gen-test "
```

### 错误处理与重试

#### 阶段级错误

当某个阶段执行失败时：

```
阶段执行失败
  ↓
判断：错误类型？
  ├─ 前置条件缺失 → 提示用户，等待确认
  ├─ 逻辑冲突 → 暂停，询问用户
  ├─ 技术错误 → 生成修复方案，重试
  └─ 用户取消 → 询问是否继续或终止
```

#### 重试策略

- **技术错误**：最多重试 3 次
- **逻辑冲突**：不重试，必须用户确认
- **前置条件缺失**：不重试，提示用户


---

## 全局约定

- **文档存储**：所有过程文档保存至当前项目的 `references/` 目录，不存在则创建
- **任务标识 `{id}`**：由 AI 从需求语义自动生成（kebab-case，2-3词，如 `user-auth`、`expense-tracker`），要保持唯一性与已有任务标识不冲突
- **用户确认**：每个阶段产出后，呈现结果并等待用户确认 
- **遇阻必问**：逻辑冲突或业务无法闭环时，停下来与用户确认，不得擅自裁决

## 输入查找规则

执行任何需要已有文档作为输入的指令时，按以下顺序查找：

1. **当前消息中是否内联提供**（用户直接粘贴了内容）
2. **`references/` 目录中是否存在对应文件**（读取并使用）
3. 两者均无 → **终止，给出明确提示**（见各指令的前置检查）

---

## /prd — 生成需求规格

### 前置检查

用户消息中是否包含需求描述？

- **否** → 终止：「请提供需求描述，用自然语言说明你想实现什么功能或解决什么问题。」

### 执行步骤

1. 理解用户描述的核心需求，结合业务常识补全细节
2. 产出 PRD，严格使用以下结构：

```
# PRD: {id}

## 背景与目的
（一段话说明为什么做这个功能）

## 功能需求
（每条需求用用户故事格式，附验收标准）

### US-01: {故事标题}
**用户故事**：作为 {角色}，我希望 {操作}，以便 {价值}
**验收标准**：
- AC-01-1: {可量化、可测试的条件，描述结果而非过程} `[→ TC-XX]`
- AC-01-2: ... `[→ TC-XX]`

> `[→ TC-XX]` 为预留 testId 占位符，在 /test-plan 阶段填写对应测试用例编号，实现 AC → 测试用例的双向追溯。

（重复每条用户故事）

## 非功能需求
- 易用性：...
- 性能：...
- 安全：...

## 用户场景与操作路径
（关键流程的步骤描述）

## 边界条件与异常场景
（边界值、异常输入、错误状态的预期处理）
```

> 验收标准是后续测试用例的直接来源，必须精确、无歧义、可被验证。写"用户可在 3 秒内看到结果"而非"响应要快"。

3. 保存至 `references/prd-{id}.md`
4. 呈现给用户确认，根据反馈修改直至通过
5. 通过后进入下一工作流程状态并同步修改`references/workflow-state.json`

---

## /prototype — 生成交互原型

### 前置检查

- PRD `references/prd-{id}.md` 是否存在？
  - **否** → 终止：「缺少 PRD，请先执行 /prd 生成需求规格，或直接粘贴 PRD 内容。」
- 用户是否提供了交互风格描述？
  - **否** → 终止：「请描述期望的交互风格，例如：简洁现代、卡片式布局、移动端优先、参考某产品等。」

### 执行步骤

1. 理解 PRD 中的功能需求与用户场景
2. 读取 `references/coding-constraints.md` 中的生码约束（复用优先、模块化、可维护）
3. 直接生成**可运行的前端原型代码**，目标是让用户看到视觉效果与交互方式，**不包含真实业务逻辑与后端对接**（用 mock 数据）
4. 对升级迭代项目：先读取已有代码的组件与样式，在保持原有视觉风格的基础上设计
5. 保存原型代码至 `references/interaction-prototype-{id}/`
6. 告知用户如何运行原型，等待确认；根据反馈修改直至通过
7. 通过后进入下一工作流程状态并同步修改`references/workflow-state.json`
---

## /plan — 生成技术方案

### 前置检查

- PRD `references/prd-{id}.md`是否存在？
  - **否** → 终止：「缺少 PRD，请先执行 /prd 生成需求规格，或直接粘贴 PRD 内容。」

### 执行步骤

**Step 1 — 读取约束并理解编码环境**

先读取 `references/coding-constraints.md`（若存在），再扫描当前工作目录，判断项目类型：

- **新项目**（无历史代码）：记录为新项目，技术选型须满足：性能良好、安全可靠、免费低门槛、工程化完善、可维护性高
- **已有项目**：读取已有代码与可能存在的业务说明/编码指导文档，理解：
  - 业务流程与具体逻辑
  - 代码架构、语言环境、依赖配置
  - 编码风格、组件/方法封装习惯
  - 已有可复用模块

**Step 2 — 产出 Coding Plan**，使用以下结构：

```
# Coding Plan: {id}

## 技术选型
（已有项目：说明沿用的技术栈；新项目：列出选型及理由，须满足五项标准）

## 模块拆分
（列出需要新建或修改的模块/组件，各自职责）

## 接口定义
（每个关键函数/API：名称、输入参数、返回值、可能的错误、实现位置）

格式：
```
- **名称**: functionName
- **输入**: param: Type
- **输出**: ReturnType
- **错误**: ErrorType（触发条件）
- **implRef**: src/path/to/file.ts#functionName   ← 实现文件路径，编码阶段填写
```

> `implRef` 初稿可填 `TBD`，/implement 阶段完成后必须回填实际路径，确保文档与代码可互相追溯。

## 数据结构
（关键数据模型定义）

## 关键业务流程
（用伪代码或流程图描述核心逻辑）

## 依赖与配置变更
（需要新增/升级的包，配置文件变更）

## 文件清单
（需新建/修改的文件路径列表）
```

3. 保存至 `references/coding-plan-{id}.md`
4. 呈现给用户确认，根据反馈修改直至通过


**step 7：用户确认与后续动作**
用户确认通过后进入下一工作流程状态并同步修改`references/workflow-state.json`

---

## /test-plan — 生成测试规格

### 前置检查

- PRD `references/prd-{id}.md` 是否存在？
  - **否** → 终止：「缺少 PRD，请先执行 /prd，或粘贴 PRD 内容。」
- Coding Plan `references/coding-plan-{id}.md` 是否存在？
  - **否** → 终止：「缺少 Coding Plan，请先执行 /plan，或粘贴 Coding Plan 内容。」

### 执行步骤

1. 从 PRD 验收标准和 Coding Plan 接口定义推导测试用例，覆盖：

- **正向路径**：每条验收标准（AC-xx）对应至少一个通过用例
- **边界场景**：边界值、最大/最小数据量、空值、极值
- **异常路径**：错误输入、非法操作、依赖失败——预期结果为业务提示或静默处理，**不得导致程序报错中断**
- **回归用例**：已有功能关键路径，确保新实现不破坏旧功能
- **冒烟测试（所有交付必须包含）**：针对本次实现/修改所涉及的功能块，设计能快速验证"基本功能可用、业务主流程能走通"的测试用例，不求覆盖全部边界，但须覆盖每个受影响功能块的核心路径。**新功能**需覆盖该功能从入口到结果的主干流程；**改动已有代码**时额外覆盖已有功能的关键路径（防止回归）。测试执行应在实现完成后立即进行，作为上线前最低门槛验证。

**测试层级分类**：

| 层级         | 定义                              | 特点                     | 适用场景                     |
| ------------ | --------------------------------- | ------------------------ | ---------------------------- |
| **单元测试** | 测试单个函数/组件，不依赖外部系统 | 执行快、隔离性强、易调试 | 工具函数、纯逻辑、组件渲染   |
| **集成测试** | 测试模块间交互，可依赖 Mock 服务  | 验证接口契约、数据流     | API 调用、状态管理、组件交互 |
| **E2E 测试** | 测试完整用户流程，需要真实浏览器  | 最接近用户行为、执行慢   | 关键业务流程、跨页面操作     |

**自动化优先级**：

| 优先级 | 定义       | 适用场景                             |
| ------ | ---------- | ------------------------------------ |
| **高** | 必须自动化 | 核心业务逻辑、高频使用路径、回归必测 |
| **中** | 建议自动化 | 重要功能、边界场景、偶发 bug         |
| **低** | 可手动测试 | 边缘场景、视觉验证、探索性测试       |

产出格式：

```
# Test Plan: {id}

## 测试策略
- 测试框架：（根据项目类型选择）
- 测试层级分布：单元 X% / 集成 Y% / E2E Z%
- 自动化目标：高优先级用例 100% 自动化

## 测试用例

| 用例ID | 类型 | 测试层级 | 前置条件 | 操作步骤 | 预期结果 | 关联AC  | 自动化优先级 |
| ------ | ---- | -------- | -------- | -------- | -------- | ------- | ------------ |
| TC-01  | 正向 | 单元     | ...      | ...      | ...      | AC-01-1 | 高           |
| TC-02  | 正向 | 集成     | ...      | ...      | ...      | AC-01-2 | 高           |
| TC-03  | 正向 | E2E      | ...      | ...      | ...      | AC-01-1 | 中           |
| TC-04  | 边界 | 单元     | ...      | ...      | ...      | -       | 高           |
| TC-05  | 异常 | 单元     | ...      | ...      | ...      | -       | 高           |
| TC-06  | 异常 | 集成     | ...      | ...      | ...      | -       | 中           |

## 测试数据需求
（列出需要准备的 Mock 数据、测试账号、测试数据集）

## E2E 测试场景（如有）

按以下格式逐场景描述，每个场景对应一段完整的用户操作链路：

| 场景ID | 场景名称 | 入口页面 | 操作步骤 | 预期结果 | 录制建议 |
| ------ | -------- | -------- | -------- | -------- | -------- |
| E2E-01 | 用户注册并完成首次登录 | /register | 1.填写信息 2.提交 3.跳转登录页 4.登录 | 进入首页且显示欢迎语 | 录制完整流程 |

- **操作步骤须模拟真实用户行为**：点击、输入、等待响应，不得跳过交互细节
- **录制建议**：标注"录制完整流程"的场景应使用 Playwright 的 `page.video` 或 `--trace on` 捕获交互录屏，保存至 `test-results/traces/`，以便复现和归档
```

2. 保存至 `references/test-plan-{id}.md`，呈现给用户确认。
3. 通过后进入下一工作流程状态并同步修改`references/workflow-state.json`

---

## /setup-test — 测试框架配置

### 前置检查

- Coding Plan `references/coding-plan-{id}.md` 是否存在？
  - **否** → 终止：「缺少 Coding Plan，请先执行 /plan。」

### 执行步骤

**Step 1 — 识别项目类型和已有测试框架**

扫描项目根目录，识别：

- **项目类型**：
  - 前端 React：检查 `package.json` 中是否有 react 依赖
  - 前端 Vue：检查 `package.json` 中是否有 vue 依赖
  - 后端 Node：检查 `package.json` 中是否有 express/koa/nest 等
  - 后端 Python：检查 `requirements.txt` 或 `pyproject.toml`
  - 后端 Go：检查 `go.mod`

- **已有测试框架**：
  - 检查 `package.json` 中的 devDependencies
  - 检查是否存在 `jest.config.js`、`vitest.config.ts`、`playwright.config.ts` 等

**Step 2 — 选择测试框架**
如果已存在测试框架，则跳过此步骤。
如果不存在已安装、已配置的测试框架，参考 `references/test-frameworks.md`，请根据项目类型和已有配置选择测试框架。
 
**Step 3 — 创建环境分层配置**
如果已存在环境分层配置，则跳过此步骤。
如果不存在环境分层配置，请生成以下文件，确保测试环境与生产环境严格隔离：

**环境变量模板**（提交到版本控制，`.env.example`）：
```
NODE_ENV=
API_BASE_URL=
DATABASE_URL=
```

**测试环境变量**（不提交，`.env.test`）：
```
NODE_ENV=test
API_BASE_URL=http://localhost:{port}/mock
```

**Mock 策略约束**（写入 `tests/mocks/README.md`）：

| 测试层级 | Mock 策略    | 说明                                                                       |
| -------- | ------------ | -------------------------------------------------------------------------- |
| 单元测试 | 完全 Mock    | 所有外部依赖均用 `vi.mock` / `jest.mock` 替代，禁止真实网络请求            |
| 集成测试 | 契约测试优先 | 用 MSW 等工具基于接口契约生成 Mock Server；契约文件存放 `tests/contracts/` |
| E2E 测试 | 真实服务     | 指向 staging 环境或本地启动的真实服务，不使用 Mock                         |

> 禁止在集成测试中直接依赖生产 API 或真实数据库，所有外部服务必须通过契约或 staging 隔离。

**Step 4 — 创建测试目录结构**

如不存在测试目录结构，或不符合以下结构，则创建或补全如下目录结构：

```
project/
├── src/
├── tests/
│   ├── unit/              # 单元测试
│   │   └── *.test.ts
│   ├── integration/       # 集成测试
│   │   └── *.test.ts
│   ├── e2e/               # E2E 测试
│   │   └── *.spec.ts
│   ├── fixtures/          # 测试数据
│   │   └── *.json
│   └── mocks/             # Mock 文件
│       └── *.ts
├── test-setup.ts          # 测试环境配置
└── test-utils.ts          # 测试工具函数
```

**Step 5 — 添加测试脚本**

在 `package.json` 中添加测试指令。
注意，必须根据测试配置来添加测试指令。
必须能通过测试指令完成所有已有的测试代码

**Step 6 — 输出配置总结**

按以下这个例子的格式输出配置总结：
```
# 测试框架配置完成

## 已安装依赖
- vitest: 单元测试框架
- @testing-library/react: 组件测试工具
- @playwright/test: E2E 测试框架

## 配置文件
- vitest.config.ts
- playwright.config.ts
- test-setup.ts

## 测试脚本
- npm test: 执行单元测试
- npm run test:e2e: 执行 E2E 测试
 
```
**step 7：用户确认与后续动作**
用户确认通过后进入下一工作流程状态并同步修改`references/workflow-state.json`

---

## /gen-test — 测试代码生成

### 前置检查

- Test Plan `references/test-plan-{id}.md` 是否存在？
  - **否** → 终止：「缺少 Test Plan，请先执行 /test-plan。」
- 测试框架是否已配置？
  - **否** → 终止：「测试框架未配置，请先执行 /setup-test。」
- Coding Plan `references/coding-plan-{id}.md` 是否存在？
  - **否** → 终止：「缺少 Coding Plan，请先执行 /plan。」

### 执行步骤

**Step 1 — 读取输入文档**

1. 读取 `references/test-plan-{id}.md` 获取测试用例定义
2. 读取 `references/coding-plan-{id}.md` 获取接口定义
3. 读取已有实现代码（如有），理解代码结构

**Step 2 — 按测试层级生成测试代码**

参考 `references/test-frameworks.md`，按照step1对已实现代码或者是coding-pan与test-plan的理解建设测试代码

**Step 3 — 生成测试数据**

根据 Coding Plan 中的数据结构定义，生成 Mock 数据：

```typescript
// tests/fixtures/mockData.ts
export const mockUser = {
  id: '1',
  name: '测试用户',
  email: 'test@example.com'
}

export const mockTodoList = [
  { id: '1', title: '待办事项 1', completed: false },
  { id: '2', title: '待办事项 2', completed: true }
]
```

**Step 4 — 生成测试工具函数**

```typescript
// tests/test-utils.ts
import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'

const AllProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    // 包装全局 Provider
    <>{children}</>
  )
}

export const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options })
```

**Step 5 — 保存测试文件**

按层级保存到对应目录：
- 单元测试 → `tests/unit/`
- 集成测试 → `tests/integration/`
- E2E 测试 → `tests/e2e/`
- 测试数据 → `tests/fixtures/`
- Mock 文件 → `tests/mocks/`

**Step 6 — 输出生成结果**

```
# 测试代码生成完成

## 生成的测试文件
- tests/unit/utils.test.ts (5 个用例)
- tests/integration/TodoList.test.tsx (8 个用例)
- tests/e2e/user-flow.spec.ts (3 个用例)

## 测试数据
- tests/fixtures/mockData.ts

## 覆盖的测试用例
- TC-01 ~ TC-16 (共 16 个)
 
```


**step 7：用户确认与后续动作**
用户确认通过后进入下一工作流程状态并同步修改`references/workflow-state.json`

---
 

## /implement — 实现代码 + 编译循环

### 前置检查

- Coding Plan `references/coding-plan-{id}.md` 是否存在？
  - **否** → 终止：「缺少 Coding Plan，请先执行 /plan，或粘贴 Coding Plan 内容。」
- Test Plan `references/test-plan-{id}.md` 是否存在？
  - **否** → 终止：「缺少 Test Plan。TDD 要求测试先于实现存在，请先执行 /test-plan。」
- 测试代码是否存在于项目测试目录 `tests/`？
  - **否** → 终止：「测试代码尚未就绪，请先完成测试代码编写（红阶段），确认测试可运行后再实现。」

### 执行模式：Agent Loop（非线性步骤）

**注意**：本阶段是 agent loop，不是预定义的线性步骤。Agent 根据每轮的环境反馈自主决定下一步动作，直到目标达成或退出条件触发。

#### 目标

实现代码满足以下条件后退出：
- Coding Plan `references/coding-plan-{id}.md` 中定义的所有接口/模块已实现
- 编译/构建通过（无错误，无 type error）
- 实现遵循 `references/coding-constraints.md` 的全部生码约束

#### 可用工具

Agent 在循环中可调用以下工具，每轮根据情况选择：
- **代码读写**：read_file、write_file、str_replace
- **编译/构建**：run_build（如 `pnpm build` / `tsc --noEmit`）
- **依赖查询**：search_docs、list_dependencies
- **运行时验证**（可选）：调用 `browser-eyes-mcp` 的 `getConsoleErrors`，仅当本地 dev server 已启动且 agent 怀疑某个修改会引发运行时问题时使用——此工具不替代编译检查

#### 决策原则

每一轮迭代,agent 应明确以下三件事并记录在内部推理中:

1. **当前观察**：刚才的工具调用返回了什么?编译报错了吗?报了什么错?
2. **根因假设**：为什么会出现这个问题?是类型错误、引用缺失、还是逻辑错误?
3. **下一步动作**：基于假设,这一轮要执行哪个工具调用?预期产生什么变化?

修复时优先级:阻塞性错误(编译失败) > 类型错误 > 警告。

#### 强制约束

- **不得通过删减功能换取编译通过**。如果某个功能确实无法实现,必须暂停并向用户说明,不得擅自删除。
- **每轮决策必须有依据**:不允许"试一下看会不会好"式的盲改。每次修改必须基于明确的根因假设。
- **遇到逻辑冲突时暂停**:如果 agent 发现 Coding Plan 与 PRD 矛盾,或某个需求在技术上无法实现,立即暂停,向用户说明并等待裁决。

#### 退出条件

Agent 在以下任一条件下退出循环:

- **达成**:编译通过 + 所有 Coding Plan 模块已实现 → 进入下一阶段(`/test`)
- **僵局**:同一个错误连续 3 轮无进展 → 暂停,向用户说明已尝试的方案和卡点,等待人工介入
- **冲突**:检测到逻辑冲突(同上) → 暂停问用户
- **预算**:总迭代轮次超过 20 → 暂停,提示可能任务规模超预期,需要拆分

#### 完成后

退出循环后,Agent 必须:
1. 汇报本次实现的代码模块清单(文件路径 + 简要说明)
2. 汇报循环统计(总轮次、主要错误类型分布)
3. 同步更新 `references/workflow-state.json`,`currentStage` 设为 `implement`,`completedStages` 追加 `implement`
---

## /test — 测试-修复循环

### 前置检查

- 测试代码是否存在于项目测试目录 `tests/`？
  - **否** → 终止：「未找到测试脚本，请先完成测试代码编写。」
- 实现代码是否已写出且编译通过？（检查`references/workflow-state.json`）
  - **否** → 终止：「实现代码尚未就绪或编译未通过，请先完成 /implement。」

### 执行模式：Agent Loop（非线性步骤）

**注意**：本阶段是 agent loop。Agent 在每一轮中观察环境(单元测试 + 集成测试 + E2E + 浏览器运行时观测)、推理根因、采取修复动作,直到目标达成或退出条件触发。本阶段是 vibe-delivery 中环境反馈最丰富的阶段。

#### 目标

测试通过且无运行时盲点。具体定义如下,**全部满足才能进入 `/ship`**:

1. 单元测试 + 集成测试 + E2E 测试 全部通过
2. (如部署 URL 已提供)`browser-eyes-mcp.getConsoleErrors` 返回的 critical errors 数为 0
3. 测试报告 `references/test-report-{id}-round{N}.md` 已生成且记录了全部环境反馈

#### 可用工具

每一轮 agent 根据当前情况选择性调用:

**测试工具**(必用):
- `run_unit_tests` — 执行 `package.json` 中配置的单元测试命令
- `run_integration_tests` — 执行集成测试
- `run_e2e_tests` — 执行 E2E 测试(如有)

**运行时观测**(关键!这是与传统 `/test` 阶段的核心区别):
- `browser-eyes-mcp.getConsoleErrors(url, waitMs?, includeWarnings?, maxTokens?)` — 观测部署应用的 console errors
- (后续可用)`browser-eyes-mcp.getNetworkRequests`、`getDOMSnapshot`、`getPerfMetrics`

**修复工具**:
- read_file、write_file、str_replace、run_build

#### 决策原则

每一轮迭代,agent 必须明确以下五件事并记录到本轮测试报告中:

1. **本轮观察**: 跑了哪些工具?各自返回了什么?
2. **失败汇总**: 单元/集成/E2E/运行时观测各自暴露了什么问题?
3. **根因假设**: 这些失败之间有没有共同根因?(例如同一个 API mock 错误导致 5 个测试失败 + console 报错)
4. **修复优先级**: 阻塞性错误 > 真实业务 bug > UI 文案不一致
5. **下一步动作**: 这一轮要修哪个文件?预期下一轮哪些测试应该转绿?

#### 关键洞察:为什么需要运行时观测

传统的 `/test` 阶段只看测试输出,会漏掉以下问题:

- **静默 console error**: 组件渲染了,测试断言通过了,但 useEffect 里抛了未捕获错误
- **API 调用失败但 UI 不报错**: 网络请求 500,组件 fallback 显示"加载中",测试不知道
- **第三方脚本异常**: 埋点 SDK、广告 SDK、监控 SDK 的运行时错误

**调用 browser-eyes-mcp 的判断标准**: 任何用户可以在浏览器中触达的功能,在跑完单元/E2E 测试后,都应该至少跑一次 `getConsoleErrors` 检查。

#### 强制约束

- **不得通过删减测试或功能换取通过**。如果某个测试用例确实有问题(测试本身写错了),修复测试代码,但要在测试报告中明确说明。
- **运行时观测的 errors 不能被忽略**。即使所有单元测试通过,只要 `getConsoleErrors` 返回 critical error,本轮就不算通过。
- **每轮必须生成测试报告**。失败时记录失败详情,通过时记录"全部通过"的最终报告。
- **逻辑冲突时暂停**。

#### 退出条件

- **达成**: 全部测试通过 + 运行时观测无 critical error → 进入 `/ship`
- **僵局**: 同一组失败连续 3 轮无进展 → 暂停,在测试报告中说明卡点和已尝试方案
- **冲突**: 测试预期与 PRD 矛盾、或测试本身设计有问题 → 暂停问用户
- **预算**: 测试-修复循环总轮次超过 10 → 暂停,提示可能存在更深的设计问题

#### 测试报告格式

每轮结束后保存至 `references/test-report-{id}-round{N}.md`:

```markdown
# 测试报告: {id} Round {N}

## 本轮工具调用
- run_unit_tests: 通过 X / 失败 Y
- run_integration_tests: 通过 X / 失败 Y
- run_e2e_tests: 通过 X / 失败 Y
- browser-eyes-mcp.getConsoleErrors(url={deployedUrl}):
  - totalErrors: N
  - uniqueErrors:
    | 错误信息 | 来源 | 频次 |
    | --- | --- | --- |
    | ... | ... | ... |

## 失败 Case 详情
(单元/集成/E2E 失败用例,与原版格式一致,略)

## 运行时观测发现
(列出 browser-eyes-mcp 报告的 console error,即使单元测试都通过)

## 根因分析
(本轮 agent 对失败原因的判断)

## 本轮修复动作
(实际修改了哪些文件,为什么)

## 下一轮预期
(预期下一轮哪些失败会转绿,哪些可能还需要进一步修复)
```

#### 完成后

最后一轮全部通过后:
1. 在 `references/workflow-state.json` 中标记 `currentStage: test`,`completedStages` 追加 `test`
2. 提示用户可执行 `/ship`
## /ship — 交付收尾

### 前置检查

- `references/` 中是否存在测试报告，且最后一轮全部通过？(`references/test-report-{id}-round{N}.md`)
  - **否** → 终止：「未检测到全量测试通过的测试报告，请先完成 /test 直到所有 case 通过。」

### 执行步骤

1. **更新业务说明文档**：将本次实现的新功能、业务规则变更整合进项目业务文档（若无则新建）
2. **更新编码指导文档**：本次引入的新编码风格、配置项、依赖使用方式同步更新（若无则新建）
3. **归档过程文档**：将 `references/` 下的 coding-plan、test-plan、test-report 等过程文件移至 `references/archive/{id}/`
4. 输出交付总结，保存为`references/archive/{id}/交付总结.md`，使用以下格式：

```
# 交付总结: {id}

## 原始任务
（对用户要求的理解）

## 交付功能
（本次实现的功能列表，对应 PRD 中的用户故事）

## 测试覆盖
- 测试用例总数：X 个（正向 X / 边界 X / 异常 X）
- 全部通过于 Round N

## 文档更新
- 业务文档：（更新了哪些内容）
- 编码指导：（新增了哪些约定）
```

交付完成。
