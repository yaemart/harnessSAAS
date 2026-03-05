'use client';

import { Bot, Brain, Eye, Radio, Cpu, Shield, Lock, Sparkles } from 'lucide-react';
import { useAuth } from '../../components/auth-context';
import { tintedBg } from '../../lib/design-tokens';
import { RoleGuard } from '../../components/guards/role-guard';
import { IronLawBanner } from '../../components/banners/iron-law-banner';

interface LayerMetric {
  label: string;
  value: string | number;
}

interface HarnessLayer {
  number: number;
  name: string;
  icon: React.ReactNode;
  status: 'Healthy' | 'Degraded' | 'Down';
  metrics: LayerMetric[];
}

const LAYERS: HarnessLayer[] = [
  {
    number: 7,
    name: 'Evolution Layer',
    icon: <Sparkles size={18} />,
    status: 'Healthy',
    metrics: [
      { label: 'Experiences stored', value: '2,847' },
      { label: 'Avg quality score', value: '0.82' },
    ],
  },
  {
    number: 6,
    name: 'Observation Layer',
    icon: <Eye size={18} />,
    status: 'Healthy',
    metrics: [
      { label: 'Active traces', value: 342 },
      { label: 'Avg response time', value: '124ms' },
    ],
  },
  {
    number: 5,
    name: 'Collaboration Layer',
    icon: <Radio size={18} />,
    status: 'Healthy',
    metrics: [
      { label: 'SSE connections', value: '1,247' },
      { label: 'Events/min', value: 856 },
    ],
  },
  {
    number: 4,
    name: 'Execution Layer',
    icon: <Cpu size={18} />,
    status: 'Healthy',
    metrics: [
      { label: 'Platform adapters registered', value: 4 },
      { label: 'Success rate', value: '99.2%' },
    ],
  },
  {
    number: 3,
    name: 'Constraint Layer',
    icon: <Shield size={18} />,
    status: 'Healthy',
    metrics: [
      { label: 'Active constitution rules', value: 23 },
      { label: 'Violations today', value: 0 },
    ],
  },
  {
    number: 2,
    name: 'Cognition Layer',
    icon: <Brain size={18} />,
    status: 'Healthy',
    metrics: [
      { label: 'Agent decisions today', value: '1,204' },
      { label: 'Avg confidence', value: '0.87' },
    ],
  },
  {
    number: 1,
    name: 'Foundation Layer',
    icon: <Lock size={18} />,
    status: 'Healthy',
    metrics: [
      { label: 'Active tenants', value: 5 },
      { label: 'Auth mode', value: 'JWT + RBAC' },
    ],
  },
];

const STATUS_COLORS: Record<string, string> = {
  Healthy: 'var(--success)',
  Degraded: 'var(--warning)',
  Down: 'var(--danger)',
};

function layerBorderColor(layerNumber: number): string {
  if (layerNumber >= 6) return 'var(--success)';
  if (layerNumber >= 4) return 'var(--accent)';
  if (layerNumber >= 2) return 'var(--warning)';
  return 'var(--accent)';
}

export default function HarnessPage() {
  return (
    <RoleGuard allowedRoles={['system_admin']}>
    <main>
      <IronLawBanner />
      <div className="header">
        <div>
          <h1 className="ios-title">Harness Monitor</h1>
          <p className="ios-subtitle">7-layer architecture health &amp; diagnostics</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {LAYERS.map((layer) => {
          const borderColor = layerBorderColor(layer.number);
          const statusColor = STATUS_COLORS[layer.status];

          return (
            <div
              key={layer.number}
              className="ios-card"
              style={{
                padding: '20px 24px',
                borderLeft: `4px solid ${borderColor}`,
                display: 'flex',
                alignItems: 'center',
                gap: 20,
              }}
            >
              <div style={{
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--border-radius-md)',
                background: tintedBg(borderColor, 10),
                color: borderColor,
                flexShrink: 0,
              }}>
                {layer.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    Layer {layer.number}
                  </span>
                  <span style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}>
                    {layer.name}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  {layer.metrics.map((m) => (
                    <div key={m.label} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{m.label}:</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {m.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <span style={{
                padding: '3px 10px',
                borderRadius: '999px',
                background: tintedBg(statusColor, 12),
                color: statusColor,
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {layer.status}
              </span>
            </div>
          );
        })}
      </div>
    </main>
    </RoleGuard>
  );
}
