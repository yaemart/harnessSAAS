'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity, Zap, ShieldAlert, Cpu, Layers, DollarSign, LayoutDashboard,
  CheckCircle, XCircle, Edit3, Clock, AlertTriangle, Shield, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Bot, Gauge, AlertCircle, Info, MessageSquare, Bookmark,
} from 'lucide-react';
import { useAuth } from '../components/auth-context';
import { useTenant } from '../components/tenant-context';
import { tintedBg } from '../lib/design-tokens';
import { REJECTION_REASONS } from '../lib/constants/reject-reasons';
import { IronLawBanner } from '../components/banners/iron-law-banner';
import { ConfidenceBadge } from '../components/ui/confidence-badge';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3300';

interface Approval {
  id: string;
  intentDomain: string;
  intentAction: string;
  riskLevel: string;
  riskScore: number;
  confidence?: number;
  createdAt: string;
  status: string;
}

type InboxPriority = 'CRITICAL' | 'WARNING' | 'INFO';

function mapRiskToPriority(level: string): InboxPriority {
  if (level === 'CRITICAL' || level === 'HIGH') return 'CRITICAL';
  if (level === 'MEDIUM') return 'WARNING';
  return 'INFO';
}

function mapDomainToAgent(domain: string): string {
  const map: Record<string, string> = {
    pricing: 'PricingAgent', ads: 'AdAgent', inventory: 'InventoryAgent',
    listing: 'ListingAgent', profit: 'ProfitAgent', content: 'ContentAgent',
  };
  return map[domain.toLowerCase()] ?? `${domain}Agent`;
}

const PRIORITY_COLORS: Record<InboxPriority, string> = {
  CRITICAL: 'var(--danger)',
  WARNING: 'var(--warning)',
  INFO: 'var(--accent)',
};

