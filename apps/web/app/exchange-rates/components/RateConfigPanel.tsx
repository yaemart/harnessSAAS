'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, Eye, EyeOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../components/auth-context';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

interface Config {
  id: string;
  provider: string;
  apiUrl?: string;
  baseCurrency: string;
  enabled: boolean;
}

type SaveState = 'idle' | 'saving' | 'ok' | 'error';
type SyncState = 'idle' | 'syncing' | 'ok' | 'error';

export function RateConfigPanel() {
  const { authHeaders } = useAuth();
  const [config, setConfig] = useState<Config | null>(null);
  const [provider, setProvider] = useState('openexchangerates');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [enabled, setEnabled] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncMsg, setSyncMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/exchange-rates/config`, { headers: authHeaders })
      .then((r) => r.json())
      .then((d: Config | null) => {
        if (d) {
          setConfig(d);
          setProvider(d.provider);
          setBaseCurrency(d.baseCurrency);
          setEnabled(d.enabled);
          if (d.apiUrl) setApiUrl(d.apiUrl);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaveState('saving');
    try {
      const res = await fetch(`${API}/exchange-rates/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          provider,
          ...(apiKey ? { apiKey } : {}),
          ...(apiUrl ? { apiUrl } : {}),
          baseCurrency,
          enabled,
        }),
      });
      if (!res.ok) throw new Error();
      const d: Config = await res.json();
      setConfig(d);
      setApiKey('');
      setSaveState('ok');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  const handleSync = async () => {
    setSyncState('syncing');
    setSyncMsg('');
    try {
      const res = await fetch(`${API}/exchange-rates/sync`, {
        method: 'POST',
        headers: { ...authHeaders },
      });
      const d = await res.json() as { ok: boolean; inserted?: number; date?: string; error?: string };
      if (d.ok) {
        setSyncMsg(`Synced ${d.inserted} currency pairs for ${d.date}`);
        setSyncState('ok');
      } else {
        setSyncMsg(d.error ?? 'Sync failed');
        setSyncState('error');
      }
    } catch {
      setSyncMsg('Network error');
      setSyncState('error');
    }
    setTimeout(() => { setSyncState('idle'); setSyncMsg(''); }, 5000);
  };

  const panelStyle: React.CSSProperties = {
    background: 'var(--panel-bg)',
    border: '1px solid var(--panel-border)',
    borderRadius: 'var(--border-radius-lg)',
    padding: 24,
    boxShadow: 'var(--panel-shadow)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 6,
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 'var(--border-radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <Settings size={16} color="var(--accent)" />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>API Configuration</span>
        {config && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>
            Last saved config: {config.provider} / {config.baseCurrency}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            style={{ ...inputStyle }}
          >
            <option value="openexchangerates">Open Exchange Rates</option>
            <option value="fixer">Fixer.io</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Base Currency</label>
          <input
            style={inputStyle}
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value.toUpperCase())}
            maxLength={3}
            placeholder="USD"
          />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 8 }}>
            <input
              type="checkbox"
              id="er-enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
            />
            <label htmlFor="er-enabled" style={{ fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
              Enabled
            </label>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>API Key</label>
        <div style={{ position: 'relative' }}>
          <input
            style={{ ...inputStyle, paddingRight: 40 }}
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config ? 'Enter new key to update (leave blank to keep current)' : 'Enter API key'}
          />
          <button
            onClick={() => setShowKey(!showKey)}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}
          >
            {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      {provider === 'custom' && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Custom API URL</label>
          <input
            style={inputStyle}
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://api.example.com/latest?key={API_KEY}&base={BASE}"
          />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, display: 'block' }}>
            Use {'{API_KEY}'} and {'{BASE}'} as placeholders
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={handleSave}
          disabled={saveState === 'saving'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px',
            borderRadius: 'var(--border-radius-md)',
            border: 'none',
            background: saveState === 'ok' ? 'var(--success)' : saveState === 'error' ? 'var(--danger)' : 'var(--accent)',
            color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: saveState === 'saving' ? 'wait' : 'pointer',
          }}
        >
          {saveState === 'ok' ? <CheckCircle size={14} /> : saveState === 'error' ? <AlertCircle size={14} /> : <Save size={14} />}
          {saveState === 'saving' ? 'Saving...' : saveState === 'ok' ? 'Saved' : saveState === 'error' ? 'Failed' : 'Save Config'}
        </button>

        <button
          onClick={handleSync}
          disabled={syncState === 'syncing'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px',
            borderRadius: 'var(--border-radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--panel-bg)',
            color: syncState === 'ok' ? 'var(--success)' : syncState === 'error' ? 'var(--danger)' : 'var(--text-primary)',
            fontSize: 13, cursor: syncState === 'syncing' ? 'wait' : 'pointer',
          }}
        >
          <RefreshCw size={14} style={{ animation: syncState === 'syncing' ? 'spin 1s linear infinite' : 'none' }} />
          {syncState === 'syncing' ? 'Syncing...' : 'Manual Sync'}
        </button>

        {syncMsg && (
          <span style={{ fontSize: 12, color: syncState === 'error' ? 'var(--danger)' : 'var(--success)' }}>
            {syncMsg}
          </span>
        )}
      </div>
    </div>
  );
}
