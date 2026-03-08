'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './auth-context';
import { tokens, tintedBg } from '../lib/design-tokens';
import { PlatformsPanel } from './registry/platforms-panel';
import CategoryOntology from './registry/category-ontology';
import { WarehousesPanel } from './registry/warehouses-panel';
import { ErpPanel } from './registry/erp-panel';
import { ToolsPanel } from './registry/tools-panel';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

type TabKey = 'platforms' | 'categories' | 'warehouses' | 'erp-systems' | 'tools';

const TABS: { key: TabKey; label: string; desc: string }[] = [
    { key: 'platforms', label: 'Platforms & Markets', desc: 'E-commerce platforms and market associations' },
    { key: 'categories', label: 'Category Ontology', desc: 'Product taxonomy, platform mappings & AI tools' },
    { key: 'warehouses', label: 'Warehouses', desc: 'FBA & 3PL warehouse network' },
    { key: 'erp-systems', label: 'ERP Integrations', desc: 'Supported ERP systems' },
    { key: 'tools', label: 'Third-party Tools', desc: 'Analytics & operations tools' },
];

function ImpactWarningModal({
    name, tenantCount, onConfirm, onCancel,
}: {
    name: string; tenantCount: number; onConfirm: () => void; onCancel: () => void;
}) {
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, backdropFilter: 'blur(4px)',
        }}>
            <div style={{
                background: tokens.color.panelBg, padding: 32, borderRadius: tokens.radius.lg,
                width: '100%', maxWidth: 480, border: `1px solid ${tokens.color.panelBorder}`,
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}>
                <h3 style={{ margin: 0, fontSize: tokens.font.size.title, color: tokens.color.warning, fontWeight: tokens.font.weight.bold }}>
                    Impact Warning
                </h3>
                <p style={{ fontSize: tokens.font.size.base, color: tokens.color.textSecondary, lineHeight: 1.6, margin: '16px 0 24px' }}>
                    Disabling <strong style={{ color: tokens.color.textPrimary }}>{name}</strong> will
                    affect <strong style={{ color: tokens.color.danger }}>{tenantCount}</strong> active tenant(s).
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button onClick={onCancel} style={{
                        padding: tokens.spacing.buttonPadding, borderRadius: tokens.radius.md,
                        border: `1px solid ${tokens.color.panelBorder}`, background: 'transparent',
                        color: tokens.color.textPrimary, fontWeight: tokens.font.weight.semibold, cursor: 'pointer',
                    }}>Cancel</button>
                    <button onClick={onConfirm} style={{
                        padding: tokens.spacing.buttonPadding, borderRadius: tokens.radius.md,
                        border: 'none', background: tokens.color.danger, color: '#fff',
                        fontWeight: tokens.font.weight.semibold, cursor: 'pointer',
                    }}>Confirm Disable</button>
                </div>
            </div>
        </div>
    );
}

