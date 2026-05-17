---
name: vibe-delivery
description: 端到端交付级代码生成工作流，将需求转化为经过测试与审核的可交付代码。包含 PRD Author Subagent 与 4 个强制 Review 节点。当用户输入 /prd、/draft-prd、/prototype、/plan、/test-plan、/setup-test、/gen-test、/implement、/test、/ship、/review-prd、/review-plan、/review-test-plan、/review-implement、/verify-manual、/skip-review 等指令时立即触发。当用户表达"帮我做个 app/功能/系统/页面"、"用生码 skill 做 xxx"、"从 xxx 需求写代码"、"实现 xxxx 功能/交互/效果"、"做技术方案/coding plan"、"修复 xxx"、"有 xxx 问题"、"帮我写 PRD" 等意图时也应触发。每个指令对应独立工作阶段，支持完整流水线顺序执行或单阶段独立调用。
---

# Vibe Delivery — 端到端交付工作流

代码交付流水线。每个**生产阶段**产出正式文档驱动下一阶段，每个生产阶段**完成后必须经过对应 Review 节点**才能继续。Review 节点识别的手动操作项必须被完成才能解除阻塞。用户采纳开发方案后先写测试再写实现，确保交付代码符合业务标准、可维护、具有健壮性。

## 核心机制

1. **PRD Author 阶段**：通过 `/draft-prd` 将自然语言需求草稿转为规范 PRD
2. **4 个强制 Review 节点**：每个生产阶段后必须经过 review 才能进入下一阶段
3. **Workflow State 含 reviews 字段**：记录每轮 review 结果与手动操作项
4. **`/verify-manual` 指令**：用户完成手动操作项后通过此指令解除阻塞
5. **`/skip-review` 指令**：紧急或个人项目场景下允许显式跳过 review（必须提供理由，留痕到 workflow-state）
6. **Reviewer 通过 task tool 起独立 subagent**：确保审核独立性，避免 self-evaluation bias
7. **PRD 严禁内容**：PRD 不允许包含 Implementation Phasing / 时间预算 / 具体步骤拆分（这些属于 /plan 阶段产出）

---

## 指令总览

### 生产阶段指令

| 指令          | 阶段            | 核心产出                                 | 前置条件                                                                                            | 合法的下一步执行                 |
| ------------- | --------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------- |
| `/draft-prd`  | PRD 草拟        | `references/prd-{id}.md`（草稿）         | 用户自然语言需求描述                                                                                | 必须执行 `/review-prd`           |
| `/prd`        | 需求规格        | `references/prd-{id}.md`                 | 用户需求描述                                                                                        | 必须执行 `/review-prd`           |
| `/prototype`  | 交互原型        | `references/interaction-prototype-{id}/` | PRD 已通过 review                                                                                   | 建议执行 `/plan`                 |
| `/plan`       | 技术方案        | `references/coding-plan-{id}.md`         | PRD 已通过 review                                                                                   | 必须执行 `/review-plan`          |
| `/test-plan`  | 测试规格        | `references/test-plan-{id}.md`           | PRD 已通过 review + Coding Plan 已通过 review                                                       | 必须执行 `/review-test-plan`     |
| `/setup-test` | 测试框架配置    | 测试框架 + 配置文件 + 测试目录结构       | Test Plan 已通过 review                                                                             | 建议执行 `/gen-test`             |
| `/gen-test`   | 测试代码生成    | `tests/` 目录下的测试文件                | Test Plan 已通过 review + 测试依赖框架与配置存在                                                    | 建议执行 `/implement`            |
| `/implement`  | 实现 + 编译循环 | 编译通过的实现代码                       | Coding Plan 已通过 review + Test Plan 已通过 review + 测试代码存在                                  | 必须执行 `/review-implement`     |
| `/test`       | 测试-修复循环   | 全量通过的测试报告                       | Implement 已通过 review + 测试代码 + 实现代码存在                                                   | 建议执行 `/ship`                 |
| `/ship`       | 交付收尾        | 更新后的业务文档与编码指导文档           | `references/test-report-{id}-round{N}.md`（最后一轮测试全部通过）                                   | 交付完成                         |

### Review 与验证指令

| 指令                  | 用途                                          | 前置条件                                          |
| --------------------- | --------------------------------------------- | ------------------------------------------------- |
| `/review-prd`         | 审核 PRD 质量与规范性                         | `references/prd-{id}.md` 存在                     |
| `/review-plan`        | 审核 Coding Plan 与 PRD 对齐                  | `references/coding-plan-{id}.md` 存在             |
| `/review-test-plan`   | 审核 Test Plan 对 AC 覆盖度                   | `references/test-plan-{id}.md` 存在               |
| `/review-implement`   | 审核实现代码与 PRD/Plan 对齐                  | `/implement` 阶段已退出循环                       |
| `/verify-manual {id}` | 标记某个手动操作项为已完成，解除对应阶段阻塞  | 该 manual action item 存在于 workflow-state.json  |
| `/skip-review {stage} --reason "{reason}"` | 显式跳过某阶段 review，必须提供理由，会留痕 | 该阶段的产出物存在 + 用户提供 reason 字段           |

---

## 工作流编排

### 完整工作流总览

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    完整交付工作流                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  原始需求草稿                                                              │
│     ↓                                                                    │
│  1. /draft-prd (可选) → references/prd-{id}.md                             │
│     ↓                                                                    │
│  2. /review-prd ──┬─ verdict=fail → 回到 /prd 修改 → 再次 /review-prd      │
│                   ├─ Manual items pending → /verify-manual                │
│                   └─ verdict=pass + no pending → 继续                      │
│     ↓                                                                    │
│  3. /prototype (可选)                                                     │
│     ↓                                                                    │
│  4. /plan → references/coding-plan-{id}.md                                │
│     ↓                                                                    │
│  5. /review-plan ──┬─ verdict=fail → 回到 /plan 修改 → 再次 /review-plan   │
│                    ├─ Manual items pending → /verify-manual                │
│                    └─ verdict=pass + no pending → 继续                     │
│     ↓                                                                    │
│  6. /test-plan → references/test-plan-{id}.md                             │
│     ↓                                                                    │
│  7. /review-test-plan ──┬─ verdict=fail → 回到 /test-plan 修改             │
│                          ├─ Manual items pending → /verify-manual           │
│                          └─ verdict=pass + no pending → 继续                │
│     ↓                                                                    │
│  8. /setup-test → 测试框架配置                                              │
│     ↓                                                                    │
│  9. /gen-test → tests/ 目录下的测试文件                                     │
│     ↓                                                                    │
│ 10. /implement → 编译通过的实现代码                                          │
│     ↓                                                                    │
│ 11. /review-implement ──┬─ verdict=fail → 回到 /implement 修改             │
│                          ├─ Manual items pending → /verify-manual           │
│                          └─ verdict=pass + no pending → 继续                │
│     ↓                                                                    │
│ 12. /test → 测试报告                                                       │
│     ↓                                                                    │
│ 13. /ship → 交付完成                                                       │
│                                                                          │
│  任意 review 节点可通过 /skip-review {stage} --reason "..." 显式跳过         │
│  跳过会留痕到 workflow-state.reviews[stage].skipped = true                  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**执行规则**：

