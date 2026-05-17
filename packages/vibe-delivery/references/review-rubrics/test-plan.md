# Test Plan Review Rubric

`/review-test-plan` 指令按本 rubric 对 `references/test-plan-{id}.md` 进行三层审核。

---

## Layer 1: 结构完整性

### Check 1.1: 必需章节齐全

Test Plan 必须包含：

- [ ] 测试策略（框架选型、测试层级分布、自动化目标）
- [ ] 测试用例表（含 TC-ID、类型、层级、AC 对应、自动化优先级）
- [ ] 测试数据需求（Mock 数据、测试账号、fixture）
- [ ] E2E 测试场景（如适用）

---

### Check 1.2: 测试用例表格式完整

每条 TC 必须包含：

- [ ] 用例 ID（TC-XX）
- [ ] 类型（正向 / 边界 / 异常 / 回归 / 冒烟）
- [ ] 测试层级（单元 / 集成 / E2E）
- [ ] 前置条件
- [ ] 操作步骤
- [ ] 预期结果
- [ ] 关联 AC ID
- [ ] 自动化优先级（高 / 中 / 低）

**Fail 触发**：任一字段缺失。

---

## Layer 2: 内容质量

### Check 2.1: AC 覆盖度（关键）

**Pass 标准**：PRD 中每条 AC 至少对应一个测试用例。

**审核方式**：
- 提取 PRD 中所有 AC ID（AC-XX-X、AC-XX-EX、NFR-AC-XX）
- 对照 Test Plan 中每条 TC 的"关联 AC"列
- 检查是否每个 AC 都被覆盖

**Fail 触发**：PRD 中存在某条 AC 在 Test Plan 中没有任何 TC 关联到。

---

### Check 2.2: 测试层级分布合理

**Pass 标准**：

- 单元测试覆盖纯函数、工具方法、组件渲染
- 集成测试覆盖模块间交互、API 调用、状态管理
- E2E 测试覆盖关键业务流程

**Fail 触发**：
- 所有测试都是单元层级（缺集成 / E2E）
- 关键业务流程没有 E2E 覆盖
- 层级分布与测试策略章节宣称的目标不符

---

### Check 2.3: 异常路径覆盖

**Pass 标准**：每条 PRD 中的异常 AC（AC-XX-EX）都有对应异常 TC。

**Fail 触发**：
- 异常 AC 没有对应 TC
- 只测正向路径，没有任何异常测试

---

### Check 2.4: 冒烟测试存在

**Pass 标准**：Test Plan 中包含冒烟测试用例，覆盖：

- 新功能的入口到结果主干流程
- 修改已有代码时的已有功能关键路径

**Fail 触发**：完全没有冒烟测试。

---

### Check 2.5: Mock 策略与项目约定一致

**Pass 标准**：

- 单元测试：完全 Mock 外部依赖
- 集成测试：契约测试或 Mock Server
- E2E 测试：使用真实服务（不 Mock）

**Fail 触发**：
- 单元测试中调用真实网络请求
- 集成测试直接依赖生产 API 或真实数据库

---

### Check 2.6: 测试用例可独立执行

**Pass 标准**：

- 每个 TC 的前置条件明确
- TC 之间没有隐式依赖（不会因为 TC-01 先跑才能跑 TC-02）

**Fail 触发**：TC 描述中出现"在 TC-01 完成后..."等依赖描述。

---

### Check 2.7: 预期结果具体

**Pass 标准**：每条 TC 的"预期结果"是具体可断言的。

**Fail 触发**：
- "返回合理结果"
- "正常显示"
- "无异常"

应改为：
- ✅ "返回 HTTP 200，response body 含 id 字段"
- ✅ "页面显示包含 X 文案的 toast"

---

## Layer 3: 一致性

### Check 3.1: 测试栈与项目实际栈一致

读取项目 `package.json` 或 `pyproject.toml`：

- [ ] Test Plan 引用的测试框架与项目实际安装一致
- [ ] Test Plan 描述的测试目录结构与项目实际一致

**Fail 触发**：Test Plan 假设用 jest，但项目实际用 vitest。

---

### Check 3.2: 测试用例与 Coding Plan 接口对齐

对照 Coding Plan 的接口定义：

- [ ] 每个新增/修改的接口都有对应测试用例
- [ ] 测试用例的输入输出与接口定义一致

**Fail 触发**：Coding Plan 中定义了函数 X，但 Test Plan 中没有任何针对 X 的测试。

---

### Check 3.3: 测试覆盖 PRD 异常处理

对照 PRD 的"通用异常处理"章节：

- [ ] 每条通用异常都有至少一个 TC 覆盖

**Fail 触发**：PRD 提到"网络超时返回 X"等通用异常，但 Test Plan 中没测。

---

## 手动操作项识别

`/review-test-plan` 阶段可能识别的 manual items：

