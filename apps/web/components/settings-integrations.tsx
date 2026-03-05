'use client';

import { useState, useEffect } from 'react';
import { useTenant } from './tenant-context';
import { useAuth } from './auth-context';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

type ApiStatus = 'connected' | 'disconnected' | 'error';

interface Integration {
    id: string;
    code: string;
    name: string;
    apiStatus: ApiStatus;
    lastSyncAt?: string;
    // Platform-specific
    apiType?: string;
    fulfillmentModes?: { id: string; code: string; name: string }[];
    // 3PL-specific
    provider?: string;
    // ERP-specific
    erpType?: string;
    syncDirection?: string;
    // Warehouse-specific
    type?: string;
    country?: string;
}

type TabKey = 'platforms' | '3pl' | 'warehouses' | 'erp';

const TABS: { key: TabKey; label: string; endpoint: string }[] = [
    { key: 'platforms', label: 'Platforms', endpoint: '/mdm/platforms' },
    { key: '3pl', label: '3PL Partners', endpoint: '/mdm/3pl' },
    { key: 'warehouses', label: 'Warehouses', endpoint: '/mdm/warehouses' },
    { key: 'erp', label: 'ERP Systems', endpoint: '/mdm/erp-systems' },
];

function statusColor(s: ApiStatus) {
    return s === 'connected' ? 'var(--success)' : s === 'error' ? 'var(--danger)' : 'var(--text-secondary)';
}

function statusLabel(s: ApiStatus) {
    return s === 'connected' ? 'Connected' : s === 'error' ? 'Error' : 'Disconnected';
}