- **意图识别匹配阶段**：识别用户意图，用户可以从中间某个阶段开始，则直接进入对应阶段进行前置检查、执行、输出
- **顺序执行**：每个阶段完成后，自动进入下一阶段（包括 review 节点）
- **Review 强制**：生产阶段（`/prd` / `/plan` / `/test-plan` / `/implement`）完成后**必须经过对应 review** 才能继续（除非显式 `/skip-review`）
- **Manual Items 阻塞**：review 识别的 manual_action_items 状态为 `pending` 时，对应 blocksStage 的下一阶段无法进入
- **Review fail 回路**：review verdict 为 fail 时，currentStage 回到对应生产阶段，用户修改后可再次执行 review
- **用户确认**：每个阶段产出后，呈现结果并等待用户确认
- **遇阻必问**：逻辑冲突或业务无法闭环时，暂停并询问用户
- **状态恢复**：支持从任意阶段恢复执行

### 单阶段独立调用

当用户明确指定某个指令时，只执行该阶段，但**前置检查仍然包括上轮 review 状态校验**。

### 强制执行规则（所有指令共同适用）

执行任何指令的**第一步**，必须按顺序完成以下检查。**状态校验失败则立即终止，输出标准错误提示，不得继续执行任何后续步骤**：

#### 检查 1：读取 workflow-state.json

- **文件存在**：加载状态，进入检查 2
- **文件不存在**：扫描 `references/` 目录，查找未归档的工作流产物：
  - 若发现 `prd-*.md`、`coding-plan-*.md`、`test-plan-*.md` 等文件，推断最后到达的阶段，询问用户是否从中断处继续
  - 若未发现任何工作流产物，初始化为：
    ```json
    {
      "taskId": "",
      "currentStage": "init",
      "completedStages": [],
      "documents": {},
      "reviews": {},
      "lastUpdated": "<当前 ISO 时间戳>"
    }
    ```

#### 检查 2：中断恢复检查

若 workflow-state.json 存在，且 `currentStage` 不为 `completed`，则展示中断任务信息并询问用户意图。

#### 检查 3：Review 阻塞检查（关键）

**对所有非 review、非 skip-review、非 verify-manual 类指令**，遍历 workflow-state.json 的 `reviews` 字段：

```
对 reviews 中每一条 ReviewRecord:
  对该记录的每个 manualActionItem:
    if (item.status === "pending" && item.blocksStage === 当前指令):
      ❌ 中断执行
      输出格式见下方
```

**中断输出格式**（严格使用）：

```
❌ 无法执行 /{指令}

阻塞原因：上一轮 review 识别的手动操作项尚未完成，无法进入本阶段。

待完成的手动操作项：
1. [{item.id}] {item.description}
   来源：{对应 review 阶段}
   阻塞阶段：{item.blocksStage}
   {若有 verification 字段}：自动验证类型 = {item.verification.type}

2. [{item.id}] ...

请完成以上操作后：
- 自动验证：执行 /verify-manual {item.id}
- 手动标记：编辑 references/workflow-state.json，将对应 manualActionItem 的 status 改为 "completed"
```

#### 检查 4：validTransitions 检查

检查目标指令是否在当前阶段的合法转换列表中（详见下方 validTransitions 表）。

#### 检查 5：前置文件检查

检查该指令所需的 `requiredInputs` 是否全部存在于 `references/` 目录中。

**状态转换失败的输出格式**（严格使用此格式）：

```
❌ 无法执行 /{指令}

当前状态：{currentState}
缺少前置条件：{具体缺失项}
建议：{下一步指令提示}
```

每个指令执行**完成后**，必须更新 `workflow-state.json` 的 `currentStage` 与 `completedStages`，再输出结果。

---

### workflow-state.json Schema

```typescript
interface WorkflowState {
  taskId: string;
  currentStage: string;
  completedStages: string[];
  documents: Record<string, string>;
  reviews: Record<string, ReviewRecord>;
  lastUpdated: string;
}

interface ReviewRecord {
  verdict: "pass" | "fail" | "pending" | "skipped";  // skipped 表示用户 /skip-review
  reviewedAt: string;  // ISO timestamp
  manualActionItems: ManualActionItem[];
  reviewerNotes: string;
  iteration: number;  // 本阶段是第几次 review（1 起步，重做时递增）
  previousVerdicts?: Array<{   // 历次 fail 记录,便于追溯
    verdict: "fail";
    reviewedAt: string;
    summary: string;
  }>;
  skipReason?: string;  // verdict === "skipped" 时的理由（必填）
  skippedAt?: string;
}

interface ManualActionItem {
  id: string;  // 格式: "manual-{stage}-{seq}", 例 "manual-plan-1"
  description: string;
  status: "pending" | "completed" | "dismissed";  // dismissed 表示用户撤销该项
  blocksStage: string;  // 阻塞哪个阶段
  createdAt: string;
  completedAt?: string;
  dismissedAt?: string;
  dismissalReason?: string;
  verification?: VerificationRule;  // 自动验证规则
}

interface VerificationRule {
  type: "env_var" | "file_exists" | "dir_exists" | "command" | "manual_only";
  envVar?: string;          // type === "env_var": 检查变量名
  path?: string;            // type === "file_exists" / "dir_exists": 检查路径
  command?: string;         // type === "command": 执行的检查命令
  expectExitCode?: number;  // type === "command": 期望退出码（默认 0）
}
```

**verification 字段使用规约**：

| type | 用途 | 必填字段 | /verify-manual 行为 |
|---|---|---|---|
| `env_var` | 检查环境变量是否配置 | `envVar` | 读 `.env.local`，检查变量存在且非空 |
| `file_exists` | 检查文件是否存在 | `path` | 检查文件路径是否存在 |
| `dir_exists` | 检查目录是否存在 | `path` | 检查目录路径是否存在 |
| `command` | 执行 shell 命令 | `command` | 执行命令，比对 exit code |
| `manual_only` | 无法自动验证 | （无） | 询问用户手动确认 |

**示例 workflow-state.json**：

