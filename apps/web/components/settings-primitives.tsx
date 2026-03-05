'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTenant } from './tenant-context';
import { useAuth } from './auth-context';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

type PrimitiveTab = 'markets' | 'categories' | 'brands' | 'suppliers' | 'platforms';

const TABS: { key: PrimitiveTab; label: string; endpoint: string }[] = [
    { key: 'markets', label: 'Markets', endpoint: '/mdm/markets' },
    { key: 'categories', label: 'Categories', endpoint: '/mdm/categories' },
    { key: 'brands', label: 'Brands', endpoint: '/mdm/brands' },
    { key: 'suppliers', label: 'Suppliers', endpoint: '/mdm/suppliers' },
];

interface PrimitiveItem {
    id: string;
    code: string;
    name: string;
    // Market
    currency?: string;
    timezone?: string;
    languages?: { id: string; language: string; isDefault: boolean }[];
    // Category
    definition?: string;
    parentId?: string;
    children?: PrimitiveItem[];
    // Brand
    description?: string;
    brandCategories?: { id: string; category: { id: string; name: string } }[];
    // Supplier
    contactName?: string;
    contactEmail?: string;
    leadTimeDays?: number;
    moq?: number;
    country?: string;
}

function CategoryTree({ items, depth = 0, onDelete, onEdit }: { items: PrimitiveItem[]; depth?: number; onDelete: (id: string) => void; onEdit: (item: PrimitiveItem) => void }) {
    return (
        <>
            {items.map((item) => (
                <div key={item.id}>
                    <div
                        style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '12px 16px', paddingLeft: 16 + depth * 24,
                            borderRadius: 'var(--border-radius-sm)',
                            transition: 'background 0.2s',
                            borderBottom: '1px solid var(--panel-border-subtle)',
                        }}
                    >
                        {item.children && item.children.length > 0 && (
                            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>▸</span>
                        )}
                        <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{item.name}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>{item.code}</span>
                            {item.definition && (
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{item.definition}</div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                title="Edit this configuration"
                                onClick={() => onEdit(item)}
                                style={{
                                    padding: '4px 8px', borderRadius: 4, border: '1px solid var(--panel-border)',
                                    background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                                    opacity: 0.6, transition: 'opacity 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                onMouseOut={(e) => e.currentTarget.style.opacity = '0.6'}
                            >
                                Edit
                            </button>
                            <button
                                title="Delete this configuration"
                                onClick={() => onDelete(item.id)}
                                style={{
                                    padding: '4px 8px', borderRadius: 4, border: '1px solid var(--panel-border)',
                                    background: 'rgba(255, 77, 79, 0.05)', color: '#ff4d4f', fontSize: 12, cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 77, 79, 0.15)'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 77, 79, 0.05)'}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                    {item.children && item.children.length > 0 && (
                        <CategoryTree items={item.children} depth={depth + 1} onDelete={onDelete} onEdit={onEdit} />
                    )}
                </div>
            ))}
        </>
    );
}

interface AmazonCatalogNode {
    code: string;
    name: string;
    children?: AmazonCatalogNode[];
}

function CatalogNode({
    node,
    parentCode,
    selected,
    onToggle,
    depth = 0
}: {
    node: AmazonCatalogNode;
    parentCode?: string;
    selected: { code: string; name: string; parentCode?: string }[];
    onToggle: (node: AmazonCatalogNode, parentCode?: string) => void;
    depth?: number;
}) {
    const [expanded, setExpanded] = useState(depth < 1);
    const isSelected = selected.some(c => c.code === node.code);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div style={{ marginLeft: depth > 0 ? 20 : 0, borderLeft: depth > 0 ? '1px solid var(--panel-border)' : 'none', paddingLeft: depth > 0 ? 12 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                {hasChildren && (
                    <button
                        title="Toggle nested view"
                        onClick={() => setExpanded(!expanded)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', width: 20 }}
                    >
                        {expanded ? '▼' : '▶'}
                    </button>
                )}
                {!hasChildren && <div style={{ width: 20 }} />}
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(node, parentCode)}
                    style={{ cursor: 'pointer', appearance: 'auto', width: 16, height: 16, padding: 0, margin: 0, display: 'inline-block' }}
                />
                <span style={{
                    fontWeight: depth === 0 ? 600 : 400,
                    fontSize: Math.max(12, 14 - depth * 0.5),
                    color: 'var(--text-primary)',
                    cursor: 'default'
                }}>
                    {node.name}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', opacity: 0.7 }}>({node.code})</span>
            </div>
            {hasChildren && expanded && (
                <div>
                    {node.children!.map(child => (
                        <CatalogNode
                            key={child.code}
                            node={child}
                            parentCode={node.code}
                            selected={selected}
                            onToggle={onToggle}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export function SettingsPrimitives() {
    const { currentTenantId } = useTenant();
    const { authHeaders } = useAuth();
    const [tab, setTab] = useState<PrimitiveTab>('markets');
    const [items, setItems] = useState<PrimitiveItem[]>([]);
    const [loading, setLoading] = useState(true);

    const activeTab = TABS.find((t) => t.key === tab)!;

    const loadItems = useCallback(async () => {
        if (!currentTenantId) return;
        setLoading(true);
        console.log(`[Settings] Loading items for ${activeTab.label}...`);
        try {
            const res = await fetch(`${API_BASE}${activeTab.endpoint}?tenantId=${currentTenantId}&t=${Date.now()}`, {
                headers: { ...authHeaders },
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.error('[Settings] Load failed:', err);
                setItems([]);
            } else {
                const data = await res.json();
                setItems(data.items ?? []);
            }
        } catch (error) {
            console.error('[Settings] Network error:', error);
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [currentTenantId, activeTab]);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    const getSingular = (label: string) => {
        if (label === 'Categories') return 'Category';
        return label.slice(0, -1);
    };

    const [isAdding, setIsAdding] = useState(false);
    const [newItemName, setNewItemName] = useState('');

    // Editing State
    const [editingItem, setEditingItem] = useState<PrimitiveItem | null>(null);
    const [editData, setEditData] = useState<Partial<PrimitiveItem>>({});

    // Amazon Category Import State
    const [importingFromAmazon, setImportingFromAmazon] = useState(false);
    const [amazonCatalog, setAmazonCatalog] = useState<AmazonCatalogNode[]>([]);
    const [selectedAmazonCategories, setSelectedAmazonCategories] = useState<{ code: string; name: string; parentCode?: string }[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(false);

    // Deletion Confirmation State
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    useEffect(() => {
        if (importingFromAmazon && amazonCatalog.length === 0) {
            setCatalogLoading(true);
            fetch(`${API_BASE}/mdm/categories/catalog/amazon-us`, {
                headers: { ...authHeaders },
            })
                .then(r => r.json())
                .then(d => setAmazonCatalog(d.items ?? []))
                .catch(() => setAmazonCatalog([]))
                .finally(() => setCatalogLoading(false));
        }
    }, [importingFromAmazon, amazonCatalog.length]);

    const handleImport = async () => {
        if (!currentTenantId || selectedAmazonCategories.length === 0) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/mdm/categories/import?tenantId=${currentTenantId}`, {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ categories: selectedAmazonCategories })
            });
            if (res.ok) {
                setImportingFromAmazon(false);
                setSelectedAmazonCategories([]);
                loadItems();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = useCallback(async (id: string) => {
        if (!currentTenantId) {
            console.warn('[Settings] Cannot delete: currentTenantId is missing');
            return;
        }
        setDeleteError(null);
        setIsDeleting(false);
        setConfirmDeleteId(id);
    }, [currentTenantId]);

    const executeDelete = useCallback(async () => {
        if (!confirmDeleteId || !currentTenantId || isDeleting) return;

        const id = confirmDeleteId;
        setIsDeleting(true);
        setDeleteError(null);
        console.log(`[Settings] Deleting ${activeTab.label} with ID: ${id} for tenant: ${currentTenantId}`);
        // Locally within modal we don't set global loading yet, or maybe we do
        try {
            const url = `${API_BASE}${activeTab.endpoint}/${id}?tenantId=${currentTenantId}&t=${Date.now()}`;
            console.log(`[Settings] DELETE request to: ${url}`);
            const res = await fetch(url, {
                method: 'DELETE',
                headers: { ...authHeaders },
            });
            console.log(`[Settings] DELETE response status: ${res.status}`);
            if (res.ok) {
                console.log('[Settings] Delete successful, reloading items...');
                setConfirmDeleteId(null);
                setIsDeleting(false);
                loadItems();
            } else {
                const err = await res.json();
                setDeleteError(err.error || err.message || 'Failed to delete');
                setIsDeleting(false);
            }
        } catch (e: any) {
            console.error('[Settings] Delete failed:', e);
            setDeleteError('An unexpected network error occurred');
            setIsDeleting(false);
        }
    }, [currentTenantId, activeTab, loadItems, confirmDeleteId, isDeleting]);

    const handleUpdate = async () => {
        if (!currentTenantId || !editingItem) return;
        setLoading(true);
        try {
            // Only send the fields the backend accepts per entity type — strip read-only DB fields
            // (id, tenantId, code, createdAt, updatedAt, brandCategories, etc.)
            let payload: Record<string, unknown> = {};
            if (activeTab.key === 'markets') {
                payload = { name: editData.name, currency: editData.currency, timezone: editData.timezone };
            } else if (activeTab.key === 'platforms') {
                payload = { name: editData.name, apiType: (editData as any).apiType };
            } else if (activeTab.key === 'categories') {
                payload = { name: editData.name, definition: editData.definition, parentId: editData.parentId };
            } else if (activeTab.key === 'brands') {
                payload = { name: editData.name, description: editData.description };
            } else if (activeTab.key === 'suppliers') {
                payload = {
                    name: editData.name,
                    contactName: editData.contactName,
                    contactEmail: editData.contactEmail,
                    leadTimeDays: editData.leadTimeDays,
                    moq: editData.moq,
                    country: editData.country,
                };
            } else {
                // Fallback: strip known read-only fields
                const { id, tenantId, code, createdAt, updatedAt, brandCategories, children, languages, fulfillmentModes, ...rest } = editData as any;
                payload = rest;
            }
            // Remove undefined values
            Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

            const res = await fetch(`${API_BASE}${activeTab.endpoint}/${editingItem.id}?tenantId=${currentTenantId}`, {
                method: 'PUT',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setEditingItem(null);
                setEditData({});
                loadItems();
            } else {
                const err = await res.json().catch(() => ({}));
                console.error('[Settings] Update failed:', err);
                setLoading(false);
            }
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!currentTenantId) return;
        const name = newItemName.trim();
        if (!name) return;

        const code = name.toUpperCase().replace(/\W+/g, '-');
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE}${activeTab.endpoint}?tenantId=${currentTenantId}`, {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, code })
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

    return (
        <div>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--panel-border)', paddingBottom: 2, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            title={`Switch to ${t.label} tab`}
                            onClick={() => setTab(t.key)}
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
                {!loading && items.length > 0 && !editingItem && (
                    <div style={{ display: 'flex', gap: 8 }}>
                        {tab === 'categories' && (
                            <button onClick={() => setImportingFromAmazon(true)} title="Import categories from Amazon catalog" style={{
                                padding: '6px 14px', borderRadius: 6, border: 'none',
                                background: 'var(--accent)', color: '#fff', fontWeight: 600,
                                fontSize: 13, cursor: 'pointer', marginBottom: 6
                            }}>
                                Import from Amazon
                            </button>
                        )}
                        {!isAdding && (
                            <button onClick={() => setIsAdding(true)} title="Add a new configuration" style={{
                                padding: '6px 14px', borderRadius: 6, border: 'none',
                                background: 'var(--accent)', color: '#fff', fontWeight: 600,
                                fontSize: 13, cursor: 'pointer', marginBottom: 6
                            }}>
                                + Add {getSingular(activeTab.label)}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Edit Form Backdrop Overlay (Simplified Modal) */}
            {editingItem && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        background: 'var(--panel-bg)', padding: 32, borderRadius: 16,
                        width: '100%', maxWidth: 500, border: '1px solid var(--panel-border)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                    }}>
                        <h2 style={{ margin: '0 0 24px 0', fontSize: 20, color: 'var(--text-primary)' }}>Edit {getSingular(activeTab.label)}</h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Name</label>
                                <input
                                    value={editData.name ?? ''}
                                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                    style={{
                                        padding: '10px 14px', borderRadius: 8, border: '1px solid var(--panel-border)',
                                        background: 'var(--panel-bg-secondary)', color: 'var(--text-primary)'
                                    }}
                                />
                            </div>

                            {activeTab.key === 'categories' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Definition</label>
                                    <textarea
                                        value={editData.definition ?? ''}
                                        onChange={(e) => setEditData({ ...editData, definition: e.target.value })}
                                        style={{
                                            padding: '10px 14px', borderRadius: 8, border: '1px solid var(--panel-border)',
                                            background: 'var(--panel-bg-secondary)', color: 'var(--text-primary)',
                                            minHeight: 80, resize: 'vertical'
                                        }}
                                    />
                                </div>
                            )}

                            {activeTab.key === 'suppliers' && (
                                <>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Contact Name</label>
                                        <input
                                            value={editData.contactName ?? ''}
                                            onChange={(e) => setEditData({ ...editData, contactName: e.target.value })}
                                            style={{
                                                padding: '10px 14px', borderRadius: 8, border: '1px solid var(--panel-border)',
                                                background: 'var(--panel-bg-secondary)', color: 'var(--text-primary)'
                                            }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Contact Email</label>
                                        <input
                                            value={editData.contactEmail ?? ''}
                                            onChange={(e) => setEditData({ ...editData, contactEmail: e.target.value })}
                                            style={{
                                                padding: '10px 14px', borderRadius: 8, border: '1px solid var(--panel-border)',
                                                background: 'var(--panel-bg-secondary)', color: 'var(--text-primary)'
                                            }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: 16 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                                            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Lead Time (Days)</label>
                                            <input
                                                type="number"
                                                value={editData.leadTimeDays ?? ''}
                                                onChange={(e) => setEditData({ ...editData, leadTimeDays: parseInt(e.target.value) || 0 })}
                                                style={{
                                                    padding: '10px 14px', borderRadius: 8, border: '1px solid var(--panel-border)',
                                                    background: 'var(--panel-bg-secondary)', color: 'var(--text-primary)'
                                                }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                                            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>MOQ</label>
                                            <input
                                                type="number"
                                                value={editData.moq ?? ''}
                                                onChange={(e) => setEditData({ ...editData, moq: parseInt(e.target.value) || 0 })}
                                                style={{
                                                    padding: '10px 14px', borderRadius: 8, border: '1px solid var(--panel-border)',
                                                    background: 'var(--panel-bg-secondary)', color: 'var(--text-primary)'
                                                }}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {activeTab.key === 'markets' && (
                                <div style={{ display: 'flex', gap: 16 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                                        <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Currency</label>
                                        <input
                                            value={editData.currency ?? ''}
                                            onChange={(e) => setEditData({ ...editData, currency: e.target.value })}
                                            style={{
                                                padding: '10px 14px', borderRadius: 8, border: '1px solid var(--panel-border)',
                                                background: 'var(--panel-bg-secondary)', color: 'var(--text-primary)'
                                            }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                                        <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Timezone</label>
                                        <input
                                            value={editData.timezone ?? ''}
                                            onChange={(e) => setEditData({ ...editData, timezone: e.target.value })}
                                            style={{
                                                padding: '10px 14px', borderRadius: 8, border: '1px solid var(--panel-border)',
                                                background: 'var(--panel-bg-secondary)', color: 'var(--text-primary)'
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {activeTab.key === 'brands' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Description</label>
                                    <textarea
                                        value={editData.description ?? ''}
                                        onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                                        style={{
                                            padding: '10px 14px', borderRadius: 8, border: '1px solid var(--panel-border)',
                                            background: 'var(--panel-bg-secondary)', color: 'var(--text-primary)',
                                            minHeight: 100, resize: 'vertical'
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: 32, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button
                                title="Save these changes"
                                onClick={handleUpdate}
                                style={{
                                    padding: '12px 28px', borderRadius: 10, border: 'none',
                                    background: 'var(--accent)', color: '#fff', fontWeight: 600,
                                    cursor: 'pointer', boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.3)'
                                }}
                            >
                                Save Changes
                            </button>
                            <button
                                title="Cancel editing"
                                onClick={() => { setEditingItem(null); setEditData({}); }}
                                style={{
                                    padding: '12px 28px', borderRadius: 10, border: '1px solid var(--panel-border)',
                                    background: 'transparent', color: 'var(--text-primary)', fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Amazon Category Import UI */}
            {importingFromAmazon && (
                <div style={{
                    marginBottom: 24, padding: 24, background: 'var(--panel-bg)',
                    border: '1px solid var(--panel-border)', borderRadius: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>Import from Amazon US Catalog</h3>
                        <button onClick={() => setImportingFromAmazon(false)} title="Cancel Amazon import" style={{
                            background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 20
                        }}>×</button>
                    </div>

                    {catalogLoading ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading catalog...</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
                            {amazonCatalog.map((node) => (
                                <div key={node.code} style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: 12 }}>
                                    <CatalogNode
                                        node={node}
                                        selected={selectedAmazonCategories}
                                        onToggle={(target, parentCode) => {
                                            const isSelected = selectedAmazonCategories.some(c => c.code === target.code);

                                            const getDescendants = (node: AmazonCatalogNode, currentParent?: string): { code: string, name: string, parentCode?: string }[] => {
                                                const res: Array<{ code: string, name: string, parentCode?: string }> = [{ code: node.code, name: node.name, parentCode: currentParent }];
                                                if (node.children) {
                                                    node.children.forEach(child => {
                                                        res.push(...getDescendants(child, node.code));
                                                    });
                                                }
                                                return res;
                                            };

                                            const nodesToToggle = getDescendants(target, parentCode);
                                            const codesToToggle = new Set(nodesToToggle.map(n => n.code));

                                            if (isSelected) {
                                                // Deselect target and all its descendants
                                                setSelectedAmazonCategories(prev => prev.filter(c => !codesToToggle.has(c.code)));
                                            } else {
                                                // Select target and all its descendants
                                                setSelectedAmazonCategories(prev => {
                                                    const existingCodes = new Set(prev.map(p => p.code));
                                                    const newNodes = nodesToToggle.filter(n => !existingCodes.has(n.code));
                                                    return [...prev, ...newNodes];
                                                });
                                            }
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                        <button
                            title="Confirm import from Amazon"
                            onClick={handleImport}
                            disabled={selectedAmazonCategories.length === 0 || catalogLoading}
                            style={{
                                padding: '10px 24px', borderRadius: 8, border: 'none',
                                background: selectedAmazonCategories.length > 0 ? 'var(--accent)' : 'var(--panel-border)',
                                color: '#fff', fontWeight: 600, cursor: 'pointer'
                            }}
                        >
                            Import {selectedAmazonCategories.length} Categories
                        </button>
                        <button
                            title="Cancel Amazon import"
                            onClick={() => { setImportingFromAmazon(false); setSelectedAmazonCategories([]); }}
                            style={{
                                padding: '10px 24px', borderRadius: 8, border: '1px solid var(--panel-border)',
                                background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Inline Add Form */}
            {isAdding && (
                <div style={{
                    marginBottom: 20, padding: 16, background: 'var(--panel-bg-secondary)',
                    border: '1px solid var(--panel-border)', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'center'
                }}>
                    {tab === 'markets' ? (
                        <select
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            style={{
                                padding: '8px 12px', borderRadius: 6, border: '1px solid var(--panel-border)',
                                background: 'var(--panel-bg)', color: 'var(--text-primary)', flex: 1,
                                appearance: 'none', cursor: 'pointer'
                            }}
                        >
                            <option value="" disabled>Select Market</option>
                            <option value="US">US (United States)</option>
                            <option value="CA">CA (Canada)</option>
                            <option value="EU">EU (European Union)</option>
                            <option value="UK">UK (United Kingdom)</option>
                            <option value="JP">JP (Japan)</option>
                        </select>
                    ) : (
                        <input
                            defaultValue={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            placeholder={`${getSingular(activeTab.label)} Name`}
                            autoFocus
                            style={{
                                padding: '8px 12px', borderRadius: 6, border: '1px solid var(--panel-border)',
                                background: 'var(--panel-bg)', color: 'var(--text-primary)', flex: 1
                            }}
                        />
                    )}
                    <button onClick={handleCreate} disabled={!newItemName} title="Save this new configuration" style={{
                        padding: '8px 16px', borderRadius: 6, border: 'none',
                        background: newItemName ? 'var(--accent)' : 'var(--panel-border)',
                        color: newItemName ? '#fff' : 'var(--text-secondary)',
                        fontWeight: 600, cursor: newItemName ? 'pointer' : 'not-allowed'
                    }}>
                        Save
                    </button>
                    {tab === 'categories' && (
                        <button
                            onClick={() => { setIsAdding(false); setImportingFromAmazon(true); }}
                            title="Switch to Amazon category import"
                            style={{
                                padding: '8px 16px', borderRadius: 6, border: '1px solid var(--panel-border)',
                                background: 'var(--panel-bg)', color: 'var(--text-primary)', cursor: 'pointer'
                            }}
                        >
                            Import from Amazon
                        </button>
                    )}
                    <button onClick={() => { setIsAdding(false); setNewItemName(''); }} title="Cancel adding new configuration" style={{
                        padding: '8px 16px', borderRadius: 6, border: '1px solid var(--panel-border)',
                        background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer'
                    }}>
                        Cancel
                    </button>
                </div>
            )}

            {/* Content */}
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
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                            {tab === 'categories' && (
                                <button onClick={() => setImportingFromAmazon(true)} title="Import categories from Amazon catalog" style={{
                                    padding: '8px 20px', borderRadius: 8, border: 'none',
                                    background: 'var(--accent)', color: '#fff', fontWeight: 600,
                                    fontSize: 14, cursor: 'pointer',
                                }}>
                                    Import from Amazon
                                </button>
                            )}
                            <button onClick={() => setIsAdding(true)} title="Add your first configuration here" style={{
                                padding: '8px 20px', borderRadius: 8, border: 'none',
                                background: 'var(--accent)', color: '#fff', fontWeight: 600,
                                fontSize: 14, cursor: 'pointer',
                            }}>
                                + Add {getSingular(activeTab.label)}
                            </button>
                        </div>
                    )}
                </div>
            ) : tab === 'categories' ? (
                <div style={{
                    background: 'var(--panel-bg)', borderRadius: 'var(--border-radius-md)',
                    border: '1px solid var(--panel-border)', padding: '8px 0',
                }}>
                    <CategoryTree items={items} onDelete={handleDelete} onEdit={(cat: PrimitiveItem) => { setEditingItem(cat); setEditData(cat); }} />
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.map((item) => (
                        <div
                            key={item.id}
                            style={{
                                background: 'var(--panel-bg)',
                                borderRadius: 'var(--border-radius-md)',
                                border: '1px solid var(--panel-border)',
                                padding: '16px 20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}
                        >
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{item.name}</span>
                                    <span style={{
                                        fontSize: 11, padding: '2px 8px', borderRadius: 6,
                                        background: 'var(--panel-bg-secondary)',
                                        color: 'var(--text-secondary)',
                                        border: '1px solid var(--panel-border)',
                                    }}>
                                        {item.code}
                                    </span>
                                </div>
                                {/* Market details */}
                                {tab === 'markets' && (
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                                        {item.currency} · {item.timezone}
                                        {item.languages && item.languages.length > 0 && (
                                            <span> · Languages: {item.languages.map((l) => l.language).join(', ')}</span>
                                        )}
                                    </div>
                                )}
                                {/* Brand details */}
                                {tab === 'brands' && (
                                    <>
                                        {item.description && (
                                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, maxWidth: 500 }}>
                                                {item.description}
                                            </div>
                                        )}
                                        {item.brandCategories && item.brandCategories.length > 0 && (
                                            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                                                {item.brandCategories.map((bc) => (
                                                    <span key={bc.id} style={{
                                                        fontSize: 11, padding: '2px 8px', borderRadius: 10,
                                                        background: 'rgba(0, 122, 255, 0.1)', color: 'var(--accent)',
                                                    }}>
                                                        {bc.category.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                                {/* Supplier details */}
                                {tab === 'suppliers' && (
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                                        {item.country}
                                        {item.contactName && ` · ${item.contactName}`}
                                        {item.leadTimeDays && ` · ${item.leadTimeDays}d lead time`}
                                        {item.moq && ` · MOQ ${item.moq}`}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    title="Edit this configuration"
                                    onClick={() => {
                                        setEditingItem(item);
                                        setEditData(item);
                                    }}
                                    style={{
                                        padding: '6px 14px', borderRadius: 8, border: '1px solid var(--panel-border)',
                                        background: 'transparent', color: 'var(--text-primary)',
                                        fontSize: 13, cursor: 'pointer',
                                    }}>
                                    Edit
                                </button>
                                <button
                                    title="Delete this configuration"
                                    onClick={() => handleDelete(item.id)}
                                    style={{
                                        padding: '6px 14px', borderRadius: 8, border: '1px solid var(--panel-border)',
                                        background: 'transparent', color: '#ff4d4f',
                                        fontSize: 13, cursor: 'pointer',
                                    }}>
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmDeleteId && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 2000, padding: 24, animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        background: 'var(--bg-secondary)', border: '2px solid var(--panel-border)',
                        borderRadius: 12, width: '100%', maxWidth: 460,
                        padding: 32, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        animation: 'scaleIn 0.2s ease-out',
                        color: 'var(--text-primary)'
                    }}>
                        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>Confirm Deletion</h3>
                        <p style={{ margin: 0, fontSize: 16, color: 'var(--accent)', lineHeight: 1.6, marginBottom: 32 }}>
                            Are you sure you want to delete this <strong style={{ color: '#ef4444', textDecoration: 'underline' }}>{getSingular(activeTab.label)}</strong>?
                            <br /><br />
                            <span style={{ fontSize: 13, color: '#6b7280' }}>This action might be restricted if there are active dependencies in the system.</span>
                        </p>

                        {deleteError && (
                            <div style={{
                                background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 8,
                                padding: '12px 16px', marginBottom: 24, color: '#b91c1c', fontSize: 14,
                                lineHeight: 1.5, display: 'flex', gap: 8, alignItems: 'flex-start'
                            }}>
                                <span style={{ fontSize: 16 }}>⚠️</span>
                                <div>
                                    <div style={{ fontWeight: 700, marginBottom: 2 }}>Restriction Found</div>
                                    <div>{deleteError}</div>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => !isDeleting && setConfirmDeleteId(null)}
                                disabled={isDeleting}
                                style={{
                                    padding: '10px 20px', borderRadius: 8, border: '1px solid var(--panel-border)',
                                    background: 'rgba(255,255,255,0.05)', color: 'var(--accent)',
                                    fontSize: 15, fontWeight: 500, cursor: isDeleting ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                                    opacity: isDeleting ? 0.5 : 1
                                }}
                                onMouseOver={(e) => { if (!isDeleting) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                                onMouseOut={(e) => { if (!isDeleting) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeDelete}
                                disabled={isDeleting}
                                style={{
                                    padding: '10px 24px', borderRadius: 8, border: 'none',
                                    background: isDeleting ? '#94a3b8' : '#ff4d4f', color: 'white',
                                    fontSize: 15, fontWeight: 600, cursor: isDeleting ? 'wait' : 'pointer', transition: 'all 0.2s',
                                    boxShadow: isDeleting ? 'none' : '0 4px 6px -1px rgba(255, 77, 79, 0.2)',
                                    display: 'flex', alignItems: 'center', gap: 8
                                }}
                                onMouseOver={(e) => { if (!isDeleting) { e.currentTarget.style.scale = '1.02'; e.currentTarget.style.background = '#ff7875'; } }}
                                onMouseOut={(e) => { if (!isDeleting) { e.currentTarget.style.scale = '1'; e.currentTarget.style.background = '#ff4d4f'; } }}
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            `}</style>

            <div style={{
                marginTop: 24, padding: '12px 16px', borderRadius: 8,
                background: 'var(--panel-bg-secondary)', border: '1px dashed var(--panel-border)',
                fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div>Current Tenant ID: {currentTenantId || 'None'}</div>
                <div>Connected to: {API_BASE}</div>
            </div>
        </div>
    );
}
