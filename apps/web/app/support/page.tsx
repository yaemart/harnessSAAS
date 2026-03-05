'use client';

import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTenant } from '../../components/tenant-context';
import { RoleGuard } from '../../components/guards/role-guard';
import {
  replySupportCase, closeSupportCase, supportCaseStreamUrl,
  createFeedbackSignal, createKnowledgeEntry, fetchTenantMaturity,
} from '../../lib/api';
import { Badge, type BadgeVariant } from '../../components/ui/badge';
import {
  listUnifiedTickets,
  getUnifiedTicket,
  computeTicketCounts,
  getChannels,
  type UnifiedTicket,
  type UnifiedMessage,
  type ChannelCode,
  type ChannelConfig,
  type TicketFilters,
  type TicketCounts,
} from '../../lib/mock-support-data';
import { timeAgo } from '../../lib/format';
import { NexusSubNav } from '../../components/nexus-sub-nav';

// ─── Shared Sub-Components ───

function StatusBadge({ status }: { status: UnifiedTicket['status'] }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    open: { bg: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', label: 'Open' },
    human_escalated: { bg: 'color-mix(in srgb, var(--warning) 15%, transparent)', color: 'var(--warning)', label: 'Escalated' },
    pending: { bg: 'color-mix(in srgb, var(--text-tertiary) 15%, transparent)', color: 'var(--text-secondary)', label: 'Pending' },
    closed: { bg: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)', label: 'Closed' },
  };
  const s = styles[status] ?? styles.open;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '999px',
      fontSize: 11, fontWeight: 700, background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number | null | undefined }) {
  if (confidence == null) return <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>—</span>;
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';
  return <span style={{ fontSize: 11, fontWeight: 600, color }}>{pct}%</span>;
}

function ChannelIcon({ channel, channels }: { channel: ChannelCode; channels: ChannelConfig[] }) {
  const cfg = channels.find(c => c.code === channel);
  return <span title={cfg?.name}>{cfg?.icon ?? '❓'}</span>;
}

// ─── Platform Status Bar ───

const PlatformStatusBar = memo(function PlatformStatusBar({ channels }: { channels: ChannelConfig[] }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '10px 16px',
      background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
      borderRadius: 'var(--border-radius-lg)', marginBottom: 16,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Channels
      </span>
      {channels.map(ch => (
        <span key={ch.code} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }} title={`Last sync: ${new Date(ch.lastSyncAt).toLocaleString()}`}>
          <span>{ch.icon}</span>
          <span style={{ color: 'var(--text-secondary)' }}>{ch.name}</span>
          <span style={{ color: 'var(--success)', fontSize: 10 }}>✓</span>
        </span>
      ))}
    </div>
  );
});

// ─── Left Panel: Ticket List ───