```json
{
  "taskId": "rag-fix",
  "currentStage": "plan-reviewed",
  "completedStages": ["draft-prd", "prd", "review-prd", "plan", "review-plan"],
  "documents": {
    "prd": "references/prd-rag-fix.md",
    "plan": "references/coding-plan-rag-fix.md"
  },
  "reviews": {
    "prd": {
      "verdict": "pass",
      "reviewedAt": "2026-05-15T20:00:00Z",
      "manualActionItems": [],
      "reviewerNotes": "PRD 结构完整，无严禁章节，所有 FR 都有对应 AC。",
      "iteration": 1
    },
    "plan": {
      "verdict": "pass",
      "reviewedAt": "2026-05-15T21:00:00Z",
      "manualActionItems": [
        {
          "id": "manual-plan-1",
          "description": "申请 DeepSeek API key 并配置 .env.local 中的 DEEPSEEK_API_KEY",
          "status": "pending",
          "blocksStage": "implement",
          "createdAt": "2026-05-15T21:00:00Z",
          "verification": {
            "type": "env_var",
            "envVar": "DEEPSEEK_API_KEY"
          }
        },
        {
          "id": "manual-plan-2",
          "description": "创建 data/knowledge-sources/ 目录",
          "status": "pending",
          "blocksStage": "implement",
          "createdAt": "2026-05-15T21:00:00Z",
          "verification": {
            "type": "dir_exists",
            "path": "data/knowledge-sources/"
          }
        }
      ],
      "reviewerNotes": "Plan 覆盖全部 FR，引入 DeepSeek 作为 judge LLM，需用户先配置 API key。",
      "iteration": 1,
      "previousVerdicts": [
        {
          "verdict": "fail",
          "reviewedAt": "2026-05-15T20:30:00Z",
          "summary": "首轮 review 发现 Plan 引入未授权的 LangChain 依赖,用户已修正"
        }
      ]
    }
  },
  "lastUpdated": "2026-05-15T21:00:00Z"
}
```

---

### validTransitions 表

| 当前状态                 | 可转换到                                          | 必须存在的前置文件                                                  |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------- |
| `init`                   | `draft-prd`, `prd`                                | 用户需求描述                                                        |
| `draft-prd`              | `review-prd`                                      | `references/prd-{id}.md`                                            |
| `prd`                    | `review-prd`                                      | `references/prd-{id}.md`                                            |
| `review-prd`             | `prd-reviewed` (verdict=pass), `prd` (verdict=fail) | -                                                                 |
| `prd-reviewed`           | `prototype`, `plan`, `skip-review`                | review.prd.verdict === "pass" 或 "skipped" + 所有阻塞 manual items 已 completed/dismissed |
| `prototype`              | `plan`                                            | -                                                                   |
| `plan`                   | `review-plan`                                     | `references/coding-plan-{id}.md`                                    |
| `review-plan`            | `plan-reviewed` (pass), `plan` (fail)             | -                                                                   |
| `plan-reviewed`          | `test-plan`, `skip-review`                        | review.plan.verdict === "pass"/"skipped" + manual items 完成        |
| `test-plan`              | `review-test-plan`                                | `references/test-plan-{id}.md`                                      |
| `review-test-plan`       | `test-plan-reviewed` (pass), `test-plan` (fail)   | -                                                                   |
| `test-plan-reviewed`     | `setup-test`, `skip-review`                       | review["test-plan"].verdict === "pass"/"skipped" + manual items 完成|
| `setup-test`             | `gen-test`                                        | -                                                                   |
| `gen-test`               | `implement`                                       | `references/test-plan-{id}.md` + 测试依赖配置                       |
| `implement`              | `review-implement`                                | `references/coding-plan-{id}.md` + `tests/` 下测试文件              |
| `review-implement`       | `implement-reviewed` (pass), `implement` (fail)   | -                                                                   |
| `implement-reviewed`     | `test`, `skip-review`                             | review.implement.verdict === "pass"/"skipped" + manual items 完成   |
| `test`                   | `ship` (全部通过)、`implement` (失败)             | `tests/` 下测试文件                                                 |
| `ship`                   | `completed`                                       | 最后一轮 test report 全部通过                                       |

**Review fail 回退规则**：

当 `/review-{stage}` 执行后 verdict === "fail"，agent 必须：
1. 将 workflow-state.currentStage 设回对应生产阶段（如 `review-plan` fail → 回到 `plan`）
2. 在 ReviewRecord 的 `previousVerdicts` 中追加本次 fail 记录
3. 输出审核报告 + 具体修改建议
4. 用户根据建议修改对应产出物后，可：
   - 直接执行 `/review-{stage}` 重新审核（不需要重跑生产阶段）
   - 若修改幅度大，可重新执行 `/{生产阶段}` 然后再 `/review-{stage}`
5. 再次审核时，ReviewRecord.iteration 递增 1

**Skip 路径规则**：

`/skip-review {stage} --reason "{reason}"` 必须满足：
1. 该阶段的产出物存在（如 skip review-prd 必须 references/prd-{id}.md 存在）
2. 用户必须提供 `--reason` 参数（非空字符串）
3. 执行后该 review 的 verdict 设为 "skipped"，记录 skipReason 与 skippedAt
4. currentStage 直接切到 `{stage}-reviewed`

---

## 全局约定

- **文档存储**：所有过程文档保存至当前项目的 `references/` 目录，不存在则创建
- **任务标识 `{id}`**：由 AI 从需求语义自动生成（kebab-case，2-3 词），与已有任务标识不冲突
- **用户确认**：每个阶段产出后，呈现结果并等待用户确认
- **遇阻必问**：逻辑冲突或业务无法闭环时，停下来与用户确认，不得擅自裁决
- **Review 客观性**：review 节点对产出物质量做客观判断，发现问题必须明确指出，不得为了流程顺畅而放水
- **Manual Items 显式化**：任何需要用户手动配置/实现的事项必须显式列入 manual_action_items，禁止隐含期望

---

## 输入查找规则

执行任何需要已有文档作为输入的指令时，按以下顺序查找：

1. **当前消息中是否内联提供**（用户直接粘贴了内容）
2. **`references/` 目录中是否存在对应文件**（读取并使用）
3. 两者均无 → **终止，给出明确提示**

---

## Reviewer Subagent 调用规范

**所有 `/review-*` 指令的核心执行必须通过 task tool 起独立的 reviewer subagent，不能由当前 agent 直接审核**。

### 为什么必须独立 subagent

1. **避免 self-evaluation bias**：刚完成 /implement 的 agent 转头评判自己写的代码，存在审核放水的认知偏差
2. **避免 context 污染**：写完代码的 agent context 中充斥实现细节，审核时容易被"存在性偏差"带偏（"我都这么实现了，应该没问题"）
3. **审核独立可追溯**：reviewer subagent 是独立的 task 调用，输出可被独立审查

### Subagent 调用步骤

当前 agent 执行 `/review-{stage}` 指令时：

#### Step 1: 准备审核输入

收集如下信息，作为 subagent 的输入参数：

- **审核对象路径列表**：
  - `/review-prd`: `references/prd-{id}.md`
  - `/review-plan`: `references/prd-{id}.md` + `references/coding-plan-{id}.md`
  - `/review-test-plan`: `references/prd-{id}.md` + `references/coding-plan-{id}.md` + `references/test-plan-{id}.md`
  - `/review-implement`: 上述全部 + Coding Plan 中提及的所有代码文件路径

- **审核规范路径**：
  - `/review-prd`: `references/review-rubrics/prd.md`
  - `/review-plan`: `references/review-rubrics/plan.md`
  - `/review-test-plan`: `references/review-rubrics/test-plan.md`
  - `/review-implement`: `references/review-rubrics/implement.md`

- **项目上下文**：当前项目根目录 `CLAUDE.md` 路径（若存在）

#### Step 2: 启动 reviewer subagent

