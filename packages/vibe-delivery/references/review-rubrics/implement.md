# Implement Review Rubric

`/review-implement` 指令按本 rubric 对实际产出的代码进行四层审核。

**这是 vibe-delivery 工作流中最重要的 review 节点**——/implement 阶段的 agent loop 容易产生暗自简化、命名误导等问题。本 review 必须严格把关。

---

## 审核输入

- `references/prd-{id}.md`（功能需求与 AC 真相源）
- `references/coding-plan-{id}.md`（实现方案）
- `references/test-plan-{id}.md`（测试要求）
- 实际产出的代码文件（按 Coding Plan 的文件清单逐一 read）
- 项目 `CLAUDE.md`（项目约束）

---

## Layer 1: 完整性（Completeness）

### Check 1.1: 所有 FR 都有对应代码

对 PRD 中每条 FR（US-XX），检查代码中：

- [ ] 有对应的实现函数/模块
- [ ] 实现路径对应 Coding Plan 中的 file 清单
- [ ] 函数签名与 Coding Plan 接口定义一致

**Fail 触发**：PRD 中某条 FR 在代码中找不到实现。

---

### Check 1.2: 所有 AC 都有实现路径

对 PRD 中每条 AC（AC-XX-X），检查代码中是否存在能让该 AC 通过的实现逻辑。

**审核方式**：

- 对每条正向 AC，找到代码中对应的功能入口，确认逻辑能达成 AC 的预期
- 对每条异常 AC，找到错误处理代码，确认与 AC 描述一致

**Fail 触发**：某条 AC 在代码中找不到对应实现路径。

---

### Check 1.3: 所有文件清单中的文件都存在

对照 Coding Plan 中的"文件清单"：

- [ ] 新建文件都已创建
- [ ] 修改文件确实被修改
- [ ] 删除文件确实被删除（如适用）

**Fail 触发**：Plan 中列出但代码中缺失。

---

## Layer 2: 质量（Quality）—— 防"暗自简化"重灾区

### Check 2.1: Metric 命名与定义一致（核心检查）

**Pass 标准**：代码中函数/变量/字段的命名，必须**与 PRD 中该术语的定义完全一致**。

**Fail 触发（关键示例）**：

- PRD 定义 "Faithfulness = LLM-as-judge: 生成答案的事实陈述是否能在检索内容中找到支撑"
- 代码实现 `computeFaithfulness()` 但内部做的是 keyword overlap
- ❌ **这种情况必须 fail**：命名误导用户与下游消费者

**审核方式**：

- 提取 PRD 中所有有明确定义的术语（如 Faithfulness、Recall@K、Hybrid Retrieval）
- 在代码中 grep 这些术语相关的函数/变量
- 对比函数实现 vs PRD 定义
- 任何"实现 ≠ 定义"必须 fail

**典型反模式**：

| PRD 定义 | 错误实现 | 判定 |
|---|---|---|
| Faithfulness = LLM-as-judge sentence-level | 实现为 keyword overlap | ❌ Fail |
| Recall@5 = top-5 至少 1 个 expected_chunk 命中 | 实现为 top-5 中匹配 keyword | ❌ Fail |
| Hybrid retrieval = BM25 + dense + RRF | 实现为只用 dense | ❌ Fail |

---

### Check 2.2: 简化未声明的实现（核心检查）

**Pass 标准**：任何因技术限制而做的简化实现，**必须在交付中显式声明**：

- 代码注释中说明"实际实现 vs PRD 定义的差异"
- 交付报告中列出"完整实现需要的工作"作为 known issue
- 函数名/类名不能误导（如果是简化版，命名应包含 "Simple" 或 "Stub" 等标识）

**Fail 触发**：

- 实现做了简化但**没有任何声明**
- 用一个完整定义的名字命名一个简化的实现（最严重的反模式）

**审核方式**：

- 检查代码注释中是否有 "TODO"、"FIXME"、"placeholder"、"simplified" 等标记
- 检查每个核心函数的注释，确认实现说明与函数名一致
- 检查项目根目录是否有 known-issues.md 或 PR 描述声明简化

---

### Check 2.3: 无 hardcoded 假数据（除非显式标注）

**Pass 标准**：

- 测试数据/示例数据放在 `tests/fixtures/` 或 `data/` 目录
- 业务代码中不出现写死的"假数据"，除非：
  - 注释明确标注 "placeholder"
  - 该数据在 PRD/Plan 中明确同意作为初始数据

