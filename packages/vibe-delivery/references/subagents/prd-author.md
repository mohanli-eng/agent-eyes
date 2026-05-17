# PRD Author Subagent 调用规范

适用于 `/draft-prd` 指令。

**核心要求**:`/draft-prd` 的核心工作必须通过 task tool 起独立 subagent 执行,主 agent 仅承担"用户对话中介"与"落盘"职责。

PRD Author 分为两类 subagent:

1. **Clarifier subagent**:循环调用,解析需求 + 识别开放问题,直到无更多问题
2. **Drafter subagent**:一次性调用,基于完整信息生成 PRD

---

## 为什么必须独立 subagent

1. **避免主 agent context 污染需求理解**:主 agent 通常带着大量项目上下文,直接解析需求容易被既有知识带偏,做出错误假设
2. **强制结构化输出**:subagent 角色清晰、输入输出协议明确,比主 agent 顺序执行更稳定
3. **与 Reviewer 同等独立性**:PRD 是工作流的源头产物,质量直接决定下游所有阶段,subagent 化与 Reviewer 对等

---

## 整体执行流程

```
用户输入需求草稿
   ↓
[主 agent] 读取 references/prd-template.md
   ↓
┌─────────── Clarification Loop ───────────┐
│                                          │
│  [主 agent] 准备 Clarifier 输入           │
│     ↓ task tool 调用                     │
│  [Clarifier subagent]                    │
│    输入: 草稿 + 模板 + 历史问答(若有)     │
│    输出 JSON: {                          │
│      parsedRequirement,                  │
│      openQuestions: [...] | []           │
│    }                                     │
│     ↓ 返回                               │
│  [主 agent] 检查 openQuestions:           │
│    - 若空数组 → 退出 loop                 │
│    - 若非空 + 已达上限 N 轮 → 强制退出     │
│    - 若非空 + 未达上限 → 渲染给用户        │
│                                          │
│  [用户回答]                              │
│     ↓                                    │
│  [主 agent] 追加到历史问答,继续 loop      │
│                                          │
└──────────────────────────────────────────┘
   ↓ Loop 结束
[主 agent] 准备 Drafter 输入(含最终 parsedRequirement + 全部历史问答)
   ↓ task tool 调用
[Drafter subagent]
  输入: 草稿 + 模板 + parsedRequirement + 历史问答
  输出: PRD markdown 全文
   ↓ 返回
[主 agent]
  落盘 references/prd-{id}.md
  更新 workflow-state.json: currentStage="draft-prd"
  输出"下一步: 必须执行 /review-prd"
```

---

## Clarification Loop 配置

- **上限轮数 N**:默认 5。达到上限即强制退出 loop,主 agent 输出警告并直接进入 Drafter 阶段
- **退出条件**:Clarifier 返回 `openQuestions: []` 或达到上限
- **stateless 关键**:每次 Clarifier 调用是干净的新 subagent,**主 agent 必须把历史问答完整传入**,否则会重复问

---

## Clarifier Subagent 调用规范

### 角色定义(system 部分)

```
你是 vibe-delivery 工作流的 PRD Clarifier。你的职责:

1. 读取用户需求草稿与 PRD 模板,识别核心业务目标、用户角色、关键功能点、非功能需求、技术约束
2. 识别需求中的模糊点、歧义、未明确事项,生成开放问题清单
3. 若用户已经回答过部分问题(在历史问答中),不得重复问相同问题
4. 若你判断当前信息已足够生成完整 PRD,返回 openQuestions: 空数组,代表澄清完成
5. 输出结构化 JSON,不得有任何 markdown 包裹或额外说明文字

行为原则:
- 遇到模糊必须问,禁止自动假设
- 每个 openQuestion 必须给出 2-4 个候选方案,帮助用户决策
- 问题数量克制:单轮最多 5 个,避免轰炸用户
- parsedRequirement 是你对需求的结构化理解,会传给下一轮或 Drafter,必须完整
```

### 任务消息(user 部分)

```
请基于以下信息识别开放问题:

【用户需求草稿】
{用户原始输入}

【PRD 模板规范】
{references/prd-template.md 完整内容}

【历史问答】(若 loop 第一轮则为空)
[
  {
    "question": "...",
    "candidates": ["A", "B"],
    "userAnswer": "..."
  },
  ...
]

输出要求:
请按以下 JSON schema 输出(不要 markdown 代码块包裹):

{
  "parsedRequirement": {
    "goal": "核心业务目标",
    "actors": ["涉及的用户角色"],
    "features": ["关键功能点"],
    "nonFunctional": ["非功能需求"],
    "constraints": ["已知技术约束"]
  },
  "openQuestions": [
    {
      "id": "q1",
      "question": "问题描述",
      "candidates": ["候选方案 A", "候选方案 B", ...],
      "why": "为什么必须澄清这个问题"
    }
  ]
}

若你判断当前信息已足够生成 PRD,openQuestions 字段返回空数组 []。
```

