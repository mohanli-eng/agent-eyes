# PRD Template & Writing Standards

本文档定义 vibe-delivery 工作流中 PRD 的撰写规范。`/draft-prd` 按本模板生成，`/review-prd` 按本规范审核。

---

## 1. PRD 必须包含的章节

PRD 文件必须按以下顺序包含**全部章节**，缺一不可：

```markdown
# PRD: {id}

## 0. 用户故事一句话总结
（一句话陈述：作为 X，希望 Y，以便 Z）

## 1. Background & Problem
（一段话说明为什么做这个功能，当前痛点是什么）

## 2. Goals
（本次交付要达成的具体目标，可量化）

## 3. Non-Goals (Out of Scope)
（明确排除的范围，避免范围蔓延）

## 4. Functional Requirements
（功能需求，用 user story + AC 格式）

## 5. Acceptance Criteria
（验收标准，每条 FR 至少对应一条 AC）

## 6. Technical Constraints
（不可逾越的技术约束：必须用 X 框架、不能引入 Y 依赖等）

## 7. Dependencies & Risks
（外部依赖：API key、第三方服务、第三方文档等；已识别的风险）

## 8. Success Metrics
（怎样算这次交付成功？可量化的指标）

## 9. Open Questions
（PRD 撰写过程中未能确定的开放问题，留给后续阶段澄清）

## 10. References
（参考文档、相关 PRD、设计文档等）
```

---

## 2. PRD 严禁包含的章节（关键）

以下章节**绝对不能出现在 PRD 中**。出现即视为 PRD 越界：

### ❌ Implementation Phasing / 实施阶段

PRD 不描述"先做 A、再做 B、然后做 C"这种步骤拆分。这属于 `/plan` 阶段产出，混入 PRD 会让 agent 跳过 /plan 直接执行 phasing。

### ❌ 时间预算 / Time Estimates

PRD 不写"预计 2 天完成"、"Phase 1 半天"等。时间预估属于 `/plan` 阶段的产出。

### ❌ 具体步骤拆分 / Step-by-step Instructions

PRD 不写"Step 1: 改 X 文件；Step 2: 跑 Y 命令"。这是 `/plan` 阶段的事。

### ❌ 技术实现细节 / Technical How-to

PRD 描述 WHAT 和 WHY，不描述 HOW。
- ✅ PRD 允许：「系统必须支持中文跨语言检索」（WHAT）
- ❌ PRD 禁止：「用 gemini-embedding-001 + pgvector 实现」（HOW，属于 /plan）

**例外**：Technical Constraints 章节可以描述"不能引入 X 依赖"这类硬约束，但不能描述"必须用 Y 实现"。

### ❌ 测试策略 / Testing Strategy

PRD 写 Acceptance Criteria（什么算通过验收），不写"用 vitest 单元测试 + Playwright E2E"。测试策略属于 `/test-plan` 阶段。

---

## 3. 各章节撰写规范

### 0. 用户故事一句话总结

**必须**：一句话，包含三要素：
- 作为 X（用户角色）
- 希望 Y（想做的事）
- 以便 Z（业务价值）

**示例**：
> 作为 AuraDiet 用户，我希望能用中文向 AI 营养师提问，以便获得基于权威指南的可信回答。

### 1. Background & Problem

**必须**：
- 一段话陈述背景（不超过 3 个段落）
- 必须明确"当前痛点"
- 必须解释"为什么现在做"

**禁止**：
- 长篇背景介绍
- 写实施计划

### 2. Goals

**必须**：
- 列举 3-7 条目标
- 每条目标必须**可验证**（能回答"是否达成")
- 目标必须聚焦本次交付，不写 long-term vision

**示例**：
- ✅ "RAG 检索 Recall@5 ≥ 80%" （可验证）
- ❌ "提升用户体验" （不可验证）
- ❌ "成为最好的 AI 营养应用" （long-term vision）

### 3. Non-Goals (Out of Scope)

**必须**：
- 明确列出本次**不做**的事
- 与 Goals 对称（凡是可能被误以为在范围内的都应排除）

**为什么这章很重要**：
- 防止 agent 在 /plan 或 /implement 阶段做范围外的工作
- 明确"下个版本才做"的事，避免本版本范围爆炸