**Fail 触发**：

- 业务函数返回写死的数组/对象（如"先写 8 条营养知识进去"）
- 数据库 schema 已就绪但代码中仍用 in-memory Map
- 应该从数据库读的数据被 hardcoded 在代码中

---

### Check 2.4: 无 silent failure

**Pass 标准**：

- 错误必须被显式处理（try-catch、显式 throw、错误日志）
- 失败时不能"假装成功"（如返回空数组而不报错）
- 降级路径必须明确标识（log 记录、metrics 上报）

**Fail 触发**：

- catch 块为空或只 console.log 不做处理
- 异常路径返回与正常路径相同的数据结构，无法区分
- 关键操作失败但不抛错也不上报

---

### Check 2.5: 不破坏 Technical Constraints 中"不可破坏"的接口

**Pass 标准**：

- PRD Technical Constraints 中标记为"必须保持"的接口签名未改动
- production code path 中关键 API 行为与之前一致

**Fail 触发**：

- 修改了 PRD 明确要求保持的接口
- 引入了 breaking change 但未在 PRD 范围内

---

### Check 2.6: 错误处理覆盖

**Pass 标准**：每个关键操作都有错误处理路径。

**Fail 触发**：

- LLM 调用没有 try-catch
- API 请求没有超时处理
- 数据库操作没有错误处理

---

## Layer 3: 一致性（Consistency）

### Check 3.1: 实现函数签名与 Plan 一致

对 Coding Plan 中每个接口定义：

- [ ] 实际函数名一致
- [ ] 参数名 + 类型一致
- [ ] 返回值类型一致
- [ ] 抛出的错误类型一致

**Fail 触发**：Plan 中定义 `function X(a: A, b: B): C`，实际实现 `function X(b: B, c: C): D`。

---

### Check 3.2: 数据库 schema 与 Plan 一致

如 Plan 涉及数据库改动：

- [ ] 实际 migration 文件与 Plan 中描述的 schema 一致
- [ ] 字段类型、索引、约束都符合 Plan

**Fail 触发**：Plan 写"加 topic TEXT 列"，实际加了 "topic JSONB 列"。

---

### Check 3.3: 文件位置与 CLAUDE.md 项目约定一致

- [ ] 新建文件的目录符合项目约定（如 `src/services/`、`scripts/`）
- [ ] 文件命名符合项目命名风格

**Fail 触发**：把 service 文件创建在 `src/utils/` 等不规范位置。

---

### Check 3.4: 与 review-plan 中识别的 manual items 兼容

确认代码中**没有依赖那些用户尚未完成的 manual items**：

- [ ] 代码中引用的 API key（如 DEEPSEEK_API_KEY）确实在 `.env.local` 模板中
- [ ] 代码中引用的数据文件确实在预期路径

**Fail 触发**：

- 代码假设某 API key 存在，但 manual item 还是 pending
- 代码读取的文件路径与 manual item 中描述的路径不一致

---

## Layer 4: 可测试性（Testability）

### Check 4.1: 测试覆盖度满足 Test Plan

对照 Test Plan 中每条 TC：

- [ ] 对应的测试文件已创建
- [ ] 测试用例数量与 Test Plan 一致
- [ ] 测试用例覆盖的 AC 与 Test Plan 关联表一致

**Fail 触发**：

- Test Plan 列出 5 条 TC 但代码中只有 3 条测试
- 测试用例存在但跳过了关键 AC

---

### Check 4.2: 测试可独立运行

抽样运行测试（或检查测试设置）：

- [ ] 测试不依赖隐式状态（如全局变量、外部服务）
- [ ] Mock 配置正确

**Fail 触发**：测试需要先运行其他测试才能通过。

---

### Check 4.3: 测试不被改宽松

对比 Test Plan 中的预期结果 vs 实际测试代码中的 assertion：

- [ ] assertion 严格度与 Test Plan 一致
- [ ] 没有为了"让测试通过"而放宽 assertion

**Fail 触发**：Test Plan 写"返回包含 5 个字段的 object"，实际 assertion 只检查"返回 object"。

---

## 手动操作项识别

`/review-implement` 阶段可能识别的 manual items：

