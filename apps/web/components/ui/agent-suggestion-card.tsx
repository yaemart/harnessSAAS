'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare, Bookmark } from 'lucide-react';
import { ConfidenceBadge } from './confidence-badge';
import { InteractionTag } from './interaction-tag';
import { REJECTION_REASONS } from '../../lib/constants/reject-reasons';

export type SuggestionPriority = 'CRITICAL' | 'WARNING' | 'INFO';

const PRIORITY_STYLES: Record<SuggestionPriority, { border: string; label: string }> = {
  CRITICAL: { border: 'var(--danger, #F87171)', label: 'CRITICAL' },
  WARNING: { border: 'var(--warning, #FBBF24)', label: 'WARNING' },
  INFO: { border: 'var(--accent, #4F8EF7)', label: 'INFO' },
};

export interface AgentSuggestion {
  id: string;
  agentName: string;
  priority: SuggestionPriority;
  summary: string;
  product?: string;
  confidence: number;
  sampleSize?: number;
  dataAge?: string;
  reasoning?: string;
  risks?: string[];
  uncertainties?: string[];
  harnessLayer: string;
  timestamp: string;
}

interface AgentSuggestionCardProps {
  suggestion: AgentSuggestion;
  onExecute?: (id: string) => void;
  onModify?: (id: string) => void;
  onReject?: (id: string, reason: string, note?: string) => void;
  onDefer?: (id: string) => void;
  onAskAgent?: (id: string) => void;
  onMarkLearning?: (id: string) => void;
}

export function AgentSuggestionCard({
  suggestion,
  onExecute,
  onModify,
  onReject,
  onDefer,
  onAskAgent,
  onMarkLearning,
}: AgentSuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [customNote, setCustomNote] = useState('');

  const priority = PRIORITY_STYLES[suggestion.priority];

  const handleRejectConfirm = () => {
    if (!selectedReason) return;
    onReject?.(suggestion.id, selectedReason, selectedReason === 'OTHER' ? customNote : undefined);
    setShowReject(false);
    setSelectedReason('');
    setCustomNote('');
  };

  return (
    <div style={{
      borderLeft: `3px solid ${priority.border}`,
      borderRadius: 'var(--border-radius-md)',
      background: 'var(--bg-card, var(--panel-bg))',
      border: '1px solid var(--border-color)',
      borderLeftWidth: 3,
      borderLeftColor: priority.border,
      padding: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <InteractionTag type={suggestion.priority === 'CRITICAL' ? 'REQUIRED' : 'CONFIRM'} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{suggestion.agentName}</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{suggestion.timestamp}</span>
        </div>
        <ConfidenceBadge value={suggestion.confidence} sampleSize={suggestion.sampleSize} dataAge={suggestion.dataAge} />
      </div>

      {/* Product tag */}
      {suggestion.product && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{suggestion.product}</div>
      )}

      {/* Summary */}
      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: '4px 0 12px', lineHeight: 1.5 }}>
        {suggestion.summary}
      </p>

      {/* Expandable reasoning */}
      {suggestion.reasoning && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
            marginBottom: 8,
          }}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Hide reasoning' : 'View reasoning chain'}
        </button>
      )}

      {expanded && suggestion.reasoning && (
        <div style={{
          padding: 12,
          background: 'color-mix(in srgb, var(--accent) 5%, transparent)',
          borderRadius: 'var(--border-radius-sm)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          marginBottom: 12,
        }}>
          {suggestion.reasoning}
          {suggestion.risks && suggestion.risks.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <span style={{ fontWeight: 600, color: 'var(--warning)' }}>Known risks: </span>
              {suggestion.risks.join(' · ')}
            </div>
          )}
          {suggestion.uncertainties && suggestion.uncertainties.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>Uncertainties: </span>
              {suggestion.uncertainties.join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {onExecute && (
          <button
            onClick={() => onExecute(suggestion.id)}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              background: 'var(--success)',
              color: '#fff',
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Execute
          </button>
        )}
        {onModify && (
          <button
            onClick={() => onModify(suggestion.id)}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
              color: 'var(--accent)',
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Modify
          </button>
        )}
        {onReject && (
          <button
            onClick={() => setShowReject(!showReject)}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              background: 'color-mix(in srgb, var(--danger) 15%, transparent)',
              color: 'var(--danger)',
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reject
          </button>
        )}
        {onDefer && (
          <button
            onClick={() => onDefer(suggestion.id)}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              background: 'color-mix(in srgb, var(--text-secondary) 10%, transparent)',
              color: 'var(--text-secondary)',
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Defer
          </button>
        )}

        <div style={{ flex: 1 }} />

        {onAskAgent && (
          <button
            onClick={() => onAskAgent(suggestion.id)}
            title="Ask Agent"
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
          >
            <MessageSquare size={16} />
          </button>
        )}
        {onMarkLearning && (
          <button
            onClick={() => onMarkLearning(suggestion.id)}
            title="Mark as Worth Learning"
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
          >
            <Bookmark size={16} />
          </button>
        )}
      </div>

      {/* Reject reason panel */}
      {showReject && (
        <div style={{
          marginTop: 12,
          padding: 16,
          background: 'color-mix(in srgb, var(--danger) 5%, transparent)',
          borderRadius: 'var(--border-radius-md)',
          border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)',
        }}>
          <div style={{
            background: 'color-mix(in srgb, var(--warning) 15%, transparent)',
            borderLeft: '3px solid var(--warning)',
            padding: '8px 12px',
            fontSize: 12,
            color: 'var(--text-primary)',
            marginBottom: 12,
            lineHeight: 1.5,
          }}>
            Reject requires reason selection — feeds Layer 7 evolution
          </div>

          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            Help the Agent learn
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Your judgment trains the system
          </div>

          {REJECTION_REASONS.map((reason) => (
            <label
              key={reason.value}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: '6px 8px',
                cursor: 'pointer',
                borderRadius: 'var(--border-radius-sm)',
                background: selectedReason === reason.value ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name={`reject-${suggestion.id}`}
                  checked={selectedReason === reason.value}
                  onChange={() => setSelectedReason(reason.value)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span style={{ fontWeight: 500 }}>{reason.label}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 24 }}>{reason.hint}</span>
            </label>
          ))}

          {selectedReason === 'OTHER' && (
            <input
              type="text"
              placeholder="请补充具体原因..."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                marginTop: 8,
                borderRadius: 'var(--border-radius-sm)',
                border: '1px solid var(--border-color)',
                background: 'var(--panel-bg)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={handleRejectConfirm}
              disabled={!selectedReason || (selectedReason === 'OTHER' && !customNote)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '999px',
                background: selectedReason && (selectedReason !== 'OTHER' || customNote) ? 'var(--danger)' : 'color-mix(in srgb, var(--text-tertiary) 20%, transparent)',
                color: selectedReason && (selectedReason !== 'OTHER' || customNote) ? '#fff' : 'var(--text-tertiary)',
                border: 'none',
                cursor: selectedReason ? 'pointer' : 'default',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Confirm Reject
            </button>
            <button
              onClick={() => { setShowReject(false); setSelectedReason(''); setCustomNote(''); }}
              style={{
                padding: '8px 12px',
                borderRadius: '999px',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Harness layer tag */}
      <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'right' }}>
        {suggestion.harnessLayer}
      </div>
    </div>
  );
}
