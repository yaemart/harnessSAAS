'use client';

import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

type DataStateType = 'loading' | 'empty' | 'error';

interface DataStateProps {
  type: DataStateType;
  message?: string;
  onRetry?: () => void;
}

const DEFAULTS: Record<DataStateType, { icon: React.ReactNode; message: string }> = {
  loading: { icon: <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />, message: 'Loading...' },
  empty: { icon: <Inbox size={32} />, message: 'No data available' },
  error: { icon: <AlertTriangle size={32} />, message: 'Something went wrong' },
};

export function DataState({ type, message, onRetry }: DataStateProps) {
  const defaults = DEFAULTS[type];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      gap: 12,
      color: 'var(--text-tertiary)',
    }}>
      {defaults.icon}
      <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{message ?? defaults.message}</p>
      {onRetry && type === 'error' && (
        <button
          onClick={onRetry}
          style={{
            padding: '6px 16px',
            borderRadius: '999px',
            background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
            color: 'var(--accent)',
            border: 'none',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
