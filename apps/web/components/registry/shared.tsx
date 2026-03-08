'use client';

import { tokens, tintedBg } from '../../lib/design-tokens';

export function ToggleSwitch({ on, loading, onChange, sm }: { on: boolean; loading?: boolean; onChange: () => void; sm?: boolean }) {
    const w = sm ? 34 : 40;
    const h = sm ? 18 : 22;
    const d = sm ? 12 : 16;
    return (
        <div
            onClick={(e) => { e.stopPropagation(); if (!loading) onChange(); }}
            style={{
                width: w, height: h, borderRadius: h / 2, cursor: loading ? 'wait' : 'pointer',
                background: on ? tokens.color.accent : tokens.color.panelBorder,
                position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                opacity: loading ? 0.5 : 1,
            }}
        >
            <div style={{
                position: 'absolute', top: (h - d) / 2, left: on ? w - d - 3 : 3,
                width: d, height: d, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }} />
        </div>
    );
}

export function Badge({ text, color }: { text: string; color?: string }) {
    const c = color ?? '#fbbf24';
    return (
        <span style={{
            fontSize: tokens.font.size.xs, padding: '1px 7px', borderRadius: 5,
            background: tintedBg(c, 10), color: c, border: `1px solid ${tintedBg(c, 20)}`,
            fontWeight: tokens.font.weight.semibold, whiteSpace: 'nowrap',
        }}>{text}</span>
    );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            color: tokens.color.textSecondary, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.07em', textTransform: 'uppercase' as const, marginBottom: 9,
        }}>{children}</div>
    );
}

export function ActionBar({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
    return (
        <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
        }}>
            <div style={{ color: tokens.color.textSecondary, fontSize: 12 }}>{left}</div>
            {right && <div style={{ display: 'flex', gap: 6 }}>{right}</div>}
        </div>
    );
}

export function SmallButton({ label, accent, onClick }: { label: string; accent?: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick} style={{
            background: accent ? tintedBg(tokens.color.accent, 10) : tokens.color.panelBg,
            border: `1px solid ${accent ? tintedBg(tokens.color.accent, 25) : tokens.color.panelBorder}`,
            color: accent ? tokens.color.accent : tokens.color.textSecondary,
            padding: '4px 11px', borderRadius: tokens.radius.sm, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
        }}>{label}</button>
    );
}

export function NodeChip({ label }: { label: string }) {
    return (
        <span style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 5,
            background: tokens.color.panelBgSecondary, color: tokens.color.textSecondary,
            border: `1px solid ${tokens.color.panelBorder}`,
        }}>{label}</span>
    );
}