export function SystemRegistry() {
    const { authHeaders } = useAuth();
    const [tab, setTab] = useState<TabKey>('platforms');
    const [data, setData] = useState<Record<string, unknown[]>>({});
    const [markets, setMarkets] = useState<{ code: string; name: string; flag: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [warningState, setWarningState] = useState<{ id: string; name: string; tenantCount: number; tab: TabKey } | null>(null);
    const [dirty, setDirty] = useState(false);
    const pendingMarketChanges = useRef<Record<string, string[]>>({});

    const loadData = useCallback(async (t: TabKey) => {
        setLoading(true);
        try {
            const endpoint = t === 'categories'
                ? `${API}/system/${t}?includeChildren=true`
                : `${API}/system/${t}`;
            const res = await fetch(endpoint, { headers: { ...authHeaders } });
            if (res.ok) {
                const d = await res.json();
                setData(prev => ({ ...prev, [t]: d.items ?? [] }));
            }
        } catch { /* silent */ }
        setLoading(false);
    }, [authHeaders]);

    const loadMarkets = useCallback(async () => {
        try {
            const res = await fetch(`${API}/system/markets`, { headers: { ...authHeaders } });
            if (res.ok) {
                const d = await res.json();
                setMarkets((d.items ?? []).map((m: Record<string, unknown>) => ({
                    code: m.code as string, name: m.name as string, flag: m.flag as string,
                })));
            }
        } catch { /* silent */ }
    }, [authHeaders]);

    useEffect(() => { loadMarkets(); }, [loadMarkets]);
    useEffect(() => { loadData(tab); }, [tab, loadData]);

    const handleToggle = async (id: string, name?: string) => {
        setTogglingId(id);
        try {
            const res = await fetch(`${API}/system/${tab}/${id}/toggle`, {
                method: 'PATCH',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            if (res.ok) {
                const result = await res.json();
                if (result.warning && result.requireConfirm) {
                    setWarningState({ id, name: name ?? id, tenantCount: result.affectedTenants ?? 0, tab });
                } else {
                    setDirty(true);
                    loadData(tab);
                }
            }
        } catch { /* silent */ }
        setTogglingId(null);
    };

    const handleConfirmToggle = async () => {
        if (!warningState) return;
        setTogglingId(warningState.id);
        try {
            await fetch(`${API}/system/${warningState.tab}/${warningState.id}/toggle`, {
                method: 'PATCH',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmed: true }),
            });
            setDirty(true);
            loadData(warningState.tab);
        } catch { /* silent */ }
        setTogglingId(null);
        setWarningState(null);
    };

    const handleUpdateMarkets = useCallback((platformId: string, marketCodes: string[]) => {
        pendingMarketChanges.current[platformId] = marketCodes;
        setDirty(true);
    }, []);

    const handleSave = async () => {
        const pending = pendingMarketChanges.current;
        const ids = Object.keys(pending);
        if (ids.length > 0) {
            await Promise.all(ids.map(pid =>
                fetch(`${API}/system/platforms/${pid}`, {
                    method: 'PUT',
                    headers: { ...authHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabledMarketCodes: pending[pid] }),
                })
            ));
            pendingMarketChanges.current = {};
            loadData('platforms');
        }
        setDirty(false);
    };

    const items = (data[tab] ?? []) as Record<string, unknown>[];

    const stats = useMemo(() => {
        const count = (key: string) => {
            const arr = (data[key] ?? []) as { enabled: boolean }[];
            const active = arr.filter(i => i.enabled).length;
            return { active, total: arr.length };
        };
        return {
            platforms: count('platforms'),
            categories: count('categories'),
            warehouses: count('warehouses'),
            erp: count('erp-systems'),
            tools: count('tools'),
        };
    }, [data]);

    useEffect(() => {
        for (const t of TABS) { if (!data[t.key]) loadData(t.key); }
    }, []);// eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div>
            {/* ── 5 Tab Navigation ── */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 8, marginBottom: 28,
            }}>
                {TABS.map((t) => {
                    const isActive = tab === t.key;
                    return (
                        <button key={t.key} onClick={() => setTab(t.key)} style={{
                            padding: '14px 16px', borderRadius: tokens.radius.md,
                            border: isActive ? `2px solid ${tokens.color.accent}` : `1px solid ${tokens.color.panelBorder}`,
                            background: isActive ? tintedBg(tokens.color.accent, 8) : tokens.color.panelBg,
                            cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                        }}>
                            <div style={{
                                fontWeight: tokens.font.weight.semibold, fontSize: tokens.font.size.sm,
                                color: isActive ? tokens.color.accent : tokens.color.textPrimary,
                            }}>{t.label}</div>
                            <div style={{
                                fontSize: tokens.font.size.xs, color: tokens.color.textTertiary, marginTop: 4, lineHeight: 1.4,
                            }}>{t.desc}</div>
                        </button>
                    );
                })}
            </div>

            {/* ── Save Button ── */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button onClick={handleSave} style={{
                    padding: '10px 24px', borderRadius: tokens.radius.md, border: 'none',
                    background: dirty ? tokens.color.accent : tokens.color.panelBorder,
                    color: '#fff', fontWeight: tokens.font.weight.bold, fontSize: tokens.font.size.sm,
                    cursor: dirty ? 'pointer' : 'default', opacity: dirty ? 1 : 0.5,
                    transition: 'all 0.2s',
                }}>Save Configuration</button>
            </div>

            {/* ── Panel Content ── */}
            {loading && items.length === 0 ? (
                <p style={{ color: tokens.color.textSecondary, textAlign: 'center', padding: 40 }}>Loading...</p>
            ) : (
                <>
                    {tab === 'platforms' && (
                        <PlatformsPanel
                            platforms={items as never[]}
                            markets={markets}
                            onToggle={(id) => handleToggle(id)}
                            onUpdateMarkets={handleUpdateMarkets}
                            togglingId={togglingId}
                        />
                    )}
                    {tab === 'categories' && (
                        <CategoryOntology />
                    )}
                    {tab === 'warehouses' && (
                        <WarehousesPanel
                            warehouses={items as never[]}
                            onToggle={(id) => handleToggle(id)}
                            togglingId={togglingId}
                        />
                    )}
                    {tab === 'erp-systems' && (
                        <ErpPanel
                            items={items as never[]}
                            onToggle={(id) => handleToggle(id)}
                            togglingId={togglingId}
                        />
                    )}
                    {tab === 'tools' && (
                        <ToolsPanel
                            items={items as never[]}
                            onToggle={(id) => handleToggle(id)}
                            togglingId={togglingId}
                        />
                    )}
                </>
            )}

            {/* ── Impact Warning Modal ── */}
            {warningState && (
                <ImpactWarningModal
                    name={warningState.name}
                    tenantCount={warningState.tenantCount}
                    onConfirm={handleConfirmToggle}
                    onCancel={() => setWarningState(null)}
                />
            )}

            {/* ── Bottom Status Bar ── */}
            <div style={{
                marginTop: 28, padding: '14px 20px', borderRadius: tokens.radius.md,
                background: tokens.color.panelBg, border: `1px solid ${tokens.color.panelBorder}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexWrap: 'wrap', gap: 12,
            }}>
                <div style={{
                    fontSize: tokens.font.size.xs, color: tokens.color.textTertiary, fontFamily: 'monospace',
                }}>
                    CrossBorder OS &middot; Core Data Config &middot; System Admin
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Platforms', ...stats.platforms },
                        { label: 'Markets', active: markets.filter((m: Record<string, unknown>) => m).length, total: markets.length },
                        { label: 'Warehouses', ...stats.warehouses },
                        { label: 'ERP', ...stats.erp },
                        { label: 'Tools', ...stats.tools },
                    ].map(s => (
                        <span key={s.label} style={{
                            fontSize: 11, padding: '3px 10px', borderRadius: 6,
                            background: tokens.color.panelBgSecondary,
                            border: `1px solid ${tokens.color.panelBorder}`,
                            color: tokens.color.textSecondary, fontFamily: 'monospace',
                        }}>
                            {s.label} <span style={{ color: tokens.color.accent, fontWeight: 600 }}>{s.active}</span>/{s.total}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