| 触发条件 | manual item 描述 | blocksStage |
|---|---|---|
| 实现包含数据库 migration 但未执行 | "执行 `supabase migration up` 应用新 migration" | "test" |
| 实现引入新的环境变量 | "在 .env.local 添加 NEW_VAR 配置" | "test" |
| 实现依赖外部数据导入 | "运行 `npx tsx scripts/ingest-X.ts` 导入初始数据" | "test" |
| 实现需要部署到 staging 才能 E2E 测试 | "部署到 staging 环境" | "test" |
| 实现引入新的 CI/CD 步骤 | "更新 CI 配置文件" | "ship" |
| 实现需要监控接入 | "在 Sentry/DataDog 中创建项目并配置 DSN" | "ship" |

---

## Subagent JSON 输出格式

reviewer subagent **必须输出严格的 JSON 字符串**（不要 markdown 代码块包裹，不要前后多余文本）。

**注意**：implement 审核是四层（而非三层），JSON 的 `layers` 字段必须包含 `完整性` / `质量` / `一致性` / `可测试性`。

```json
{
  "verdict": "pass | fail",
  "layers": {
    "完整性": [
      {
        "checkId": "1.1",
        "checkName": "所有 FR 都有对应代码",
        "status": "pass | fail | warning",
        "evidence": "PRD FR 总数：N；代码中实现的 FR：M；缺失的 FR：[具体列表]"
      },
      {"checkId": "1.2", "checkName": "所有 AC 都有实现路径", "status": "...", "evidence": "..."},
      {"checkId": "1.3", "checkName": "所有文件清单中的文件都存在", "status": "...", "evidence": "..."}
    ],
    "质量": [
      {
        "checkId": "2.1",
        "checkName": "Metric 命名与定义一致",
        "status": "pass | fail | warning",
        "evidence": "审查的术语：[Faithfulness, Recall@5, ...]；发现的命名 vs 定义不一致：[{term}: PRD 定义=X, 实际实现=Y]"
      },
      {
        "checkId": "2.2",
        "checkName": "简化未声明的实现",
        "status": "pass | fail | warning",
        "evidence": "发现的简化：1. {function/feature}: 简化为 Y, 是否声明=Yes/No"
      },
      {"checkId": "2.3", "checkName": "无 hardcoded 假数据", "status": "...", "evidence": "..."},
      {"checkId": "2.4", "checkName": "无 silent failure", "status": "...", "evidence": "..."},
      {"checkId": "2.5", "checkName": "不破坏 Technical Constraints 中保留接口", "status": "...", "evidence": "..."},
      {"checkId": "2.6", "checkName": "错误处理覆盖", "status": "...", "evidence": "..."}
    ],
    "一致性": [
      {"checkId": "3.1", "checkName": "实现函数签名与 Plan 一致", "status": "...", "evidence": "..."},
      {"checkId": "3.2", "checkName": "数据库 schema 与 Plan 一致", "status": "...", "evidence": "..."},
      {"checkId": "3.3", "checkName": "文件位置与 CLAUDE.md 项目约定一致", "status": "...", "evidence": "..."},
      {"checkId": "3.4", "checkName": "与 review-plan 中识别的 manual items 兼容", "status": "...", "evidence": "..."}
    ],
    "可测试性": [
      {"checkId": "4.1", "checkName": "测试覆盖度满足 Test Plan", "status": "...", "evidence": "..."},
      {"checkId": "4.2", "checkName": "测试可独立运行", "status": "...", "evidence": "..."},
      {"checkId": "4.3", "checkName": "测试不被改宽松", "status": "...", "evidence": "..."}
    ]
  },
  "manualActionItems": [
    {
      "id": "manual-implement-1",
      "description": "执行 supabase migration up 应用新 migration",
      "blocksStage": "test",
      "verification": {
        "type": "command",
        "command": "supabase migration list | grep applied",
        "expectExitCode": 0
      }
    }
  ],
  "reviewerNotes": "重点记录发现的简化与命名问题的具体位置、对实现质量的整体判断、给用户的修改建议",
  "summary": "一句话总结审核结论"
}
```

### Verdict 判定规则（最严格）

implement review 是工作流最后一道质量关卡，verdict 判定**最严格**：

- **verdict = "fail"** 触发条件（任一即 fail）：
  - 完整性层任意 check status === "fail"
  - **关键 Check 2.1**（Metric 命名与定义一致）status === "fail"——命名误导是最严重错误
  - **关键 Check 2.2**（简化未声明）status === "fail"——未声明的简化必 fail
  - Check 2.3（无 hardcoded 假数据）status === "fail"
  - Check 2.4（无 silent failure）status === "fail"
  - Check 2.5（不破坏保留接口）status === "fail"
  - 一致性层 Check 3.1（函数签名与 Plan 一致）status === "fail"
  - 可测试性层 Check 4.1（测试覆盖度）status === "fail"
  - 可测试性层 Check 4.3（测试不被改宽松）status === "fail"——target leakage 的另一种形式