通过 task tool 起一个新 subagent，传入：

**角色定义** (system 部分):

```
你是 vibe-delivery 工作流的 {stage} 阶段 reviewer。你的职责：

1. 严格按 rubric 文件中的所有 check 进行三层（或四层）审核
2. 对每条 check 给出 pass / fail / warning 判定，并提供 PRD 或代码中的具体引用作为证据
3. 识别所有需要用户手动完成的事项，结构化为 ManualActionItem
4. 输出结构化 JSON 审核结果

行为原则：
- 客观：发现问题必须 fail，禁止为流程顺畅而放水
- 具体：每条 check 必须给出具体证据（引用文件路径 + 行号或段落）
- 可执行的修改建议：fail 时必须告诉用户具体怎么改
- 不假装看代码：如果对项目结构不确定，必须在审核报告中说明
```

**任务消息** (user 部分):

```
请审核以下 {stage} 阶段产出物：

审核对象:
{对每个审核对象,提供文件完整内容}

审核规范:
{review-rubrics/{stage}.md 完整内容}

项目上下文 (CLAUDE.md):
{若存在,提供 CLAUDE.md 内容}

输出要求:
请按以下 JSON schema 输出审核结果（不要 markdown 代码块包裹）:

{
  "verdict": "pass" | "fail",
  "layers": {
    "完整性": [
      {"checkId": "1.1", "status": "pass|fail|warning", "evidence": "..."},
      ...
    ],
    "质量": [...],
    "一致性": [...],
    "可测试性": [...]
  },
  "manualActionItems": [
    {
      "id": "manual-{stage}-{seq}",
      "description": "...",
      "blocksStage": "...",
      "verification": {
        "type": "env_var|file_exists|dir_exists|command|manual_only",
        "envVar": "...",
        "path": "...",
        "command": "..."
      }
    }
  ],
  "reviewerNotes": "整体审核观察、给用户的修改建议",
  "summary": "一句话总结"
}
```

#### Step 3: 接收并处理 subagent 输出

当前 agent 接收 reviewer 输出的 JSON 后：

1. **解析 JSON**：使用容错解析（处理可能的 markdown 包裹、前后空白等）
2. **写入 workflow-state.json**：
   - 更新 `reviews.{stage}` 字段
   - 设置 `iteration` （首次为 1，重审时递增）
   - 若是重审且上轮 fail，追加到 `previousVerdicts`
3. **渲染 markdown 报告输出给用户**：将 JSON 渲染为可读的 markdown 审核报告
4. **更新 currentStage**：
   - verdict === "pass" → `{stage}-reviewed`
   - verdict === "fail" → 回退到 `{stage}`（生产阶段）

#### Step 4: 输出下一步提示

根据 verdict 给出下一步建议：

- **pass + 无 pending manual items**：可执行下一阶段指令
- **pass + 有 pending manual items**：列出 pending items，提示 /verify-manual
- **fail**：列出主要问题，提示用户修改对应文档后再执行 `/review-{stage}` 重审

### 调用约束

- **禁止跳过 subagent 直接审核**：即便审核内容很短，也必须走 task tool
- **禁止 reviewer 写入 workflow-state.json**：写入由调用方（当前 agent）完成，reviewer 只输出 JSON
- **禁止 reviewer 执行任何文件修改**：reviewer 只读取与判断，不修改任何文件
- **Subagent 失败处理**：若 task tool 调用失败（超时、JSON 解析失败等），当前 agent 提示用户重试 `/review-{stage}`，不允许跳过

---

# 指令详细规范

## /draft-prd — PRD 草拟

### 触发条件

用户输入：
- `/draft-prd`
- "帮我写 PRD"
- "把这个需求写成 PRD"
- "我有个需求想做成 PRD"
- 用户粘贴一段较长的需求草稿，意图不明确但显然在描述需求

### 前置检查

用户消息中是否包含需求描述？

- **否** → 终止：「请提供需求描述。可以是简短意图也可以是详细草稿，无论格式如何，PRD Author 都会引导你补全细节。」

### 执行步骤

#### Step 1 — 读取 PRD 模板规范

读取 `references/prd-template.md`，理解：
- PRD 必须包含的章节
- PRD **严禁包含的章节**（关键）
- 各章节的写作要求

#### Step 2 — 解析用户需求

理解用户提供的需求草稿，识别：
- 核心业务目标
- 涉及的用户角色
- 关键功能点
- 可能的非功能需求
- 已知的技术约束

#### Step 3 — 主动澄清开放问题

对解析过程中识别出的**模糊点、歧义、未明确事项**，**主动列出开放问题清单**，向用户提问：

```
我从需求中识别了 N 个开放问题，需要您先回答以确保 PRD 不做错误假设：

1. {开放问题 1}
   - 候选方案 A：...
   - 候选方案 B：...
   - 您的选择？

2. {开放问题 2}
   ...
```

**严禁**：对模糊处自动假设并写入 PRD。**遇到模糊必须问，不能猜**。

#### Step 4 — 生成 PRD 草稿

根据用户回答 + 解析结果，按 `references/prd-template.md` 的规范生成 PRD。

**严格遵守**：
- 必须包含的章节都要有
- **严禁章节**绝对不能出现（Implementation Phasing / 时间预算 / 具体执行步骤）
- 每个 FR 必须对应 AC
- Goals 与 Non-Goals 必须对称
- 任何外部依赖必须列入 Dependencies & Risks

#### Step 5 — 保存与确认

- 保存至 `references/prd-{id}.md`
- 呈现给用户确认，根据反馈修改直至通过
- 用户确认后更新 workflow-state.json：
  - `currentStage` → "draft-prd"
  - `completedStages` 追加 "draft-prd"
- 输出："下一步：必须执行 `/review-prd` 对 PRD 进行规范性审核"

---

## /prd — 生成需求规格

### 前置检查

用户消息中是否包含需求描述？

- **否** → 终止：「请提供需求描述，或考虑使用 `/draft-prd` 让 PRD Author 引导生成。」

### 执行步骤

1. 理解用户描述的核心需求，结合业务常识补全细节
2. 读取 `references/prd-template.md`，严格按规范生成 PRD
3. 保存至 `references/prd-{id}.md`
4. 呈现给用户确认，根据反馈修改直至通过
5. 通过后更新 workflow-state.json：
   - `currentStage` → "prd"
   - `completedStages` 追加 "prd"
6. **输出明确提示**："PRD 已生成。下一步：必须执行 `/review-prd` 对 PRD 进行规范性审核。不能跳过 review 直接进入 /plan。"

---

## /review-prd — 审核 PRD

### 触发条件

- `/prd` 或 `/draft-prd` 完成后**自动建议**执行
- 用户主动执行 `/review-prd` 重新审核

### 前置检查

- `references/prd-{id}.md` 是否存在？
  - **否** → 终止：「无 PRD 文件可审核。请先执行 /prd 或 /draft-prd。」

### 执行步骤

按"Reviewer Subagent 调用规范"章节，通过 task tool 起独立 reviewer subagent，输入：

