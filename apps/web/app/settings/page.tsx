'use client';

import { useState } from 'react';
import { SettingsIntegrations } from '../../components/settings-integrations';
import { SettingsPrimitives } from '../../components/settings-primitives';
import { SettingsAi } from '../../components/settings-ai';
import { SettingsSubscription } from '../../components/settings-subscription';
import { RoleGuard } from '../../components/guards/role-guard';

type SettingsSection = 'integrations' | 'primitives' | 'ai' | 'subscription';

export default function SettingsPage() {
    const [section, setSection] = useState<SettingsSection>('integrations');

    const SECTIONS: { key: SettingsSection; label: string; description: string }[] = [
        { key: 'integrations', label: 'Integrations', description: 'Manage platform connections, 3PL, warehouses, and ERP systems' },
        { key: 'primitives', label: 'Business Primitives', description: 'Configure markets, categories, brands, and suppliers' },
        { key: 'ai', label: 'AI Integrations', description: 'Manage LLM providers, model selection, and Vertex AI / Gemini keys' },
        { key: 'subscription', label: 'Subscription', description: 'View your plan, AI quota usage, and upgrade or downgrade' },
    ];

    return (
        <RoleGuard allowedRoles={['tenant_admin']}>
        <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
            {/* Page Header */}
            <div style={{ marginBottom: 32 }}>
                <h1 style={{
                    fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em',
                    color: 'var(--text-primary)', margin: 0,
                }}>
                    Settings
                    <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 12, opacity: 0.6 }}>
                        Diagnostic v2.3
                    </span>
                </h1>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>
                    Configure your tenant&apos;s business primitives and external integrations
                </p>
            </div>

            {/* Section Switcher */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
                {SECTIONS.map((s) => (
                    <button
                        key={s.key}
                        title={`Navigate to ${s.label}`}
                        onClick={() => setSection(s.key)}
                        style={{
                            flex: 1,
                            padding: '16px 20px',
                            borderRadius: 'var(--border-radius-md)',
                            border: section === s.key ? '2px solid var(--accent)' : '1px solid var(--panel-border)',
                            background: section === s.key ? 'rgba(0, 122, 255, 0.06)' : 'var(--panel-bg)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s',
                        }}
                    >
                        <div style={{
                            fontWeight: 600, fontSize: 15,
                            color: section === s.key ? 'var(--accent)' : 'var(--text-primary)',
                        }}>
                            {s.label}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                            {s.description}
                        </div>
                    </button>
                ))}
            </div>

            {/* Active Section */}
            {section === 'integrations' ? <SettingsIntegrations /> :
                section === 'primitives' ? <SettingsPrimitives /> :
                section === 'subscription' ? <SettingsSubscription /> :
                    <SettingsAi />}
        </div>
        </RoleGuard>
    );
}
