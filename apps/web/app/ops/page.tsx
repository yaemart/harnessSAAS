'use client';

import {
  Server, Database, Layers, Radio, Activity, Clock, Bot,
  AlertCircle, AlertTriangle, Info, Shield, Cpu, TrendingUp,
} from 'lucide-react';
import { tintedBg } from '../../lib/design-tokens';
import { RoleGuard } from '../../components/guards/role-guard';
import { IronLawBanner } from '../../components/banners/iron-law-banner';
import { ConfidenceBadge } from '../../components/ui/confidence-badge';

const HEALTH_METRICS = [
  { label: 'Active Tenants', value: '247', detail: '+12 this week', icon: <Server size={18} />, color: 'var(--success)' },
  { label: 'Agent Executions/day', value: '14,302', detail: '+8% MoM', icon: <Bot size={18} />, color: 'var(--accent)' },
  { label: 'Avg Confidence', value: '0.81', detail: '↑ from 0.74', icon: <Cpu size={18} />, color: 'var(--accent)' },
  { label: 'Error Rate', value: '0.3%', detail: '< 1% target', icon: <Shield size={18} />, color: 'var(--success)' },
  { label: 'Layer B Patterns', value: '1,847', detail: '+23 this week', icon: <Layers size={18} />, color: 'var(--warning)' },
  { label: 'API P95 Latency', value: '142ms', detail: '< 200ms SLA', icon: <Activity size={18} />, color: 'var(--success)' },
];

type AlertLevel = 'CRITICAL' | 'WARNING' | 'INFO';

interface PlatformAlert {
  level: AlertLevel;
  message: string;
  time: string;
  action?: string;
}

const ALERTS: PlatformAlert[] = [
  { level: 'CRITICAL', message: 'Tenant #1042: RLS policy missing on new table `supplier_quotes`', time: '4m ago', action: 'View Diff' },
  { level: 'WARNING', message: '17 tenants have not updated COGS data in 30+ days', time: '1h ago', action: 'Notify All' },
  { level: 'INFO', message: 'Layer B distillation complete: 3 new patterns published', time: '3h ago', action: 'Review' },
];

const ALERT_COLORS: Record<AlertLevel, string> = {
  CRITICAL: 'var(--danger)', WARNING: 'var(--warning)', INFO: 'var(--accent)',
};

const ALERT_ICONS: Record<AlertLevel, React.ReactNode> = {
  CRITICAL: <AlertCircle size={16} />, WARNING: <AlertTriangle size={16} />, INFO: <Info size={16} />,
};

interface EvolutionEntry {
  context: string;
  cases: number;
  status: 'healthy' | 'growing' | 'early' | 'insufficient';
  confidenceCoverage: number;
}

const EVOLUTION_TRACKER: EvolutionEntry[] = [
  { context: '3C Electronics · Amazon US', cases: 847, status: 'healthy', confidenceCoverage: 0.78 },
  { context: 'Home & Garden · EU Markets', cases: 412, status: 'growing', confidenceCoverage: 0.61 },
  { context: 'Fashion · TikTok Shop', cases: 183, status: 'early', confidenceCoverage: 0.34 },
  { context: 'Sports · Shopify', cases: 94, status: 'insufficient', confidenceCoverage: 0.19 },
];

const STATUS_COLORS: Record<string, string> = {
  healthy: 'var(--success)', growing: 'var(--accent)', early: 'var(--warning)', insufficient: 'var(--danger)',
};

export default function OpsPage() {
  return (
    <RoleGuard allowedRoles={['system_admin']}>
    <main>
      <IronLawBanner />
      <div className="header">
        <div>
          <h1 className="ios-title">Platform Operations</h1>
          <p className="ios-subtitle">Real-time platform health · Harness Layer 6 Observability</p>
        </div>
      </div>

      {/* Health Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {HEALTH_METRICS.map((m) => (
          <div key={m.label} className="ios-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ padding: 6, background: tintedBg(m.color, 10), color: m.color, borderRadius: 'var(--border-radius-md)' }}>
                {m.icon}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{m.value}</div>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{m.detail}</p>
          </div>
        ))}
      </div>

      {/* Active Alerts */}
      <div className="ios-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Active Alerts</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ALERTS.map((alert, idx) => {
            const color = ALERT_COLORS[alert.level];
            return (
              <div key={idx} style={{
                borderLeft: `3px solid ${color}`, borderRadius: 'var(--border-radius-md)',
                padding: '12px 16px', background: tintedBg(color, 5),
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ color, flexShrink: 0 }}>{ALERT_ICONS[alert.level]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color, letterSpacing: '0.04em' }}>{alert.level}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{alert.message}</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{alert.time}</span>
                {alert.action && (
                  <button style={{
                    padding: '4px 12px', borderRadius: '999px',
                    background: tintedBg(color, 15), color, border: 'none',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>{alert.action}</button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Evolution Tracker */}
      <div className="ios-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <TrendingUp size={18} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Evolution Tracker</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {EVOLUTION_TRACKER.map((entry) => {
            const statusColor = STATUS_COLORS[entry.status];
            return (
              <div key={entry.context} style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: 12,
                borderRadius: 'var(--border-radius-md)',
                background: tintedBg('var(--panel-bg-secondary)', 50),
                border: '1px solid var(--border-color)',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{entry.context}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{entry.cases} cases</div>
                </div>
                <span style={{
                  padding: '2px 8px', borderRadius: '999px',
                  background: tintedBg(statusColor, 15), color: statusColor,
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                }}>{entry.status}</span>
                <div style={{ width: 80 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>confidence coverage</div>
                  <div style={{ height: 4, borderRadius: 2, background: tintedBg('var(--text-tertiary)', 20), overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${entry.confidenceCoverage * 100}%`, background: statusColor, borderRadius: 2 }} />
                  </div>
                </div>
                <ConfidenceBadge value={entry.confidenceCoverage} />
              </div>
            );
          })}
        </div>
      </div>
    </main>
    </RoleGuard>
  );
}
