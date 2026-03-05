'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  approveApproval,
  approvalEventsUrl,
  listApprovals,
  rejectApproval,
  type ApprovalItem,
} from '../lib/api';
import { useTenant } from './tenant-context';
import { SovereignGovernanceInsight } from './sovereign-governance-insight';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { REJECTION_REASONS } from '../lib/constants/reject-reasons';

function formatDate(dateLike: string | null): string {
  if (!dateLike) return '-';
  const date = new Date(dateLike);
  return date.toLocaleString();
}

export function ApprovalsDashboard() {
  const { currentTenantId: tenantId } = useTenant();
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedId, setUpdatedId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>(REJECTION_REASONS[0].value);
  const [rejectNote, setRejectNote] = useState<string>('');

  async function refresh() {
    try {
      setLoading(true);
      setError(null);
      const data = await listApprovals(tenantId);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    const source = new EventSource(approvalEventsUrl(tenantId));

    source.addEventListener('ready', () => {
      setConnected(true);
    });

    source.addEventListener('approval.created', (event) => {
      try {
        const incoming = JSON.parse((event as MessageEvent).data) as Partial<ApprovalItem>;
        if (!incoming.id) return;

        setUpdatedId(incoming.id);
        setTimeout(() => setUpdatedId(null), 1200);
        void refresh();
      } catch {
        // ignore malformed events
      }
    });

    source.onerror = () => {
      setConnected(false);
    };

    return () => {
      source.close();
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const pendingCount = useMemo(
    () => items.filter((item) => item.status === 'PENDING').length,
    [items],
  );

  async function handleApprove(id: string) {
    await approveApproval(id, tenantId);
    await refresh();
  }

  function openRejectDialog(id: string) {
    setRejectingId(id);
    setRejectReason('RISK_TOO_HIGH');
    setRejectNote('');
  }

  async function handleRejectConfirm() {
    if (!rejectingId) return;
    const reason = `[${rejectReason}]${rejectNote ? ` ${rejectNote}` : ''}`;
    await rejectApproval(rejectingId, tenantId, reason);
    setRejectingId(null);
    await refresh();
  }

  return (
    <main>
      <div className="header">
        <div>
          <h1 className="ios-title">Approvals Dashboard</h1>
          <p className="ios-subtitle">
            Human-in-the-loop oversight | Pending: <strong>{pendingCount}</strong> | SSE: <strong>{connected ? 'connected' : 'retrying'}</strong>
          </p>
        </div>
      </div>

      <div className="card table-wrap">
        {loading ? <p style={{ padding: 16 }}>Loading approvals...</p> : null}
        {error ? <p style={{ padding: 16, color: '#b42318' }}>{error}</p> : null}

        {!loading && !error ? (
          <table>
            <thead>
              <tr>
                <th>Intent</th>
                <th>Domain/Action</th>
                <th>Risk</th>
                <th>Status</th>
                <th>Created</th>
                <th>Ops</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6}>No approvals found for tenant.</td>
                </tr>
              ) : null}

              {items.map((item) => (
                <React.Fragment key={item.id}>
                  <tr
                    className={`${updatedId === item.id ? 'row-highlight' : ''} ${expandedId === item.id ? 'active' : ''}`}
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {expandedId === item.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        <div>
                          <div>{item.intentId}</div>
                          <div className="small">{item.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>{item.domain}</div>
                      <div className="small">{item.action}</div>
                    </td>
                    <td>
                      <div style={{ color: Number(item.riskScore) > 0.7 ? 'var(--danger)' : Number(item.riskScore) > 0.4 ? 'var(--warning)' : 'inherit', fontWeight: 600 }}>
                        {item.riskScore}
                      </div>
                      <div className="small">{item.reason ?? '-'}</div>
                    </td>
                    <td>
                      <span className={`status ${item.status}`}>{item.status}</span>
                    </td>
                    <td>
                      <div>{formatDate(item.createdAt)}</div>
                      <div className="small">expires: {formatDate(item.expiresAt)}</div>
                    </td>
                    <td>
                      <div className="actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="approve"
                          title="Approve this automated AI action to proceed"
                          onClick={() => void handleApprove(item.id)}
                          disabled={item.status !== 'PENDING'}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="reject"
                          title="Reject and block this automated AI action"
                          onClick={() => openRejectDialog(item.id)}
                          disabled={item.status !== 'PENDING'}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === item.id && (
                    <tr className="detail-row">
                      <td colSpan={6} style={{ padding: '16px 24px', background: 'var(--sidebar-bg)' }}>
                        <SovereignGovernanceInsight
                          reasoningLog={item.reasoningLog}
                          constitution={item.constitution}
                          governance={item.governance}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      {rejectingId && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setRejectingId(null)}
        >
          <div
            style={{
              background: 'var(--card-bg, #fff)', borderRadius: 12, padding: 24,
              minWidth: 360, maxWidth: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>Help the Agent learn</h3>
            <div style={{
              background: 'color-mix(in srgb, var(--warning, #FBBF24) 15%, transparent)',
              borderLeft: '3px solid var(--warning, #FBBF24)',
              padding: '8px 12px',
              fontSize: 12,
              color: 'var(--text-primary)',
              marginBottom: 16,
              lineHeight: 1.5,
            }}>
              ⚠ Reject requires reason selection — feeds Layer 7 evolution
            </div>
            <select
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--border, #ddd)', marginBottom: 12, fontSize: 14,
              }}
            >
              {REJECTION_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <textarea
              placeholder="补充说明（可选）"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--border, #ddd)', marginBottom: 16, fontSize: 14,
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setRejectingId(null)}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border, #ddd)',
                  background: 'transparent', cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleRejectConfirm()}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: 'var(--danger, #b42318)', color: '#fff', cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
