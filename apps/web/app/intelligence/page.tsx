'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { RoleGuard } from '../../components/guards/role-guard';
import { StatBadge } from '../../components/ui/stat-badge';
import { useTenant } from '../../components/tenant-context';
import {
  fetchDashboardStats,
  fetchInsightStream,
  fetchDriftAlerts,
  type DashboardStats,
  type InsightStreamData,
  type DriftAlert,
} from '../../lib/api';
import {
  MOCK_KPIS,
  MOCK_CASES_BY_SOURCE,
  MOCK_ISSUE_TYPES,
  MOCK_SENTIMENTS,
  MOCK_PRODUCT_FEEDBACK,
  MOCK_AI_INSIGHTS,
  MOCK_WRITEBACK_QUEUE,
  MOCK_A2A_LOGS,
  MOCK_INSIGHT_STREAM,
} from '../../lib/mock-intelligence-data';
import type {
  CrossChannelKPI,
  CasesBySource,
  IssueTypeEntry,
  ChannelSentiment,
  ProductFeedbackEntry,
  AIInsight,
  WritebackQueueItem,
  A2AActivityLog,
  InsightStreamItem,
} from '../../lib/support-types';
import { timeAgo } from '../../lib/format';
import { NexusSubNav } from '../../components/nexus-sub-nav';

// ─── Helpers ───

function trendLabel(value: number, suffix = 'vs prev'): string {
  if (value === 0) return '';
  const pct = Math.round(Math.abs(value) * 100);
  return value > 0 ? `↑ ${pct}% ${suffix}` : `↓ ${pct}% ${suffix}`;
}

function trendColor(value: number, invertPositive = false): string {
  if (value > 0) return invertPositive ? 'var(--danger)' : 'var(--success)';
  if (value < 0) return invertPositive ? 'var(--success)' : 'var(--danger)';
  return 'var(--text-tertiary)';
}

const sectionTitle: React.CSSProperties = {
  fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16,
};

const cardStyle: React.CSSProperties = {
  padding: 20,
  background: 'var(--panel-bg)',
  border: '1px solid var(--panel-border)',
  borderRadius: 'var(--border-radius-lg)',
  boxShadow: 'var(--panel-shadow)',
};

// ─── Module 1: KPI Row ───

