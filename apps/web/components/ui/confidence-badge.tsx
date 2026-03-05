'use client';

interface ConfidenceBadgeProps {
  value: number;
  sampleSize?: number;
  dataAge?: string;
}

function getConfidenceColor(value: number): string {
  if (value >= 0.85) return 'var(--success, #34D399)';
  if (value >= 0.60) return 'var(--warning, #FBBF24)';
  return 'var(--danger, #F87171)';
}

export function ConfidenceBadge({ value, sampleSize, dataAge }: ConfidenceBadgeProps) {
  const color = getConfidenceColor(value);
  const pct = Math.round(value * 100);

  return (
    <span
      title={[
        `Confidence: ${pct}%`,
        sampleSize != null ? `Based on ${sampleSize} cases` : null,
        dataAge ? `Data age: ${dataAge}` : null,
      ].filter(Boolean).join(' · ')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: '999px',
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        color,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.6,
        cursor: sampleSize != null || dataAge ? 'help' : 'default',
      }}
    >
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }} />
      {pct}%
    </span>
  );
}