### 4. Functional Requirements

**必须**：每条 FR 用 user story 格式 + AC 列表：

```markdown
### US-01: {故事标题}
**用户故事**：作为 {角色}，我希望 {操作}，以便 {价值}

**正向验收标准**：
- AC-01-1: {可量化、可测试的条件，描述结果而非过程} `[→ TC-XX]`
- AC-01-2: ...

**异常验收标准**：
- AC-01-E1: 给定 {异常输入}，返回 {具体响应} `[→ TC-XX]`
- AC-01-E2: ...
```

**关键约束**：

1. **验收标准必须精确、无歧义、可验证**
   - ✅ "用户可在 3 秒内看到结果"
   - ❌ "响应要快"

2. **每条正向 AC 必须包含「具体输入 → 具体可断言输出」**
   - ✅ "返回包含 h1-h6 文本、所有 button 的 accessible name、所有 link 的 href 和 text 的快照"
   - ❌ "返回快照"

3. **异常情况按以下规则归类**：
   - 特定于某 US 的异常 → 写到该 US 的"异常验收标准"
   - 跨多个 US 共享的异常 → 写到"通用异常处理"章节
   - **禁止**异常情况以独立散表呈现（孤儿问题）

### 5. Acceptance Criteria

**注意**：本章节是对 Section 4 中所有 AC 的汇总索引，便于 review 阶段对照检查。

```markdown
| AC ID | 来源 US | 描述 | 测试用例占位 |
|---|---|---|---|
| AC-01-1 | US-01 | ... | TC-XX |
| AC-01-2 | US-01 | ... | TC-XX |
| AC-01-E1 | US-01 | ... | TC-XX |
| ... | ... | ... | ... |
```

### 6. Technical Constraints

**必须**：
- 列出**不可逾越的技术边界**
- 用"必须"/"不能"明确语气

**示例**：
- ✅ "必须使用 Next.js 16 + App Router"
- ✅ "不能引入新的向量数据库（继续用 Supabase pgvector）"
- ✅ "测试栈必须保持 vitest + jsdom@24，不能升级"

**禁止**：
- ❌ 描述具体实现（"用 X 函数实现"）
- ❌ 描述 phasing（"先改 A 再改 B"）

### 7. Dependencies & Risks

**必须**：
- 列出所有外部依赖（API key、第三方服务、第三方数据源）
- 列出已识别的风险与缓解措施

**示例**：
```markdown
| 依赖/风险 | 影响 | 缓解 |
|---|---|---|
| DeepSeek API | 没 key 无法启动 Faithfulness 评估 | 在 /implement 前需用户配置 |
| Cross-lingual recall loss | 约 5-10% recall 损失 | 在评估集中显式测量 |
```

### 8. Success Metrics

**必须**：可量化指标，证明"这次交付成功了"。

**与 Goals 的区别**：
- Goals 是"要达成什么"
- Success Metrics 是"怎么知道达成了"

**示例**：
- "30 题金标准评估集上 Recall@5 ≥ 80%"
- "Faithfulness（LLM-as-judge sentence-level）≥ 85%"

### 9. Open Questions

**必须**：列出 PRD 撰写过程中**没能确定的事**，留给后续阶段处理。

**这是 PRD Author 诚实性的体现**——遇到模糊就列出来，不要自动假设。

**示例**：
- "评估集 expected_chunks 是手动 lookup 还是工具辅助？" → 留给 /plan
- "是否需要支持移动端图片上传？" → 留给业务方决策

### 10. References

**必须**：列出相关文档、相关 PRD、设计文档。

**禁止**：随便堆链接。每个链接必须**说明关联性**。

---

## 4. PRD 撰写流程（供 /draft-prd 参考）

### Step 1: 解析用户需求草稿

读取用户提供的自然语言需求，识别：
- 核心业务目标（→ Section 1, 2）
- 涉及的用户角色（→ Section 4）
- 关键功能点（→ Section 4）
- 可能的非功能需求（→ Section 4 末尾或 Section 8）
- 已知的技术约束（→ Section 6）
- 外部依赖（→ Section 7）

### Step 2: 识别开放问题

