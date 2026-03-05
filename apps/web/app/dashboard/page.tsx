'use client';

import { useState, useCallback } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Bot, Layers,
  Clock, CheckCircle, Gauge, Zap, AlertTriangle, AlertCircle, Info,
  Download, FileText,
} from 'lucide-react';
import { useAuth } from '../../components/auth-context';
import { useTenant } from '../../components/tenant-context';
import { tintedBg } from '../../lib/design-tokens';
import { RoleGuard } from '../../components/guards/role-guard';
import { IronLawBanner } from '../../components/banners/iron-law-banner';
import { ConfidenceBadge } from '../../components/ui/confidence-badge';
import { useAgentEvents, type AgentEvent } from '../../lib/use-agent-events';

type AttentionLevel = 'CRITICAL' | 'WARNING' | 'INFO';

interface AttentionItem {
  level: AttentionLevel;
  title: string;
  detail: string;
  confidence: number;
  action: string;
  actionLabel: string;
}

const ATTENTION_COLORS: Record<AttentionLevel, string> = {
  CRITICAL: 'var(--danger)',
  WARNING: 'var(--warning)',
  INFO: 'var(--accent)',
};

const ATTENTION_ICONS: Record<AttentionLevel, React.ReactNode> = {
  CRITICAL: <AlertCircle size={16} />,
  WARNING: <AlertTriangle size={16} />,
  INFO: <Info size={16} />,
};

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  'intent.completed': { label: 'Completed', color: 'var(--success)' },
  'intent.failed': { label: 'Failed', color: 'var(--danger)' },
  'intent.queued': { label: 'Queued', color: 'var(--accent)' },
  'intent.approved': { label: 'Approved', color: 'var(--success)' },
  'intent.rejected': { label: 'Rejected', color: 'var(--warning)' },
};

const MAX_LIVE_EVENTS = 5;

