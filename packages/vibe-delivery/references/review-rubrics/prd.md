# PRD Review Rubric

`/review-prd` 指令按本 rubric 对 `references/prd-{id}.md` 进行三层审核。

每个 check item 给出 **pass / fail / warning** 判定 + 具体证据（引用 PRD 的具体段落）。

---

## Layer 1: 结构完整性（Structural Completeness）

### Check 1.1: 必需章节齐全

PRD 必须包含以下章节，缺一则 fail：

- [ ] Section 0: 用户故事一句话总结
- [ ] Section 1: Background & Problem
- [ ] Section 2: Goals
- [ ] Section 3: Non-Goals (Out of Scope)
- [ ] Section 4: Functional Requirements
- [ ] Section 5: Acceptance Criteria（FR 中的 AC 索引）
- [ ] Section 6: Technical Constraints
- [ ] Section 7: Dependencies & Risks
- [ ] Section 8: Success Metrics
- [ ] Section 9: Open Questions
- [ ] Section 10: References

**审核方式**：grep PRD 的二级标题，对照清单。

**Fail 触发**：缺少任意章节。

---

### Check 1.2: 严禁章节不存在（关键检查）

PRD 中**不能出现**以下章节，出现即 fail：

- [ ] ❌ Implementation Phasing / 实施阶段
- [ ] ❌ Time Estimates / 时间预算 / 工时估算
- [ ] ❌ Step-by-step Instructions / 具体步骤拆分
- [ ] ❌ Technical How-to / 技术实现细节（除 Technical Constraints 中的硬约束外）
- [ ] ❌ Testing Strategy / 测试策略（属于 /test-plan）

**审核方式**：
- grep 二级标题中的关键词："Phasing"、"Phase"、"Timeline"、"Estimate"、"Step 1"、"Schedule"
- 扫描内容中是否有"Phase 1: ... Phase 2: ..."、"第一天 ... 第二天 ..."等模式
- 扫描是否有大量"用 X 函数实现"、"在 Y 文件添加代码"等 HOW 描述

**Fail 触发**：任一严禁章节或类似内容出现。

**审核者备注**：发现严禁内容时，必须明确指出**哪一段**、**为什么属于严禁**、**应放到哪个阶段**。

---

### Check 1.3: 用户故事格式正确

Section 4 中每个 user story 必须包含：

- [ ] 用户故事一句话陈述（"作为 X，希望 Y，以便 Z"）
- [ ] 正向验收标准列表（至少 1 条）
- [ ] 异常验收标准列表（若该 US 有特定异常）

**审核方式**：对每个 US-XX 检查上述三要素。

---

## Layer 2: 内容质量（Quality）

### Check 2.1: AC 可验证性

每条 AC 必须**可量化、可测试**。

**Fail 触发**：
- 出现主观描述如"用户体验流畅"、"响应快"、"界面美观"
- 出现"应当"、"尽量"、"合理"等模糊词
- 没有具体输入 → 具体可断言输出

**审核方式**：对每条 AC 检查：
- 这条 AC 能转化为一个具体测试用例吗？
- 测试用例的 expected output 是具体的吗？

---

### Check 2.2: Goals 与 Non-Goals 对称

**Pass 标准**：
- Goals 列出本次要做的事
- Non-Goals 列出**可能被误以为在范围内、但本次不做**的事
- 两者数量相当（不能 Goals 有 5 条 Non-Goals 只有 1 条空泛声明）

**Fail 触发**：
- Non-Goals 只写"不做 v3 功能"等空泛排除
- Non-Goals 没有具体枚举与 Goals 平行的排除项

---

### Check 2.3: Dependencies & Risks 完整

**Pass 标准**：
- 所有外部依赖（API key、第三方服务、数据源）都列出
- 每个依赖明确"影响哪个阶段"
- 每个风险有缓解措施

**Fail 触发**：
- 漏列明显的外部依赖（比如 PRD 中提到"用 X API"但 Dependencies 章节没列）
- 风险只列出但无缓解

---

### Check 2.4: Open Questions 如实列出

**Pass 标准**：
- 如果 PRD 撰写过程中遇到模糊处，必须列入 Open Questions
- Open Questions 章节存在但为空是允许的（只要确实没有未决问题）

**Fail 触发**：
- PRD 内容中存在明显假设（比如"假设用户都使用桌面浏览器"），但未列入 Open Questions
- 多处技术决策模糊但 Open Questions 章节缺失或为空

**审核方式**：对照内容扫描，识别"PRD 已经决定但没有依据"的地方。