**最重要的一步**：把所有"我没法从草稿中确定的事"列出来，包括：
- 业务边界模糊（"是否包含 X 功能？"）
- 技术方向不明（"用 A 还是 B 方案？" — 注意：这是技术方向选择，不是技术实现）
- 优先级未定（"如果时间不够，先做哪个？"）
- 用户行为未定（"用户在 X 场景下期望看到什么？"）

### Step 3: 主动询问用户

按以下格式向用户提问，**等待用户回答后再继续**：

```
我从您的需求中识别了 N 个开放问题，需要您先回答以确保 PRD 不做错误假设：

1. {开放问题 1}
   - 候选方案 A: ...
   - 候选方案 B: ...
   - 您的选择？

2. {开放问题 2}
   ...
```

**严禁**：自动假设并写入 PRD。**遇到模糊必须问，不能猜**。

### Step 4: 生成 PRD

按本模板生成 PRD，**严格遵守**：

1. 包含全部 11 个必需章节（含 Section 0）
2. 严禁章节绝对不出现
3. 每个 FR 必须对应 AC
4. Goals 与 Non-Goals 对称
5. 任何外部依赖必须列入 Dependencies & Risks
6. Open Questions 必须如实列出（不能"为了显得完整"清空）

### Step 5: 输出与确认

保存至 `references/prd-{id}.md`，呈现给用户确认。

提示用户："PRD 已生成。下一步：必须执行 `/review-prd` 对 PRD 进行规范性审核。"

---

## 5. 常见反模式

### 反模式 1：PRD 写得像项目计划

❌ 错误示例：
```markdown
## Implementation Phasing
Phase 1: 改 service 层 (1 天)
Phase 2: 改 evaluation 脚本 (半天)
Phase 3: 跑 eval (半天)
```

→ 这种内容应放在 /plan 阶段，**不能写进 PRD**。

### 反模式 2：AC 不可验证

❌ 错误示例：
- "用户体验流畅"
- "响应速度合理"
- "性能良好"

✅ 正确示例：
- "首屏渲染时间 ≤ 1.5s (p50)"
- "API 响应延迟 ≤ 500ms (p50)"

### 反模式 3：Goals 与 Non-Goals 不对称

❌ 错误示例：
```markdown
## Goals
- 实现 RAG 升级

## Non-Goals
- 不做 v3 功能
```

✅ 正确示例：
```markdown
## Goals
- 向量存储真实化（pgvector）
- Hybrid retrieval（BM25 + dense + RRF）
- 评估集 30 题 + Recall@5 / Faithfulness 指标

## Non-Goals
- ❌ Multi-agent / agent loop
- ❌ GraphRAG
- ❌ 完整 LangChain → LangGraph 全替换
- ❌ 训练自定义 embedding 模型
```

→ Non-Goals 应该枚举具体被排除的方向，与 Goals 一一对照。

### 反模式 4：开放问题被自动假设

❌ 错误：PRD 中没有 Open Questions 章节，但实际上有大量假设。

✅ 正确：所有不确定的事**显式列入 Open Questions**，等用户在 /plan 或后续阶段澄清。

### 反模式 5：Technical Constraints 描述实现

❌ 错误示例：
- "用 Gemini-2.5-Flash 生成答案"
- "用 BAAI/bge-reranker-v2-m3 做 rerank"

→ 这是具体技术选型，属于 /plan 产出。

✅ 正确示例：
- "必须使用 Gemini 系列 LLM（与现有 .env 配置一致）"
- "Rerank 必须有降级路径（API 失败时不阻塞主流程）"

→ 描述约束，不描述实现。

---

## 6. PRD 质量自检清单

提交 PRD 前，撰写者（无论是用户还是 /draft-prd）应自查：

- [ ] 包含全部 11 个必需章节（Section 0-10）
- [ ] 严禁章节（Phasing / 时间预算 / 步骤拆分 / Testing Strategy / Technical How-to）不存在
- [ ] 每个 FR 都有对应 AC
- [ ] 每个 AC 都可量化可验证
- [ ] Goals 与 Non-Goals 对称
- [ ] 所有外部依赖列入 Dependencies & Risks
- [ ] Open Questions 如实列出，未自动假设
- [ ] 异常场景按归属分类（特定 US 内 vs 通用异常处理）
- [ ] References 链接都说明了关联性

通过自检后再提交 `/review-prd`。