const TicketListItem = memo(function TicketListItem({
  ticket, isSelected, channels, onSelect,
}: {
  ticket: UnifiedTicket; isSelected: boolean; channels: ChannelConfig[]; onSelect: (id: string) => void;
}) {
  const isA2A = ticket.channel === 'a2a';
  return (
    <div
      onClick={() => onSelect(ticket.id)}
      style={{
        padding: '10px 12px', cursor: 'pointer',
        borderBottom: '1px solid var(--panel-border)',
        background: isSelected ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
        borderLeft: isA2A ? `3px solid ${channels.find(c => c.code === 'a2a')?.color ?? '#7C3AED'}` : isSelected ? '3px solid var(--accent)' : '3px solid transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ChannelIcon channel={ticket.channel} channels={channels} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            {ticket.consumer.name}
          </span>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{timeAgo(ticket.updatedAt)}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {ticket.commodity?.productName ?? 'General'} · {ticket.issueType.replace(/_/g, ' ')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StatusBadge status={ticket.status} />
        {ticket.agentConfidence !== null && <ConfidenceBadge confidence={ticket.agentConfidence} />}
        {ticket.priority === 'critical' && <span style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 700 }}>● CRITICAL</span>}
      </div>
    </div>
  );
});

const TicketListPanel = memo(function TicketListPanel({
  tickets, selectedId, channels, counts,
  statusFilter, channelFilter,
  onSelectTicket, onStatusFilter, onChannelFilter,
}: {
  tickets: UnifiedTicket[];
  selectedId: string | null;
  channels: ChannelConfig[];
  counts: TicketCounts;
  statusFilter: TicketFilters['status'];
  channelFilter: ChannelCode[];
  onSelectTicket: (id: string) => void;
  onStatusFilter: (s: TicketFilters['status']) => void;
  onChannelFilter: (ch: ChannelCode[]) => void;
}) {
  const statusOptions: { value: TicketFilters['status']; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'open', label: 'Open', count: counts.open },
    { value: 'human_escalated', label: 'Escalated', count: counts.human_escalated },
    { value: 'pending', label: 'Pending', count: counts.pending },
    { value: 'closed', label: 'Closed', count: counts.closed },
  ];

  return (
    <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Status filters */}
      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--panel-border)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          Status
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => onStatusFilter(opt.value)}
              style={{
                padding: '4px 10px', fontSize: 11, fontWeight: statusFilter === opt.value ? 700 : 500,
                background: statusFilter === opt.value ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
                color: statusFilter === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
                border: statusFilter === opt.value ? '1px solid var(--accent)' : '1px solid var(--panel-border)',
                borderRadius: '999px', cursor: 'pointer',
              }}
            >
              {opt.label} ({opt.count})
            </button>
          ))}
        </div>
      </div>

      {/* Channel filters */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--panel-border)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          Channel
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <button
            onClick={() => onChannelFilter([])}
            style={{
              padding: '4px 8px', fontSize: 11,
              background: channelFilter.length === 0 ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
              color: channelFilter.length === 0 ? 'var(--accent)' : 'var(--text-secondary)',
              border: channelFilter.length === 0 ? '1px solid var(--accent)' : '1px solid var(--panel-border)',
              borderRadius: '999px', cursor: 'pointer', fontWeight: channelFilter.length === 0 ? 700 : 500,
            }}
          >
            All
          </button>
          {channels.map(ch => {
            const active = channelFilter.includes(ch.code);
            return (
              <button
                key={ch.code}
                onClick={() => {
                  if (active) onChannelFilter(channelFilter.filter(c => c !== ch.code));
                  else onChannelFilter([...channelFilter, ch.code]);
                }}
                style={{
                  padding: '4px 8px', fontSize: 11,
                  background: active ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  border: active ? '1px solid var(--accent)' : '1px solid var(--panel-border)',
                  borderRadius: '999px', cursor: 'pointer', fontWeight: active ? 700 : 500,
                }}
              >
                {ch.icon} {ch.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ticket list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tickets.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
            No tickets found
          </div>
        ) : (
          tickets.map(t => (
            <TicketListItem
              key={t.id}
              ticket={t}
              isSelected={t.id === selectedId}
              channels={channels}
              onSelect={onSelectTicket}
            />
          ))
        )}
      </div>
    </div>
  );
});

// ─── Center Panel: Conversation ───