- **审核对象**：`references/prd-{id}.md`
- **审核规范**：`references/review-rubrics/prd.md`
- **项目上下文**：项目根目录 `CLAUDE.md`（若存在）

#### Reviewer subagent 的核心任务

按 `references/review-rubrics/prd.md` 三层审核：

1. **完整性检查**（structural completeness）：必需章节齐全、严禁章节不存在
2. **质量检查**（quality）：AC 可验证性、Goals/Non-Goals 对称、Dependencies 完整、Open Questions 如实列出
3. **一致性检查**（consistency）：与项目 CLAUDE.md 不冲突、Goals 与 FR 对齐、Non-Goals 与 FR 不冲突

每条 rubric 给出 **pass / fail / warning** 判定 + 具体证据（PRD 中的引用）。

#### Manual Action Items 识别

审核过程中，识别**需要用户手动完成才能继续后续阶段的事项**：
- API key 申请（影响 /implement）
- 第三方服务注册（影响 /implement）
- 业务方向需要澄清的开放问题（影响 /plan）
- 数据源准备（影响 /plan 或 /implement）

每个 manual item 必须明确 `id` / `description` / `blocksStage` / `verification` 规则。

#### 当前 agent 处理 subagent 输出

接收 reviewer JSON 后：

1. 写入 `reviews.prd`（含 iteration、previousVerdicts 等字段）
2. 渲染 markdown 审核报告给用户（含 verdict、三层审核详情、manual items、下一步提示）
3. 更新 `currentStage`：
   - verdict === "pass" → `currentStage` → "prd-reviewed"，`completedStages` 追加 "review-prd"
   - verdict === "fail" → `currentStage` → "prd"（回退），不追加 completedStages

---

## /prototype — 生成交互原型

### 前置检查

- PRD `references/prd-{id}.md` 是否存在？
  - **否** → 终止：「缺少 PRD，请先执行 /prd 或 /draft-prd 生成需求规格，或直接粘贴 PRD 内容。」
- **PRD 是否已通过 review**？
  - 检查 `workflow-state.json` 中 `reviews.prd.verdict === "pass"` 或 `"skipped"`
  - 检查 `reviews.prd.manualActionItems` 中所有 blocksStage === "prototype" 或 "plan" 的项 status === "completed" 或 "dismissed"
  - **否** → 终止：「PRD 未通过 review，或仍有阻塞 manual items。请先执行 /review-prd 或 /verify-manual 处理。」
- 用户是否提供了交互风格描述？
  - **否** → 终止：「请描述期望的交互风格，例如：简洁现代、卡片式布局、移动端优先、参考某产品等。」

### 执行步骤

1. 理解 PRD 中的功能需求与用户场景
2. 读取 `references/coding-constraints.md` 中的生码约束（复用优先、模块化、可维护）
3. 直接生成**可运行的前端原型代码**，目标是让用户看到视觉效果与交互方式，**不包含真实业务逻辑与后端对接**（用 mock 数据）
4. 对升级迭代项目：先读取已有代码的组件与样式，在保持原有视觉风格的基础上设计
5. 保存原型代码至 `references/interaction-prototype-{id}/`
6. 告知用户如何运行原型，等待确认；根据反馈修改直至通过
7. 通过后更新 workflow-state.json：
   - `currentStage` → "prototype"
   - `completedStages` 追加 "prototype"

**注意**：prototype 是可选辅助阶段，无独立 review 节点。

---

## /plan — 生成技术方案

### 前置检查

- PRD `references/prd-{id}.md` 是否存在？
  - **否** → 终止：「缺少 PRD，请先执行 /prd 或 /draft-prd，或粘贴 PRD 内容。」
- PRD 已通过 review？
  - 检查 `reviews.prd.verdict === "pass"` 或 `"skipped"`
  - 检查 `reviews.prd.manualActionItems` 中所有 blocksStage === "plan" 的项 status === "completed" 或 "dismissed"
  - **否** → 终止，指引用户处理

### 执行步骤

**Step 1 — 读取约束并理解编码环境**

先读取 `references/coding-constraints.md`（若存在），再扫描当前工作目录，判断项目类型：

- **新项目**（无历史代码）：记录为新项目，技术选型须满足：性能良好、安全可靠、免费低门槛、工程化完善、可维护性高
- **已有项目**：读取已有代码与可能存在的业务说明/编码指导文档，理解：
  - 业务流程与具体逻辑
  - 代码架构、语言环境、依赖配置
  - 编码风格、组件/方法封装习惯
  - 已有可复用模块

**关键约束**：**严禁在 Coding Plan 中沿用 PRD 中可能存在的 Phasing 信息**——若 PRD 越界写了 Implementation Phasing，Plan 必须基于真实代码结构独立设计执行步骤，不得直接复用 PRD 的 Phasing。

**Step 2 — 产出 Coding Plan**，使用以下结构：

```
# Coding Plan: {id}

## 技术选型
（已有项目：说明沿用的技术栈；新项目：列出选型及理由，须满足五项标准）

## 模块拆分
（列出需要新建或修改的模块/组件，各自职责）

## 接口定义
（每个关键函数/API：名称、输入参数、返回值、可能的错误、implRef）
- **名称**: functionName
- **输入**: param: Type
- **输出**: ReturnType
- **错误**: ErrorType（触发条件）
- **implRef**: src/path/to/file.ts#functionName

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
5. 通过后更新 workflow-state.json：
   - `currentStage` → "plan"
   - `completedStages` 追加 "plan"
6. **输出明确提示**："Coding Plan 已生成。下一步：必须执行 `/review-plan`。不能跳过 review 直接进入 /test-plan，除非通过 `/skip-review plan --reason \"...\"` 显式跳过。"

---

## /review-plan — 审核 Coding Plan

### 前置检查

- `references/coding-plan-{id}.md` 是否存在？
  - **否** → 终止：「无 Coding Plan 可审核。请先执行 /plan。」
- `references/prd-{id}.md` 是否存在？
  - **否** → 终止
- workflow-state.json 中 `reviews.prd.verdict === "pass"` 或 `"skipped"`？
  - **否** → 终止：「PRD 尚未通过 review，请先执行 /review-prd。」

### 执行步骤

按照本文档"Reviewer Subagent 调用规范"章节，通过 task tool 起独立 reviewer subagent，输入：

- 审核对象：`references/prd-{id}.md` + `references/coding-plan-{id}.md`
- 审核规范：`references/review-rubrics/plan.md`
- 项目上下文：项目根目录 `CLAUDE.md`（若存在）

subagent 按 rubric 三层审核（完整性 / 质量 / 一致性），返回结构化 JSON。

当前 agent 接收 JSON 后：
1. 写入 `reviews.plan`（含 iteration、previousVerdicts 等字段）
2. 渲染 markdown 报告给用户
3. 若 verdict === "pass"，更新 `currentStage` → "plan-reviewed"
4. 若 verdict === "fail"，回退 `currentStage` → "plan"，提示用户修改

---

## /test-plan — 生成测试规格

### 前置检查

