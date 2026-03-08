'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { tokens, tintedBg } from '../../lib/design-tokens';
import { ToggleSwitch, Badge, SmallButton } from './shared';

interface Market { code: string; name: string; flag: string }
interface Platform {
    id: string; code: string; name: string; icon: string; color: string;
    description: string; badge: string | null; badgeColor: string | null;
    enabled: boolean;
    supportedMarketCodes: string[];
    enabledMarketCodes: string[];
}

export function PlatformsPanel({
    platforms, markets, onToggle, onUpdateMarkets, togglingId,
}: {
    platforms: Platform[];
    markets: Market[];
    onToggle: (id: string) => void;
    onUpdateMarkets: (platformId: string, marketCodes: string[]) => void;
    togglingId: string | null;
}) {
    const [expanded, setExpanded] = useState<string | null>(platforms.find(p => p.enabled)?.id ?? null);
    const [localEnabled, setLocalEnabled] = useState<Record<string, Set<string>>>({});
    const prevKey = useRef('');

    useEffect(() => {
        const key = platforms.map(p => `${p.id}:${p.enabledMarketCodes.join(',')}`).join('|');
        if (key !== prevKey.current) {
            prevKey.current = key;
            const next: Record<string, Set<string>> = {};
            platforms.forEach(p => { next[p.id] = new Set(p.enabledMarketCodes); });
            setLocalEnabled(next);
        }
    }, [platforms]);

    const mkMap = Object.fromEntries(markets.map(m => [m.code, m]));

    const getEnabledSet = (platformId: string): Set<string> => {
        return localEnabled[platformId] ?? new Set(platforms.find(p => p.id === platformId)?.enabledMarketCodes ?? []);
    };

    const toggleMarket = useCallback((platformId: string, marketCode: string) => {
        let codes: string[] = [];
        setLocalEnabled(prev => {
            const current = new Set(prev[platformId] ?? []);
            if (current.has(marketCode)) current.delete(marketCode);
            else current.add(marketCode);
            codes = Array.from(current);
            return { ...prev, [platformId]: current };
        });
        queueMicrotask(() => onUpdateMarkets(platformId, codes));
    }, [onUpdateMarkets]);

    const selectAll = useCallback((platformId: string) => {
        const platform = platforms.find(p => p.id === platformId);
        const allCodes = platform?.supportedMarketCodes ?? [];
        setLocalEnabled(prev => ({ ...prev, [platformId]: new Set(allCodes) }));
        queueMicrotask(() => onUpdateMarkets(platformId, allCodes));
    }, [platforms, onUpdateMarkets]);

    const clearAll = useCallback((platformId: string) => {
        setLocalEnabled(prev => ({ ...prev, [platformId]: new Set() }));
        queueMicrotask(() => onUpdateMarkets(platformId, []));
    }, [onUpdateMarkets]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {platforms.map(p => {
                const isExp = expanded === p.id && p.enabled;
                const enabled = getEnabledSet(p.id);
                return (
                    <div key={p.id} style={{
                        background: tokens.color.panelBg,
                        border: `1px solid ${p.enabled ? tintedBg(p.color, 28) : tokens.color.panelBorder}`,
                        borderRadius: tokens.radius.md, overflow: 'hidden',
                    }}>
                        <div
                            onClick={() => p.enabled && setExpanded(isExp ? null : p.id)}
                            style={{
                                padding: '13px 17px', display: 'flex', alignItems: 'center', gap: 13,
                                cursor: p.enabled ? 'pointer' : 'default',
                            }}
                        >
                            <div style={{
                                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                                background: tintedBg(p.color, 12), border: `1px solid ${tintedBg(p.color, 25)}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                            }}>{p.icon}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                    <span style={{ color: tokens.color.textPrimary, fontWeight: tokens.font.weight.bold, fontSize: 14 }}>{p.name}</span>
                                    {p.badge && <Badge text={p.badge} color={p.badgeColor ?? '#fbbf24'} />}
                                </div>
                                <div style={{ color: tokens.color.textTertiary, fontSize: 11, marginTop: 2 }}>{p.description}</div>
                            </div>
                            {p.enabled && (
                                <span style={{
                                    fontSize: 11, padding: '2px 8px', borderRadius: 7,
                                    background: tintedBg(tokens.color.accent, 13), color: tokens.color.accent,
                                    fontFamily: 'monospace', marginRight: 6,
                                }}>{enabled.size}/{p.supportedMarketCodes.length} Markets</span>
                            )}
                            <ToggleSwitch on={p.enabled} loading={togglingId === p.id} onChange={() => onToggle(p.id)} sm />
                            {p.enabled && (
                                <span style={{ color: tokens.color.textTertiary, fontSize: 10 }}>{isExp ? '\u25B2' : '\u25BC'}</span>
                            )}
                        </div>
                        {isExp && (
                            <div style={{ borderTop: `1px solid ${tokens.color.panelBorder}`, padding: '12px 17px 16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <span style={{ color: tokens.color.textSecondary, fontSize: 12 }}>
                                        Select enabled markets ({enabled.size}/{p.supportedMarketCodes.length})
                                    </span>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <SmallButton label="Select All" accent onClick={() => selectAll(p.id)} />
                                        <SmallButton label="Clear" onClick={() => clearAll(p.id)} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {p.supportedMarketCodes.map(mc => {
                                        const m = mkMap[mc];
                                        if (!m) return null;
                                        const isEnabled = enabled.has(mc);
                                        return (
                                            <div
                                                key={mc}
                                                onClick={(e) => { e.stopPropagation(); toggleMarket(p.id, mc); }}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                    padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                                                    userSelect: 'none', transition: 'all 0.15s',
                                                    background: isEnabled ? tintedBg(tokens.color.accent, 18) : tokens.color.panelBgSecondary,
                                                    border: `1px solid ${isEnabled ? tintedBg(tokens.color.accent, 45) : tokens.color.panelBorder}`,
                                                    color: isEnabled ? tokens.color.accent : tokens.color.textTertiary,
                                                    fontSize: 12, fontWeight: isEnabled ? 600 : 400,
                                                    opacity: isEnabled ? 1 : 0.5,
                                                }}
                                            >
                                                <span style={{ fontSize: 13 }}>{m.flag}</span>
                                                {m.name}
                                                <span style={{
                                                    fontSize: 10, fontFamily: 'monospace',
                                                    color: isEnabled ? tokens.color.accent : tokens.color.textTertiary,
                                                }}>{mc.toUpperCase()}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