const KPIRow = memo(function KPIRow({ kpis }: { kpis: CrossChannelKPI }) {
  const items: { label: string; value: string; trend: string; trendColor: string; subtitle?: string }[] = [
    { label: 'Total Cases', value: kpis.totalCases.toLocaleString(), trend: trendLabel(kpis.trends.totalCases), trendColor: trendColor(kpis.trends.totalCases) },
    { label: 'Auto-Resolved', value: `${kpis.autoResolvedPct}%`, trend: trendLabel(kpis.trends.autoResolvedPct), trendColor: trendColor(kpis.trends.autoResolvedPct) },
    { label: 'Avg Response', value: `${kpis.avgResponseSec}s`, trend: 'Agent-only', trendColor: 'var(--text-tertiary)' },
    { label: 'Escalations', value: kpis.escalations.toLocaleString(), trend: trendLabel(kpis.trends.escalations), trendColor: trendColor(kpis.trends.escalations, true) },
    { label: 'A2A Sessions', value: kpis.a2aSessions.toLocaleString(), trend: '↑ New channel', trendColor: 'var(--accent)' },
    { label: 'KB Writebacks', value: kpis.kbWritebacks.toLocaleString(), trend: 'Agent learned', trendColor: 'var(--success)' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
      {items.map(item => (
        <StatBadge key={item.label} label={item.label} value={item.value} trend={item.trend} trendColor={item.trendColor} />
      ))}
    </div>
  );
});

// ─── Module 2: Cases by Source ───

const CasesBySourceCard = memo(function CasesBySourceCard({ sources }: { sources: CasesBySource[] }) {
  const maxCount = Math.max(...sources.map(s => s.count));

  return (
    <div style={cardStyle}>
      <div style={sectionTitle}>Cases by Source</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 16 }}>All channels · 30D</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sources.map(s => (
          <div key={s.channel} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, width: 24, textAlign: 'center' }}>{s.icon}</span>
            <span style={{ width: 90, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{s.channelName}</span>
            <div style={{ flex: 1, height: 24, background: 'color-mix(in srgb, var(--text-tertiary) 8%, transparent)', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}>
              <div style={{
                width: `${(s.count / maxCount) * 100}%`, height: '100%',
                background: 'var(--accent)', borderRadius: 'var(--border-radius-sm)',
                transition: 'width 0.4s ease',
              }} />
            </div>
            <span style={{ width: 40, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{s.count}</span>
            <span style={{ width: 32, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
});

// ─── Module 3: Issue Type Distribution ───

const IssueTypeCard = memo(function IssueTypeCard({ issues }: { issues: IssueTypeEntry[] }) {
  const maxCount = Math.max(...issues.map(i => i.count));
  const barColors = [
    'var(--danger)', 'var(--accent)', 'var(--warning)', 'color-mix(in srgb, var(--accent) 70%, var(--success))',
    'var(--success)', 'color-mix(in srgb, var(--text-tertiary) 60%, transparent)',
    'color-mix(in srgb, var(--danger) 60%, transparent)', 'var(--text-tertiary)',
  ];

  return (
    <div style={cardStyle}>
      <div style={sectionTitle}>Issue Type Distribution</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 16 }}>All products · Click to drill down</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {issues.map((issue, i) => (
          <div key={issue.type} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <span style={{ width: 34, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{issue.count}</span>
            <div style={{ flex: 1, height: 22, background: 'color-mix(in srgb, var(--text-tertiary) 8%, transparent)', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}>
              <div style={{
                width: `${(issue.count / maxCount) * 100}%`, height: '100%',
                background: barColors[i % barColors.length], borderRadius: 'var(--border-radius-sm)',
                transition: 'width 0.4s ease',
              }} />
            </div>
            <span style={{ width: 130, fontSize: 12, color: 'var(--text-secondary)' }}>{issue.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

// ─── Module 4: Sentiment by Platform ───

const SentimentCard = memo(function SentimentCard({ sentiments }: { sentiments: ChannelSentiment[] }) {
  return (
    <div style={cardStyle}>
      <div style={sectionTitle}>Sentiment by Platform</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 16 }}>Cross-platform comparison</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {sentiments.map(s => (
          <div key={s.channel} style={{ padding: 14, border: '1px solid var(--panel-border)', borderRadius: 'var(--border-radius-md)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>{s.channelName}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SentimentBar label="Positive" pct={s.positivePct} color="var(--success)" />
              <SentimentBar label="Neutral" pct={s.neutralPct} color="var(--text-tertiary)" />
              <SentimentBar label="Negative" pct={s.negativePct} color="var(--danger)" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

function SentimentBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 56, fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ flex: 1, height: 16, background: 'color-mix(in srgb, var(--text-tertiary) 8%, transparent)', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 'var(--border-radius-sm)', transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ width: 30, fontSize: 11, fontWeight: 600, color, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

// ─── Module 5: Product Feedback Signals ───

const ProductFeedbackCard = memo(function ProductFeedbackCard({ products }: { products: ProductFeedbackEntry[] }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={sectionTitle}>Product Feedback Signals</div>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Threshold alerts active</span>
      </div>
      <div className="table-wrap">
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Product</th>
              <th style={{ textAlign: 'right' }}>Cases</th>
              <th style={{ textAlign: 'right' }}>Defect %</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => {
              const rowBg = p.status === 'alert_sent'
                ? 'color-mix(in srgb, var(--danger) 8%, transparent)'
                : p.status === 'rising'
                ? 'color-mix(in srgb, var(--warning) 6%, transparent)'
                : undefined;
              return (
                <tr key={p.commodityId} style={{ background: rowBg }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.productName}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.batchId ?? p.market ?? ''}</div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.totalCases}</td>
                  <td style={{
                    textAlign: 'right', fontWeight: 700,
                    color: p.defectPct >= 20 ? 'var(--danger)' : p.defectPct >= 10 ? 'var(--warning)' : 'var(--text-primary)',
                  }}>
                    {p.defectPct}%
                  </td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: p.status === 'alert_sent' ? 'var(--danger)' : p.status === 'rising' ? 'var(--warning)' : 'var(--success)',
                    }}>
                      {p.statusLabel}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

// ─── Module 6: AI Insights ───

const SEVERITY_CONFIG: Record<AIInsight['severity'], { bg: string; border: string; label: string; labelColor: string }> = {
  critical: { bg: 'color-mix(in srgb, var(--danger) 8%, transparent)', border: 'var(--danger)', label: 'CRITICAL', labelColor: 'var(--danger)' },
  pattern: { bg: 'color-mix(in srgb, var(--accent) 8%, transparent)', border: 'var(--accent)', label: 'PATTERN', labelColor: 'var(--accent)' },
  opportunity: { bg: 'color-mix(in srgb, var(--success) 8%, transparent)', border: 'var(--success)', label: 'OPPORTUNITY', labelColor: 'var(--success)' },
  a2a: { bg: 'color-mix(in srgb, var(--accent) 8%, transparent)', border: 'var(--accent)', label: 'A2A', labelColor: 'var(--accent)' },
};

const AIInsightsCard = memo(function AIInsightsCard({ insights }: { insights: AIInsight[] }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 16 }}>🧠</span>
        <span style={sectionTitle}>AI Insights</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>Agent-generated</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {insights.map(ins => {
          const cfg = SEVERITY_CONFIG[ins.severity];
          return (
            <div key={ins.id} style={{
              padding: 14, borderRadius: 'var(--border-radius-md)',
              background: cfg.bg, borderLeft: `3px solid ${cfg.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '2px 6px', borderRadius: 'var(--border-radius-sm)',
                  background: `color-mix(in srgb, ${cfg.border} 20%, transparent)`, color: cfg.labelColor,
                }}>
                  {cfg.label}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{ins.title}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: cfg.labelColor, marginLeft: 'auto' }}>{ins.metric}</span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 8 }}>
                {ins.description}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: cfg.labelColor, cursor: 'pointer' }}>
                {ins.actionLabel}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ─── Module 7: Writeback Queue ───

const WritebackQueueCard = memo(function WritebackQueueCard({ items }: { items: WritebackQueueItem[] }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 16 }}>🧬</span>
        <span style={sectionTitle}>Writeback Queue</span>
        <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600, marginLeft: 'auto' }}>{items.length} pending · Agent waiting</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(item => (
          <div key={item.caseId} style={{
            padding: 14, borderRadius: 'var(--border-radius-md)',
            background: 'color-mix(in srgb, var(--warning) 6%, transparent)',
            border: '1px solid color-mix(in srgb, var(--warning) 20%, transparent)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{item.productName}</span>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, color: 'var(--danger)',
                padding: '2px 8px', borderRadius: '999px',
                background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
              }}>
                {item.overdueLabel}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>
              {item.channel === 'amazon' ? 'Amazon US' : item.channel === 'tiktok' ? 'TikTok Shop' : item.channel} · {item.caseRef}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{item.summary}</div>
            <div style={{
              fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic', marginBottom: 10,
              padding: '6px 10px', background: 'color-mix(in srgb, var(--text-tertiary) 5%, transparent)',
              borderRadius: 'var(--border-radius-sm)', border: '1px dashed var(--panel-border)',
            }}>
              {item.promptQuestion}
            </div>
            <button
              disabled
              title="Coming soon"
              style={{
                padding: '6px 16px', fontSize: 11, fontWeight: 700,
                background: 'var(--success)', color: 'var(--bg-color)', border: 'none',
                borderRadius: '999px', cursor: 'not-allowed', opacity: 0.7,
              }}
            >
              SAVE → AGENT LEARNS
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});

// ─── Module 8: A2A Activity Log ───

const STATUS_TYPE_STYLES: Record<A2AActivityLog['statusType'], { color: string; bg: string }> = {
  waiting: { color: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning) 8%, transparent)' },
  auto: { color: 'var(--success)', bg: 'color-mix(in srgb, var(--success) 8%, transparent)' },
  human_confirmed: { color: 'var(--accent)', bg: 'color-mix(in srgb, var(--accent) 8%, transparent)' },
  read_only: { color: 'var(--text-tertiary)', bg: 'color-mix(in srgb, var(--text-tertiary) 8%, transparent)' },
};

const A2AActivityCard = memo(function A2AActivityCard({ logs }: { logs: A2AActivityLog[] }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 16 }}>🤖</span>
        <span style={sectionTitle}>A2A Activity Log</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>Consumer agents · 30D</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {logs.map(log => {
          const st = STATUS_TYPE_STYLES[log.statusType];
          return (
            <div key={log.id} style={{
              padding: 14, borderRadius: 'var(--border-radius-md)',
              background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                  padding: '2px 8px', borderRadius: 'var(--border-radius-sm)',
                  background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                }}>
                  {log.agentName}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{timeAgo(log.timestamp)}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{log.title}</div>
              <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)', marginBottom: 8 }}>{log.description}</div>
              <div style={{
                fontSize: 11, fontWeight: 600, color: st.color,
                padding: '3px 10px', borderRadius: '999px', background: st.bg,
                display: 'inline-block',
              }}>
                {log.statusLabel}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ─── Module 9: Bottom Insight Stream ───

const BottomInsightStream = memo(function BottomInsightStream({ items }: { items: InsightStreamItem[] }) {
  const productItems = items.filter(i => i.category === 'product');
  const marketItems = items.filter(i => ['market', 'a2a', 'sentiment'].includes(i.category));
  const kbItems = items.filter(i => i.category === 'knowledge');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
      <StreamColumn title="Product Intelligence" items={productItems} />
      <StreamColumn title="Market Signals" items={marketItems} />
      <StreamColumn title="KB Growth" items={kbItems} />
    </div>
  );
});

function StreamColumn({ title, items }: { title: string; items: InsightStreamItem[] }) {
  return (
    <div style={cardStyle}>
      <div style={{ ...sectionTitle, marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 12 }}>No recent items</div>
        )}
        {items.map(item => (
          <div key={item.id} style={{
            padding: '10px 12px', borderRadius: 'var(--border-radius-md)',
            borderLeft: '3px solid var(--panel-border)',
            background: 'color-mix(in srgb, var(--text-tertiary) 3%, transparent)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ fontSize: 12, flexShrink: 0 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 4 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                  {item.description}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {timeAgo(item.timestamp)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Module 10: Knowledge Drift Alerts ───

const DriftAlertsCard = memo(function DriftAlertsCard({ alerts }: { alerts: DriftAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <div style={{ ...cardStyle, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 16 }}>⚠️</span>
        <div style={sectionTitle}>Knowledge Drift Detected</div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--border-radius-sm)',
          background: 'color-mix(in srgb, var(--danger) 15%, transparent)', color: 'var(--danger)',
        }}>
          {alerts.length} {alerts.length === 1 ? 'category' : 'categories'}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {alerts.map((alert) => (
          <div key={`${alert.tenantId}-${alert.category}`} style={{
            padding: 14, borderRadius: 'var(--border-radius-md)',
            border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
            background: 'color-mix(in srgb, var(--danger) 4%, transparent)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {alert.category}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 700, color: 'var(--danger)',
              }}>
                ↓ {Math.round(alert.driftPct * 100)}% decline
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
              <span>Impact: {alert.previousAvgImpact.toFixed(2)} → {alert.currentAvgImpact.toFixed(2)}</span>
              <span>{alert.entryCount} entries</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        Drift indicates knowledge effectiveness is declining. Review affected categories and update knowledge entries.
      </div>
    </div>
  );
});

// ─── Period Selector ───

function PeriodSelector({
  active, onChange,
}: {
  active: string;
  onChange: (v: string) => void;
}) {
  const options = ['7D', '30D', '90D'];
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 8 }}>Period:</span>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            padding: '5px 14px', fontSize: 12, fontWeight: active === opt ? 700 : 500,
            background: active === opt ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
            color: active === opt ? 'var(--accent)' : 'var(--text-secondary)',
            border: active === opt ? '1px solid var(--accent)' : '1px solid var(--panel-border)',
            borderRadius: '999px', cursor: 'pointer',
          }}
        >
          {opt}
        </button>
      ))}
      <div style={{
        marginLeft: 8, display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 12px', borderRadius: '999px',
        background: 'color-mix(in srgb, var(--success) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)' }}>Live Sync</span>
      </div>
    </div>
  );
}

// ─── Main Page ───

export default function IntelligencePage() {
  return (
    <RoleGuard allowedRoles={['tenant_admin']}>
      <IntelligenceContent />
    </RoleGuard>
  );
}

const useMock = process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA === 'true';

const PERIOD_DAYS: Record<string, number> = { '7D': 7, '30D': 30, '90D': 90 };

interface LiveDashboard {
  kpis: CrossChannelKPI;
  insightItems: InsightStreamItem[];
  driftAlerts: DriftAlert[];
  loading: boolean;
  error: string | null;
}

function useLiveDashboard(period: string): LiveDashboard {
  const { currentTenantId: tenantId } = useTenant();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [streamItems, setStreamItems] = useState<InsightStreamData['items']>([]);
  const [driftAlerts, setDriftAlerts] = useState<DriftAlert[]>([]);
  const [loading, setLoading] = useState(!useMock);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef<string>('');
  const driftFetchedRef = useRef<string>('');

  useEffect(() => {
    if (useMock || !tenantId) return;
    const cacheKey = `${tenantId}:${period}`;
    if (fetchedRef.current === cacheKey) return;
    fetchedRef.current = cacheKey;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const days = PERIOD_DAYS[period] ?? 30;
    Promise.all([
      fetchDashboardStats(tenantId, days),
      fetchInsightStream(tenantId, 15),
    ])
      .then(([dashData, streamData]) => {
        if (cancelled) return;
        setStats(dashData);
        setStreamItems(streamData.items);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load data');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [tenantId, period]);

  useEffect(() => {
    if (useMock || !tenantId) return;
    if (driftFetchedRef.current === tenantId) return;
    driftFetchedRef.current = tenantId;

    fetchDriftAlerts(tenantId)
      .then((data) => setDriftAlerts(data.alerts))
      .catch(() => {});
  }, [tenantId]);

  if (useMock) {
    return { kpis: MOCK_KPIS, insightItems: MOCK_INSIGHT_STREAM, driftAlerts: [], loading: false, error: null };
  }

  if (!stats) {
    return { kpis: MOCK_KPIS, insightItems: MOCK_INSIGHT_STREAM, driftAlerts, loading, error };
  }

  // avgResponseSec, a2aSessions, trends: not yet available from API — using mock placeholders
  const liveKpis: CrossChannelKPI = {
    totalCases: stats.totalCases,
    autoResolvedPct: stats.autoResolutionRate,
    avgResponseSec: MOCK_KPIS.avgResponseSec,
    escalations: stats.escalations,
    a2aSessions: MOCK_KPIS.a2aSessions,
    kbWritebacks: stats.kbWritebacks,
    trends: MOCK_KPIS.trends,
  };

  const liveInsights: InsightStreamItem[] = streamItems.map((item) => ({
    id: item.id,
    timestamp: item.timestamp,
    icon: item.icon,
    category: item.category as InsightStreamItem['category'],
    title: item.title,
    description: item.description,
  }));

  return { kpis: liveKpis, insightItems: liveInsights, driftAlerts, loading, error: null };
}

function IntelligenceContent() {
  const [period, setPeriod] = useState('30D');
  const { kpis, insightItems, driftAlerts, loading, error } = useLiveDashboard(period);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 className="ios-title">Support Intelligence</h1>
        <NexusSubNav />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <PeriodSelector active={period} onChange={setPeriod} />
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>
          Loading live data...
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: 16, marginBottom: 16, color: 'var(--danger)', fontSize: 13, background: 'color-mix(in srgb, var(--danger) 8%, transparent)', borderRadius: 'var(--border-radius-md)' }}>
          Failed to load live data: {error}. Showing cached/fallback data.
        </div>
      )}

      {/* KPI Row */}
      <div style={{ marginBottom: 24 }}>
        <KPIRow kpis={kpis} />
      </div>

      {/* Row 2: Cases by Source + Issue Type Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <CasesBySourceCard sources={MOCK_CASES_BY_SOURCE} />
        <IssueTypeCard issues={MOCK_ISSUE_TYPES} />
      </div>

      {/* Row 3: Sentiment by Platform + Product Feedback */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <SentimentCard sentiments={MOCK_SENTIMENTS} />
        <ProductFeedbackCard products={MOCK_PRODUCT_FEEDBACK} />
      </div>

      {/* Row 4: AI Insights (full width) */}
      <div style={{ marginBottom: 24 }}>
        <AIInsightsCard insights={MOCK_AI_INSIGHTS} />
      </div>

      {/* Row 4b: Knowledge Drift Alerts */}
      <DriftAlertsCard alerts={driftAlerts} />

      {/* Row 5: Writeback Queue + A2A Activity Log */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <WritebackQueueCard items={MOCK_WRITEBACK_QUEUE} />
        <A2AActivityCard logs={MOCK_A2A_LOGS} />
      </div>

      {/* Row 6: Bottom Insight Stream (3 columns) */}
      <BottomInsightStream items={insightItems} />
    </div>
  );
}
