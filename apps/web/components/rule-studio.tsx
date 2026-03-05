'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  RUNTIME_FACTS_JSON_SCHEMA,
  RUNTIME_FACT_FIELDS,
  type RuntimeFactGroup,
  type RuntimeFactPrimitive,
} from '@repo/shared-types';
import {
  applyRuleTemplate,
  compileRuleIntents,
  createRuleSet,
  listRuleSets,
  listRuleTemplates,
  parseRules,
  previewRules,
  rollbackRuleSet,
  updateRuleSet,
  type ParsedRule,
  type CompiledIntentDecision,
  type RuleConflict,
  type RuleDslAst,
  type RuleSetSummary,
  type RuleSuggestion,
  type RuleTemplate,
} from '../lib/api';
import { useTenant } from './tenant-context';
import { Card, PageHeader, Badge } from './ui';

interface PreviewData {
  affectedListings: number;
  totalListings: number;
  estimatedSpendDeltaPct: number;
  estimatedSalesDeltaPct: number;
  estimatedAcosFrom: number;
  estimatedAcosTo: number;
  examples: Array<{ listingTitle: string; current: string; projected: string }>;
}

interface CompiledIntentView {
  intent: {
    intentId: string;
    domain: string;
    action: string;
    target: { type: string; id: string };
    scope: Record<string, string | undefined>;
    payload: Record<string, unknown>;
    risk: { score: number; level: string; violations: string[] };
    reasoning: { summary: string; evidence: Array<{ metric: string; value: string | number }> };
    createdAt: string;
  };
  decision: CompiledIntentDecision;
  condition: {
    expression: string;
    dependencies: string[];
    matched: boolean;
    missingFields: string[];
  };
}

function statusClass(severity: RuleConflict['severity']): string {
  if (severity === 'CRITICAL') return 'REJECTED';
  if (severity === 'WARNING') return 'PENDING';
  return 'APPROVED';
}

function groupLabel(group: RuntimeFactGroup): string {
  if (group === 'ads') return '广告';
  if (group === 'inventory') return '库存';
  if (group === 'risk') return '风险';
  return '上下文';
}

function levelLabel(level: 'required' | 'recommended' | 'optional'): string {
  if (level === 'required') return '必填';
  if (level === 'recommended') return '推荐';
  return '可选';
}

function validateRuntimeFactsInput(text: string): {
  parsed: Record<string, RuntimeFactPrimitive> | null;
  errors: string[];
} {
  let parsedUnknown: unknown;
  try {
    parsedUnknown = JSON.parse(text);
  } catch {
    return { parsed: null, errors: ['runtimeFacts 必须是合法 JSON'] };
  }

  if (!parsedUnknown || typeof parsedUnknown !== 'object' || Array.isArray(parsedUnknown)) {
    return { parsed: null, errors: ['runtimeFacts 必须是 JSON 对象'] };
  }

  const parsed = parsedUnknown as Record<string, RuntimeFactPrimitive>;
  const errors: string[] = [];
  const fieldMap = new Map(RUNTIME_FACT_FIELDS.map((field) => [field.key, field.type]));

  for (const [key, value] of Object.entries(parsed)) {
    const expected = fieldMap.get(key);
    if (!expected) {
      errors.push(`未知字段: ${key}`);
      continue;
    }
    if (value === null || value === undefined) continue;
    const actual = typeof value;
    if (actual !== expected) {
      errors.push(`字段 ${key} 类型错误，期望 ${expected}，实际 ${actual}`);
    }
  }

  for (const field of RUNTIME_FACT_FIELDS) {
    if (field.level === 'required' && (parsed[field.key] === undefined || parsed[field.key] === null || parsed[field.key] === '')) {
      errors.push(`缺少必填字段: ${field.key}`);
    }
  }

  return { parsed, errors };
}

function formatDiffValue(value: RuntimeFactPrimitive): string {
  if (value === undefined) return 'undefined';
  return JSON.stringify(value);
}

