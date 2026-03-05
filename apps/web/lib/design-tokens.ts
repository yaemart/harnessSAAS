/**
 * Design tokens as TypeScript constants.
 * Use these when building inline styles to ensure consistency.
 *
 * For colors, borders, shadows — ALWAYS use CSS variable references
 * (e.g. `color: tokens.color.textPrimary`) so themes work correctly.
 */

export const tokens = {
  color: {
    bgColor: 'var(--bg-color)',
    bgPrimary: 'var(--bg-primary)',
    bgSecondary: 'var(--bg-secondary)',
    sidebarBg: 'var(--sidebar-bg)',
    panelBg: 'var(--panel-bg)',
    panelBgSecondary: 'var(--panel-bg-secondary)',
    cardBg: 'var(--card-bg)',

    textPrimary: 'var(--text-primary)',
    textSecondary: 'var(--text-secondary)',
    textTertiary: 'var(--text-tertiary)',

    accent: 'var(--accent)',
    accentHover: 'var(--accent-hover)',
    primary: 'var(--primary)',
    success: 'var(--success)',
    danger: 'var(--danger)',
    warning: 'var(--warning)',

    border: 'var(--border)',
    borderColor: 'var(--border-color)',
    panelBorder: 'var(--panel-border)',
    sidebarBorder: 'var(--sidebar-border)',
  },

  radius: {
    lg: 'var(--border-radius-lg)',
    md: 'var(--border-radius-md)',
    sm: 'var(--border-radius-sm)',
    pill: '999px',
  },

  shadow: {
    panel: 'var(--panel-shadow)',
  },

  blur: {
    glass: 'var(--glass-blur)',
  },

  font: {
    size: {
      xs: 11,
      sm: 13,
      base: 15,
      title: 20,
      stat: 24,
    } as const,
    weight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    } as const,
  },

  spacing: {
    mainPadding: '32px 40px',
    sidebarPadding: '20px 12px',
    cardPadding: 24,
    cardPaddingCompact: 16,
    tableHeaderCell: '12px 16px',
    tableBodyCell: '8px 16px',
    buttonPadding: '10px 18px',
    inputPadding: '10px 12px',
    sectionGap: 24,
    inlineGap: 8,
    inlineGapLg: 12,
    statBadgePadding: 16,
  },

  layout: {
    sidebarWidth: 260,
  },
} as const;

/**
 * Generate a tinted background using color-mix.
 * Use this instead of hardcoded rgba() for theme compatibility.
 */
export function tintedBg(
  tokenVar: string,
  percent: number = 15,
): string {
  return `color-mix(in srgb, ${tokenVar} ${percent}%, transparent)`;
}
