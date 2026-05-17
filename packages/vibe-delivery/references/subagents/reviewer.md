# Reviewer Subagent 调用规范

适用于 `/review-prd` / `/review-plan` / `/review-test-plan` / `/review-implement` 四个指令。

**核心要求**:所有 `/review-*` 指令的审核工作必须通过 task tool 起独立 subagent 执行,不能由当前 agent 直接审核。

---

## 为什么必须独立 subagent

1. **避免 self-evaluation bias**:刚完成 `/implement` 的 agent 转头评判自己写的代码,存在审核放水的认知偏差
2. **避免 context 污染**:写完代码的 agent context 中充斥实现细节,审核时容易被"存在性偏差"带偏("我都这么实现了,应该没问题")
3. **审核独立可追溯**:reviewer subagent 是独立的 task 调用,输出可被独立审查

---

## 调用步骤

当前 agent 执行 `/review-{stage}` 指令时:

### Step 1: 准备审核输入

收集如下信息,作为 subagent 的输入参数。

**审核对象路径列表**:

| 指令 | 审核对象 |
| --- | --- |
| `/review-prd` | `references/prd-{id}.md` |
| `/review-plan` | `references/prd-{id}.md` + `references/coding-plan-{id}.md` |
| `/review-test-plan` | `references/prd-{id}.md` + `references/coding-plan-{id}.md` + `references/test-plan-{id}.md` |
| `/review-implement` | 上述全部 + Coding Plan 中提及的所有代码文件路径 |

**审核规范路径**:

| 指令 | rubric 文件 |
| --- | --- |
| `/review-prd` | `references/review-rubrics/prd.md` |
| `/review-plan` | `references/review-rubrics/plan.md` |
| `/review-test-plan` | `references/review-rubrics/test-plan.md` |
| `/review-implement` | `references/review-rubrics/implement.md` |

**项目上下文**:当前项目根目录 `CLAUDE.md` 路径(若存在)

---

### Step 2: 启动 reviewer subagent

通过 task tool 起一个新 subagent,传入:

**角色定义** (system 部分):

```
你是 vibe-delivery 工作流的 {stage} 阶段 reviewer。你的职责:

1. 严格按 rubric 文件中的所有 check 进行三层(或四层)审核
2. 对每条 check 给出 pass / fail / warning 判定,并提供 PRD 或代码中的具体引用作为证据
3. 识别所有需要用户手动完成的事项,结构化为 ManualActionItem
4. 输出结构化 JSON 审核结果

行为原则:
- 客观:发现问题必须 fail,禁止为流程顺畅而放水
- 具体:每条 check 必须给出具体证据(引用文件路径 + 行号或段落)
- 可执行的修改建议:fail 时必须告诉用户具体怎么改
- 不假装看代码:如果对项目结构不确定,必须在审核报告中说明
```

**任务消息** (user 部分):

```
请审核以下 {stage} 阶段产出物:

审核对象:
{对每个审核对象,提供文件完整内容}

审核规范:
{review-rubrics/{stage}.md 完整内容}

项目上下文 (CLAUDE.md):
{若存在,提供 CLAUDE.md 内容}

输出要求:
请按以下 JSON schema 输出审核结果(不要 markdown 代码块包裹):

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

---

### Step 3: 接收并处理 subagent 输出

当前 agent 接收 reviewer 输出的 JSON 后:

1. **解析 JSON**:使用容错解析(处理可能的 markdown 包裹、前后空白等)
2. **写入 workflow-state.json**:
   - 更新 `reviews.{stage}` 字段
   - 设置 `iteration`(首次为 1,重审时递增)
   - 若是重审且上轮 fail,追加到 `previousVerdicts`
3. **渲染 markdown 报告输出给用户**:将 JSON 渲染为可读的 markdown 审核报告
4. **更新 currentStage**:
   - verdict === "pass" → `{stage}-reviewed`
   - verdict === "fail" → 回退到 `{stage}`(生产阶段)

---

### Step 4: 输出下一步提示

根据 verdict 给出下一步建议:

- **pass + 无 pending manual items**:可执行下一阶段指令
- **pass + 有 pending manual items**:列出 pending items,提示 `/verify-manual`
- **fail**:列出主要问题,提示用户修改对应文档后再执行 `/review-{stage}` 重审

---

## 调用约束

- **禁止跳过 subagent 直接审核**:即便审核内容很短,也必须走 task tool
- **禁止 reviewer 写入 workflow-state.json**:写入由调用方(当前 agent)完成,reviewer 只输出 JSON
- **禁止 reviewer 执行任何文件修改**:reviewer 只读取与判断,不修改任何文件
- **Subagent 失败处理**:若 task tool 调用失败(超时、JSON 解析失败等),当前 agent 提示用户重试 `/review-{stage}`,不允许跳过
