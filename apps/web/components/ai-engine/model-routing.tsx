'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../tenant-context';
import { useAuth } from '../auth-context';
import { tintedBg } from '../../lib/design-tokens';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

type WorkTypeItem = {
  workType: string;
  label: string;
  description: string;
  available: boolean;
  tenantModel: string | null;
  systemDefault: string;
  effectiveModel: string;
};

type ModelOption = {
  id: string;
  name: string;
  description: string;
  isLegacy?: boolean;
};

export function ModelRouting() {
  const { currentTenantId } = useTenant();
  const { authHeaders } = useAuth();
  const [workTypes, setWorkTypes] = useState<WorkTypeItem[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [wtRes, modelsRes] = await Promise.all([
        fetch(`${API_BASE}/mdm/ai-config/work-types`, { headers: authHeaders }),
        fetch(`${API_BASE}/mdm/ai-config/models`, { headers: authHeaders }),
      ]);
      if (wtRes.ok) {
        const data = await wtRes.json();
        setWorkTypes(data.items ?? []);
        const initial: Record<string, string> = {};
        for (const item of (data.items ?? []) as WorkTypeItem[]) {
          if (item.tenantModel) initial[item.workType] = item.tenantModel;
        }
        setOverrides(initial);
      }
      if (modelsRes.ok) {
        const data = await modelsRes.json();
        setModels(data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      const configRes = await fetch(`${API_BASE}/mdm/ai-config`, { headers: authHeaders });
      const currentConfig = configRes.ok ? await configRes.json() : {};

      const body: Record<string, unknown> = {
        modelId: currentConfig.modelId,
        models: overrides,
      };

      const res = await fetch(`${API_BASE}/mdm/ai-config`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setMsg('Model routing saved');
        load();
      } else {
        const err = await res.json();
        setMsg(err.error ?? 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Loading...</div>;

  return (
    <div style={{ background: 'var(--panel-bg)', borderRadius: 12, padding: 24, border: '1px solid var(--border)' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
        WorkType Model Routing
      </h3>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
        Choose which model to use for each task type. Leave as system default to use the platform-configured model.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {workTypes.map((wt) => (
          <div key={wt.workType} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8,
            background: tintedBg('var(--text-primary)', 3),
            opacity: wt.available ? 1 : 0.5,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {wt.label}
                </span>
                {!wt.available && (
                  <span style={{
                    fontSize: 11, padding: '2px 6px', borderRadius: 4,
                    background: tintedBg('var(--warning, #FBBF24)', 20),
                    color: 'var(--warning, #FBBF24)',
                  }}>
                    Coming Soon
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {wt.description}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, minWidth: 220 }}>
              <select
                value={overrides[wt.workType] ?? ''}
                disabled={!wt.available}
                onChange={(e) => {
                  const val = e.target.value;
                  setOverrides((prev) => {
                    const next = { ...prev };
                    if (!val) {
                      delete next[wt.workType];
                    } else {
                      next[wt.workType] = val;
                    }
                    return next;
                  });
                }}
                style={{
                  padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'var(--input-bg, var(--panel-bg))', color: 'var(--text-primary)',
                  fontSize: 13, minWidth: 180,
                }}
              >
                <option value="">System default ({wt.systemDefault})</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.isLegacy ? ' (Legacy)' : ''}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Effective: {overrides[wt.workType] ?? wt.effectiveModel}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
        {msg && <span style={{ fontSize: 13, color: 'var(--accent)' }}>{msg}</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13,
          }}
        >
          {saving ? 'Saving...' : 'Save Routing'}
        </button>
      </div>
    </div>
  );
}