export function SettingsIntegrations() {
    const { currentTenantId } = useTenant();
    const { authHeaders } = useAuth();
    const [tab, setTab] = useState<TabKey>('platforms');
    const [items, setItems] = useState<Integration[]>([]);
    const [loading, setLoading] = useState(true);

    const activeTab = TABS.find((t) => t.key === tab)!;

    const [isAdding, setIsAdding] = useState(false);
    const [newItemName, setNewItemName] = useState('');

    const loadItems = () => {
        if (!currentTenantId) return;
        setLoading(true);
        fetch(`${API_BASE}${activeTab.endpoint}?tenantId=${currentTenantId}`, {
            headers: { ...authHeaders },
        })
            .then((r) => r.json())
            .then((d: { items: Integration[] }) => setItems(d.items ?? []))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadItems();
    }, [currentTenantId, activeTab.endpoint]);

    const handleCreate = async () => {
        if (!currentTenantId) return;
        const name = newItemName.trim();
        if (!name) return;

        const code = name.toUpperCase().replace(/\W+/g, '-');
        setLoading(true);

        // Map required fields based on tab
        const payload: Record<string, unknown> = { name, code };
        if (tab === 'platforms') payload.apiType = 'REST';
        if (tab === '3pl') payload.provider = 'SHIPSTATION';
        if (tab === 'erp') payload.erpType = 'NETSUITE';

        try {
            const res = await fetch(`${API_BASE}${activeTab.endpoint}?tenantId=${currentTenantId}`, {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setNewItemName('');
                setIsAdding(false);
                loadItems();
            } else {
                const err = await res.json();
                console.error('Failed to create:', err.error);
                setLoading(false);
            }
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    const handleTestConnection = async (id: string) => {
        const endpoint = `${API_BASE}${activeTab.endpoint}/${id}/test-connection`;
        await fetch(endpoint, {
            method: 'POST',
            headers: { ...authHeaders, 'content-type': 'application/json' },
        });
        loadItems();
    };

    const getSingular = (label: string) => {
        if (label === 'Warehouses') return 'Warehouse';
        return label.slice(0, -1);
    };

    return (
        <div>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--panel-border)', paddingBottom: 2, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            title={`Switch to ${t.label} tab`}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px 8px 0 0',
                                border: 'none',
                                background: tab === t.key ? 'var(--accent)' : 'transparent',
                                color: tab === t.key ? '#fff' : 'var(--text-secondary)',
                                fontWeight: tab === t.key ? 600 : 400,
                                fontSize: 14,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                {/* Add Button in Tab Bar for when items exist */}
                {!loading && items.length > 0 && !isAdding && (
                    <button onClick={() => setIsAdding(true)} title="Add a new integration" style={{
                        padding: '6px 14px', borderRadius: 6, border: 'none',
                        background: 'var(--accent)', color: '#fff', fontWeight: 600,
                        fontSize: 13, cursor: 'pointer', marginBottom: 6
                    }}>
                        + Add {getSingular(activeTab.label)}
                    </button>
                )}
            </div>

            {/* Inline Add Form */}
            {isAdding && (
                <div style={{
                    marginBottom: 20, padding: 16, background: 'var(--panel-bg-secondary)',
                    border: '1px solid var(--panel-border)', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'center'
                }}>
                    <select
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        style={{
                            padding: '8px 12px', borderRadius: 6, border: '1px solid var(--panel-border)',
                            background: 'var(--panel-bg)', color: 'var(--text-primary)', flex: 1,
                            appearance: 'none', cursor: 'pointer'
                        }}
                    >
                        <option value="" disabled>Select {getSingular(activeTab.label)}</option>
                        {tab === 'platforms' && (
                            <>
                                <option value="Amazon">Amazon</option>
                                <option value="Walmart">Walmart</option>
                                <option value="Shopify">Shopify</option>
                                <option value="Wayfair">Wayfair</option>
                                <option value="Home Depot">Home Depot</option>
                            </>
                        )}
                        {tab === '3pl' && (
                            <>
                                <option value="ShipBob">ShipBob</option>
                                <option value="Deliverr">Deliverr</option>
                            </>
                        )}
                        {tab === 'warehouses' && (
                            <>
                                <option value="Internal Transit">Internal Transit</option>
                                <option value="FBA Inbound">FBA Inbound</option>
                                <option value="Overseas">Overseas</option>
                            </>
                        )}
                        {tab === 'erp' && (
                            <>
                                <option value="NetSuite">NetSuite</option>
                                <option value="SAP">SAP</option>
                                <option value="QuickBooks">QuickBooks</option>
                            </>
                        )}
                    </select>
                    <button onClick={handleCreate} disabled={!newItemName} title="Save the new integration configuration" style={{
                        padding: '8px 16px', borderRadius: 6, border: 'none',
                        background: newItemName ? 'var(--accent)' : 'var(--panel-border)',
                        color: newItemName ? '#fff' : 'var(--text-secondary)',
                        fontWeight: 600, cursor: newItemName ? 'pointer' : 'not-allowed'
                    }}>
                        Save
                    </button>
                    <button onClick={() => { setIsAdding(false); setNewItemName(''); }} title="Cancel adding a new integration" style={{
                        padding: '8px 16px', borderRadius: 6, border: '1px solid var(--panel-border)',
                        background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer'
                    }}>
                        Cancel
                    </button>
                </div>
            )}

            {/* List */}
            {loading ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 32 }}>Loading…</p>
            ) : items.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: 48,
                    background: 'var(--panel-bg)', borderRadius: 'var(--border-radius-md)',
                    border: '1px dashed var(--panel-border)',
                }}>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>No {activeTab.label.toLowerCase()} configured yet</p>
                    {!isAdding && (
                        <button onClick={() => setIsAdding(true)} title="Add your first integration of this type" style={{
                            padding: '8px 20px', borderRadius: 8, border: 'none',
                            background: 'var(--accent)', color: '#fff', fontWeight: 600,
                            fontSize: 14, cursor: 'pointer',
                        }}>
                            + Add {getSingular(activeTab.label)}
                        </button>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {items.map((item) => (
                        <div
                            key={item.id}
                            style={{
                                background: 'var(--panel-bg)',
                                borderRadius: 'var(--border-radius-md)',
                                border: '1px solid var(--panel-border)',
                                padding: 20,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'box-shadow 0.2s',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <div style={{
                                    width: 10, height: 10, borderRadius: '50%',
                                    background: statusColor(item.apiStatus),
                                    boxShadow: item.apiStatus === 'connected' ? `0 0 8px ${statusColor(item.apiStatus)}` : 'none',
                                    flexShrink: 0,
                                }} />
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
                                        {item.name}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                        {item.code}
                                        {item.apiType && ` · ${item.apiType}`}
                                        {item.provider && ` · ${item.provider}`}
                                        {item.erpType && ` · ${item.erpType}`}
                                        {item.type && ` · ${item.type}`}
                                    </div>
                                    {item.lastSyncAt && (
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                                            Last sync: {new Date(item.lastSyncAt).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span style={{
                                    fontSize: 12, fontWeight: 600, color: statusColor(item.apiStatus),
                                    padding: '4px 10px', borderRadius: 12,
                                    background: `color-mix(in srgb, ${statusColor(item.apiStatus)} 12%, transparent)`,
                                }}>
                                    {statusLabel(item.apiStatus)}
                                </span>
                                <button
                                    onClick={() => handleTestConnection(item.id)}
                                    title="Test API connection to this integration"
                                    style={{
                                        padding: '6px 14px', borderRadius: 8, border: '1px solid var(--panel-border)',
                                        background: 'transparent', color: 'var(--text-primary)',
                                        fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                >
                                    Test
                                </button>
                                <button title="Edit the configuration for this integration" style={{
                                    padding: '6px 14px', borderRadius: 8, border: '1px solid var(--panel-border)',
                                    background: 'transparent', color: 'var(--text-primary)',
                                    fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                                }}>
                                    Edit
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
