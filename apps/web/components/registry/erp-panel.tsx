'use client';

import { tokens, tintedBg } from '../../lib/design-tokens';
import { ToggleSwitch } from './shared';

interface ErpSystem {
    id: string; code: string; name: string; vendor: string;
    icon: string; description: string; enabled: boolean;
}

export function ErpPanel({
    items, onToggle, togglingId,
}: {
    items: ErpSystem[];
    onToggle: (id: string) => void;
    togglingId: string | null;
}) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 11 }}>
            {items.map(e => (
                <div key={e.id} style={{
                    background: tokens.color.panelBg,
                    border: `1px solid ${e.enabled ? tintedBg(tokens.color.accent, 28) : tokens.color.panelBorder}`,
                    borderRadius: tokens.radius.md, padding: '17px 19px',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 24 }}>{e.icon}</span>
                        <ToggleSwitch on={e.enabled} loading={togglingId === e.id} onChange={() => onToggle(e.id)} sm />
                    </div>
                    <div style={{ marginTop: 11 }}>
                        <div style={{ color: tokens.color.textPrimary, fontWeight: 600, fontSize: 14 }}>{e.name}</div>
                        <div style={{ color: tokens.color.accent, fontSize: 11, marginTop: 2 }}>{e.vendor}</div>
                        <div style={{ color: tokens.color.textSecondary, fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>{e.description}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}
