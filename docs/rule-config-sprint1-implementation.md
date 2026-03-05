# Rule Config Sprint 1 Implementation

## 1) 本次已交付

### API（Hono）
- 规则模板：
  - `GET /rule-templates`
  - `POST /rule-templates/:id/apply`
- 规则引擎：
  - `POST /rules/parse`（自然语言解析 + 冲突检测 + 智能建议）
  - `POST /rules/conflicts/check`
  - `POST /rules/preview`（基于历史快照的影响预估）
- 规则版本管理：
  - `GET /rulesets?tenantId=...`
  - `GET /rulesets/:id`
  - `POST /rulesets`（创建规则集 + v1）
  - `PUT /rulesets/:id`（生成新版本）
  - `POST /rulesets/:id/rollback`（回滚到历史版本并生成新版本）

### Frontend（Next.js）
- 新增规则配置工作台页面：`/rules`
- 首页改为控制台入口，提供 `/rules` 与 `/approvals` 导航
- 审批面板迁移到独立路由：`/approvals`
- 规则工作台已包含：
  - 自然语言编辑
  - 模板叠加
  - 实时结构化预览
  - 冲突面板
  - 智能建议面板
  - 版本列表与回滚
  - 生效预览

### 数据层
- 使用已新增 Prisma 模型：`RuleSet / RuleVersion / RuleConflictRecord / RuleSuggestionRecord`
- 持久化规则版本时同步写入冲突与建议记录

### 契约
- OpenAPI 补充 rules/rulesets/rule-templates 相关接口与 schema

## 2) 当前能力边界

- 规则解析是 **MVP 规则抽取器**（正则 + 关键词），支持中英文常见表达，不是完整 DSL 编译器。
- 冲突检测覆盖四类冲突（直接矛盾、逻辑冲突、范围风险、优先级歧义），当前为启发式判定。
- 生效预览基于历史快照估算，属于运营预览，不是数字孪生级仿真。

## 3) 验证结果

- `pnpm --filter @apps/api typecheck` ✅
- `pnpm --filter @apps/web typecheck` ✅
- `pnpm --filter @apps/api build` ✅
- `pnpm --filter @apps/web build` ✅
- `pnpm week8:validate` ✅（原有 6 个 E2E 场景全部通过）

## 4) 继续开发注意事项（Phase 2 前置）

1. 规则语义升级
- 引入 `Rule DSL AST`（条件、动作、优先级、作用域），替换纯正则解析。
- 解析结果必须可映射到 Intent Schema（domain/action/target/risk/reasoning）。

2. 多租户安全
- 所有 rules 相关查询必须强制 `tenantId` 过滤。
- 建议在 API 中补统一中间件做 tenant 校验，避免漏筛。

3. 冲突引擎可解释性
- 每个冲突需输出：冲突场景、影响对象、推荐修复方案、可选自动修复 patch。

4. 建议引擎数据化
- 当前建议以启发式为主，下一阶段需接入租户历史窗口与行业基线。
- 忽略建议后要记忆（避免重复轰炸）。

5. 版本治理
- 增加“发布态”与“草稿态”隔离（编辑草稿、发布生效）。
- 增加版本 diff API，支持任意两版本对比。

6. Agent 对接
- Agent 不可直接执行动作，必须输出 Intent。
- 在 Policy Engine/Constitution 层完成拦截，再路由执行。

7. 测试
- 增加规则解析与冲突检测单元测试。
- 增加 ruleset create/update/rollback 的 API 集成测试。

## 5) 关键文件

- `apps/api/src/rules-engine.ts`
- `apps/api/src/rule-templates.ts`
- `apps/api/src/server.ts`
- `apps/web/components/rule-studio.tsx`
- `apps/web/lib/api.ts`
- `apps/web/app/rules/page.tsx`
- `packages/agent-contract/openapi.yaml`

