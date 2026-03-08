'use client';

import { useState, useMemo } from 'react';
import { tokens, tintedBg } from '../../lib/design-tokens';
import { ToggleSwitch, SmallButton, NodeChip } from './shared';

const REGION_META: Record<string, { label: string; flag: string; color: string }> = {
    us: { label: 'USA', flag: '\u{1F1FA}\u{1F1F8}', color: '#3B82F6' },
    eu: { label: 'Europe', flag: '\u{1F1EA}\u{1F1FA}', color: '#10B981' },
    uk: { label: 'UK', flag: '\u{1F1EC}\u{1F1E7}', color: '#8B5CF6' },
    jp: { label: 'Japan', flag: '\u{1F1EF}\u{1F1F5}', color: '#EF4444' },
    ca: { label: 'Canada', flag: '\u{1F1E8}\u{1F1E6}', color: '#F59E0B' },
};

interface Warehouse {
    id: string; code: string; name: string; type: string; region: string;
    nodes: string[]; description: string; enabled: boolean;
}

export function WarehousesPanel({
    warehouses, onToggle, togglingId,
}: {
    warehouses: Warehouse[];
    onToggle: (id: string) => void;
    togglingId: string | null;
}) {
    const [region, setRegion] = useState('us');

    const grouped = useMemo(() => {
        const map: Record<string, Warehouse[]> = {};
        for (const w of warehouses) {
            (map[w.region] ??= []).push(w);
        }
        return map;
    }, [warehouses]);

    const whs = grouped[region] ?? [];
    const enabledCount = whs.filter(w => w.enabled).length;

    return (
        <div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {Object.entries(REGION_META).map(([r, m]) => {
                    const total = (grouped[r] ?? []).length;
                    const active = (grouped[r] ?? []).filter(w => w.enabled).length;
                    const isSel = region === r;
                    return (
                        <div key={r} onClick={() => setRegion(r)} style={{
                            display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 8,
                            cursor: 'pointer',
                            background: isSel ? tintedBg(m.color, 12) : tokens.color.panelBg,
                            border: `1px solid ${isSel ? tintedBg(m.color, 40) : tokens.color.panelBorder}`,
                            color: isSel ? tokens.color.textPrimary : tokens.color.textSecondary,
                            fontSize: 12, fontWeight: isSel ? 600 : 400,
                        }}>
                            {m.flag} {m.label}
                            <span style={{ fontFamily: 'monospace', fontSize: 10, color: isSel ? m.color : tokens.color.textTertiary }}>
                                {active}/{total}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
            }}>
                <div style={{ color: tokens.color.textSecondary, fontSize: 12 }}>
                    {REGION_META[region]?.flag} {REGION_META[region]?.label}
                    {' \u00B7 '}Enabled <span style={{ color: tokens.color.accent, fontWeight: 600 }}>{enabledCount}</span> / {whs.length}
                    <span style={{ marginLeft: 10, color: tokens.color.textTertiary, fontSize: 11 }}>
                        FBA prioritizes Amazon; 3PL can be used cross-platform
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <SmallButton label="Select All" accent onClick={() => {}} />
                    <SmallButton label="Clear" onClick={() => {}} />
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {whs.map(w => (
                    <div key={w.id} style={{
                        background: tokens.color.panelBg,
                        border: `1px solid ${w.enabled ? tintedBg(tokens.color.accent, 28) : tokens.color.panelBorder}`,
                        borderRadius: tokens.radius.md, padding: '13px 16px',
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                    }}>
                        <div style={{
                            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                            background: w.type === 'FBA' ? tintedBg('#FF9900', 12) : tintedBg(tokens.color.accent, 10),
                            border: `1px solid ${w.type === 'FBA' ? tintedBg('#FF9900', 25) : tintedBg(tokens.color.accent, 20)}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                        }}>
                            {w.type === 'FBA' ? '\u{1F4E6}' : '\u{1F3ED}'}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                                <span style={{ color: tokens.color.textPrimary, fontWeight: 600, fontSize: 13 }}>{w.name}</span>
                                <span style={{
                                    fontSize: 10, padding: '1px 7px', borderRadius: 5,
                                    background: w.type === 'FBA' ? tintedBg('#FF9900', 12) : tintedBg(tokens.color.accent, 10),
                                    color: w.type === 'FBA' ? '#FF9900' : tokens.color.accent,
                                    border: `1px solid ${w.type === 'FBA' ? tintedBg('#FF9900', 25) : tintedBg(tokens.color.accent, 20)}`,
                                }}>{w.type}</span>
                            </div>
                            <div style={{ color: tokens.color.textSecondary, fontSize: 11, marginBottom: 6 }}>{w.description}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {w.nodes.map(n => <NodeChip key={n} label={`\u{1F4CD}${n}`} />)}
                            </div>
                        </div>
                        <ToggleSwitch on={w.enabled} loading={togglingId === w.id} onChange={() => onToggle(w.id)} sm />
                    </div>
                ))}
            </div>
        </div>
    );
}