- **warning 仅允许在不影响核心功能的细节问题上使用**

### Evidence 字段要求（implement review 特别严格）

- **Check 1.1**：必须给出精确数字 + 未覆盖 FR 列表
- **Check 2.1**：必须列出所有审查的术语 + 不一致的具体细节（PRD 定义 vs 实际实现）
- **Check 2.2**：必须列出所有发现的简化 + 是否声明的状态
- **Check 4.1**：必须给出"Test Plan TC 总数 vs 代码中测试用例数"的精确对比
- 任何 fail 状态的 evidence 必须**精确到文件路径 + 行号或函数名**

### Manual Items ID 规则

- 格式：`manual-implement-{seq}`，seq 从 1 起递增

### 常见 verification 模式

| 场景 | type | 配置 |
|---|---|---|
| migration 已应用 | `command` | `command: "supabase migration list \| grep applied"` |
| 环境变量已配置 | `env_var` | `envVar: "NEW_VAR"` |
| 数据已导入 | `command` | `command: "psql ... -c 'SELECT COUNT(*) FROM ...'"` 配合 expectExitCode |
| 部署到 staging | `manual_only` | （无法自动验证） |
| CI 配置更新 | `file_exists` | `path: ".github/workflows/..."` |

---

## 当前 agent 渲染规则

接收 subagent JSON 后，按以下格式渲染 markdown 给用户：

```markdown
# Implement Review Report: {id}

## 审核裁决
Verdict: {verdict}

Summary: {summary}

## Layer 1: 完整性
- [1.1] 所有 FR 都有对应代码: {status} — {evidence}
- [1.2] 所有 AC 都有实现路径: {status} — {evidence}
- [1.3] 所有文件清单中的文件都存在: {status} — {evidence}

## Layer 2: 质量
- [2.1] **Metric 命名与定义一致**: {status} — {evidence}  ← 关键
- [2.2] **简化未声明的实现**: {status} — {evidence}  ← 关键
- [2.3] 无 hardcoded 假数据: {status} — {evidence}
- [2.4] 无 silent failure: {status} — {evidence}
- [2.5] 不破坏保留接口: {status} — {evidence}
- [2.6] 错误处理覆盖: {status} — {evidence}

## Layer 3: 一致性
- [3.1] 实现函数签名与 Plan 一致: {status} — {evidence}
- [3.2] 数据库 schema 与 Plan 一致: {status} — {evidence}
- [3.3] 文件位置与 CLAUDE.md 项目约定一致: {status} — {evidence}
- [3.4] 与 manual items 兼容: {status} — {evidence}

## Layer 4: 可测试性
- [4.1] 测试覆盖度满足 Test Plan: {status} — {evidence}
- [4.2] 测试可独立运行: {status} — {evidence}
- [4.3] 测试不被改宽松: {status} — {evidence}

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

- 若 verdict === "pass" 且无 pending manual items：可执行 `/test`
- 若 verdict === "fail"：根据 fail check 修改实现代码后重新执行 `/review-implement`（不需要重跑 `/implement`，除非修改幅度大）
- 若有 pending manual items：处理后执行 `/verify-manual {item-id}`
- 紧急需要跳过：`/skip-review implement --reason "..."`（**强烈不推荐**——这是工作流最后一道质量关卡）
```

---

## Reviewer 行为原则

### 原则 1: 严格对照 PRD 定义

PRD 怎么定义的术语，代码就必须怎么实现。**这是最关键的检查**，不能放水。

### 原则 2: 暗自简化必 fail

即便简化是合理的（如技术限制），**未声明的简化必 fail**。声明后才能 pass。

### 原则 3: 命名误导是最严重的错误

把一个简化实现命名为完整术语，是对下游消费者（包括用户面试时的讲述）的误导。这类问题应作为"严重 fail"，不接受"补充注释"等小修小补。

### 原则 4: 客观，不卖人情

发现问题必须明确指出，不能为了流程顺畅说"基本符合"。reviewer 是工作流的最后一道质量关卡。

### 原则 5: 修改建议必须具体

fail 时必须告诉用户：
- 具体在哪个文件哪一行
- 应该改成什么
- 改完如何验证
