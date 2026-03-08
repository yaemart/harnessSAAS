'use client';

import { useState } from 'react';
import { RoleGuard } from '../../components/guards/role-guard';
import { PlatformProvider } from '../../components/platform-ai/platform-provider';
import { ModelCatalog } from '../../components/platform-ai/model-catalog';

const TABS = [
  { key: 'provider', label: 'Provider & Defaults' },
  { key: 'catalog', label: 'Model Catalog' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function PlatformAiPage() {
  const [tab, setTab] = useState<TabKey>('provider');

  return (
    <RoleGuard allowedRoles={['system_admin']}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
          AI Platform Config
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--text-secondary)' }}>
          Manage platform-level AI provider, default models, and model catalog.
        </p>

        <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: tab === t.key ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: tab === t.key ? 'var(--accent)' : 'transparent',
                color: tab === t.key ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'provider' && <PlatformProvider />}
        {tab === 'catalog' && <ModelCatalog />}
      </div>
    </RoleGuard>
  );
}