function buildRuntimeFactsDiff(
  baseline: Record<string, RuntimeFactPrimitive> | null,
  current: Record<string, RuntimeFactPrimitive> | null,
): Array<{ type: 'added' | 'removed' | 'changed'; key: string; before?: RuntimeFactPrimitive; after?: RuntimeFactPrimitive }> {
  const b = baseline ?? {};
  const c = current ?? {};
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(c)])).sort();
  const diff: Array<{ type: 'added' | 'removed' | 'changed'; key: string; before?: RuntimeFactPrimitive; after?: RuntimeFactPrimitive }> = [];

  for (const key of keys) {
    const before = b[key];
    const after = c[key];
    if (before === undefined && after !== undefined) {
      diff.push({ type: 'added', key, after });
      continue;
    }
    if (before !== undefined && after === undefined) {
      diff.push({ type: 'removed', key, before });
      continue;
    }
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      diff.push({ type: 'changed', key, before, after });
    }
  }
  return diff;
}

export function RuleStudio() {
  const { currentTenantId: tenantId } = useTenant();
  const [createdBy, setCreatedBy] = useState('operator');
  const [ruleSetName, setRuleSetName] = useState('默认规则集');
  const [ruleText, setRuleText] = useState(
    '我们的产品毛利率较高，ACoS目标控制在35%以内。库存低于7天时暂停广告。新品上架30天可适度放宽。',
  );

  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [ruleSets, setRuleSets] = useState<RuleSetSummary[]>([]);
  const [activeRuleSetId, setActiveRuleSetId] = useState<string | null>(null);
  const [compileTargetId, setCompileTargetId] = useState('LISTING-DEMO-001');
  const [runtimeFactsText, setRuntimeFactsText] = useState('{\"acos\": 31, \"bid_change_pct\": 10, \"inventory_days\": 5, \"risk_profile\": \"CONSERVATIVE\", \"platform\": \"amazon\", \"market\": \"US\"}');
  const [runtimeFactsBaselineText, setRuntimeFactsBaselineText] = useState('{\"acos\": 31, \"bid_change_pct\": 10, \"inventory_days\": 5, \"risk_profile\": \"CONSERVATIVE\", \"platform\": \"amazon\", \"market\": \"US\"}');
  const [showRequiredOnlyDiff, setShowRequiredOnlyDiff] = useState(false);
  const [showHighRiskDiffOnly, setShowHighRiskDiffOnly] = useState(false);

  const [parsedRules, setParsedRules] = useState<ParsedRule[]>([]);
  const [dslAst, setDslAst] = useState<RuleDslAst | null>(null);
  const [unparsedSegments, setUnparsedSegments] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<RuleConflict[]>([]);
  const [suggestions, setSuggestions] = useState<RuleSuggestion[]>([]);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [compiledIntents, setCompiledIntents] = useState<CompiledIntentView[]>([]);
  const [compileSummary, setCompileSummary] = useState<{
    total: number;
    approved: number;
    rejected: number;
    queued: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeRuleSet = useMemo(
    () => ruleSets.find((ruleSet) => ruleSet.id === activeRuleSetId) ?? null,
    [ruleSets, activeRuleSetId],
  );
  const runtimeFactTypeHints = useMemo(
    () =>
      RUNTIME_FACT_FIELDS.reduce<Record<string, string>>((acc, field) => {
        acc[field.key] = field.type;
        return acc;
      }, {}),
    [],
  );
  const runtimeFactsValidation = useMemo(
    () => validateRuntimeFactsInput(runtimeFactsText),
    [runtimeFactsText],
  );
  const runtimeFactsBaselineValidation = useMemo(
    () => validateRuntimeFactsInput(runtimeFactsBaselineText),
    [runtimeFactsBaselineText],
  );
  const runtimeFactsGrouped = useMemo(() => {
    const groups: Record<RuntimeFactGroup, typeof RUNTIME_FACT_FIELDS> = {
      ads: [],
      inventory: [],
      risk: [],
      context: [],
    };
    for (const field of RUNTIME_FACT_FIELDS) {
      groups[field.group].push(field);
    }
    return groups;
  }, []);
  const runtimeFactsDiff = useMemo(
    () => buildRuntimeFactsDiff(runtimeFactsBaselineValidation.parsed, runtimeFactsValidation.parsed),
    [runtimeFactsBaselineValidation.parsed, runtimeFactsValidation.parsed],
  );
  const requiredRuntimeFactKeys = useMemo(
    () => new Set(RUNTIME_FACT_FIELDS.filter((field) => field.level === 'required').map((field) => field.key)),
    [],
  );
  const runtimeFactsDiffFiltered = useMemo(
    () => {
      let filtered = runtimeFactsDiff;
      if (showRequiredOnlyDiff) {
        filtered = filtered.filter((item) => requiredRuntimeFactKeys.has(item.key));
      }
      if (showHighRiskDiffOnly) {
        filtered = filtered.filter((item) => item.type === 'removed' || item.type === 'changed');
      }
      return filtered;
    },
    [runtimeFactsDiff, requiredRuntimeFactKeys, showRequiredOnlyDiff, showHighRiskDiffOnly],
  );

  async function refreshRuleSets(): Promise<void> {
    const items = await listRuleSets(tenantId);
    setRuleSets(items);
    if (!activeRuleSetId && items.length > 0) {
      setActiveRuleSetId(items[0].id);
    }
  }

  useEffect(() => {
    async function init(): Promise<void> {
      try {
        setError(null);
        const [templateItems] = await Promise.all([listRuleTemplates(), refreshRuleSets()]);
        setTemplates(templateItems);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      }
    }

    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void handleAnalyze();
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleText, tenantId]);

  async function handleAnalyze(): Promise<void> {
    if (!ruleText.trim()) {
      setParsedRules([]);
      setDslAst(null);
      setConflicts([]);
      setSuggestions([]);
      setUnparsedSegments([]);
      return;
    }

    try {
      const result = await parseRules(tenantId, ruleText);
      setParsedRules(result.parse.rules);
      setDslAst(result.parse.ast);
      setUnparsedSegments(result.parse.unparsedSegments);
      setConflicts(result.conflicts);
      setSuggestions(result.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : '规则解析失败');
    }
  }

  async function handleApplyTemplate(templateId: string): Promise<void> {
    try {
      setLoading(true);
      setError(null);
      const result = await applyRuleTemplate(templateId);
      setRuleText((prev) => `${prev}\n${result.generatedRuleText}`.trim());
      setMessage('模板已叠加到规则编辑器');
    } catch (err) {
      setError(err instanceof Error ? err.message : '模板应用失败');
    } finally {
      setLoading(false);
    }
  }

  async function handlePreview(): Promise<void> {
    try {
      setLoading(true);
      setError(null);
      const result = await previewRules(tenantId, parsedRules);
      setPreview(result.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : '预览失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateOrUpdate(): Promise<void> {
    if (!ruleSetName.trim()) {
      setError('规则集名称不能为空');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (!activeRuleSetId) {
        const result = await createRuleSet({
          tenantId,
          name: ruleSetName,
          createdBy,
          ruleText,
          status: 'DRAFT',
          changeSummary: 'UI create',
        });
        setActiveRuleSetId(result.item.id);
        setMessage('规则集已创建并生成版本 v1');
      } else {
        await updateRuleSet(activeRuleSetId, {
          tenantId,
          updatedBy: createdBy,
          ruleText,
          name: ruleSetName,
          changeSummary: 'UI update',
        });
        setMessage('规则集已更新并生成新版本');
      }
      await refreshRuleSets();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleCompileIntents(execute: boolean): Promise<void> {
    if (!dslAst) {
      setError('请先解析规则并生成 AST');
      return;
    }
    if (!compileTargetId.trim()) {
      setError('请填写目标 ID');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (!runtimeFactsValidation.parsed || runtimeFactsValidation.errors.length > 0) {
        setError('runtimeFacts 校验失败，请先修正后再编译');
        return;
      }
      const runtimeFacts = Object.fromEntries(
        Object.entries(runtimeFactsValidation.parsed).filter(([, value]) => value !== undefined),
      ) as Record<string, string | number | boolean | null>;
      const result = await compileRuleIntents({
        tenantId,
        target: { type: 'listing', id: compileTargetId },
        ast: dslAst,
        runtimeFacts,
        execute,
      });
      setCompiledIntents(result.intents);
      setCompileSummary(result.summary);
      setMessage(execute ? `已提交 ${result.summary.queued} 条 intent 到执行队列` : 'Intent 编译完成');
      setRuntimeFactsBaselineText(JSON.stringify(runtimeFacts, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Intent 编译失败');
    } finally {
      setLoading(false);
    }
  }

  function insertRuntimeFactField(fieldKey: string): void {
    const base =
      runtimeFactsValidation.parsed && typeof runtimeFactsValidation.parsed === 'object'
        ? { ...runtimeFactsValidation.parsed }
        : ({} as Record<string, RuntimeFactPrimitive>);
    const field = RUNTIME_FACT_FIELDS.find((item) => item.key === fieldKey);
    if (!field) return;
    base[field.key] = field.example as RuntimeFactPrimitive;
    setRuntimeFactsText(JSON.stringify(base, null, 2));
  }

  function updateRuntimeFactField(fieldKey: string, rawValue: string | boolean): void {
    const field = RUNTIME_FACT_FIELDS.find((item) => item.key === fieldKey);
    if (!field) return;
    const base =
      runtimeFactsValidation.parsed && typeof runtimeFactsValidation.parsed === 'object'
        ? { ...runtimeFactsValidation.parsed }
        : ({} as Record<string, RuntimeFactPrimitive>);

    if (field.type === 'boolean') {
      base[field.key] = Boolean(rawValue);
      setRuntimeFactsText(JSON.stringify(base, null, 2));
      return;
    }

    if (typeof rawValue !== 'string') return;
    if (rawValue.trim().length === 0) {
      delete base[field.key];
      setRuntimeFactsText(JSON.stringify(base, null, 2));
      return;
    }

    if (field.type === 'number') {
      const num = Number(rawValue);
      if (Number.isFinite(num)) {
        base[field.key] = num;
        setRuntimeFactsText(JSON.stringify(base, null, 2));
      }
      return;
    }

    base[field.key] = rawValue;
    setRuntimeFactsText(JSON.stringify(base, null, 2));
  }

  async function handleRollback(version: number): Promise<void> {
    if (!activeRuleSetId) return;

    try {
      setLoading(true);
      setError(null);
      await rollbackRuleSet(activeRuleSetId, {
        tenantId,
        toVersion: version,
        updatedBy: createdBy,
        changeSummary: `Rollback to v${version}`,
      });
      setMessage(`已回滚并生成新版本（基于 v${version}）`);
      await refreshRuleSets();
    } catch (err) {
      setError(err instanceof Error ? err.message : '回滚失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <PageHeader
        title="规则配置工作台"
        subtitle="多租户规则编辑、冲突检测、版本管理与生效预览"
      />

      <Card style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
          <label>
            <span className="small">操作者</span>
            <input value={createdBy} onChange={(event) => setCreatedBy(event.target.value)} style={{ width: '100%', padding: 8 }} />
          </label>
          <label>
            <span className="small">规则集名称</span>
            <input value={ruleSetName} onChange={(event) => setRuleSetName(event.target.value)} style={{ width: '100%', padding: 8 }} />
          </label>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
        <Card style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>模板库</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {templates.map((template) => (
              <div key={template.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                <strong>{template.name}</strong>
                <div className="small">{template.category} · {template.scenario}</div>
                <div className="small" style={{ marginTop: 4 }}>{template.description}</div>
                <button type="button" onClick={() => void handleApplyTemplate(template.id)} style={{ marginTop: 8 }} disabled={loading} title="Apply this template to the rule editor">
                  使用模板
                </button>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 16 }}>
          <Card style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>规则编辑器</h3>
            <textarea
              value={ruleText}
              onChange={(event) => setRuleText(event.target.value)}
              rows={10}
              style={{ width: '100%', resize: 'vertical', padding: 12, borderColor: 'var(--border)' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => void handleAnalyze()} disabled={loading} title="Parse the rule text to detect conflicts and generate AST">解析规则</button>
              <button type="button" onClick={() => void handlePreview()} disabled={loading || parsedRules.length === 0} title="Preview the estimated impact of these rules on active listings">生效预览</button>
              <button type="button" className="approve" onClick={() => void handleCreateOrUpdate()} disabled={loading} title="Save these rules as a new version in the current ruleset">保存规则集</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
              <input
                value={compileTargetId}
                onChange={(event) => setCompileTargetId(event.target.value)}
                style={{ padding: 8, width: 220 }}
                placeholder="target listing id"
              />
              <button type="button" onClick={() => void handleCompileIntents(false)} disabled={loading || !dslAst} title="Compile the rules into theoretical intents without executing">
                编译 Intent
              </button>
              <button type="button" className="approve" onClick={() => void handleCompileIntents(true)} disabled={loading || !dslAst} title="Compile and immediately push intents to the execution queue">
                编译并执行
              </button>
            </div>
            <textarea
              value={runtimeFactsText}
              onChange={(event) => setRuntimeFactsText(event.target.value)}
              rows={3}
              style={{ width: '100%', marginTop: 8, padding: 8 }}
              placeholder='{"acos": 31, "inventory_days": 5}'
            />
            <Card style={{ marginTop: 10, padding: 10 }}>
              <div className="small" style={{ marginBottom: 8 }}>
                结构化表单（与 JSON 双向联动）
              </div>
              {(['ads', 'inventory', 'risk', 'context'] as RuntimeFactGroup[]).map((group) => (
                <div key={group} style={{ marginBottom: 10 }}>
                  <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>
                    {groupLabel(group)}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))',
                      gap: 8,
                    }}
                  >
                    {runtimeFactsGrouped[group].map((field) => {
                      const value = runtimeFactsValidation.parsed?.[field.key];
                      return (
                        <label
                          key={field.key}
                          style={{
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            padding: 8,
                            display: 'grid',
                            gap: 4,
                          }}
                        >
                          <span className="small">
                            {field.key} ({field.type}) · {levelLabel(field.level)}
                          </span>
                          {field.type === 'boolean' ? (
                            <input
                              type="checkbox"
                              checked={value === true}
                              onChange={(event) => updateRuntimeFactField(field.key, event.target.checked)}
                            />
                          ) : (
                            <input
                              type={field.type === 'number' ? 'number' : 'text'}
                              value={typeof value === 'undefined' || value === null ? '' : String(value)}
                              onChange={(event) => updateRuntimeFactField(field.key, event.target.value)}
                              placeholder={String(field.example)}
                              style={{ padding: 6 }}
                            />
                          )}
                          <span className="small">{field.description}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </Card>
            <div className="small" style={{ marginTop: 6 }}>
              JSON Schema: {RUNTIME_FACTS_JSON_SCHEMA.$id}
            </div>
            <div className="small" style={{ marginTop: 6 }}>
              字段自动补全：
              {RUNTIME_FACT_FIELDS.map((field) => (
                <button
                  key={field.key}
                  type="button"
                  title="Insert this field into the JSON input"
                  onClick={() => insertRuntimeFactField(field.key)}
                  style={{ marginLeft: 6, padding: '2px 6px' }}
                >
                  {field.key}
                </button>
              ))}
            </div>
            <div className="small" style={{ marginTop: 6 }}>
              字段类型提示：{Object.entries(runtimeFactTypeHints).map(([key, type]) => `${key}:${type}`).join(' | ')}
            </div>
            <Card style={{ marginTop: 10, padding: 10 }}>
              <div className="small" style={{ marginBottom: 6 }}>
                JSON Diff 预览（提交前，相对上次提交基线）
              </div>
              <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={showRequiredOnlyDiff}
                  onChange={(event) => setShowRequiredOnlyDiff(event.target.checked)}
                />
                只看必填字段变化（高风险审阅）
              </label>
              <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={showHighRiskDiffOnly}
                  onChange={(event) => setShowHighRiskDiffOnly(event.target.checked)}
                />
                仅显示变更类型 removed/changed
              </label>
              {runtimeFactsDiffFiltered.length === 0 ? (
                <div className="small">无变化</div>
              ) : (
                runtimeFactsDiffFiltered.map((item) => (
                  <div key={`${item.type}-${item.key}`} className="small" style={{ marginBottom: 4 }}>
                    [{item.type}] {item.key}
                    {item.type !== 'added' ? `: ${formatDiffValue(item.before)}` : ''}
                    {item.type === 'changed' ? ' -> ' : item.type === 'added' ? ': ' : ' -> (removed)'}
                    {item.type !== 'removed' ? formatDiffValue(item.after) : ''}
                  </div>
                ))
              )}
            </Card>
            {runtimeFactsValidation.errors.length > 0 ? (
              <div style={{ marginTop: 8 }}>
                {runtimeFactsValidation.errors.map((errItem) => (
                  <div key={errItem} className="small" style={{ color: '#b42318' }}>
                    {errItem}
                  </div>
                ))}
              </div>
            ) : null}
            {message ? <p style={{ color: '#067647', marginBottom: 0 }}>{message}</p> : null}
            {error ? <p style={{ color: '#b42318', marginBottom: 0 }}>{error}</p> : null}
          </Card>

          <Card style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>结构化预览</h3>
            {parsedRules.length === 0 ? <p className="small">暂无可解析规则</p> : null}
            {parsedRules.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Domain</th>
                    <th>Metric</th>
                    <th>Action</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRules.map((rule) => (
                    <tr key={rule.id}>
                      <td>{rule.id}</td>
                      <td>{rule.domain}</td>
                      <td>{rule.metric}</td>
                      <td>{rule.action}</td>
                      <td>{Math.round(rule.confidence * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {unparsedSegments.length > 0 ? (
              <div style={{ marginTop: 10 }}>
                <p className="small">未解析片段：</p>
                {unparsedSegments.map((segment) => (
                  <div key={segment} className="small">• {segment}</div>
                ))}
              </div>
            ) : null}
            {dslAst ? (
              <details style={{ marginTop: 12 }}>
                <summary className="small">查看 DSL AST（优先级 / 作用域 / 条件树）</summary>
                <pre
                  style={{
                    marginTop: 8,
                    background: '#f8fafc',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 12,
                    overflowX: 'auto',
                  }}
                >
                  {JSON.stringify(dslAst, null, 2)}
                </pre>
              </details>
            ) : null}
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card style={{ padding: 16 }}>
              <h3 style={{ marginTop: 0 }}>冲突检测</h3>
              {conflicts.length === 0 ? <p className="small">未检测到冲突</p> : null}
              {conflicts.map((conflict, idx) => (
                <div key={`${conflict.type}-${idx}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                  <span className={`status ${statusClass(conflict.severity)}`}>{conflict.severity}</span>
                  <p style={{ margin: '8px 0 4px 0' }}><strong>{conflict.title}</strong></p>
                  <p className="small" style={{ margin: 0 }}>{conflict.detail}</p>
                  {conflict.suggestions.map((suggestion) => (
                    <div key={suggestion} className="small" style={{ marginTop: 4 }}>💡 {suggestion}</div>
                  ))}
                </div>
              ))}
            </Card>

            <Card style={{ padding: 16 }}>
              <h3 style={{ marginTop: 0 }}>智能建议</h3>
              {suggestions.length === 0 ? <p className="small">暂无建议</p> : null}
              {suggestions.map((suggestion) => (
                <div key={`${suggestion.suggestionType}-${suggestion.title}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                  <p style={{ margin: '0 0 4px 0' }}><strong>{suggestion.title}</strong></p>
                  <p className="small" style={{ margin: 0 }}>{suggestion.detail}</p>
                </div>
              ))}
            </Card>
          </div>

          <Card style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>版本管理</h3>
            <div className="small" style={{ marginBottom: 8 }}>
              当前规则集：{activeRuleSet?.name ?? '未选择'}
            </div>
            <div style={{ marginBottom: 8 }}>
              <label className="small" htmlFor="ruleset-select">选择规则集：</label>
              <select
                id="ruleset-select"
                value={activeRuleSetId ?? ''}
                onChange={(event) => setActiveRuleSetId(event.target.value || null)}
                style={{ marginLeft: 8, padding: 8 }}
              >
                <option value="">--</option>
                {ruleSets.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} (v{item.activeVersion ?? '-'})</option>
                ))}
              </select>
            </div>
            {activeRuleSet?.versions?.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>时间</th>
                    <th>变更</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRuleSet.versions.map((version) => (
                    <tr key={version.id}>
                      <td>v{version.version}</td>
                      <td>{new Date(version.createdAt).toLocaleString()}</td>
                      <td>{version.changeSummary ?? '-'}</td>
                      <td>
                        <button type="button" className="reject" onClick={() => void handleRollback(version.version)} disabled={loading} title="Rollback the ruleset to this specific version">
                          回滚到此版本
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="small">暂无版本历史</p>
            )}
          </Card>

          {preview ? (
            <Card style={{ padding: 16 }}>
              <h3 style={{ marginTop: 0 }}>规则生效预览</h3>
              <p>
                受影响 Listing: <strong>{preview.affectedListings}</strong> / {preview.totalListings}
              </p>
              <p>
                预计支出变化: <strong>{preview.estimatedSpendDeltaPct > 0 ? '+' : ''}{preview.estimatedSpendDeltaPct}%</strong> |
                预计销售变化: <strong>{preview.estimatedSalesDeltaPct > 0 ? '+' : ''}{preview.estimatedSalesDeltaPct}%</strong>
              </p>
              <p>
                ACoS 变化: <strong>{preview.estimatedAcosFrom}% → {preview.estimatedAcosTo}%</strong>
              </p>
              <h4>案例</h4>
              {preview.examples.map((example) => (
                <div key={`${example.listingTitle}-${example.current}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <strong>{example.listingTitle}</strong>
                  <div className="small">当前：{example.current}</div>
                  <div className="small">预估：{example.projected}</div>
                </div>
              ))}
            </Card>
          ) : null}

          {compileSummary ? (
            <Card style={{ padding: 16 }}>
              <h3 style={{ marginTop: 0 }}>Intent 编译结果</h3>
              <p>
                total: <strong>{compileSummary.total}</strong> | approved: <strong>{compileSummary.approved}</strong> |
                rejected: <strong>{compileSummary.rejected}</strong> | queued: <strong>{compileSummary.queued}</strong>
              </p>
              {compiledIntents.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>Intent</th>
                      <th>Action</th>
                      <th>Risk</th>
                      <th>Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compiledIntents.map((row) => (
                      <tr key={row.intent.intentId}>
                        <td className="small">{row.intent.intentId}</td>
                        <td>{row.intent.action}</td>
                        <td>
                          {row.intent.risk.level} ({row.intent.risk.score.toFixed(2)})
                        </td>
                        <td>
                          <span className={`status ${row.decision.approved ? 'APPROVED' : 'REJECTED'}`}>
                            {row.decision.approved ? 'APPROVED' : 'REJECTED'}
                          </span>
                          <span className={`status ${row.condition.matched ? 'APPROVED' : 'PENDING'}`} style={{ marginLeft: 8 }}>
                            {row.condition.matched ? 'WHEN_MATCHED' : 'WHEN_NOT_MATCHED'}
                          </span>
                          {row.decision.requiresApproval ? (
                            <span className="small" style={{ marginLeft: 8 }}>
                              需审批
                            </span>
                          ) : null}
                          {row.decision.violations.length > 0 ? (
                            <div className="small">{row.decision.violations.join(', ')}</div>
                          ) : null}
                          <div className="small">expr: {row.condition.expression}</div>
                          {row.condition.missingFields.length > 0 ? (
                            <div className="small">missing: {row.condition.missingFields.join(', ')}</div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>
    </main >
  );
}
