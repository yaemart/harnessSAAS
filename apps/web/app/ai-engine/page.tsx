'use client';

import { useState } from 'react';
import { RoleGuard } from '../../components/guards/role-guard';
import { ProviderConfig } from '../../components/ai-engine/provider-config';
import { ModelRouting } from '../../components/ai-engine/model-routing';
import { AccessPolicy } from '../../components/ai-engine/access-policy';
import { UsageQuota } from '../../components/ai-engine/usage-quota';

const TABS = [
  { key: 'provider', label: 'Provider Config' },
  { key: 'routing', label: 'Model Routing' },
  { key: 'policy', label: 'Access Policy' },
  { key: 'usage', label: 'Usage & Plan' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function AiEnginePage() {
  const [tab, setTab] = useState<TabKey>('provider');

  return (
    <RoleGuard allowedRoles={['tenant_admin']}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
          AI Engine
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--text-secondary)' }}>
          Configure your tenant&apos;s AI provider, model routing, access policies, and usage plan.
        </p>

        <div style={{ display: 'flex', gap: 4, marginBottom: 24, flexWrap: 'wrap' }}>
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

        {tab === 'provider' && <ProviderConfig />}
        {tab === 'routing' && <ModelRouting />}
        {tab === 'policy' && <AccessPolicy />}
        {tab === 'usage' && <UsageQuota />}
      </div>
    </RoleGuard>
  );
}
