'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTenant } from './tenant-context';
import { Card, PageHeader, Badge, StatBadge } from './ui';
import { Shield, History, Lightbulb, Settings, ChevronDown, ChevronUp, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  fetchConstitution,
  fetchConstitutionHistory,
  fetchConstitutionSuggestions,
  publishConstitutionRules,
  fetchTenantMaturity,
  patchTenantMaturity,
  type ConstitutionManifest,
  type ConstitutionRule,
  type ConstitutionHistoryEntry,
  type ConstitutionSuggestion,
  type TenantMaturityData,
} from '../lib/api';

type Tab = 'rules' | 'authority' | 'history';

const AAL_CONFIG: Record<string, { label: string; variant: 'danger' | 'warning' | 'info' | 'success'; desc: string }> = {
  GUIDED: { label: 'L1 Guided', variant: 'danger', desc: 'Agent asks for human confirmation on every action' },
  ASSISTED: { label: 'L2 Assisted', variant: 'warning', desc: 'Agent handles routine tasks, escalates complex ones' },
  SUPERVISED: { label: 'L3 Supervised', variant: 'info', desc: 'Agent operates autonomously with periodic review' },
  AUTONOMOUS: { label: 'L4 Autonomous', variant: 'success', desc: 'Agent fully autonomous, human reviews exceptions only' },
};

const AAL_LEVELS = ['GUIDED', 'ASSISTED', 'SUPERVISED', 'AUTONOMOUS'] as const;