export default function DashboardPage() {
  const { hasRole } = useAuth();
  const { currentTenantId } = useTenant();
  const isViewer = hasRole('viewer') && !hasRole('tenant_admin');

  const [liveEvents, setLiveEvents] = useState<(AgentEvent & { ts: number })[]>([]);

  const handleAgentEvent = useCallback((event: AgentEvent) => {
    setLiveEvents((prev) => [{ ...event, ts: Date.now() }, ...prev].slice(0, MAX_LIVE_EVENTS));
  }, []);

  useAgentEvents(currentTenantId, handleAgentEvent);

  const attentionItems: AttentionItem[] = [
    {
      level: 'CRITICAL',
      title: 'BT Headphones X1',
      detail: 'Profit margin turned negative (−4.2%) — 3 contributing factors identified',
      confidence: 0.91,
      action: '/products/bt-headphones-x1',
      actionLabel: 'View RCA',
    },
    {
      level: 'WARNING',
      title: 'DE Market · All SKUs',
      detail: 'Q4 restock window closes in 12 days — suggested qty: 800 units via DHL',
      confidence: 0.78,
      action: '/products?market=DE',
      actionLabel: 'View Plan',
    },
    {
      level: 'INFO',
      title: 'Shopify Channel',
      detail: 'ROAS 7-day avg beats Amazon by 34% — consider budget shift',
      confidence: 0.72,
      action: '/campaigns',
      actionLabel: 'Review',
    },
  ];

  const healthMatrix = [
    { label: 'Star (maintain)', count: 8, color: 'var(--success)', emoji: '⭐' },
    { label: 'Rising (scale)', count: 5, color: 'var(--accent)', emoji: '🚀' },
    { label: 'Drain (intervene)', count: 3, color: 'var(--danger)', emoji: '⚠️' },
    { label: 'Potential (nurture)', count: 6, color: 'var(--warning)', emoji: '💡' },
  ];

  return (
    <RoleGuard allowedRoles={['tenant_admin', 'viewer']}>
    <main>
      <IronLawBanner />

      {liveEvents.length > 0 && (
        <div style={{
          margin: '0 0 16px', padding: '12px 16px',
          background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
          borderRadius: 'var(--border-radius-lg)', boxShadow: 'var(--panel-shadow)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={12} /> Live Agent Activity
          </div>
          {liveEvents.map((evt, i) => {
            const meta = EVENT_LABELS[evt.type] ?? { label: evt.type, color: 'var(--text-secondary)' };
            const intentId = typeof evt.data.intentId === 'string' ? evt.data.intentId.slice(0, 8) : '';
            const action = typeof evt.data.action === 'string' ? evt.data.action : '';
            return (
              <div key={`${evt.ts}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
                <span style={{
                  display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                  background: meta.color, flexShrink: 0,
                }} />
                <span style={{ fontWeight: 600, color: meta.color }}>{meta.label}</span>
                {action && <span style={{ color: 'var(--text-secondary)' }}>{action}</span>}
                {intentId && <span style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace', fontSize: 10 }}>{intentId}…</span>}
                <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: 10 }}>
                  {new Date(evt.ts).toLocaleTimeString()}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="header">
        <div>
          <h1 className="ios-title">{isViewer ? 'Executive Report' : 'Business Overview'}</h1>
          <p className="ios-subtitle">
            {isViewer
              ? 'Read-only view — true profit across all channels'
              : 'True profit across all channels · Harness Layer 6'}
          </p>
        </div>
      </div>

      {/* ─── TRUE PROFIT Row ─── */}
      <div className="ios-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TRUE PROFIT</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>$18,420</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>MARGIN</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>22.4%</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>GMV</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>$82,200</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>VS LAST MONTH</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <TrendingUp size={18} /> +$2,140 (+13%)
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
          Updated 2h ago · 4 platforms · confidence 87%
        </div>
      </div>

      {/* ─── Product Health Matrix ─── */}
      <div className="ios-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
          Product Health Matrix
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {healthMatrix.map((q) => (
            <div key={q.label} style={{
              padding: 16,
              borderRadius: 'var(--border-radius-md)',
              background: tintedBg(q.color, 8),
              border: `1px solid ${tintedBg(q.color, 20)}`,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 24 }}>{q.emoji}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: q.color, marginTop: 4 }}>{q.count}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{q.label}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12 }}>
          X = profit margin, Y = sales trend. Click any product → Product Workspace.
        </p>
      </div>

      {/* ─── Needs Your Attention (Tenant Admin only) ─── */}
      {!isViewer && (
        <div className="ios-card" style={{ padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
            Needs Your Attention
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {attentionItems.map((item, idx) => {
              const color = ATTENTION_COLORS[item.level];
              return (
                <div key={idx} style={{
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 'var(--border-radius-md)',
                  padding: '12px 16px',
                  background: tintedBg(color, 5),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <div style={{ color, flexShrink: 0 }}>{ATTENTION_ICONS[item.level]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        color, letterSpacing: '0.04em',
                      }}>{item.level}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.detail}</div>
                  </div>
                  <ConfidenceBadge value={item.confidence} />
                  <button style={{
                    padding: '6px 14px',
                    borderRadius: '999px',
                    background: tintedBg(color, 15),
                    color,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}>
                    {item.actionLabel}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── AI Today Summary (Tenant Admin) ─── */}
      {!isViewer && (
        <div className="ios-card" style={{ padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
            AI Today Summary
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <p>Past 24h: system auto-executed <strong style={{ color: 'var(--text-primary)' }}>47 operations</strong></p>
            <p>Decisions pending your review: <strong style={{ color: 'var(--warning)' }}>3 items</strong> (sorted by urgency)</p>
            <p>Estimated labor hours saved this week: <strong style={{ color: 'var(--success)' }}>12.5 hours</strong></p>
          </div>
        </div>
      )}

      {/* ─── Agent Capabilities (Help) ─── */}
      {!isViewer && (
        <div className="ios-card" style={{ padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={18} /> What can the AI Agent do?
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { icon: '📊', title: 'Ads Optimization', desc: 'Auto-adjust bids, pause underperformers, scale winners' },
              { icon: '🛡️', title: 'Risk Management', desc: 'Constitution checks, kill-switches, circuit breakers' },
              { icon: '💬', title: 'Customer Support', desc: 'AI-powered portal chat, media analysis, escalation' },
              { icon: '📦', title: 'Inventory Signals', desc: 'Restock alerts, lifecycle detection, demand forecasting' },
              { icon: '🔍', title: 'Pattern Learning', desc: 'Experience memory, pattern matching, cold-start bootstrap' },
              { icon: '📋', title: 'Approval Workflows', desc: 'Human-in-the-loop for high-risk decisions' },
            ].map((cap) => (
              <div key={cap.title} style={{
                padding: 12, borderRadius: 'var(--border-radius-md)',
                border: '1px solid var(--panel-border)', background: 'var(--bg-color)',
              }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{cap.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{cap.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{cap.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── AI System Efficiency (Viewer + Tenant Admin) ─── */}
      <div className="ios-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
          {isViewer ? 'AI System Efficiency (Investor View)' : 'AI Agent Performance'}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Suggestion Acceptance Rate', value: '91.3%', icon: <CheckCircle size={16} />, color: 'var(--success)' },
            { label: 'Avg Confidence', value: '0.87', icon: <Gauge size={16} />, color: 'var(--accent)' },
            { label: 'Auto-Processed Ops', value: '3,842', icon: <Zap size={16} />, color: 'var(--accent)' },
            { label: 'Labor Hours Saved', value: '52h', icon: <Clock size={16} />, color: 'var(--warning)' },
          ].map((stat) => (
            <div key={stat.label} style={{
              padding: 16,
              background: tintedBg('var(--panel-bg-secondary)', 50),
              borderRadius: 'var(--border-radius-md)',
              border: '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ color: stat.color }}>{stat.icon}</div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{stat.label}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{stat.value}</div>
            </div>
          ))}
        </div>
        {isViewer && (
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12 }}>
            Compared to pre-system baseline: operational efficiency improved by <strong style={{ color: 'var(--success)' }}>34%</strong>
          </p>
        )}
      </div>

      {/* ─── Export Reports (Viewer only) ─── */}
      {isViewer && (
        <div className="ios-card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
            Export Reports
          </h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Monthly Business Report', format: 'PDF', icon: <FileText size={16} /> },
              { label: 'Financial Summary', format: 'Excel', icon: <Download size={16} /> },
              { label: 'AI Efficiency Report', format: 'PDF', icon: <Bot size={16} /> },
            ].map((report) => (
              <button key={report.label} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 16px',
                borderRadius: 'var(--border-radius-md)',
                border: '1px solid var(--border-color)',
                background: 'var(--panel-bg)',
                color: 'var(--text-primary)',
                fontSize: 13, fontWeight: 500,
                cursor: 'pointer',
              }}>
                {report.icon}
                {report.label}
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>{report.format}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
    </RoleGuard>
  );
}