const PRIORITY_ICONS: Record<InboxPriority, React.ReactNode> = {
  CRITICAL: <AlertCircle size={16} />,
  WARNING: <AlertTriangle size={16} />,
  INFO: <Info size={16} />,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ─── Inbox Card ─── */
function InboxCard({ approval, onAction }: {
  approval: Approval;
  onAction: (id: string, action: 'approve' | 'modify' | 'reject', reason?: string) => void;
}) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [customNote, setCustomNote] = useState('');

  const priority = mapRiskToPriority(approval.riskLevel);
  const color = PRIORITY_COLORS[priority];
  const agentName = mapDomainToAgent(approval.intentDomain);

  const handleRejectConfirm = () => {
    if (!selectedReason) return;
    const reason = selectedReason === 'OTHER' ? customNote : selectedReason;
    if (!reason) return;
    onAction(approval.id, 'reject', `[${selectedReason}] ${customNote}`);
    setShowReject(false);
    setSelectedReason('');
    setCustomNote('');
  };

  return (
    <div style={{
      borderLeft: `3px solid ${color}`,
      borderRadius: 'var(--border-radius-md)',
      background: 'var(--panel-bg)',
      border: '1px solid var(--border-color)',
      borderLeftWidth: 3,
      borderLeftColor: color,
      padding: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            padding: '2px 8px', borderRadius: '999px',
            background: tintedBg(color, 15), color,
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>{priority}</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{agentName}</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{timeAgo(approval.createdAt)}</span>
        </div>
        {approval.confidence != null && (
          <ConfidenceBadge value={approval.confidence} />
        )}
      </div>

      {/* Summary */}
      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: '4px 0 12px', lineHeight: 1.5 }}>
        <strong>{approval.intentDomain}</strong>: {approval.intentAction}
      </p>

      {/* Reasoning toggle */}
      <button
        onClick={() => setShowReasoning(!showReasoning)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', color: 'var(--accent)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 8,
        }}
      >
        {showReasoning ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {showReasoning ? 'Hide reasoning' : 'View reasoning chain (OODA)'}
      </button>

      {showReasoning && (
        <div style={{
          padding: 12,
          background: tintedBg('var(--accent)', 5),
          borderRadius: 'var(--border-radius-sm)',
          fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12,
        }}>
          <div><strong>Observe:</strong> Detected anomaly in {approval.intentDomain} metrics</div>
          <div><strong>Orient:</strong> Compared against 7-day baseline and seasonal patterns</div>
          <div><strong>Decide:</strong> {approval.intentAction} (risk score: {approval.riskScore})</div>
          <div><strong>Act:</strong> Awaiting human confirmation</div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => onAction(approval.id, 'approve')}
          style={{
            padding: '6px 14px', borderRadius: '999px',
            background: 'var(--success)', color: '#fff',
            border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <CheckCircle size={13} /> Execute
        </button>
        <button
          onClick={() => onAction(approval.id, 'modify')}
          style={{
            padding: '6px 14px', borderRadius: '999px',
            background: tintedBg('var(--accent)', 15), color: 'var(--accent)',
            border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <Edit3 size={13} /> Modify
        </button>
        <button
          onClick={() => setShowReject(!showReject)}
          style={{
            padding: '6px 14px', borderRadius: '999px',
            background: tintedBg('var(--danger)', 15), color: 'var(--danger)',
            border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <XCircle size={13} /> Reject
        </button>
        <button
          onClick={() => {/* defer */}}
          style={{
            padding: '6px 14px', borderRadius: '999px',
            background: tintedBg('var(--text-secondary)', 10), color: 'var(--text-secondary)',
            border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <Clock size={13} /> Defer
        </button>

        <div style={{ flex: 1 }} />
        <button title="Ask Agent" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
          <MessageSquare size={16} />
        </button>
        <button title="Mark as Worth Learning" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
          <Bookmark size={16} />
        </button>
      </div>

      {/* Reject panel */}
      {showReject && (
        <div style={{
          marginTop: 12, padding: 16,
          background: tintedBg('var(--danger)', 5),
          borderRadius: 'var(--border-radius-md)',
          border: '1px solid ' + tintedBg('var(--danger)', 20),
        }}>
          <div style={{
            background: tintedBg('var(--warning)', 15),
            borderLeft: '3px solid var(--warning)',
            padding: '8px 12px', fontSize: 12,
            color: 'var(--text-primary)', marginBottom: 12, lineHeight: 1.5,
          }}>
            ⚠ Reject requires reason selection — feeds Layer 7 evolution
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Help the Agent learn</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>Your judgment trains the system</div>

          {REJECTION_REASONS.map((reason) => (
            <label key={reason.value} style={{
              display: 'flex', flexDirection: 'column', gap: 2,
              padding: '6px 8px', cursor: 'pointer',
              borderRadius: 'var(--border-radius-sm)',
              background: selectedReason === reason.value ? tintedBg('var(--accent)', 10) : 'transparent',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)' }}>
                <input type="radio" name={`reject-${approval.id}`} checked={selectedReason === reason.value}
                  onChange={() => setSelectedReason(reason.value)} style={{ accentColor: 'var(--accent)' }} />
                <span style={{ fontWeight: 500 }}>{reason.label}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 24 }}>{reason.hint}</span>
            </label>
          ))}

          {selectedReason === 'OTHER' && (
            <input type="text" placeholder="请补充具体原因..." value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', marginTop: 8,
                borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)',
                background: 'var(--panel-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none',
              }}
            />
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={handleRejectConfirm}
              disabled={!selectedReason || (selectedReason === 'OTHER' && !customNote)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: '999px',
                background: selectedReason && (selectedReason !== 'OTHER' || customNote) ? 'var(--danger)' : tintedBg('var(--text-tertiary)', 20),
                color: selectedReason && (selectedReason !== 'OTHER' || customNote) ? '#fff' : 'var(--text-tertiary)',
                border: 'none', cursor: selectedReason ? 'pointer' : 'default', fontWeight: 600, fontSize: 13,
              }}>Confirm Reject</button>
            <button onClick={() => { setShowReject(false); setSelectedReason(''); setCustomNote(''); }}
              style={{
                padding: '8px 12px', borderRadius: '999px', background: 'transparent',
                color: 'var(--text-secondary)', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 13,
              }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Operator: Intelligent Inbox ─── */
function OperatorInbox() {
  const { authHeaders } = useAuth();
  const { currentTenantId } = useTenant();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/approvals?tenantId=${currentTenantId}`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.approvals ?? []);
        setApprovals(items.filter((a: Approval) => a.status === 'PENDING'));
      }
    } catch { /* network error */ } finally { setLoading(false); }
  }, [currentTenantId, authHeaders]);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  const handleAction = async (id: string, action: 'approve' | 'modify' | 'reject', reason?: string) => {
    try {
      await fetch(`${API_BASE}/approvals/${id}/${action}`, {
        method: 'POST',
        headers: { ...authHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      setApprovals((prev) => prev.filter((a) => a.id !== id));
    } catch { /* silent */ }
  };

  const grouped = {
    CRITICAL: approvals.filter((a) => mapRiskToPriority(a.riskLevel) === 'CRITICAL'),
    WARNING: approvals.filter((a) => mapRiskToPriority(a.riskLevel) === 'WARNING'),
    INFO: approvals.filter((a) => mapRiskToPriority(a.riskLevel) === 'INFO'),
  };

  return (
    <>
      <div className="header">
        <div>
          <h1 className="ios-title">Inbox</h1>
          <p className="ios-subtitle">Agent-pushed decisions. You process, not search. · Layer 5 Collaboration</p>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: '999px',
          background: tintedBg('var(--accent)', 12), color: 'var(--accent)',
          fontSize: 13, fontWeight: 600,
        }}>
          {loading ? '...' : `${approvals.length} items`}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="ios-card" style={{ padding: 20, opacity: 0.5 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 120, height: 16, background: tintedBg('var(--text-tertiary)', 20), borderRadius: 'var(--border-radius-sm)' }} />
                <div style={{ width: 80, height: 16, background: tintedBg('var(--text-tertiary)', 15), borderRadius: 'var(--border-radius-sm)' }} />
              </div>
              <div style={{ width: '60%', height: 14, background: tintedBg('var(--text-tertiary)', 10), borderRadius: 'var(--border-radius-sm)', marginTop: 12 }} />
            </div>
          ))}
        </div>
      ) : approvals.length === 0 ? (
        <div className="ios-card" style={{ padding: 48, textAlign: 'center' }}>
          <CheckCircle size={48} style={{ color: 'var(--success)', opacity: 0.5, marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>All caught up</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No pending items. The AI agents are operating within approved parameters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {(['CRITICAL', 'WARNING', 'INFO'] as InboxPriority[]).map((level) => {
            const items = grouped[level];
            if (items.length === 0) return null;
            const color = PRIORITY_COLORS[level];
            return (
              <div key={level}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ color }}>{PRIORITY_ICONS[level]}</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {level}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>— {items.length} items</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {items.map((a) => <InboxCard key={a.id} approval={a} onAction={handleAction} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ─── Tenant Admin: Business Overview Landing ─── */
function TenantAdminLanding() {
  const { currentTenant } = useTenant();

  const attentionItems = [
    { level: 'CRITICAL' as const, title: 'BT Headphones X1', detail: 'Profit margin turned negative (−4.2%)', confidence: 0.91 },
    { level: 'WARNING' as const, title: 'DE Market', detail: 'Q4 restock window closes in 12 days', confidence: 0.78 },
    { level: 'INFO' as const, title: 'Shopify Channel', detail: 'ROAS 7-day avg beats Amazon by 34%', confidence: 0.72 },
  ];

  return (
    <>
      <div className="header">
        <div>
          <h1 className="ios-title">Business Overview</h1>
          <p className="ios-subtitle">{currentTenant?.name} · True profit across all channels</p>
        </div>
      </div>

      {/* TRUE PROFIT */}
      <div className="ios-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TRUE PROFIT</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)' }}>$18,420</div>
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
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>Updated 2h ago · 4 platforms · confidence 87%</div>
      </div>

      {/* Needs Your Attention */}
      <div className="ios-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Needs Your Attention</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {attentionItems.map((item, idx) => {
            const color = PRIORITY_COLORS[item.level];
            return (
              <div key={idx} style={{
                borderLeft: `3px solid ${color}`, borderRadius: 'var(--border-radius-md)',
                padding: '12px 16px', background: tintedBg(color, 5),
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ color, flexShrink: 0 }}>{PRIORITY_ICONS[item.level]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color, letterSpacing: '0.04em' }}>{item.level}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.detail}</div>
                </div>
                <ConfidenceBadge value={item.confidence} />
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Today Summary */}
      <div className="ios-card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>AI Today Summary</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <p>Past 24h: system auto-executed <strong style={{ color: 'var(--text-primary)' }}>47 operations</strong></p>
          <p>Decisions pending your review: <strong style={{ color: 'var(--warning)' }}>3 items</strong></p>
          <p>Estimated labor hours saved this week: <strong style={{ color: 'var(--success)' }}>12.5 hours</strong></p>
        </div>
      </div>
    </>
  );
}

/* ─── Main Page Router ─── */
export default function HomePage() {
  const { hasRole } = useAuth();

  return (
    <main>
      <IronLawBanner />
      {hasRole('operator') && !hasRole('system_admin', 'tenant_admin') ? (
        <OperatorInbox />
      ) : hasRole('viewer') && !hasRole('system_admin', 'tenant_admin', 'operator') ? (
        <div className="ios-card" style={{ padding: 48, textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>Executive Report</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 13 }}>
            Navigate to <a href="/dashboard" style={{ color: 'var(--accent)', fontWeight: 600 }}>Executive Dashboard</a> for your read-only business overview.
          </p>
        </div>
      ) : hasRole('system_admin') ? (
        <div className="ios-card" style={{ padding: 48, textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>Platform Operations Center</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 13 }}>
            Use the sidebar to navigate to Platform Ops, Knowledge Mgmt, or Harness Monitor.
          </p>
        </div>
      ) : (
        <TenantAdminLanding />
      )}
    </main>
  );
}
