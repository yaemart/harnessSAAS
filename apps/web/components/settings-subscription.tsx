'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './auth-context';
import { tintedBg } from '../lib/design-tokens';

const PLAN_META = {
  starter:    { label: 'Starter',    color: 'var(--text-secondary)', aiOps: 100,     budget: '5,000',     desc: 'For small teams getting started' },
  pro:        { label: 'Pro',        color: 'var(--accent)',         aiOps: 1_000,   budget: '50,000',    desc: 'For growing businesses' },
  enterprise: { label: 'Enterprise', color: '#AF52DE',               aiOps: Infinity, budget: '∞',        desc: 'For large-scale operations' },
} as const;
type PlanKey = keyof typeof PLAN_META;

interface SubscriptionData {
  plan: PlanKey;
  tenantName: string;
  quotas: { maxDailyOps: number; maxDailyBudget: number };
  usage: { dailyOps: number; dailyBudget: number };
}

export function SettingsSubscription() {
  const { authHeaders } = useAuth();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3300';

  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmPlan, setConfirmPlan] = useState<PlanKey | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch(`${API}/subscription`, { headers: authHeaders })
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [API, authHeaders]);

  async function applyPlan(plan: PlanKey) {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch(`${API}/subscription`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (r.ok) {
        setData(prev => prev ? { ...prev, plan, quotas: {
          maxDailyOps: plan === 'enterprise' ? 999_999 : plan === 'pro' ? 1_000 : 100,
          maxDailyBudget: plan === 'enterprise' ? 999_999_999 : plan === 'pro' ? 50_000 : 5_000,
        } } : prev);
        setMsg({ ok: true, text: `Plan updated to ${PLAN_META[plan].label}` });
      } else {
        setMsg({ ok: false, text: 'Update failed. Please try again.' });
      }
    } finally {
      setSaving(false);
      setConfirmPlan(null);
    }
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--text-secondary)', fontSize: 14 }}>Loading subscription…</div>;
  if (!data) return <div style={{ padding: 32, color: 'var(--danger)', fontSize: 14 }}>Failed to load subscription data.</div>;

  const currentMeta = PLAN_META[data.plan] ?? PLAN_META.starter;
  const usagePercent = data.quotas.maxDailyOps >= 999_999
    ? 0
    : Math.min(100, Math.round((data.usage.dailyOps / data.quotas.maxDailyOps) * 100));

  return (
    <div>
      {/* Current plan card */}
      <div style={{
        padding: 24, borderRadius: 14,
        background: 'var(--panel-bg)', border: `2px solid ${currentMeta.color}`,
        boxShadow: 'var(--panel-shadow)', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>
              Current Plan
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: currentMeta.color }}>{currentMeta.label}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                background: tintedBg(currentMeta.color, 15), color: currentMeta.color,
              }}>ACTIVE</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{currentMeta.desc}</div>
          </div>

          {/* Usage */}
          <div style={{ minWidth: 200 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8 }}>
              Today&apos;s AI Usage
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: 'var(--text-secondary)' }}>AI Ops</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                {data.usage.dailyOps.toLocaleString()} / {data.quotas.maxDailyOps >= 999_999 ? '∞' : data.quotas.maxDailyOps.toLocaleString()}
              </span>
            </div>
            {data.quotas.maxDailyOps < 999_999 && (
              <div style={{ background: 'var(--surface-secondary)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  width: `${usagePercent}%`,
                  background: usagePercent > 80 ? 'var(--danger)' : usagePercent > 60 ? 'var(--warning)' : 'var(--success)',
                  transition: 'width 0.3s',
                }} />
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
              Budget/day: <b>{data.quotas.maxDailyBudget >= 999_999_999 ? '∞' : data.quotas.maxDailyBudget.toLocaleString()}</b>
            </div>
          </div>
        </div>
      </div>

      {/* Plan picker */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
          Change Plan
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {(Object.entries(PLAN_META) as [PlanKey, typeof PLAN_META[PlanKey]][]).map(([key, m]) => {
            const isCurrent = key === data.plan;
            const isConfirming = confirmPlan === key;
            return (
              <div key={key} style={{
                padding: '18px 20px', borderRadius: 12, position: 'relative',
                background: isCurrent ? tintedBg(m.color, 8) : 'var(--panel-bg)',
                border: `${isCurrent ? 2 : 1}px solid ${isCurrent ? m.color : 'var(--panel-border)'}`,
                boxShadow: 'var(--panel-shadow)',
              }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: m.color, marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{m.desc}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  {m.aiOps === Infinity ? '∞' : m.aiOps.toLocaleString()} AI ops · {m.budget} budget
                </div>
                {isCurrent ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: m.color }}>✓ Current</span>
                ) : isConfirming ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      disabled={saving}
                      onClick={() => applyPlan(key)}
                      style={{
                        flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
                        background: m.color === 'var(--text-secondary)' ? 'var(--danger)' : m.color,
                        color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                      }}
                    >{saving ? '…' : 'Confirm'}</button>
                    <button
                      onClick={() => setConfirmPlan(null)}
                      style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 12,
                        border: '1px solid var(--panel-border)', background: 'transparent',
                        color: 'var(--text-secondary)', cursor: 'pointer',
                      }}
                    >Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmPlan(key)}
                    style={{
                      width: '100%', padding: '6px 0', borderRadius: 8,
                      border: `1px solid ${m.color}`,
                      background: 'transparent', color: m.color,
                      fontWeight: 600, fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    {key === 'starter' && data.plan !== 'starter' ? 'Downgrade' :
                     key === 'enterprise' && data.plan !== 'enterprise' ? 'Upgrade' : 'Switch'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cancel subscription */}
      <div style={{
        padding: '16px 20px', borderRadius: 12,
        background: tintedBg('var(--danger)', 6), border: '1px solid var(--danger)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--danger)' }}>Cancel Subscription</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Downgrade to Starter (free tier). Your data is preserved.
          </div>
        </div>
        <button
          disabled={data.plan === 'starter'}
          onClick={() => setConfirmPlan('starter')}
          style={{
            padding: '7px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            border: '1px solid var(--danger)', background: 'transparent',
            color: data.plan === 'starter' ? 'var(--text-tertiary)' : 'var(--danger)',
            cursor: data.plan === 'starter' ? 'default' : 'pointer', opacity: data.plan === 'starter' ? 0.5 : 1,
          }}
        >
          {data.plan === 'starter' ? 'Already on Free' : 'Cancel & Downgrade'}
        </button>
      </div>

      {msg && (
        <div style={{
          marginTop: 16, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: msg.ok ? tintedBg('var(--success)', 12) : tintedBg('var(--danger)', 12),
          color: msg.ok ? 'var(--success)' : 'var(--danger)',
          border: `1px solid ${msg.ok ? 'var(--success)' : 'var(--danger)'}`,
        }}>{msg.text}</div>
      )}
    </div>
  );
}
