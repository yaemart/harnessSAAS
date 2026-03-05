'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Lock, Clock, Bot, CheckCircle, XCircle, Edit3 } from 'lucide-react';
import { useAuth } from '../../components/auth-context';
import { useTenant } from '../../components/tenant-context';
import { tintedBg } from '../../lib/design-tokens';
import { RoleGuard } from '../../components/guards/role-guard';
import { IronLawBanner } from '../../components/banners/iron-law-banner';
import { InteractionTag } from '../../components/ui/interaction-tag';

type AuthLevel = 'AUTO' | 'CONFIRM' | 'BLOCK';

interface ExecutionRule {
  id: string;
  action: string;
  range: string;
  level: AuthLevel;
  locked: boolean;
}

interface ExecutionLogEntry {
  time: string;
  agent: string;
  level: AuthLevel;
  summary: string;
  result: string;
  resultType: 'success' | 'approved' | 'rejected';
}

const DEFAULT_RULES: ExecutionRule[] = [
  { id: 'price-low', action: 'Price adjustment', range: '< 5%', level: 'AUTO', locked: false },
  { id: 'price-mid', action: 'Price adjustment', range: '5 – 15%', level: 'CONFIRM', locked: false },
  { id: 'price-high', action: 'Price adjustment', range: '> 15%', level: 'BLOCK', locked: true },
  { id: 'ad-low', action: 'Ad budget change', range: '< 20%', level: 'AUTO', locked: false },
  { id: 'ad-mid', action: 'Ad budget change', range: '20 – 50%', level: 'CONFIRM', locked: false },
  { id: 'restock', action: 'Restock execution', range: 'Any', level: 'BLOCK', locked: true },
  { id: 'supplier-comm', action: 'Supplier communication', range: 'Any', level: 'CONFIRM', locked: true },
  { id: 'new-market', action: 'New market expansion', range: 'Any', level: 'CONFIRM', locked: true },
  { id: 'delist', action: 'Product delisting', range: 'Any', level: 'BLOCK', locked: true },
];

const EXECUTION_LOG: ExecutionLogEntry[] = [
  { time: 'Today 09:14', agent: 'PricingAgent', level: 'AUTO', summary: 'Price −3.2% · BT Headphones X1 · Amazon US', result: 'ROAS +11% after 24h', resultType: 'success' },
  { time: 'Today 08:30', agent: 'AdAgent', level: 'CONFIRM', summary: 'Pause 3 keywords · total saving $420/mo', result: 'Approved by @wang', resultType: 'approved' },
  { time: 'Yesterday', agent: 'ProfitAgent', level: 'CONFIRM', summary: 'Profit alert: margin below 10%', result: 'Rejected — seasonal dip expected', resultType: 'rejected' },
];

const LEVEL_COLORS: Record<AuthLevel, string> = {
  AUTO: 'var(--success)',
  CONFIRM: 'var(--warning)',
  BLOCK: 'var(--danger)',
};

function storageKey(tenantId: string) {
  return `agent_auth_rules_${tenantId}`;
}

export default function AgentAuthPage() {
  const { currentTenantId } = useTenant();
  const [rules, setRules] = useState<ExecutionRule[]>(DEFAULT_RULES);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(storageKey(currentTenantId));
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ExecutionRule[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRules(parsed);
          return;
        }
      } catch { /* use defaults */ }
    }
    setRules(DEFAULT_RULES);
  }, [currentTenantId]);

  const persist = useCallback((updated: ExecutionRule[]) => {
    setRules(updated);
    localStorage.setItem(storageKey(currentTenantId), JSON.stringify(updated));
  }, [currentTenantId]);

  const cycleLevel = (id: string) => {
    const order: AuthLevel[] = ['AUTO', 'CONFIRM', 'BLOCK'];
    persist(rules.map((r) => {
      if (r.id !== id || r.locked) return r;
      const nextIdx = (order.indexOf(r.level) + 1) % order.length;
      return { ...r, level: order[nextIdx] };
    }));
  };

  if (!mounted) return null;

  return (
    <RoleGuard allowedRoles={['tenant_admin']}>
    <main>
      <IronLawBanner message="⚠ New agent capabilities default to BLOCK — explicit authorization required" />
      <div className="header">
        <div>
          <h1 className="ios-title">Agent Authority Settings</h1>
          <p className="ios-subtitle">Define what agents can do autonomously vs. require approval · Layer 2 Execution</p>
        </div>
      </div>

      {/* Execution Rules Table */}
      <div className="ios-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Execution Rules</h2>
        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Action', 'Range', 'Level', 'Config'].map((h) => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '12px 16px',
                    borderBottom: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const color = LEVEL_COLORS[rule.level];
                return (
                  <tr key={rule.id}>
                    <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {rule.action}
                    </td>
                    <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {rule.range}
                    </td>
                    <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)' }}>
                      <InteractionTag type={rule.level} />
                    </td>
                    <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)' }}>
                      {rule.locked ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
                          <Lock size={12} /> locked
                        </span>
                      ) : (
                        <button
                          onClick={() => cycleLevel(rule.id)}
                          style={{
                            padding: '4px 10px', borderRadius: '999px',
                            background: tintedBg(color, 10), color,
                            border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <Edit3 size={10} /> Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Execution Log */}
      <div className="ios-card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Execution Log (Last 7 Days)</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {EXECUTION_LOG.map((entry, idx) => {
            const resultColor = entry.resultType === 'success' ? 'var(--success)' : entry.resultType === 'approved' ? 'var(--accent)' : 'var(--danger)';
            return (
              <div key={idx} style={{
                padding: 12,
                borderRadius: 'var(--border-radius-md)',
                background: tintedBg('var(--panel-bg-secondary)', 50),
                border: '1px solid var(--border-color)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{entry.time}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{entry.agent}</span>
                  <InteractionTag type={entry.level} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>{entry.summary}</div>
                <div style={{ fontSize: 12, color: resultColor, display: 'flex', alignItems: 'center', gap: 4 }}>
                  ↳ {entry.result}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
    </RoleGuard>
  );
}