| 触发条件 | manual item 描述 | blocksStage |
|---|---|---|
| Test Plan 引用某 Mock 服务 | "准备 Mock 服务 X（如 MSW 配置）" | "setup-test" 或 "implement" |
| E2E 测试需要 staging 环境 | "确认 staging 环境 X 可用" | "test" |
| 需要测试数据集 | "准备测试数据集 Y（路径、格式）" | "implement" 或 "test" |
| 需要测试账号 | "申请测试账号 Z" | "test" |

---

## Subagent JSON 输出格式

reviewer subagent **必须输出严格的 JSON 字符串**（不要 markdown 代码块包裹，不要前后多余文本），格式如下：

```json
{
  "verdict": "pass | fail",
  "layers": {
    "完整性": [
      {"checkId": "1.1", "checkName": "必需章节齐全", "status": "pass | fail | warning", "evidence": "..."},
      {"checkId": "1.2", "checkName": "测试用例表格式完整", "status": "...", "evidence": "..."}
    ],
    "质量": [
      {
        "checkId": "2.1",
        "checkName": "AC 覆盖度",
        "status": "pass | fail | warning",
        "evidence": "PRD AC 总数：N；Test Plan 覆盖的 AC：M；未覆盖的 AC：[具体列表]"
      },
      {"checkId": "2.2", "checkName": "测试层级分布合理", "status": "...", "evidence": "..."},
      {"checkId": "2.3", "checkName": "异常路径覆盖", "status": "...", "evidence": "..."},
      {"checkId": "2.4", "checkName": "冒烟测试存在", "status": "...", "evidence": "..."},
      {"checkId": "2.5", "checkName": "Mock 策略与项目约定一致", "status": "...", "evidence": "..."},
      {"checkId": "2.6", "checkName": "测试用例可独立执行", "status": "...", "evidence": "..."},
      {"checkId": "2.7", "checkName": "预期结果具体", "status": "...", "evidence": "..."}
    ],
    "一致性": [
      {"checkId": "3.1", "checkName": "测试栈与项目实际栈一致", "status": "...", "evidence": "..."},
      {"checkId": "3.2", "checkName": "测试用例与 Coding Plan 接口对齐", "status": "...", "evidence": "..."},
      {"checkId": "3.3", "checkName": "测试覆盖 PRD 异常处理", "status": "...", "evidence": "..."}
    ]
  },
  "manualActionItems": [
    {
      "id": "manual-test-plan-1",
      "description": "准备 Mock 服务 X（如 MSW 配置）",
      "blocksStage": "setup-test",
      "verification": {
        "type": "file_exists",
        "path": "tests/mocks/handlers.ts"
      }
    }
  ],
  "reviewerNotes": "整体审核观察、对 Test Plan 撰写者的建议",
  "summary": "一句话总结审核结论"
}
```

### Verdict 判定规则

- **verdict = "fail"** 触发条件（任一即 fail）：
  - 完整性层任意 check status === "fail"
  - **关键**：质量层 Check 2.1（AC 覆盖度）status === "fail"——这是测试的硬指标，少 1 条 AC 没覆盖就 fail
  - 质量层 Check 2.3（异常路径覆盖）status === "fail"——异常 AC 没对应 TC
  - 一致性层 Check 3.1（测试栈一致）status === "fail"——测试栈与实际项目不符

- **warning 不阻塞 verdict = "pass"**，但需在 reviewerNotes 中提示用户

### Evidence 字段要求（特别针对 AC 覆盖度）

Check 2.1 的 evidence 必须包含**精确数字 + 未覆盖 AC 列表**：

```
"PRD AC 总数：12（含 8 个正向 + 4 个异常）；Test Plan 关联到的 AC：10；未覆盖的 AC：[AC-03-2, AC-05-E1]"
```

不能写"大部分覆盖"或"基本完整"。

### Manual Items ID 规则

- 格式：`manual-test-plan-{seq}`，seq 从 1 起递增

---

## 当前 agent 渲染规则

接收 subagent JSON 后，按以下格式渲染 markdown 给用户：

```markdown
# Test Plan Review Report: {id}

## 审核裁决
Verdict: {verdict}

Summary: {summary}

## Layer 1: 结构完整性
- [1.1] {checkName}: {status} — {evidence}
- [1.2] {checkName}: {status} — {evidence}

## Layer 2: 内容质量
- [2.1] AC 覆盖度: {status} — {evidence}  ← 关键指标
- [2.2] {checkName}: {status} — {evidence}
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

- 若 verdict === "pass" 且无 pending manual items：可执行 `/setup-test`
- 若 verdict === "fail"：根据 fail check 修改 Test Plan 后重新执行 `/review-test-plan`
- 若有 pending manual items：处理后执行 `/verify-manual {item-id}`
- 紧急需要跳过：`/skip-review test-plan --reason "..."`（不推荐）
```

---

## Reviewer 行为原则

1. **AC 覆盖率是硬指标**：少 1 条都 fail
2. **挑战测试质量**：模糊预期结果必须打回
3. **不接受"暂时省略"**：如果某 AC 不测，必须给出明确理由（在 Test Plan 中），否则 fail
