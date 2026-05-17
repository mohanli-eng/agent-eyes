# Plan Review Rubric

`/review-plan` 指令按本 rubric 对 `references/coding-plan-{id}.md` 进行三层审核。

---

## Layer 1: 结构完整性

### Check 1.1: 必需章节齐全

Coding Plan 必须包含：

- [ ] 技术选型（含选型理由）
- [ ] 模块拆分
- [ ] 接口定义
- [ ] 数据结构
- [ ] 关键业务流程
- [ ] 依赖与配置变更
- [ ] 文件清单

**Fail 触发**：任一章节缺失。

---

### Check 1.2: 接口定义完整

每个接口必须包含：

- [ ] 名称
- [ ] 输入参数（含类型）
- [ ] 返回值（含类型）
- [ ] 可能的错误（含触发条件）
- [ ] implRef（实现文件路径，初稿可为 TBD）

**Fail 触发**：任一接口缺失上述字段。

---

### Check 1.3: 文件清单具体

文件清单必须明确：

- [ ] 新建文件（路径完整）
- [ ] 修改文件（路径完整 + 修改性质，如"新增函数 X"、"重构 Y 方法"）
- [ ] 删除文件（如有）

**Fail 触发**：只列"修改一些文件"等模糊描述。

---

## Layer 2: 内容质量

### Check 2.1: 技术选型有 trade-off 说明

每个技术选择必须说明：

- 选 X 而不是 Y/Z 的理由
- X 的 trade-off（代价是什么）
- X 是否符合 PRD Technical Constraints

**Fail 触发**：
- 只列"使用 X"无理由
- 没有讨论备选方案
- 没有提 trade-off

---

### Check 2.2: 不引入未授权依赖

对比 Coding Plan 中的"依赖与配置变更" vs PRD 中的"Technical Constraints"：

- [ ] 新引入的依赖在 PRD 中是允许的
- [ ] 没有引入 PRD 明确禁止的依赖

**Fail 触发**：引入 PRD Technical Constraints 中"不能引入"列表里的依赖。

---

### Check 2.3: 不修改 Non-Goals 中的功能

扫描 Coding Plan 是否触及 PRD Non-Goals：

- [ ] 模块拆分中不包含 Non-Goals 排除的功能
- [ ] 接口定义中不实现 Non-Goals 排除的能力

**Fail 触发**：Plan 实现了 PRD 明确排除的功能。

---

### Check 2.4: 错误处理与降级路径

Coding Plan 必须明确：

- [ ] 关键操作的失败如何处理
- [ ] 是否有降级路径（fallback）
- [ ] 错误是否被显式抛出/记录

**Fail 触发**：
- 关键流程缺少错误处理设计
- 涉及外部 API 调用但无降级路径

---

### Check 2.5: 不规划 PRD 未要求的工作

**Pass 标准**：Plan 严格围绕 PRD FR 设计实现，不扩展范围。

**Fail 触发**：
- Plan 中出现 PRD 未提及的功能模块
- Plan 中包含"顺便重构 X"等范围外的工作

---

## Layer 3: 一致性

### Check 3.1: 覆盖所有 PRD FR

对照 PRD 的每条 FR，检查 Plan 中：

- [ ] 有对应模块
- [ ] 有对应接口
- [ ] 有对应业务流程

**Fail 触发**：PRD 中某条 FR 在 Plan 中找不到对应实现。

---

### Check 3.2: 与 CLAUDE.md 项目结构一致

读取项目 CLAUDE.md，对比 Plan 中的文件清单：

- [ ] 新建文件的路径符合项目目录结构
- [ ] 修改文件的路径与项目中实际文件一致
- [ ] 引入的工具/库与 CLAUDE.md 记录的技术栈兼容

**Fail 触发**：
- 文件路径不符合项目目录约定
- Plan 假设的项目结构与实际不符（agent 没读真实代码）

---

### Check 3.3: 数据模型与现有数据库 schema 兼容

如 Plan 涉及数据库改动：

- [ ] 新表/字段定义与现有 schema 不冲突
- [ ] 涉及的 migration 文件路径合理
- [ ] RLS 策略与项目约定一致

**Fail 触发**：Plan 设计的 schema 与现有约定（如 Supabase RLS）冲突。

---

### Check 3.4: 不破坏 PRD Technical Constraints 中"不可破坏"的接口

PRD 通常会写"API X 行为必须保持"、"接口 Y 签名不变"等。

- [ ] Plan 中没有修改这些保留接口

**Fail 触发**：Plan 修改了 PRD 明确要求保持的接口/行为。

---

## 手动操作项识别

`/review-plan` 阶段是**识别 manual items 最重要的节点**，因为 Plan 揭示了所有实际依赖。

**典型 manual items**：

| 触发条件 | manual item 描述 | blocksStage |
|---|---|---|
| Plan 引入需要 API key 的服务 | "申请 X 服务 API key 并配置 .env.local 中的 X_API_KEY" | "implement" |
| Plan 引入需要账号的第三方服务 | "注册 X 服务账号" | "implement" |
| Plan 依赖本地数据文件 | "创建 data/X/ 目录并下载/准备 Y 文件" | "implement" |
| Plan 涉及数据库 migration | "确认 supabase CLI 已配置且能连接到目标数据库" | "implement" |
| Plan 引入本地需要预安装的工具 | "安装本地工具 X (如 docker、postgresql)" | "implement" |
| Plan 依赖未实现的上游接口 | "联系 X 团队确认接口 Y 何时可用" | "implement" |

**审核者操作**：