const ConversationView = memo(function ConversationView({
  ticket, tenantId, channels, onTicketUpdated,
}: {
  ticket: UnifiedTicket; tenantId: string; channels: ChannelConfig[]; onTicketUpdated: () => void;
}) {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendReply = useCallback(async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      if (ticket.channel === 'portal') {
        await replySupportCase(tenantId, ticket.id, reply.trim());
        onTicketUpdated();
      }
      setReply('');
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setSending(false);
    }
  }, [reply, sending, ticket, tenantId, onTicketUpdated]);

  const ch = channels.find(c => c.code === ticket.channel);

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Case header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <ChannelIcon channel={ticket.channel} channels={channels} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {ticket.consumer.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {ch?.name} · {ticket.commodity?.productName ?? 'General'} · {ticket.issueType.replace(/_/g, ' ')}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusBadge status={ticket.status} />
          {ticket.priority === 'critical' && (
            <span style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 700, padding: '2px 8px', background: 'color-mix(in srgb, var(--danger) 15%, transparent)', borderRadius: '999px' }}>
              CRITICAL
            </span>
          )}
        </div>
      </div>

      {/* A2A details banner */}
      {ticket.a2aDetails && (() => {
        const a2aColor = channels.find(c => c.code === 'a2a')?.color ?? 'var(--accent)';
        return (
          <div style={{ padding: '8px 20px', background: `color-mix(in srgb, ${a2aColor} 8%, transparent)`, borderBottom: '1px solid var(--panel-border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: a2aColor, marginBottom: 4 }}>
              🤖 A2A Agent: {ticket.a2aDetails.agentName}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
              Scope: {ticket.a2aDetails.scope.join(', ')}
              {ticket.a2aDetails.humanConfirmationRequired && (
                <span style={{ color: 'var(--warning)', fontWeight: 700, marginLeft: 8 }}>⚠ Human confirmation required</span>
              )}
            </div>
            <div style={{ marginTop: 6 }}>
              {ticket.a2aDetails.operationChain.map((op, i) => (
                <div key={i} style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', gap: 8, marginTop: 2 }}>
                  <span>{new Date(op.timestamp).toLocaleTimeString()}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{op.action}</span>
                  <span>→ {op.result}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Messages timeline */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        {ticket.messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Reply input */}
      {ticket.status !== 'closed' && (
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--panel-border)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Type your reply..."
              rows={2}
              maxLength={10000}
              style={{
                flex: 1, padding: '8px 12px', fontSize: 13,
                border: '1px solid var(--panel-border)', borderRadius: 'var(--border-radius-md)',
                background: 'var(--panel-bg)', color: 'var(--text-primary)', resize: 'none',
              }}
            />
            <button
              onClick={handleSendReply}
              disabled={sending || !reply.trim()}
              style={{
                padding: '8px 16px', fontSize: 12, fontWeight: 600, alignSelf: 'flex-end',
                background: 'var(--accent)', color: 'var(--bg-color)', border: 'none',
                borderRadius: '999px', cursor: 'pointer', opacity: sending || !reply.trim() ? 0.5 : 1,
              }}
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

const MessageBubble = memo(function MessageBubble({ message }: { message: UnifiedMessage }) {
  const roleStyles: Record<string, { bg: string; labelColor: string; label: string }> = {
    consumer: { bg: 'transparent', labelColor: 'var(--text-secondary)', label: 'Consumer' },
    agent: { bg: 'color-mix(in srgb, var(--accent) 5%, transparent)', labelColor: 'var(--accent)', label: 'Agent' },
    operator: { bg: 'color-mix(in srgb, var(--warning) 5%, transparent)', labelColor: 'var(--warning)', label: 'Operator' },
    system: { bg: 'color-mix(in srgb, var(--text-tertiary) 5%, transparent)', labelColor: 'var(--text-tertiary)', label: 'System' },
  };
  const rs = roleStyles[message.role] ?? roleStyles.consumer;

  return (
    <div style={{ padding: '8px 20px', background: rs.bg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: rs.labelColor }}>{rs.label}</span>
          {message.confidence !== undefined && (
            <ConfidenceBadge confidence={message.confidence} />
          )}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{timeAgo(message.createdAt)}</span>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
        {message.contentType === 'image' ? (
          <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>📷 {message.content}</span>
        ) : message.contentType === 'video' ? (
          <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>🎥 {message.content}</span>
        ) : (
          message.content
        )}
      </div>
    </div>
  );
});

// ─── Right Panel: Agent Analysis ───

const REJECT_REASONS = [
  { value: 'inaccurate', label: 'Inaccurate information' },
  { value: 'incomplete', label: 'Incomplete response' },
  { value: 'wrong_tone', label: 'Wrong tone / language' },
  { value: 'policy_violation', label: 'Policy violation' },
  { value: 'other', label: 'Other' },
] as const;

const AAL_LABELS: Record<string, { label: string; variant: BadgeVariant }> = {
  GUIDED: { label: 'L1 Guided', variant: 'danger' },
  ASSISTED: { label: 'L2 Assisted', variant: 'warning' },
  SUPERVISED: { label: 'L3 Supervised', variant: 'info' },
  AUTONOMOUS: { label: 'L4 Autonomous', variant: 'success' },
};

const AgentPanel = memo(function AgentPanel({
  ticket, tenantId, channels, onTicketUpdated, onToast,
}: {
  ticket: UnifiedTicket; tenantId: string; channels: ChannelConfig[]; onTicketUpdated: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const [accepting, setAccepting] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showModify, setShowModify] = useState(false);
  const [rejectReason, setRejectReason] = useState<typeof REJECT_REASONS[number]['value']>(REJECT_REASONS[0].value);
  const [rejectDetail, setRejectDetail] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [modifyText, setModifyText] = useState('');
  const [modifying, setModifying] = useState(false);
  const [aalLevel, setAalLevel] = useState('GUIDED');
  const [tmsScore, setTmsScore] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchTenantMaturity(tenantId)
      .then((data) => {
        if (cancelled) return;
        setAalLevel(data.maturity.autonomyLevel);
        setTmsScore(data.maturity.maturityScore);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tenantId]);

  const handleAccept = useCallback(async () => {
    if (accepting || !ticket.agentSuggestion) return;
    setAccepting(true);
    try {
      await createFeedbackSignal(tenantId, {
        type: 'accept',
        sourceRole: 'operator',
        caseId: ticket.id,
        agentAction: 'suggestion',
        metadata: { suggestion: ticket.agentSuggestion },
      });
      onToast('✓ Confirmed — confidence +0.05, knowledge impact boosted', 'success');
    } catch {
      onToast('Failed to record feedback', 'error');
    } finally {
      setAccepting(false);
    }
  }, [accepting, ticket, tenantId, onToast]);

  const handleReject = useCallback(async () => {
    if (rejecting) return;
    setRejecting(true);
    try {
      await createFeedbackSignal(tenantId, {
        type: 'reject',
        sourceRole: 'operator',
        priorityClass: rejectReason === 'policy_violation' ? 'SAFETY' : 'EXPERIENCE',
        caseId: ticket.id,
        agentAction: 'suggestion',
        reason: rejectReason,
        correction: rejectDetail || undefined,
        metadata: { suggestion: ticket.agentSuggestion },
      });
      onToast('✓ Rejection recorded to Confidence Ledger — confidence −0.10', 'success');
      setShowReject(false);
      setRejectDetail('');
    } catch {
      onToast('Failed to record rejection', 'error');
    } finally {
      setRejecting(false);
    }
  }, [rejecting, ticket, tenantId, rejectReason, rejectDetail, onToast]);

  const handleModify = useCallback(async () => {
    if (modifying || !modifyText.trim()) return;
    setModifying(true);
    try {
      await createFeedbackSignal(tenantId, {
        type: 'modify',
        sourceRole: 'operator',
        caseId: ticket.id,
        agentAction: 'suggestion',
        correction: modifyText.trim(),
        metadata: { originalSuggestion: ticket.agentSuggestion },
      });
      onToast('✓ Correction recorded — Agent will reference in similar scenarios', 'success');
      setShowModify(false);
      setModifyText('');
    } catch {
      onToast('Failed to record modification', 'error');
    } finally {
      setModifying(false);
    }
  }, [modifying, modifyText, ticket, tenantId, onToast]);

  return (
    <div style={{ width: 340, flexShrink: 0, borderLeft: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {/* AAL Indicator */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="small" style={{ fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent Autonomy</span>
        <Badge variant={AAL_LABELS[aalLevel]?.variant ?? 'default'}>
          {AAL_LABELS[aalLevel]?.label ?? aalLevel} · TMS {tmsScore.toFixed(2)}
        </Badge>
      </div>
      {/* Agent recommendation */}
      {ticket.agentSuggestion && (
        <div style={{ padding: '16px', borderBottom: '1px solid var(--panel-border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Agent Recommendation
          </div>
          <div style={{
            padding: 12, borderRadius: 'var(--border-radius-md)',
            background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
          }}>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-primary)', marginBottom: 8 }}>
              {ticket.agentSuggestion}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Confidence:</span>
                <ConfidenceBadge confidence={ticket.agentConfidence} />
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  style={{
                    padding: '4px 12px', fontSize: 11, fontWeight: 600,
                    background: 'var(--accent)', color: 'var(--bg-color)', border: 'none',
                    borderRadius: '999px', cursor: accepting ? 'wait' : 'pointer',
                    opacity: accepting ? 0.7 : 1,
                  }}
                >
                  {accepting ? '...' : '✓ Accept'}
                </button>
                <button
                  onClick={() => { setShowModify(!showModify); setShowReject(false); }}
                  style={{
                    padding: '4px 12px', fontSize: 11, fontWeight: 600,
                    background: 'color-mix(in srgb, var(--warning) 12%, transparent)',
                    color: 'var(--warning)', border: '1px solid var(--warning)',
                    borderRadius: '999px', cursor: 'pointer',
                  }}
                >
                  ✎ Modify
                </button>
                <button
                  onClick={() => { setShowReject(!showReject); setShowModify(false); }}
                  style={{
                    padding: '4px 12px', fontSize: 11, fontWeight: 600,
                    background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
                    color: 'var(--danger)', border: '1px solid var(--danger)',
                    borderRadius: '999px', cursor: 'pointer',
                  }}
                >
                  ✗ Reject
                </button>
              </div>
            </div>

            {/* Modify editor */}
            {showModify && (
              <div style={{ marginTop: 10, padding: 10, background: 'var(--panel-bg)', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--panel-border)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Corrected Response
                </div>
                <textarea
                  value={modifyText}
                  onChange={e => setModifyText(e.target.value)}
                  placeholder="Type the corrected suggestion..."
                  rows={3}
                  maxLength={5000}
                  style={{
                    width: '100%', padding: '6px 8px', fontSize: 11,
                    border: '1px solid var(--panel-border)', borderRadius: 'var(--border-radius-sm)',
                    background: 'var(--panel-bg)', color: 'var(--text-primary)', resize: 'none',
                  }}
                />
                <button
                  onClick={handleModify}
                  disabled={modifying || !modifyText.trim()}
                  style={{
                    marginTop: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600,
                    background: 'var(--warning)', color: 'var(--bg-color)', border: 'none',
                    borderRadius: '999px', cursor: modifying ? 'wait' : 'pointer',
                    opacity: modifying || !modifyText.trim() ? 0.7 : 1,
                  }}
                >
                  {modifying ? '...' : 'Submit Correction'}
                </button>
              </div>
            )}

            {/* Reject reason selector */}
            {showReject && (
              <div style={{ marginTop: 10, padding: 10, background: 'var(--panel-bg)', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--panel-border)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Reason (Agent pre-selected)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {REJECT_REASONS.map(r => (
                    <button
                      key={r.value}
                      onClick={() => setRejectReason(r.value)}
                      style={{
                        padding: '3px 8px', fontSize: 10, fontWeight: rejectReason === r.value ? 700 : 400,
                        background: rejectReason === r.value ? 'color-mix(in srgb, var(--danger) 15%, transparent)' : 'transparent',
                        color: rejectReason === r.value ? 'var(--danger)' : 'var(--text-secondary)',
                        border: `1px solid ${rejectReason === r.value ? 'var(--danger)' : 'var(--panel-border)'}`,
                        borderRadius: '999px', cursor: 'pointer',
                      }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={rejectDetail}
                  onChange={e => setRejectDetail(e.target.value)}
                  placeholder="Optional: correction or detail..."
                  rows={2}
                  maxLength={2000}
                  style={{
                    width: '100%', padding: '6px 8px', fontSize: 11,
                    border: '1px solid var(--panel-border)', borderRadius: 'var(--border-radius-sm)',
                    background: 'var(--panel-bg)', color: 'var(--text-primary)', resize: 'none',
                  }}
                />
                <button
                  onClick={handleReject}
                  disabled={rejecting}
                  style={{
                    marginTop: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600,
                    background: 'var(--danger)', color: 'var(--bg-color)', border: 'none',
                    borderRadius: '999px', cursor: rejecting ? 'wait' : 'pointer',
                    opacity: rejecting ? 0.7 : 1,
                  }}
                >
                  {rejecting ? '...' : 'Confirm Rejection'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Media analyses */}
      {ticket.mediaAnalyses.length > 0 && (
        <div style={{ padding: '16px', borderBottom: '1px solid var(--panel-border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Media Analysis
          </div>
          {ticket.mediaAnalyses.map(ma => (
            <div key={ma.id} style={{
              padding: 10, borderRadius: 'var(--border-radius-md)',
              background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', marginBottom: 8,
            }}>
              {ma.originalDeleted && (
                <div style={{ fontSize: 10, color: 'var(--warning)', fontWeight: 600, marginBottom: 6 }}>
                  ⚠ Original file processed & deleted — structured info retained
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <div><strong>Type:</strong> {ma.sourceType}</div>
                {ma.analysisResult.damageType && <div><strong>Damage:</strong> {ma.analysisResult.damageType.replace(/_/g, ' ')}</div>}
                {ma.analysisResult.severity && <div><strong>Severity:</strong> {ma.analysisResult.severity}</div>}
                {ma.analysisResult.observations && (
                  <div><strong>Findings:</strong> {ma.analysisResult.observations.join('; ')}</div>
                )}
                {ma.analysisResult.recommendation && <div><strong>Rec:</strong> {ma.analysisResult.recommendation}</div>}
              </div>
              <div style={{ marginTop: 4 }}>
                <ConfidenceBadge confidence={ma.confidence} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Case info */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--panel-border)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          Case Info
        </div>
        <div style={{ fontSize: 11, lineHeight: 2, color: 'var(--text-secondary)' }}>
          <div><strong>Consumer:</strong> {ticket.consumer.email}</div>
          <div><strong>Product:</strong> {ticket.commodity?.productName ?? '—'}</div>
          <div><strong>Channel:</strong> <ChannelIcon channel={ticket.channel} channels={channels} /> {channels.find(c => c.code === ticket.channel)?.name}</div>
          <div><strong>Priority:</strong> {ticket.priority}</div>
          <div><strong>Created:</strong> {new Date(ticket.createdAt).toLocaleDateString()}</div>
        </div>
      </div>

      {/* Knowledge writeback */}
      <WritebackEditor key={ticket.id} ticket={ticket} tenantId={tenantId} onTicketUpdated={onTicketUpdated} onToast={onToast} />
    </div>
  );
});

function WritebackEditor({
  ticket, tenantId, onTicketUpdated, onToast,
}: {
  ticket: UnifiedTicket; tenantId: string; onTicketUpdated: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const [writeback, setWriteback] = useState(ticket.agentSuggestion ?? '');
  const [closing, setClosing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const isEscalated = ticket.status === 'human_escalated';
  const writebackEmpty = !writeback.trim();
  const closeDisabled = ticket.status === 'closed' || (isEscalated && writebackEmpty) || closing;

  const handleConfirmWriteback = useCallback(async () => {
    if (writebackEmpty || confirming || confirmed) return;
    setConfirming(true);
    try {
      await createKnowledgeEntry(tenantId, {
        source: 'writeback',
        category: ticket.issueType ?? 'general',
        content: writeback.trim(),
        sourceRef: ticket.id,
      });
      setConfirmed(true);
      onToast('Knowledge entered candidate pool — Agent will cite in future similar cases', 'success');
    } catch {
      onToast('Failed to save knowledge entry', 'error');
    } finally {
      setConfirming(false);
    }
  }, [writebackEmpty, confirming, confirmed, tenantId, ticket, writeback, onToast]);

  const handleClose = useCallback(async () => {
    if (closeDisabled) return;
    setClosing(true);
    try {
      if (ticket.channel === 'portal') {
        await closeSupportCase(tenantId, ticket.id, writeback.trim() || 'Resolved', ticket.issueType ?? undefined);
      }
      onToast('Case closed — writeback saved to knowledge base', 'success');
      onTicketUpdated();
    } catch (err) {
      console.error('Failed to close case:', err);
      onToast('Failed to close case', 'error');
    } finally {
      setClosing(false);
    }
  }, [closeDisabled, ticket, tenantId, writeback, onTicketUpdated, onToast]);

  if (ticket.status === 'closed') {
    return ticket.knowledgeWriteback ? (
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          Knowledge Writeback ✓
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{ticket.knowledgeWriteback}</div>
      </div>
    ) : null;
  }

  return (
    <div style={{ padding: 16, marginTop: 'auto' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: isEscalated ? 'var(--warning)' : 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        Knowledge Writeback {isEscalated && '(Required)'}
      </div>
      <textarea
        value={writeback}
        onChange={e => { setWriteback(e.target.value); setConfirmed(false); }}
        placeholder="What did we learn from this case? AI suggestion pre-filled above..."
        rows={3}
        maxLength={5000}
        style={{
          width: '100%', padding: '8px 10px', fontSize: 12,
          border: `1px solid ${isEscalated && writebackEmpty ? 'var(--danger)' : confirmed ? 'var(--success)' : 'var(--panel-border)'}`,
          borderRadius: 'var(--border-radius-md)',
          background: 'var(--panel-bg)', color: 'var(--text-primary)', resize: 'vertical',
        }}
      />
      {isEscalated && writebackEmpty && (
        <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 4, fontWeight: 600 }}>
          ⚠ Knowledge writeback required to close escalated cases
        </div>
      )}
      {confirmed && (
        <div style={{ fontSize: 10, color: 'var(--success)', marginTop: 4, fontWeight: 600 }}>
          ✓ Saved to knowledge candidate pool
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          onClick={handleConfirmWriteback}
          disabled={writebackEmpty || confirming || confirmed}
          style={{
            padding: '4px 12px', fontSize: 11, fontWeight: 600,
            background: confirmed ? 'color-mix(in srgb, var(--success) 15%, transparent)' : 'color-mix(in srgb, var(--success) 15%, transparent)',
            color: 'var(--success)', border: '1px solid var(--success)',
            borderRadius: '999px',
            cursor: writebackEmpty || confirming || confirmed ? 'default' : 'pointer',
            opacity: writebackEmpty || confirmed ? 0.5 : 1,
          }}
        >
          {confirming ? '...' : confirmed ? '✓ Saved' : '✓ Confirm Writeback'}
        </button>
        <button
          onClick={handleClose}
          disabled={closeDisabled}
          style={{
            padding: '4px 12px', fontSize: 11, fontWeight: 600,
            background: closeDisabled ? 'var(--panel-bg)' : 'color-mix(in srgb, var(--danger) 15%, transparent)',
            color: closeDisabled ? 'var(--text-tertiary)' : 'var(--danger)',
            border: `1px solid ${closeDisabled ? 'var(--panel-border)' : 'var(--danger)'}`,
            borderRadius: '999px', cursor: closeDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {closing ? '...' : 'Close Case'}
        </button>
      </div>
    </div>
  );
}

// ─── Empty State ───

// ─── L1 Toast Feedback ───

interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error';
  expiresAt: number;
}

function ToastContainer({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          style={{
            padding: '10px 16px', maxWidth: 380, fontSize: 12, lineHeight: 1.5, fontWeight: 500,
            background: t.type === 'success' ? 'color-mix(in srgb, var(--success) 95%, var(--bg-color))' : 'color-mix(in srgb, var(--danger) 95%, var(--bg-color))',
            color: 'var(--bg-color)',
            borderRadius: 'var(--border-radius-lg)', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            animation: 'toast-slide-in 0.3s ease-out',
          }}
        >
          <span style={{ marginRight: 6 }}>{t.type === 'success' ? '✓' : '✗'}</span>
          {t.text}
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, type: 'success' | 'error') => {
    const id = crypto.randomUUID();
    const expiresAt = Date.now() + 4000;
    setToasts(prev => [...prev, { id, text, type, expiresAt }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setToasts(prev => prev.filter(t => t.expiresAt > now));
    }, 500);
    return () => clearInterval(timer);
  }, [toasts.length]);

  return { toasts, showToast, dismissToast };
}

// ─── Empty State ───

function EmptySelection() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>Select a ticket to view details</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>Choose from the list on the left</div>
      </div>
    </div>
  );
}

// ─── Main Page ───

export default function SupportOpsPage() {
  return (
    <RoleGuard allowedRoles={['tenant_admin', 'operator']}>
      <SupportOpsContent />
    </RoleGuard>
  );
}

const SAFE_CASE_ID = /^[a-zA-Z0-9_-]{1,64}$/;

function SupportOpsContent() {
  const { currentTenantId } = useTenant();
  const searchParams = useSearchParams();
  const { toasts, showToast, dismissToast } = useToast();

  const [tickets, setTickets] = useState<UnifiedTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<UnifiedTicket | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketFilters['status']>('all');
  const [channelFilter, setChannelFilter] = useState<ChannelCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const channels = getChannels();

  const loadTickets = useCallback(async () => {
    if (!currentTenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listUnifiedTickets(currentTenantId, {
        status: statusFilter,
        channels: channelFilter.length > 0 ? channelFilter : undefined,
      });
      setTickets(data);
    } catch (err) {
      console.error('Failed to load tickets:', err);
      setError('Failed to load tickets. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentTenantId, statusFilter, channelFilter]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  useEffect(() => {
    const caseParam = searchParams.get('case');
    if (caseParam && !selectedId && SAFE_CASE_ID.test(caseParam)) {
      setSelectedId(caseParam);
    }
  }, [searchParams, selectedId]);

  useEffect(() => {
    if (!selectedId || !currentTenantId) {
      setSelectedTicket(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const ticket = await getUnifiedTicket(currentTenantId, selectedId);
      if (!cancelled) setSelectedTicket(ticket);
    })();
    return () => { cancelled = true; };
  }, [selectedId, currentTenantId]);

  const counts = useMemo(() => computeTicketCounts(tickets), [tickets]);

  const handleSelectTicket = useCallback((id: string) => setSelectedId(id), []);
  const handleStatusFilter = useCallback((s: TicketFilters['status']) => setStatusFilter(s), []);
  const handleChannelFilter = useCallback((ch: ChannelCode[]) => setChannelFilter(ch), []);

  const loadTicketsRef = useRef(loadTickets);
  loadTicketsRef.current = loadTickets;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const handleTicketUpdated = useCallback(async () => {
    await loadTicketsRef.current();
    const id = selectedIdRef.current;
    if (id && currentTenantId) {
      const updated = await getUnifiedTicket(currentTenantId, id);
      setSelectedTicket(updated);
    }
  }, [currentTenantId]);

  useEffect(() => {
    if (!selectedId || !currentTenantId) return;
    const isPortalCase = selectedTicket?.channel === 'portal';
    if (!isPortalCase) return;

    let es: EventSource | null = null;
    try {
      es = new EventSource(supportCaseStreamUrl(selectedId, currentTenantId));
      es.addEventListener('message', () => {
        handleTicketUpdated();
      });
      es.addEventListener('escalation', () => {
        handleTicketUpdated();
      });
      es.onerror = () => {
        es?.close();
      };
    } catch {
      // SSE not available — silent fallback
    }
    return () => { es?.close(); };
  }, [selectedId, currentTenantId, selectedTicket?.channel, handleTicketUpdated]);

  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h1 className="ios-title" style={{ marginBottom: 4 }}>Support Ops</h1>
            <p className="ios-subtitle">Unified inbox — all channel messages in one place</p>
          </div>
          <NexusSubNav />
        </div>
        <PlatformStatusBar channels={channels} />
      </div>

      {/* Error state */}
      {error && (
        <div style={{ margin: '0 20px 12px', padding: '10px 16px', background: 'color-mix(in srgb, var(--danger) 10%, transparent)', border: '1px solid var(--danger)', borderRadius: 'var(--border-radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>
          <button onClick={loadTickets} style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', background: 'transparent', border: '1px solid var(--danger)', borderRadius: '999px', padding: '3px 10px', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {/* Three-column layout */}
      <div style={{
        flex: 1, display: 'flex', minHeight: 0,
        background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
        borderRadius: 'var(--border-radius-lg)', margin: '0 20px 20px',
        boxShadow: 'var(--panel-shadow)', overflow: 'hidden',
      }}>
        {/* Left: Ticket list */}
        {loading ? (
          <div style={{ width: 260, flexShrink: 0, padding: 16, borderRight: '1px solid var(--panel-border)' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: 64, background: 'color-mix(in srgb, var(--text-tertiary) 8%, transparent)', borderRadius: 'var(--border-radius-md)', marginBottom: 8 }} />
            ))}
          </div>
        ) : (
          <TicketListPanel
            tickets={tickets}
            selectedId={selectedId}
            channels={channels}
            counts={counts}
            statusFilter={statusFilter}
            channelFilter={channelFilter}
            onSelectTicket={handleSelectTicket}
            onStatusFilter={handleStatusFilter}
            onChannelFilter={handleChannelFilter}
          />
        )}

        {/* Center + Right: Conversation + Agent Panel */}
        {selectedTicket && currentTenantId ? (
          <>
            <ConversationView
              ticket={selectedTicket}
              tenantId={currentTenantId}
              channels={channels}
              onTicketUpdated={handleTicketUpdated}
            />
            <AgentPanel
              ticket={selectedTicket}
              tenantId={currentTenantId}
              channels={channels}
              onTicketUpdated={handleTicketUpdated}
              onToast={showToast}
            />
          </>
        ) : (
          <EmptySelection />
        )}
      </div>

      {/* L1 Toast feedback */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