- PRD `references/prd-{id}.md` 已通过 review
- Coding Plan `references/coding-plan-{id}.md` 已通过 review
- 所有阻塞 "test-plan" 的 manual items 已 completed 或 dismissed

### 执行步骤

1. 从 PRD 验收标准和 Coding Plan 接口定义推导测试用例，覆盖：

- **正向路径**：每条验收标准（AC-xx）对应至少一个通过用例
- **边界场景**：边界值、最大/最小数据量、空值、极值
- **异常路径**：错误输入、非法操作、依赖失败——预期结果为业务提示或静默处理，**不得导致程序报错中断**
- **回归用例**：已有功能关键路径
- **冒烟测试**：针对本次实现/修改所涉及的功能块，设计能快速验证"基本功能可用、业务主流程能走通"的测试用例

**测试层级分类**：

| 层级         | 定义                              | 适用场景                     |
| ------------ | --------------------------------- | ---------------------------- |
| **单元测试** | 测试单个函数/组件，不依赖外部系统 | 工具函数、纯逻辑、组件渲染   |
| **集成测试** | 测试模块间交互，可依赖 Mock 服务  | API 调用、状态管理、组件交互 |
| **E2E 测试** | 测试完整用户流程，需要真实浏览器  | 关键业务流程、跨页面操作     |

**自动化优先级**：高（必须自动化） / 中（建议自动化） / 低（可手动测试）

2. 产出格式见下方 sample。保存至 `references/test-plan-{id}.md`
3. 呈现给用户确认
4. 通过后更新 workflow-state.json：
   - `currentStage` → "test-plan"
   - `completedStages` 追加 "test-plan"
5. **输出**："Test Plan 已生成。下一步：必须执行 `/review-test-plan`。"

---

## /review-test-plan — 审核 Test Plan

### 前置检查

- `references/test-plan-{id}.md` 存在
- `references/prd-{id}.md` 存在
- `references/coding-plan-{id}.md` 存在
- reviews.prd.verdict 和 reviews.plan.verdict 都已就绪（pass / skipped）

### 执行步骤

按"Reviewer Subagent 调用规范"，通过 task tool 起 reviewer subagent，输入 PRD + Coding Plan + Test Plan + `references/review-rubrics/test-plan.md`。

接收 JSON 后：
1. 写入 `reviews["test-plan"]`
2. 渲染 markdown 报告
3. 若 pass，`currentStage` → "test-plan-reviewed"
4. 若 fail，`currentStage` → "test-plan"

---

## /setup-test — 测试框架配置

### 前置检查

- Test Plan 已通过 review
- 所有阻塞 "setup-test" 的 manual items 已 completed 或 dismissed

### 执行步骤

**Step 1 — 识别项目类型和已有测试框架**

扫描项目根目录，识别项目类型（前端 React/Vue/后端 Node/Python/Go）与已有测试框架。

**Step 2 — 选择测试框架**

如果已存在测试框架，跳过此步。否则参考 `references/test-frameworks.md` 选择框架。

**Step 3 — 创建环境分层配置**

生成 `.env.example` 模板与 `.env.test`。建立 Mock 策略约束（单元测试完全 Mock / 集成测试契约测试优先 / E2E 真实服务）。

**Step 4 — 创建测试目录结构**

```
project/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── fixtures/
│   └── mocks/
├── test-setup.ts
└── test-utils.ts
```

**Step 5 — 添加测试脚本**

在 `package.json` 中添加测试指令。

**Step 6 — 输出配置总结**

**Step 7 — 用户确认**

通过后更新 workflow-state.json：
- `currentStage` → "setup-test"
- `completedStages` 追加 "setup-test"

---

## /gen-test — 测试代码生成

### 前置检查

- Test Plan 已通过 review
- 测试框架已配置
- Coding Plan 存在

### 执行步骤

**Step 1 — 读取输入文档**

读取 Test Plan + Coding Plan + 已有实现代码（如有）

**Step 2 — 按测试层级生成测试代码**

参考 `references/test-frameworks.md`，按测试用例生成测试文件。

**Step 3 — 生成测试数据**

根据 Coding Plan 中的数据结构定义，生成 Mock 数据到 `tests/fixtures/`

**Step 4 — 生成测试工具函数**

按需在 `tests/test-utils.ts` 生成 wrapper 函数

**Step 5 — 保存测试文件**

按层级保存到对应目录

**Step 6 — 输出生成结果**

汇报生成的测试文件清单与覆盖的测试用例

**Step 7 — 用户确认**

通过后更新 workflow-state.json：
- `currentStage` → "gen-test"
- `completedStages` 追加 "gen-test"

---

## /implement — 实现代码 + 编译循环

### 前置检查

- Coding Plan `references/coding-plan-{id}.md` 已通过 review
- Test Plan `references/test-plan-{id}.md` 已通过 review
- 测试代码存在于 `tests/`
- **所有阻塞 "implement" 的 manual items 已 completed 或 dismissed**（关键）

### 执行模式：Agent Loop

本阶段是 agent loop，不是预定义的线性步骤。Agent 根据每轮的环境反馈自主决定下一步动作，直到目标达成或退出条件触发。

#### 目标

实现代码满足以下条件后退出：
- Coding Plan 中定义的所有接口/模块已实现
- 编译/构建通过（无错误，无 type error）
- 实现遵循 `references/coding-constraints.md` 的全部生码约束

#### 可用工具

- **代码读写**：read_file、write_file、str_replace
- **编译/构建**：run_build（如 `pnpm build` / `tsc --noEmit`）
- **依赖查询**：search_docs、list_dependencies
- **运行时验证**（可选）：浏览器观测 MCP

#### 决策原则

每轮迭代，agent 应明确：
1. **当前观察**：上一次工具调用返回了什么
2. **根因假设**：为什么会出现这个问题
3. **下一步动作**：基于假设这一轮要执行什么

修复优先级：阻塞性错误 > 类型错误 > 警告。

#### 强制约束

- **不得通过删减功能换取编译通过**
- **每轮决策必须有依据**（不允许"试一下看会不会好"）
- **遇到逻辑冲突时暂停**

#### 退出条件

- **达成**：编译通过 + 所有模块已实现 → 进入 `/review-implement`
- **僵局**：同一错误连续 3 轮无进展 → 暂停，等待人工介入
- **冲突**：检测到逻辑冲突 → 暂停问用户
- **预算**：总迭代轮次超过 20 → 暂停

#### 完成后

退出循环后必须：
1. 汇报本次实现的代码模块清单（文件路径 + 简要说明）
2. 汇报循环统计（总轮次、主要错误类型分布）
3. 更新 `references/workflow-state.json`：
   - `currentStage` → "implement"
   - `completedStages` 追加 "implement"
4. **强制输出**："实现代码已完成。下一步：必须执行 `/review-implement`。不能跳过直接 /test，除非通过 `/skip-review implement --reason \"...\"` 显式跳过。"

---

## /review-implement — 审核实现代码（最关键的 Review 节点）

### 前置检查