export function GovernanceDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('rules');
  const { currentTenant, currentTenantId: tenantId } = useTenant();

  // Cache data across tab switches
  const [rulesCache, setRulesCache] = useState<{ manifest: ConstitutionManifest; suggestions: ConstitutionSuggestion[] } | null>(null);
  const [maturityCache, setMaturityCache] = useState<TenantMaturityData['maturity'] | null>(null);
  const [historyCache, setHistoryCache] = useState<ConstitutionHistoryEntry[] | null>(null);

  return (
    <main>
      <PageHeader
        title="AI Governance"
        subtitle={`Constitution Rules & Agent Authority · Tenant: ${currentTenant?.name ?? '—'}`}
      />

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        {([
          { key: 'rules' as Tab, icon: <Shield size={16} />, label: 'Constitution Rules' },
          { key: 'authority' as Tab, icon: <Settings size={16} />, label: 'Agent Authority' },
          { key: 'history' as Tab, icon: <History size={16} />, label: 'Version History' },
        ]).map(({ key, icon, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            style={{
              background: 'transparent', border: 'none',
              borderBottom: activeTab === key ? '2px solid var(--accent)' : '2px solid transparent',
              borderRadius: 0, padding: '8px 4px',
              color: activeTab === key ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === key ? 600 : 400,
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {activeTab === 'rules' && tenantId && (
        <ConstitutionRulesTab tenantId={tenantId} cache={rulesCache} onCache={setRulesCache} />
      )}
      {activeTab === 'authority' && tenantId && (
        <AgentAuthorityTab tenantId={tenantId} cache={maturityCache} onCache={setMaturityCache} />
      )}
      {activeTab === 'history' && tenantId && (
        <VersionHistoryTab tenantId={tenantId} cache={historyCache} onCache={setHistoryCache} />
      )}
    </main>
  );
}

// ─── Constitution Rules Tab ───────────────────────────

function ConstitutionRulesTab({ tenantId, cache, onCache }: {
  tenantId: string;
  cache: { manifest: ConstitutionManifest; suggestions: ConstitutionSuggestion[] } | null;
  onCache: (v: { manifest: ConstitutionManifest; suggestions: ConstitutionSuggestion[] } | null) => void;
}) {
  const [manifest, setManifest] = useState<ConstitutionManifest | null>(cache?.manifest ?? null);
  const [suggestions, setSuggestions] = useState<ConstitutionSuggestion[]>(cache?.suggestions ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [editingRules, setEditingRules] = useState<ConstitutionRule[] | null>(null);
  const [changeSummary, setChangeSummary] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [constData, sugData] = await Promise.all([
        fetchConstitution(tenantId),
        fetchConstitutionSuggestions(tenantId),
      ]);
      setManifest(constData.constitution);
      setSuggestions(sugData.suggestions);
      onCache({ manifest: constData.constitution, suggestions: sugData.suggestions });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tenantId, onCache]);

  useEffect(() => { if (!cache) loadData(); }, [cache, loadData]);

  const startEditing = () => {
    if (manifest) {
      setEditingRules(manifest.rules.map((r) => ({ ...r })));
      setChangeSummary('');
      setPublishError(null);
    }
  };

  const cancelEditing = () => {
    setEditingRules(null);
    setChangeSummary('');
    setPublishError(null);
  };

  const toggleRule = (ruleId: string) => {
    if (!editingRules) return;
    setEditingRules(editingRules.map((r) => r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
  };

  const handlePublish = async () => {
    if (!editingRules || !changeSummary.trim()) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const result = await publishConstitutionRules(tenantId, changeSummary.trim(), editingRules);
      setManifest(result.constitution);
      onCache({ manifest: result.constitution, suggestions });
      setEditingRules(null);
      setChangeSummary('');
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Loading constitution...</div>;
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div>
        <button onClick={loadData} style={{ padding: '8px 16px', borderRadius: 999, cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  if (!manifest) return null;

  const rules = editingRules ?? manifest.rules;
  const hardRules = rules.filter((r) => r.level === 'HARD');
  const structuralRules = rules.filter((r) => r.level === 'STRUCTURAL');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Badge variant="info">v{manifest.version}</Badge>
          <span className="small" style={{ color: 'var(--text-secondary)' }}>
            Updated {new Date(manifest.updatedAt).toLocaleDateString()} by {manifest.updatedBy}
          </span>
        </div>
        {!editingRules ? (
          <button
            onClick={startEditing}
            style={{
              padding: '8px 18px', borderRadius: 999, cursor: 'pointer',
              background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13,
            }}
          >
            Edit Rules
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={cancelEditing}
              style={{ padding: '8px 18px', borderRadius: 999, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing || !changeSummary.trim()}
              style={{
                padding: '8px 18px', borderRadius: 999, cursor: publishing ? 'wait' : 'pointer',
                background: changeSummary.trim() ? 'var(--accent)' : 'var(--text-tertiary)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13,
                opacity: publishing ? 0.6 : 1,
              }}
            >
              {publishing ? 'Publishing...' : 'Publish v' + (manifest.version + 1)}
            </button>
          </div>
        )}
      </div>

      {/* Publish error */}
      {publishError && (
        <div style={{ padding: 12, color: 'var(--danger)', fontSize: 13, background: 'color-mix(in srgb, var(--danger) 8%, transparent)', borderRadius: 'var(--border-radius-md)' }}>
          {publishError}
        </div>
      )}

      {/* Change summary input (edit mode) */}
      {editingRules && (
        <div style={{ padding: 16, background: 'color-mix(in srgb, var(--accent) 5%, transparent)', borderRadius: 'var(--border-radius-md)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            Change Summary (required)
          </label>
          <input
            type="text"
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            placeholder="Describe what changed and why..."
            maxLength={500}
            style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)', background: 'var(--panel-bg)' }}
          />
        </div>
      )}

      {/* Rules grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <RulePanel
          title="Hard Rules (Safety)"
          description="Absolute boundaries — violations trigger immediate rejection."
          rules={hardRules}
          editing={!!editingRules}
          onToggle={toggleRule}
        />
        <RulePanel
          title="Structural Rules (Behavior)"
          description="Operational guidelines — violations require human approval."
          rules={structuralRules}
          editing={!!editingRules}
          onToggle={toggleRule}
        />
      </div>

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Lightbulb size={18} color="var(--warning)" />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>AI Rule Suggestions</h3>
            <Badge variant="warning">{suggestions.length}</Badge>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {suggestions.map((s, i) => (
              <div key={i} style={{
                padding: 14, borderRadius: 'var(--border-radius-md)',
                border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
                background: 'color-mix(in srgb, var(--warning) 5%, transparent)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Badge variant={s.type === 'restrict_action' ? 'danger' : 'info'}>
                    {s.type === 'restrict_action' ? 'Restrict' : 'New Rule'}
                  </Badge>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.action}</span>
                  <span className="small" style={{ color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                    {s.rejectCount} rejections / 30d
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.reason}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function RulePanel({
  title, description, rules, editing, onToggle,
}: {
  title: string;
  description: string;
  rules: ConstitutionRule[];
  editing: boolean;
  onToggle: (ruleId: string) => void;
}) {
  return (
    <Card style={{ padding: 20 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>{title}</h3>
      <p className="small" style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>{description}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rules.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 12 }}>No rules in this category</div>
        )}
        {rules.map((rule) => (
          <div key={rule.id} style={{
            padding: 14, borderRadius: 'var(--border-radius-md)',
            border: `1px solid ${rule.enabled ? 'var(--panel-border)' : 'color-mix(in srgb, var(--text-tertiary) 20%, transparent)'}`,
            opacity: rule.enabled ? 1 : 0.6,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{rule.title}</span>
                <span className="small" style={{ color: 'var(--text-tertiary)' }}>{rule.id}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge variant={rule.kind === 'ALLOWED_ACTIONS' ? 'info' : rule.kind === 'MAX_BID_CHANGE_PCT' ? 'warning' : 'danger'}>
                  {rule.kind.replace(/_/g, ' ')}
                </Badge>
                {editing && (
                  <button
                    onClick={() => onToggle(rule.id)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
                    title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                  >
                    {rule.enabled
                      ? <ToggleRight size={22} color="var(--success)" />
                      : <ToggleLeft size={22} color="var(--text-tertiary)" />
                    }
                  </button>
                )}
                {!editing && (
                  <Badge variant={rule.enabled ? 'success' : 'default'}>
                    {rule.enabled ? 'ACTIVE' : 'DISABLED'}
                  </Badge>
                )}
              </div>
            </div>
            {rule.kind === 'ALLOWED_ACTIONS' && 'actions' in rule.params && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Allowed: {(rule.params.actions as string[]).join(', ')}
              </div>
            )}
            {rule.kind === 'MAX_BID_CHANGE_PCT' && 'maxPct' in rule.params && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Max change: ±{rule.params.maxPct as number}%
              </div>
            )}
            {rule.kind === 'MIN_BID_GUARD' && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Prevents bids from dropping below minimum threshold
              </div>
            )}
            {rule.scope?.platforms && rule.scope.platforms.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {rule.scope.platforms.map((p) => (
                  <span key={p} className="small" style={{ padding: '2px 6px', borderRadius: 'var(--border-radius-sm)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)' }}>
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Agent Authority Tab ──────────────────────────────

function AgentAuthorityTab({ tenantId, cache, onCache }: {
  tenantId: string;
  cache: TenantMaturityData['maturity'] | null;
  onCache: (v: TenantMaturityData['maturity'] | null) => void;
}) {
  const [maturity, setMaturity] = useState<TenantMaturityData['maturity'] | null>(cache);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [overrideLevel, setOverrideLevel] = useState<string | null>(null);
  const [showOverride, setShowOverride] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTenantMaturity(tenantId);
      setMaturity(data.maturity);
      onCache(data.maturity);
      setOverrideLevel(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tenantId, onCache]);

  useEffect(() => { if (!cache) loadData(); }, [cache, loadData]);

  const handleOverride = async (level: string | null) => {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await patchTenantMaturity(tenantId, { autonomyOverride: level });
      setMaturity(result.maturity);
      onCache(result.maturity);
      setShowOverride(false);
      setOverrideLevel(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Loading authority data...</div>;
  }

  if (error || !maturity) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error ?? 'No data'}</div>
        <button onClick={loadData} style={{ padding: '8px 16px', borderRadius: 999, cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  const aalConfig = AAL_CONFIG[maturity.autonomyLevel] ?? AAL_CONFIG.GUIDED;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* TMS + AAL Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatBadge label="Tenant Maturity Score" value={`${(maturity.maturityScore * 100).toFixed(0)}%`} />
        <StatBadge label="Knowledge Score" value={`${(maturity.knowledgeScore * 100).toFixed(0)}%`} />
        <StatBadge label="Feedback Score" value={`${(maturity.feedbackScore * 100).toFixed(0)}%`} />
        <StatBadge label="Escalation Threshold" value={`${(maturity.escalationThreshold * 100).toFixed(0)}%`} />
      </div>

      {/* Current AAL */}
      <Card style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Agent Autonomy Level</h3>
              <Badge variant={aalConfig.variant} style={{ fontSize: 13, padding: '5px 12px' }}>
                {aalConfig.label}
              </Badge>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {aalConfig.desc}
            </p>
          </div>
          <button
            onClick={() => setShowOverride(!showOverride)}
            style={{
              padding: '8px 16px', borderRadius: 999, cursor: 'pointer', fontSize: 13,
              background: 'transparent', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            Manual Override {showOverride ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {showOverride && (
          <div style={{ marginTop: 20, padding: 16, borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)', background: 'color-mix(in srgb, var(--warning) 3%, transparent)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Override AAL (can only downgrade, not upgrade beyond computed level)
            </div>

            {saveError && (
              <div style={{ padding: 10, marginBottom: 12, color: 'var(--danger)', fontSize: 12, background: 'color-mix(in srgb, var(--danger) 8%, transparent)', borderRadius: 'var(--border-radius-sm)' }}>
                {saveError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {AAL_LEVELS.map((level) => {
                const cfg = AAL_CONFIG[level];
                const isCurrentOverride = overrideLevel === level;
                return (
                  <button
                    key={level}
                    onClick={() => setOverrideLevel(level)}
                    style={{
                      padding: '8px 16px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: isCurrentOverride ? 'var(--accent)' : 'transparent',
                      color: isCurrentOverride ? '#fff' : 'var(--text-primary)',
                      border: `1px solid ${isCurrentOverride ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    {cfg.label}
                  </button>
                );
              })}
              <button
                onClick={() => handleOverride(null)}
                disabled={saving}
                style={{
                  padding: '8px 16px', borderRadius: 999, cursor: 'pointer', fontSize: 12,
                  background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text-secondary)',
                }}
              >
                Clear Override
              </button>
            </div>
            {overrideLevel && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => handleOverride(overrideLevel)}
                  disabled={saving}
                  style={{
                    padding: '8px 18px', borderRadius: 999, cursor: saving ? 'wait' : 'pointer',
                    background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Saving...' : `Apply ${AAL_CONFIG[overrideLevel]?.label ?? overrideLevel} Override`}
                </button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* AAL Tier Progression */}
      <Card style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Autonomy Tier Progression</h3>
        <div style={{ display: 'flex', gap: 0 }}>
          {AAL_LEVELS.map((level, i) => {
            const cfg = AAL_CONFIG[level];
            const isActive = maturity.autonomyLevel === level;
            const isPast = AAL_LEVELS.indexOf(maturity.autonomyLevel as typeof AAL_LEVELS[number]) > i;
            return (
              <div key={level} style={{
                flex: 1, padding: 16, textAlign: 'center',
                borderBottom: isActive ? `3px solid var(--accent)` : `3px solid ${isPast ? 'var(--success)' : 'var(--border)'}`,
                opacity: isActive || isPast ? 1 : 0.5,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? 'var(--accent)' : 'var(--text-primary)', marginBottom: 4 }}>
                  {cfg.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  TMS {['0–20%', '20–50%', '50–80%', '80–100%'][i]}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── Version History Tab ──────────────────────────────

function VersionHistoryTab({ tenantId, cache, onCache }: {
  tenantId: string;
  cache: ConstitutionHistoryEntry[] | null;
  onCache: (v: ConstitutionHistoryEntry[] | null) => void;
}) {
  const [history, setHistory] = useState<ConstitutionHistoryEntry[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    setLoading(true);
    fetchConstitutionHistory(tenantId, 50)
      .then((data) => { setHistory(data.history); onCache(data.history); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [tenantId, cache, onCache]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Loading history...</div>;
  }

  if (error) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--danger)' }}>{error}</div>;
  }

  return (
    <Card style={{ padding: 20 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Constitution Version History</h3>
      {history.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: 20, textAlign: 'center' }}>
          No constitution versions found. The default constitution is active.
        </div>
      ) : (
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Version</th>
              <th style={{ textAlign: 'left' }}>Date</th>
              <th style={{ textAlign: 'left' }}>Author</th>
              <th style={{ textAlign: 'left' }}>Change Summary</th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => (
              <tr key={entry.version}>
                <td>
                  <Badge variant="info">v{entry.version}</Badge>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {new Date(entry.updatedAt).toLocaleDateString()} {new Date(entry.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td>{entry.updatedBy}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{entry.changeSummary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
