'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth-context';
import { tintedBg } from '../../lib/design-tokens';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

type CatalogItem = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  isLegacy: boolean;
};

export function ModelCatalog() {
  const { authHeaders } = useAuth();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const loadCatalog = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/platform/ai/catalog`, { headers: authHeaders });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const handleToggle = async (modelId: string, field: 'enabled' | 'isLegacy', value: boolean) => {
    setMsg('');
    const res = await fetch(`${API_BASE}/platform/ai/catalog/${modelId}`, {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      setMsg(`Updated ${modelId}`);
      loadCatalog();
    }
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'var(--panel-bg)', borderRadius: 12, padding: 24, border: '1px solid var(--border)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
          Model Catalog
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
          Manage available models across all tenants. Disabled models are hidden. Legacy models are only visible to tenants with &quot;Include Legacy&quot; policy enabled.
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Model</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Legacy</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{
                borderBottom: '1px solid var(--border)',
                opacity: item.enabled ? 1 : 0.5,
              }}>
                <td style={{ padding: '12px', fontSize: 14 }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.description}</div>
                </td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13,
                    color: item.enabled ? 'var(--success, #34D399)' : 'var(--text-muted)',
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: item.enabled ? 'var(--success, #34D399)' : 'var(--text-muted, #666)',
                    }} />
                    {item.enabled ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td style={{ padding: '12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                  {item.isLegacy ? 'Yes' : 'No'}
                </td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  {editingId === item.id ? (
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => { handleToggle(item.id, 'enabled', !item.enabled); setEditingId(null); }}
                        style={{
                          padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                          background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12,
                        }}
                      >
                        {item.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => { handleToggle(item.id, 'isLegacy', !item.isLegacy); setEditingId(null); }}
                        style={{
                          padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                          background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12,
                        }}
                      >
                        {item.isLegacy ? 'Unmark Legacy' : 'Mark Legacy'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                          background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingId(item.id)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                        background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12,
                      }}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {msg && (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--accent)' }}>{msg}</div>
        )}
      </div>
    </div>
  );
}
