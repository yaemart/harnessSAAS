'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth-context';
import { tintedBg } from '../../lib/design-tokens';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

type WorkTypeMeta = {
  label: string;
  description: string;
  available: boolean;
};

type PlatformConfig = {
  geminiKeySet: boolean;
  envKeySet: boolean;
  modelId: string | null;
  models: Record<string, string>;
  defaultModels: Record<string, string>;
  workTypes: Record<string, WorkTypeMeta>;
};

export function PlatformProvider() {
  const { authHeaders } = useAuth();
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [msg, setMsg] = useState('');

  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [modelOverrides, setModelOverrides] = useState<Record<string, string>>({});

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/platform/ai/config`, { headers: authHeaders });
      if (!res.ok) return;
      const data: PlatformConfig = await res.json();
      setConfig(data);
      setKeyInput(data.geminiKeySet ? '****' : '');
      setModelOverrides(data.models ?? {});
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      const body: Record<string, unknown> = { models: modelOverrides };
      if (keyInput && !keyInput.includes('****')) {
        body.geminiKey = keyInput;
      }
      const res = await fetch(`${API_BASE}/platform/ai/config`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setMsg('Configuration saved');
        loadConfig();
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
      const body: Record<string, string> = {};
      if (keyInput && !keyInput.includes('****')) {
        body.geminiKey = keyInput;
      }
      const res = await fetch(`${API_BASE}/platform/ai/test`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setTestResult({
        ok: data.ok,
        message: data.ok ? `Connected — ${data.model}` : (data.error ?? 'Failed'),
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Loading...</div>;
  if (!config) return <div style={{ padding: 24, color: 'var(--danger)' }}>Failed to load config</div>;

  const allWorkTypes = Object.entries(config.workTypes) as [string, WorkTypeMeta][];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* API Key Section */}
      <div style={{ background: 'var(--panel-bg)', borderRadius: 12, padding: 24, border: '1px solid var(--border)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
          Platform Gemini API Key
        </h3>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Enter platform API key"
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

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13,
            color: 'var(--text-secondary)',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: config.envKeySet ? 'var(--success, #34D399)' : 'var(--text-muted, #666)',
            }} />
            env.GEMINI_API_KEY: {config.envKeySet ? 'Set' : 'Not set'}
          </span>
          {config.geminiKeySet && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13,
              color: 'var(--text-secondary)',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
              Platform DB key: Set
            </span>
          )}
        </div>

        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
          This key is the fallback for tenants without their own BYOK key.
          The env variable is read-only; override it here or via .env.
        </p>

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

        {msg && (
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--accent)' }}>{msg}</div>
        )}
      </div>

      {/* System Default Models */}
      <div style={{ background: 'var(--panel-bg)', borderRadius: 12, padding: 24, border: '1px solid var(--border)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
          System Default Models
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
          Default model for each WorkType. Tenants can override these per their configuration.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {allWorkTypes.map(([wt, meta]) => {
            const systemDefault = config.defaultModels[wt] ?? 'gemini-2.5-flash';
            const currentOverride = modelOverrides[wt] ?? '';
            return (
              <div key={wt} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8,
                background: tintedBg('var(--text-primary)', 3),
                opacity: meta.available ? 1 : 0.6,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {meta.label}
                    </span>
                    {!meta.available && (
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
                    {meta.description}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 220 }}>
                  <select
                    value={currentOverride || systemDefault}
                    onChange={(e) => {
                      const val = e.target.value;
                      setModelOverrides((prev) => {
                        const next = { ...prev };
                        if (val === systemDefault) {
                          delete next[wt];
                        } else {
                          next[wt] = val;
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
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-3.1-pro">Gemini 3.1 Pro</option>
                    <option value="gemini-3.0">Gemini 3.0</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13,
            }}
          >
            {saving ? 'Saving...' : 'Save Defaults'}
          </button>
        </div>
      </div>
    </div>
  );
}
