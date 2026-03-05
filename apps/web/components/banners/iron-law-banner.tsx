'use client';

import { useAuth } from '../auth-context';
import { IRON_LAW_MESSAGES } from '../../lib/constants/reject-reasons';

interface IronLawBannerProps {
  message?: string;
}

export function IronLawBanner({ message }: IronLawBannerProps) {
  const { user } = useAuth();
  const text = message ?? (user ? IRON_LAW_MESSAGES[user.role] : null);

  if (!text) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: 'color-mix(in srgb, var(--warning, #FBBF24) 15%, transparent)',
        borderLeft: '3px solid var(--warning, #FBBF24)',
        padding: '8px 16px',
        fontSize: '13px',
        color: 'var(--text-primary)',
        lineHeight: 1.5,
        marginBottom: '16px',
      }}
    >
      {text}
    </div>
  );
}