- 扫描 Plan 中所有"需要外部资源"的描述
- 每个外部资源对应一个 manual item
- 描述必须**精确到用户可执行的动作**，不能"配置一下 X"
- blocksStage 必须准确（通常是 "implement"，少数是 "test"）

---

## Subagent JSON 输出格式

reviewer subagent **必须输出严格的 JSON 字符串**（不要 markdown 代码块包裹，不要前后多余文本），格式如下：

```json
{
  "verdict": "pass | fail",
  "layers": {
    "完整性": [
      {"checkId": "1.1", "checkName": "必需章节齐全", "status": "pass | fail | warning", "evidence": "..."},
      {"checkId": "1.2", "checkName": "接口定义完整", "status": "pass | fail | warning", "evidence": "..."},
      {"checkId": "1.3", "checkName": "文件清单具体", "status": "pass | fail | warning", "evidence": "..."}
    ],
    "质量": [
      {"checkId": "2.1", "checkName": "技术选型有 trade-off 说明", "status": "...", "evidence": "..."},
      {"checkId": "2.2", "checkName": "不引入未授权依赖", "status": "...", "evidence": "..."},
      {"checkId": "2.3", "checkName": "不修改 Non-Goals 中的功能", "status": "...", "evidence": "..."},
      {"checkId": "2.4", "checkName": "错误处理与降级路径", "status": "...", "evidence": "..."},
      {"checkId": "2.5", "checkName": "不规划 PRD 未要求的工作", "status": "...", "evidence": "..."}
    ],
    "一致性": [
      {"checkId": "3.1", "checkName": "覆盖所有 PRD FR", "status": "...", "evidence": "..."},
      {"checkId": "3.2", "checkName": "与 CLAUDE.md 项目结构一致", "status": "...", "evidence": "..."},
      {"checkId": "3.3", "checkName": "数据模型与现有数据库 schema 兼容", "status": "...", "evidence": "..."},
      {"checkId": "3.4", "checkName": "不破坏 PRD 保留接口", "status": "...", "evidence": "..."}
    ]
  },
  "manualActionItems": [
    {
      "id": "manual-plan-1",
      "description": "申请 DeepSeek API key 并配置 .env.local 中的 DEEPSEEK_API_KEY",
      "blocksStage": "implement",
      "verification": {
        "type": "env_var",
        "envVar": "DEEPSEEK_API_KEY"
      }
    },
    {
      "id": "manual-plan-2",
      "description": "创建 data/knowledge-sources/ 目录并下载 5 个 PDF",
      "blocksStage": "implement",
      "verification": {
        "type": "dir_exists",
        "path": "data/knowledge-sources/"
      }
    }
  ],
  "reviewerNotes": "整体审核观察、对 Plan 撰写者的建议、需要重点关注的地方",
  "summary": "一句话总结审核结论"
}
```

### Verdict 判定规则

- **verdict = "fail"** 触发条件（任一即 fail）：
  - 完整性层任意 check status === "fail"
  - 质量层 Check 2.2（不引入未授权依赖）status === "fail"——违反 PRD Technical Constraints
  - 质量层 Check 2.3（不修改 Non-Goals）status === "fail"——范围越界
  - 一致性层 Check 3.1（覆盖所有 PRD FR）status === "fail"——FR 未覆盖
  - 一致性层 Check 3.4（不破坏保留接口）status === "fail"——破坏保留接口

- **warning 不阻塞 verdict = "pass"**，但需在 reviewerNotes 中提示用户

### Evidence 字段要求

- 必须**引用 Plan 或 PRD 的具体段落/章节**
- fail 状态的 evidence 必须包含**具体可执行的修改建议**
- 涉及 PRD 对照时，必须同时引用 PRD 和 Plan 的对应位置

### Manual Items ID 规则

- 格式：`manual-plan-{seq}`，seq 从 1 起递增

### Verification 字段使用

| type | 必填子字段 | 典型场景 |
|---|---|---|
| `env_var` | `envVar` | "申请 X API key 并配置 .env.local" |
| `file_exists` | `path` | "下载 X 文件到指定路径" |
| `dir_exists` | `path` | "创建 X 目录" |
| `command` | `command`（可选 `expectExitCode`） | "执行 `supabase migration up` 应用 migration" |
| `manual_only` | （无） | 业务方向决策、联系上游团队等无法自动验证的事项 |

---

## 当前 agent 渲染规则

接收 subagent JSON 后，按以下格式渲染 markdown 给用户：

```markdown
# Plan Review Report: {id}

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

（若 manualActionItems 非空，逐条展示）
- [{id}] {description}
  - 阻塞阶段: {blocksStage}
  - 自动验证: {verification.type}（{对应子字段}）

（若 manualActionItems 为空）
本阶段无 manual items。

## 审核者备注

{reviewerNotes}

## 下一步

- 若 verdict === "pass" 且无 pending manual items：可执行 `/test-plan`
- 若 verdict === "fail"：根据上述 fail check 修改 Plan 后重新执行 `/review-plan`
- 若有 pending manual items：处理后执行 `/verify-manual {item-id}`
- 紧急需要跳过：`/skip-review plan --reason "..."`（不推荐）
```

---

## Reviewer 行为原则

1. **客观对照 PRD**：发现 Plan 不覆盖某条 FR、违反某条 Constraint，必须 fail
2. **挑战 trade-off**：每个技术选型都要问"为什么不是 Y"
3. **完整识别 manual items**：宁可识别多，不可漏识别
4. **不假装看了代码**：如果对项目结构不确定，必须在审核者备注中说明"未深入对照实际代码，建议用户手动确认 X"