---

### Check 2.5: 异常场景归类正确

**Pass 标准**：
- 特定于某 US 的异常 → 写在该 US 的"异常验收标准"小节
- 跨多个 US 共享的异常 → 写在"通用异常处理"章节

**Fail 触发**：
- 出现独立的"异常表格"或"边界条件表"，无法对应到任何 US
- 异常 AC 没有明确归属

---

## Layer 3: 一致性（Consistency）

### Check 3.1: 不与项目 CLAUDE.md 冲突

读取项目根目录的 `CLAUDE.md`，对比 PRD 内容是否冲突：

- 技术栈：PRD 提及的技术是否与 CLAUDE.md 记录的技术栈一致？
- 现有约束：PRD 是否违反 CLAUDE.md 中已记录的特殊约束？

**Fail 触发**：
- PRD 要求使用 CLAUDE.md 明确禁止的库（例如 `@langchain/google-genai`，AuraDiet 已记录会构造空 Part）
- PRD 描述的项目结构与实际不符

---

### Check 3.2: Goals 与 FR 对齐

**Pass 标准**：每条 Goal 至少对应一个 FR。

**Fail 触发**：Goal 描述的目标在 FR 中完全找不到对应。

---

### Check 3.3: Non-Goals 与 FR 不冲突

**Pass 标准**：FR 中不能描述 Non-Goals 排除的功能。

**Fail 触发**：例如 Non-Goals 写"不实现 multi-agent"，但 FR 中有"agent 协作"相关需求。

---

### Check 3.4: Technical Constraints 内化为 FR 设计

**Pass 标准**：FR 在描述功能时，与 Technical Constraints 保持一致。

**Fail 触发**：
- Technical Constraints 写"必须用 PostgreSQL"，但 FR 暗示需要 NoSQL
- Technical Constraints 写"不能引入新依赖"，但 FR 要求使用某个未在现有依赖中的库

---

## 手动操作项识别（Manual Action Items）

审核过程中，识别**用户必须手动完成才能继续后续阶段的事项**，每项明确：

- `id`: 唯一标识（如 `manual-prd-1`）
- `description`: 用户可读的描述
- `blocksStage`: 阻塞哪个阶段

**典型 manual items**（PRD 阶段）：

| 触发条件 | manual item 描述 | blocksStage |
|---|---|---|
| Open Questions 中存在影响 /plan 的业务方向决策 | "回答 Open Question X: {具体问题}" | "plan" |
| PRD 提及外部数据源但未确认可用性 | "确认数据源 X 可访问/可下载" | "plan" |
| PRD 提及第三方 API 但未确认账号 | "申请 X 服务账号" | "plan" 或 "implement" |

**PRD 阶段通常较少 manual items**，因为大部分配置类 manual items 在 /review-plan 才被识别。

---

## Subagent JSON 输出格式

reviewer subagent **必须输出严格的 JSON 字符串**（不要 markdown 代码块包裹，不要前后多余文本），格式如下：

```json
{
  "verdict": "pass | fail",
  "layers": {
    "完整性": [
      {
        "checkId": "1.1",
        "checkName": "必需章节齐全",
        "status": "pass | fail | warning",
        "evidence": "在 PRD 中引用具体段落或行号说明判定依据"
      },
      {
        "checkId": "1.2",
        "checkName": "严禁章节不存在",
        "status": "pass | fail | warning",
        "evidence": "若发现严禁章节，明确指出位置 + 类型 + 应去的阶段"
      },
      {
        "checkId": "1.3",
        "checkName": "用户故事格式正确",
        "status": "pass | fail | warning",
        "evidence": "..."
      }
    ],
    "质量": [
      {
        "checkId": "2.1",
        "checkName": "AC 可验证性",
        "status": "pass | fail | warning",
        "evidence": "若有问题 AC，列出具体 AC 编号 + 问题"
      },
      {
        "checkId": "2.2",
        "checkName": "Goals 与 Non-Goals 对称",
        "status": "pass | fail | warning",
        "evidence": "..."
      },
      {
        "checkId": "2.3",
        "checkName": "Dependencies & Risks 完整",
        "status": "pass | fail | warning",
        "evidence": "..."
      },
      {
        "checkId": "2.4",
        "checkName": "Open Questions 如实列出",
        "status": "pass | fail | warning",
        "evidence": "..."
      },
      {
        "checkId": "2.5",
        "checkName": "异常场景归类正确",
        "status": "pass | fail | warning",
        "evidence": "..."
      }
    ],
    "一致性": [
      {
        "checkId": "3.1",
        "checkName": "不与项目 CLAUDE.md 冲突",
        "status": "pass | fail | warning",
        "evidence": "..."
      },
      {
        "checkId": "3.2",
        "checkName": "Goals 与 FR 对齐",
        "status": "pass | fail | warning",
        "evidence": "..."
      },
      {
        "checkId": "3.3",
        "checkName": "Non-Goals 与 FR 不冲突",
        "status": "pass | fail | warning",
        "evidence": "..."
      },
      {
        "checkId": "3.4",
        "checkName": "Technical Constraints 内化为 FR",
        "status": "pass | fail | warning",
        "evidence": "..."
      }
    ]
  },
  "manualActionItems": [
    {
      "id": "manual-prd-1",
      "description": "具体可执行的操作描述",
      "blocksStage": "plan | prototype | implement",
      "verification": {
        "type": "env_var | file_exists | dir_exists | command | manual_only",
        "envVar": "（仅 type=env_var 时填）",
        "path": "（仅 type=file_exists 或 dir_exists 时填）",
        "command": "（仅 type=command 时填）",
        "expectExitCode": 0
      }
    }
  ],
  "reviewerNotes": "整体审核观察、对 PRD 撰写者的建议、需要重点关注的地方",
  "summary": "一句话总结审核结论"
}
```