### 主 agent 处理 Clarifier 输出

1. 解析 JSON(容错)
2. 检查 `openQuestions`:
   - **空数组** → 退出 loop,进入 Drafter 阶段。`parsedRequirement` 作为 Drafter 输入
   - **非空数组 + 已达上限** → 警告用户"已达澄清上限 N 轮,使用当前信息生成 PRD,后续可在 PRD review 阶段补充",退出 loop
   - **非空数组 + 未达上限** → 渲染给用户:

```
我从需求中识别了 N 个开放问题,请您回答以确保 PRD 不做错误假设:

1. {question}
   - {candidate A}
   - {candidate B}
   - 您的选择?

2. ...
```

3. 收集用户回答,拼装为历史问答条目,追加到 history,进入 loop 下一轮

---

## Drafter Subagent 调用规范

### 角色定义(system 部分)

```
你是 vibe-delivery 工作流的 PRD Drafter。你的职责:

1. 基于用户需求草稿、PRD 模板规范、Clarifier 解析的 parsedRequirement、用户全部历史问答,生成完整 PRD
2. 严格遵守 PRD 模板的章节结构与撰写要求
3. **严禁包含**:Implementation Phasing / 时间预算 / 具体执行步骤(这些是 /plan 阶段产出)
4. 每个 FR 必须对应 AC,Goals 与 Non-Goals 必须对称,任何外部依赖必须列入 Dependencies & Risks
5. 输出 PRD markdown 全文,不得有额外解释、不得有 markdown 代码块包裹

行为原则:
- 若历史问答与初始草稿冲突,以历史问答为准(用户后续澄清是更准确的信号)
- 不发明用户未表达的需求
- 模糊处优先采用历史问答中的回答;若历史问答未覆盖,在 PRD 的 Open Questions 章节如实列出
```

### 任务消息(user 部分)

```
请生成完整 PRD:

【用户需求草稿】
{用户原始输入}

【PRD 模板规范】
{references/prd-template.md 完整内容}

【Clarifier 解析的需求结构】
{Clarifier 最终轮输出的 parsedRequirement JSON}

【用户全部历史问答】
[
  {"question": "...", "candidates": [...], "userAnswer": "..."},
  ...
]

输出要求:
直接输出 PRD markdown 全文,不要任何前后说明、不要 markdown 代码块包裹。
PRD 应严格遵循模板章节结构。
```

### 主 agent 处理 Drafter 输出

1. 接收 PRD markdown 全文
2. 落盘:
   - 任务 ID `{id}` 由主 agent 从需求语义自动生成(kebab-case, 2-3 词)
   - 保存至 `references/prd-{id}.md`
3. 呈现给用户确认,根据反馈微调(微调由主 agent 直接编辑,无需再起 subagent)
4. 用户确认后更新 workflow-state.json:
   - `currentStage` → "draft-prd"
   - `completedStages` 追加 "draft-prd"
   - `documents.prd` → "references/prd-{id}.md"
5. 输出:"PRD 已生成。下一步: 必须执行 `/review-prd` 对 PRD 进行规范性审核。"

---

## 调用约束

- **禁止主 agent 直接执行需求解析或 PRD 生成**:解析必须经 Clarifier,生成必须经 Drafter
- **禁止跳过 Clarification Loop 直接 Drafter**:即使用户草稿看起来很完整,也必须至少经过一次 Clarifier(它可能识别出用户没察觉的歧义)
- **禁止 subagent 写入 workflow-state.json 或落盘 PRD**:这些由主 agent 完成
- **Loop 上限不可省略**:必须设 N 防止 Clarifier 死循环钻牛角尖
- **历史问答必须完整传递**:Clarifier 是 stateless 的,每次调用都要带全部历史

---

## 失败处理

| 失败情况 | 处理 |
| --- | --- |
| Clarifier JSON 解析失败 | 主 agent 提示用户重试 `/draft-prd`,不允许跳过 |
| Clarifier 连续 2 轮返回相同问题 | 主 agent 强制退出 loop,警告用户"Clarifier 卡住,使用现有信息生成 PRD" |
| Drafter 返回 PRD 缺少必需章节 | 主 agent 不落盘,提示用户重试或直接进入 `/prd` 手动模式 |
| task tool 调用超时 | 主 agent 提示用户重试 `/draft-prd` |
