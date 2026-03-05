import React from 'react';
import { tokens, tintedBg } from '../../lib/design-tokens';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const VARIANT_MAP: Record<BadgeVariant, { bg: string; color: string }> = {
  default: {
    bg: tintedBg(tokens.color.textSecondary),
    color: tokens.color.textPrimary,
  },
  success: {
    bg: tintedBg(tokens.color.success),
    color: tokens.color.success,
  },
  danger: {
    bg: tintedBg(tokens.color.danger),
    color: tokens.color.danger,
  },
  warning: {
    bg: tintedBg(tokens.color.warning),
    color: tokens.color.warning,
  },
  info: {
    bg: tintedBg(tokens.color.accent),
    color: tokens.color.accent,
  },
};

export function Badge({
  children,
  variant = 'default',
  style = {},
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  style?: React.CSSProperties;
}) {
  const v = VARIANT_MAP[variant];

  return (
    <span
      style={{
        fontSize: tokens.font.size.xs,
        padding: '4px 8px',
        borderRadius: tokens.radius.sm,
        backgroundColor: v.bg,
        color: v.color,
        fontWeight: tokens.font.weight.semibold,
        display: 'inline-block',
        border: `1px solid ${tintedBg(v.color, 30)}`,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
