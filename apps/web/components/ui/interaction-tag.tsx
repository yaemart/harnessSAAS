'use client';

type TagType = 'AUTO' | 'CONFIRM' | 'REQUIRED' | 'BLOCK' | '2FA';

const TAG_STYLES: Record<TagType, { bg: string; color: string; label: string }> = {
  AUTO: { bg: 'color-mix(in srgb, var(--success, #34D399) 15%, transparent)', color: 'var(--success, #34D399)', label: 'AUTO' },
  CONFIRM: { bg: 'color-mix(in srgb, var(--warning, #FBBF24) 15%, transparent)', color: 'var(--warning, #FBBF24)', label: 'CONFIRM' },
  REQUIRED: { bg: 'color-mix(in srgb, var(--danger, #F87171) 15%, transparent)', color: 'var(--danger, #F87171)', label: 'REQUIRED' },
  BLOCK: { bg: 'color-mix(in srgb, var(--danger, #F87171) 15%, transparent)', color: 'var(--danger, #F87171)', label: 'BLOCK' },
  '2FA': { bg: 'color-mix(in srgb, var(--danger, #F87171) 15%, transparent)', color: 'var(--danger, #F87171)', label: '2FA REQUIRED' },
};

interface InteractionTagProps {
  type: TagType;
  className?: string;
}

export function InteractionTag({ type, className }: InteractionTagProps) {
  const style = TAG_STYLES[type];
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '999px',
        background: style.bg,
        color: style.color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        lineHeight: 1.6,
      }}
    >
      {style.label}
    </span>
  );
}