### Verdict 判定规则

- **verdict = "fail"** 触发条件（任一即 fail）：
  - 完整性层任意 check status === "fail"
  - 质量层 Check 2.1（AC 可验证性）status === "fail"
  - 一致性层 Check 3.1（与 CLAUDE.md 冲突）status === "fail"
  - **关键**：Check 1.2（严禁章节不存在）status === "fail"——防止 PRD 越界写 Implementation Phasing，必 fail

- **warning 不阻塞 verdict = "pass"**，但需在 reviewerNotes 中提示用户

### Evidence 字段要求

- 必须**引用 PRD 的具体内容**（段落、行号、章节名）
- 不能写空泛的"质量差"、"基本符合"
- fail 状态的 evidence 必须包含**具体可执行的修改建议**

### Manual Items ID 规则

- 格式：`manual-prd-{seq}`，seq 从 1 起递增
- 同一阶段的 manual items seq 不重复

### Verification 字段使用

| type | 必填子字段 | 说明 |
|---|---|---|
| `env_var` | `envVar` | 检查 `.env.local` 中的环境变量 |
| `file_exists` | `path` | 检查文件路径是否存在 |
| `dir_exists` | `path` | 检查目录路径是否存在 |
| `command` | `command`（可选 `expectExitCode`） | 执行 shell 命令，比对 exit code |
| `manual_only` | （无） | 无法自动验证，由用户手动确认 |

---

## 当前 agent 渲染规则

当前 agent 接收 subagent 的 JSON 后，按以下格式渲染 markdown 给用户：

```markdown
# PRD Review Report: {id}

## 审核裁决
Verdict: {verdict}

Summary: {summary}

## Layer 1: 结构完整性
- [1.1] {checkName}: {status} — {evidence}
- [1.2] {checkName}: {status} — {evidence}
- [1.3] {checkName}: {status} — {evidence}

## Layer 2: 内容质量
- [2.1] {checkName}: {status} — {evidence}
- ...

## Layer 3: 一致性
- [3.1] {checkName}: {status} — {evidence}
- ...

## 手动操作项

（若 manualActionItems 非空）
- [{id}] {description}
  - 阻塞阶段: {blocksStage}
  - 自动验证: {verification.type}（{对应子字段}）

（若 manualActionItems 为空）
本阶段无 manual items。

## 审核者备注

{reviewerNotes}

## 下一步

- 若 verdict === "pass" 且无 pending manual items：可执行 `/plan` 或 `/prototype`
- 若 verdict === "fail"：根据上述 fail check 修改 PRD 后重新执行 `/review-prd`
- 若有 pending manual items：处理后执行 `/verify-manual {item-id}`
- 紧急需要跳过：`/skip-review prd --reason "..."`（不推荐）
```

---

## Reviewer 行为原则

1. **客观判断**：发现问题必须给 fail，不得为了流程顺畅放水
2. **具体证据**：每条 check 必须给出 PRD 的具体引用，不能只写"质量差"
3. **可执行的修改建议**：fail 时必须告诉用户**具体怎么改**，不能只列问题
4. **manual items 显式化**：任何需要用户手动完成的事项必须以结构化形式记录，禁止用 reviewer notes 软提示
