'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../tenant-context';
import { useAuth } from '../auth-context';
import { tintedBg } from '../../lib/design-tokens';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

type AiStatus = {
  provider: string;
  keySource: 'tenant' | 'platform' | 'none';
  modelId: string;
  connected: boolean;
};

type AiConfig = {
  geminiKey: string;
  modelId: string;
};

export function ProviderConfig() {
  const { currentTenantId } = useTenant();
  const { authHeaders } = useAuth();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [msg, setMsg] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);

  const load = useCallback(async () => {
    try {
      const [statusRes, configRes] = await Promise.all([
        fetch(`${API_BASE}/mdm/ai-config/status`, { headers: authHeaders }),
        fetch(`${API_BASE}/mdm/ai-config`, { headers: authHeaders }),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (configRes.ok) {
        const c = await configRes.json();
        setConfig(c);
        setKeyInput(c.geminiKey ?? '');
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
      const body: Record<string, unknown> = {
        modelId: config?.modelId,
      };
      if (keyInput && !keyInput.includes('...') && !keyInput.includes('****')) {
        body.geminiKey = keyInput;
      }
      const res = await fetch(`${API_BASE}/mdm/ai-config`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setMsg('Configuration saved');
        load();
      } else {
        const err = await res.json();
        setMsg(err.error ?? 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const isMasked = keyInput.includes('...') || keyInput.includes('****');
      const res = await fetch(`${API_BASE}/mdm/ai-config/test`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(isMasked
          ? { useStoredKey: true, modelId: config?.modelId }
          : { geminiKey: keyInput, modelId: config?.modelId }
        ),
      });
      const data = await res.json();
      setTestResult({
        ok: data.ok ?? data.success,
        message: data.ok || data.success ? `Connected` : (data.error ?? 'Failed'),
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Loading...</div>;

  const statusBg = status?.keySource === 'tenant'
    ? tintedBg('var(--accent)', 15)
    : status?.keySource === 'platform'
      ? tintedBg('var(--success, #34D399)', 15)
      : tintedBg('var(--danger, #F87171)', 15);

  const statusColor = status?.keySource === 'tenant'
    ? 'var(--accent)'
    : status?.keySource === 'platform'
      ? 'var(--success, #34D399)'
      : 'var(--danger, #F87171)';

  const statusText = status?.keySource === 'tenant'
    ? 'Using your own API key'
    : status?.keySource === 'platform'
      ? 'Using platform-provided AI capacity (counted against your plan)'
      : 'AI not configured';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* BYOK Status */}
      <div style={{
        padding: '12px 16px', borderRadius: 8, background: statusBg,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
        <span style={{ fontSize: 14, color: statusColor, fontWeight: 500 }}>{statusText}</span>
      </div>

      {/* Key Config */}
      <div style={{ background: 'var(--panel-bg)', borderRadius: 12, padding: 24, border: '1px solid var(--border)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
          Gemini API Key
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
          Optional. Leave empty to use platform-provided AI capacity.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Enter your Gemini API key (optional)"
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--input-bg, var(--panel-bg))',
              color: 'var(--text-primary)', fontSize: 14,
            }}
          />
          <button
            onClick={() => setShowKey(!showKey)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
            }}
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleTest}
            disabled={testing}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13,
            }}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {testResult && (
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 8, fontSize: 13,
            background: tintedBg(testResult.ok ? 'var(--success, #34D399)' : 'var(--danger, #F87171)', 15),
            color: testResult.ok ? 'var(--success, #34D399)' : 'var(--danger, #F87171)',
          }}>
            {testResult.message}
          </div>
        )}

        {msg && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--accent)' }}>{msg}</div>}
      </div>
    </div>
  );
}