- `/implement` 阶段已退出循环（workflow-state.currentStage === "implement"）
- Coding Plan + PRD 存在

### 执行步骤

按"Reviewer Subagent 调用规范"章节，通过 task tool 起独立 reviewer subagent，输入：

- **审核对象**：
  - `references/prd-{id}.md`
  - `references/coding-plan-{id}.md`
  - `references/test-plan-{id}.md`
  - Coding Plan 中"文件清单"列出的所有代码文件
- **审核规范**：`references/review-rubrics/implement.md`
- **项目上下文**：项目根目录 `CLAUDE.md`

#### Reviewer subagent 的核心任务

按 `references/review-rubrics/implement.md` 四层审核：

1. **完整性**：所有 FR 都有对应代码、所有 AC 都有实现路径
2. **质量**（最关键的两个检查）：
   - **Check 2.1: Metric 命名与定义一致**——函数/变量命名必须与 PRD 中该术语的定义完全一致。如把 keyword overlap 命名为 Faithfulness 必 fail
   - **Check 2.2: 简化未声明的实现**——任何因技术限制做的简化实现必须在代码或交付报告中显式声明，未声明的简化必 fail
   - 其他：没有 hardcoded 假数据、没有 silent failure
3. **一致性**：实现函数签名与 plan 一致、数据库 schema 与 plan 一致、文件位置符合项目约定
4. **可测试性**：测试覆盖度满足 test-plan、测试可独立运行、assertion 严格度未被放宽

**这是 vibe-delivery 中最关键的 review 节点**——/implement 阶段的 agent loop 容易产生暗自简化、命名误导等问题。本 review 必须严格把关。

#### 当前 agent 处理 subagent 输出

接收 reviewer JSON 后：

1. 写入 `reviews.implement`（含 iteration、previousVerdicts 等字段）
2. 渲染 markdown 审核报告输出给用户
3. 若 verdict === "pass"，`currentStage` → "implement-reviewed"
4. 若 verdict === "fail"，`currentStage` → "implement"，提示用户根据建议修改代码后再次执行 `/review-implement`

---

## /test — 测试-修复循环

### 前置检查

- Implement 已通过 review（`reviews.implement.verdict === "pass"` 或 `"skipped"`）
- 所有阻塞 "test" 的 manual items 已 completed 或 dismissed
- 测试代码存在于 `tests/`
- 实现代码已写出且编译通过（`reviews.implement.verdict !== "pending"`）

### 执行模式：Agent Loop

本阶段是 agent loop。Agent 在每轮中观察环境（单元测试 + 集成测试 + E2E + 浏览器运行时观测）、推理根因、采取修复动作，直到目标达成或退出条件触发。

#### 目标

测试通过且无运行时盲点。**全部满足才能进入 `/ship`**:

1. 单元测试 + 集成测试 + E2E 测试 全部通过
2. （如部署 URL 已提供）浏览器观测工具返回的 critical errors 数为 0
3. 测试报告 `references/test-report-{id}-round{N}.md` 已生成且记录了全部环境反馈

#### 可用工具

- **测试工具**（必用）：`run_unit_tests`、`run_integration_tests`、`run_e2e_tests`
- **运行时观测**（关键）：浏览器观测 MCP 的 `getConsoleErrors`、`getNetworkRequests`、`getDOMSnapshot`、`getPerfMetrics`
- **修复工具**：read_file、write_file、str_replace、run_build

#### 决策原则

每轮迭代记录：
1. 本轮观察（跑了哪些工具，返回什么）
2. 失败汇总（单元/集成/E2E/运行时观测各自暴露的问题）
3. 根因假设（失败是否有共同根因）
4. 修复优先级（阻塞性错误 > 真实业务 bug > UI 文案不一致）
5. 下一步动作

#### 关键洞察：为什么需要运行时观测

传统 `/test` 只看测试输出，会漏掉以下问题：
- **静默 console error**：组件渲染了，测试断言通过了，但 useEffect 里抛了未捕获错误
- **API 调用失败但 UI 不报错**：网络请求 500，组件 fallback 显示"加载中"，测试不知道
- **第三方脚本异常**：埋点 SDK、广告 SDK 的运行时错误

任何用户可在浏览器中触达的功能，跑完测试后至少跑一次 `getConsoleErrors` 检查。

#### 强制约束

- **不得通过删减测试或功能换取通过**
- **运行时观测的 errors 不能被忽略**
- **每轮必须生成测试报告**
- **逻辑冲突时暂停**

#### 退出条件

- **达成**：全部测试通过 + 运行时观测无 critical error → 进入 `/ship`
- **僵局**：同一组失败连续 3 轮无进展 → 暂停
- **冲突**：测试预期与 PRD 矛盾 → 暂停问用户
- **预算**：测试-修复循环总轮次超过 10 → 暂停

#### 测试报告格式

每轮结束后保存至 `references/test-report-{id}-round{N}.md`：

```markdown
# 测试报告: {id} Round {N}

## 本轮工具调用
（测试工具与运行时观测的执行结果）

## 失败 Case 详情
（单元/集成/E2E 失败用例）

## 运行时观测发现
（浏览器观测报告的 console error 等）

## 根因分析
（本轮 agent 对失败原因的判断）

## 本轮修复动作
（实际修改了哪些文件，为什么）

## 下一轮预期
（预期下一轮哪些失败会转绿）
```

#### 完成后

最后一轮全部通过后：
1. 在 `workflow-state.json` 中标记 `currentStage: test`，`completedStages` 追加 "test"
2. 提示用户可执行 `/ship`

---

## /ship — 交付收尾

### 前置检查

- `references/` 中存在测试报告，且最后一轮全部通过（`references/test-report-{id}-round{N}.md`）
  - **否** → 终止：「未检测到全量测试通过的测试报告，请先完成 /test 直到所有 case 通过。」

### 执行步骤

1. **更新业务说明文档**：将本次实现的新功能、业务规则变更整合进项目业务文档（若无则新建）
2. **更新编码指导文档**：本次引入的新编码风格、配置项、依赖使用方式同步更新（若无则新建）
3. **归档过程文档**：将 `references/` 下的 coding-plan、test-plan、test-report 等过程文件移至 `references/archive/{id}/`
4. 输出交付总结，保存为 `references/archive/{id}/交付总结.md`：

```markdown
# 交付总结: {id}

## 原始任务
（对用户要求的理解）

## 交付功能
（本次实现的功能列表，对应 PRD 中的用户故事）

## Review 历史
（各阶段 review 的 verdict 与 manual items 处理情况）

## 测试覆盖
- 测试用例总数：X 个（正向 X / 边界 X / 异常 X）
- 全部通过于 Round N

## 文档更新
- 业务文档：（更新了哪些内容）
- 编码指导：（新增了哪些约定）
```

5. 更新 workflow-state.json：`currentStage` → "completed"

交付完成。

---

## /verify-manual — 手动操作项验证

### 触发条件

- 用户完成某个手动操作项后主动执行
- 命令格式：`/verify-manual {item-id}` 或 `/verify-manual` (列出所有 pending 项让用户选择)

