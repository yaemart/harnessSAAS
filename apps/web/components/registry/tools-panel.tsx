'use client';

import { useMemo } from 'react';
import { tokens, tintedBg } from '../../lib/design-tokens';
import { ToggleSwitch, SectionTitle } from './shared';

interface Tool {
    id: string; code: string; name: string; category: string;
    icon: string; description: string; enabled: boolean;
}

export function ToolsPanel({
    items, onToggle, togglingId,
}: {
    items: Tool[];
    onToggle: (id: string) => void;
    togglingId: string | null;
}) {
    const grouped = useMemo(() => {
        const cats = [...new Set(items.map(t => t.category))];
        return cats.map(cat => ({ cat, tools: items.filter(t => t.category === cat) }));
    }, [items]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {grouped.map(g => (
                <div key={g.cat}>
                    <SectionTitle>{g.cat}</SectionTitle>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(255px,1fr))', gap: 8 }}>
                        {g.tools.map(t => (
                            <div key={t.id} style={{
                                background: tokens.color.panelBg,
                                border: `1px solid ${t.enabled ? tintedBg(tokens.color.accent, 28) : tokens.color.panelBorder}`,
                                borderRadius: tokens.radius.md, padding: '12px 14px',
                                display: 'flex', alignItems: 'center', gap: 10,
                            }}>
                                <span style={{ fontSize: 19 }}>{t.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ color: tokens.color.textPrimary, fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                                    <div style={{ color: tokens.color.textSecondary, fontSize: 11, marginTop: 2 }}>{t.description}</div>
                                </div>
                                <ToggleSwitch on={t.enabled} loading={togglingId === t.id} onChange={() => onToggle(t.id)} sm />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