### 前置检查

- workflow-state.json 存在

### 执行步骤

#### 模式 1：无参数调用

列出所有 status === "pending" 的 manual action items：

```
当前 pending 的手动操作项：
1. [manual-plan-1] 申请 DeepSeek API key 并配置 .env.local (blocks: implement)
   验证类型: env_var (DEEPSEEK_API_KEY)
2. [manual-plan-2] 创建 data/knowledge-sources/ 目录并下载 PDF (blocks: implement)
   验证类型: dir_exists (data/knowledge-sources/)

请执行 /verify-manual {item-id} 来标记某项为完成。
```

#### 模式 2：带 item-id 调用

1. 查找 workflow-state.json 中对应 item
2. 若 item 不存在：错误退出
3. 若 item.status === "completed" 或 "dismissed"：提示"该项已是 {status} 状态"
4. **执行自动验证**（基于 `item.verification.type`）：

| verification.type | 验证逻辑 |
|---|---|
| `env_var` | 读取 `.env.local`，检查 `item.verification.envVar` 指定的变量是否存在且非空 |
| `file_exists` | 检查 `item.verification.path` 指定的文件路径是否存在 |
| `dir_exists` | 检查 `item.verification.path` 指定的目录是否存在 |
| `command` | 执行 `item.verification.command`，比对 exit code（默认期望 0，可通过 `expectExitCode` 指定） |
| `manual_only` | 跳过自动验证，直接询问用户是否手动确认完成 |

5. **自动验证通过** → `item.status` = "completed"，`item.completedAt` = 当前时间
6. **自动验证失败** → 输出失败原因，询问用户：
   - "强制标记为 completed（手动覆盖）"
   - "保持 pending 状态，先完成手动操作"
   - "标记为 dismissed（撤销该项，需提供理由）"
7. 输出结果

#### 输出格式（验证通过）

```
✅ Manual action item [manual-plan-1] 已标记为 completed

自动验证：通过
- 类型: env_var
- 检查: DEEPSEEK_API_KEY 在 .env.local 中存在且非空 ✓

剩余 pending items: 1 个
- [manual-plan-2] 创建 data/knowledge-sources/ 目录并下载 PDF (blocks: implement)
```

#### 输出格式（验证失败）

```
⚠️ Manual action item [manual-plan-1] 自动验证未通过

自动验证：失败
- 类型: env_var
- 检查: DEEPSEEK_API_KEY 在 .env.local 中不存在或为空 ✗

请选择处理方式：
1. 完成实际配置后重新执行 /verify-manual manual-plan-1
2. 强制标记为 completed（手动覆盖，慎用）
3. /dismiss-manual manual-plan-1 --reason "..."（撤销该项）
```

---

## /skip-review — 跳过 Review 节点

### 触发条件

用户主动执行 `/skip-review {stage} --reason "{reason}"`

允许的 stage：`prd` / `plan` / `test-plan` / `implement`

### 用途

紧急修补、个人项目、信任高的场景下，允许用户显式跳过某 review 节点。**跳过会留痕到 workflow-state.json 的 reviews 字段**，便于事后追溯。

### 前置检查

- 参数 `stage` 必须是 `prd` / `plan` / `test-plan` / `implement` 之一
  - **否** → 终止：「stage 参数必须是 prd / plan / test-plan / implement 之一」
- `--reason` 参数必须提供且非空
  - **否** → 终止：「必须通过 --reason 提供跳过理由，留痕到 workflow-state」
- 该阶段的产出物必须存在
  - 例如 `/skip-review plan` 时 `references/coding-plan-{id}.md` 必须存在
  - **否** → 终止：「{stage} 阶段的产出物不存在，无可跳过的对象」

### 执行步骤

1. 写入 `reviews.{stage}`：

```json
{
  "verdict": "skipped",
  "reviewedAt": "<当前 ISO>",
  "manualActionItems": [],
  "reviewerNotes": "",
  "iteration": 0,
  "skipReason": "{用户提供的 reason}",
  "skippedAt": "<当前 ISO>"
}
```

2. 更新 `currentStage` → `{stage}-reviewed`
3. 输出确认：

```
⚠️ Review 已跳过

阶段: {stage}
跳过理由: {reason}
时间: <ISO>

注意：跳过 review 意味着该阶段产出物未经过质量审核。建议仅在以下场景使用：
- 紧急修补，事后补审
- 个人项目，自审已完成
- 项目末期，时间紧迫

跳过记录已留痕到 workflow-state.reviews.{stage}.skipped = true，可被事后追溯。

下一步：可执行下一阶段指令。
```

---

## 状态管理与恢复

### 工作流状态记录

每个阶段完成后更新 `references/workflow-state.json`。状态字段含 `currentStage`、`completedStages`、`documents`、`reviews`、`lastUpdated`。

### 从任意阶段恢复

当用户指定从某个阶段开始时：

1. 读取 workflow-state.json
2. 检查前置条件（包括 review 状态、manual items 状态）
3. 满足则继续
4. 不满足则提示需要先完成的事项

### 错误处理与重试

#### 阶段级错误

当某个阶段执行失败时：

```
阶段执行失败
  ↓
判断错误类型：
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

## 关键设计原则

### 1. Review 不可隐式绕过

任何尝试隐式跳过 review 进入下一生产阶段的行为都会被前置检查阻断。这是架构层硬约束，不依赖 agent 自觉。

用户可以**显式跳过**——通过 `/skip-review {stage} --reason "..."`，但跳过会被留痕到 workflow-state.json，便于事后追溯。

### 2. Manual Items 必须显式化

任何 reviewer 识别的"需要用户手动完成"的事项都必须以结构化形式记录在 `manualActionItems`，并附带 `verification` 自动验证规则。禁止用 reviewer notes 文本表达"建议用户做某事"——这种软提示会被忽略。

### 3. PRD Author 不能猜

`/draft-prd` 遇到模糊处必须问用户，禁止自动假设。这是 PRD 质量的源头保证。

### 4. Reviewer 不能给情面

`/review-*` 节点必须客观评判。发现 PRD 与实现不一致、metric 命名误导、简化未声明等问题，必须给 fail，不得为流程顺畅而放水。

### 5. Reviewer 必须通过 task tool 独立执行

所有 `/review-*` 必须通过 task tool 起 subagent 执行，避免 self-evaluation bias 与 context 污染。

### 6. PRD 严禁包含 How

PRD 只描述 WHAT / WHY / CONSTRAINTS，不描述 HOW。Implementation Phasing、时间预算、步骤拆分等 HOW 信息全部放到 /plan 阶段。这通过 `prd-template.md` 与 `/review-prd` 双重保证。

### 7. Review fail 不重置工作流

`/review-{stage}` 输出 verdict === "fail" 时，仅回退 currentStage 到对应生产阶段，**不清空已完成的其他阶段**。用户修改后可直接 `/review-{stage}` 重新审核，不需要重跑生产指令（除非用户主动选择重跑）。

历次 fail 记录追加到 `reviews.{stage}.previousVerdicts`，便于追溯演进。
