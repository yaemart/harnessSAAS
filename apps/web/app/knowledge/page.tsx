'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Globe, BarChart3, Thermometer, Plus, Shield } from 'lucide-react';
import { useAuth } from '../../components/auth-context';
import { tokens, tintedBg } from '../../lib/design-tokens';
import { RoleGuard } from '../../components/guards/role-guard';
import { IronLawBanner } from '../../components/banners/iron-law-banner';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

interface KnowledgeItem {
  id: string;
  domain: string;
  key: string;
  title: string;
  version: number;
  approvedBy: string[];
  isActive: boolean;
}

interface BenchmarkItem {
  industryCategory: string;
  metricKey: string;
  metricValue: number;
  sampleSize: number;
  contributingTenants: number;
}


const COLD_START_PHASES = [
  { phase: 'COLD', range: '< 50', weights: 'A:50% B:40% C:10%', explore: '30%', maxAdj: '5%', color: tokens.color.accent },
  { phase: 'WARMING', range: '50-500', weights: 'A:30% B:30% C:40%', explore: '15%', maxAdj: '8%', color: tokens.color.warning },
  { phase: 'MATURE', range: '> 500', weights: 'A:10% B:20% C:70%', explore: '5%', maxAdj: '12%', color: tokens.color.success },
];

type Tab = 'public' | 'benchmarks' | 'coldstart';

export default function KnowledgePage() {
  const { hasRole, authHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('public');
  const [publicItems, setPublicItems] = useState<KnowledgeItem[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkItem[]>([]);
  const [coldStartConfig, setColdStartConfig] = useState<{ phase: string; experienceCount: number; weights: Record<string, number>; explorationRate: number; maxPriceAdjustPct: number } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/knowledge/public`, { headers: authHeaders })
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((d) => setPublicItems(d.items ?? []))
      .catch(() => setPublicItems([]));

    fetch(`${API_BASE}/knowledge/benchmarks?category=kitchen-appliances`, { headers: authHeaders })
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((d) => setBenchmarks(d.items ?? []))
      .catch(() => setBenchmarks([]));

    fetch(`${API_BASE}/knowledge/cold-start`, { headers: authHeaders })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setColdStartConfig(d))
      .catch(() => setColdStartConfig(null));
  }, [authHeaders]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'public', label: 'Public Knowledge (Layer A)', icon: <Globe size={16} /> },
    { id: 'benchmarks', label: 'Industry Benchmarks (Layer B)', icon: <BarChart3 size={16} /> },
    { id: 'coldstart', label: 'Cold Start Config', icon: <Thermometer size={16} /> },
  ];

  return (
    <RoleGuard allowedRoles={['system_admin']}>
    <main>
      <IronLawBanner />
      <div className="header">
        <div>
          <h1 className="ios-title">Knowledge Layer Console</h1>
          <p className="ios-subtitle">Manage Layer A (public) and Layer B (aggregate) · Harness Layer 7 Evolution</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: tokens.spacing.sectionGap, borderBottom: `1px solid ${tokens.color.border}`, paddingBottom: 0 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              fontSize: tokens.font.size.sm,
              fontWeight: activeTab === tab.id ? tokens.font.weight.semibold : tokens.font.weight.normal,
              color: activeTab === tab.id ? tokens.color.accent : tokens.color.textSecondary,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? `2px solid ${tokens.color.accent}` : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'public' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: tokens.font.size.sm, color: tokens.color.textSecondary }}>
              {publicItems.length} knowledge entries
            </span>
            <button style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: tokens.spacing.buttonPadding,
              background: tokens.color.accent,
              color: '#fff',
              border: 'none',
              borderRadius: tokens.radius.sm,
              fontSize: tokens.font.size.sm,
              fontWeight: tokens.font.weight.medium,
              cursor: 'pointer',
            }}>
              <Plus size={14} />
              Add Entry
            </button>
          </div>

          <div className="ios-card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
                  {['Domain', 'Title', 'Version', 'Approval', 'Status'].map((h) => (
                    <th key={h} style={{
                      padding: tokens.spacing.tableHeaderCell,
                      textAlign: 'left',
                      fontSize: tokens.font.size.xs,
                      fontWeight: tokens.font.weight.semibold,
                      color: tokens.color.textTertiary,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.05em',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {publicItems.map((item) => (
                  <tr key={item.id} style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
                    <td style={{ padding: tokens.spacing.tableBodyCell }}>
                      <span style={{
                        fontSize: tokens.font.size.xs,
                        padding: '2px 8px',
                        borderRadius: tokens.radius.pill,
                        background: tintedBg(tokens.color.accent, 10),
                        color: tokens.color.accent,
                        fontWeight: tokens.font.weight.medium,
                      }}>
                        {item.domain}
                      </span>
                    </td>
                    <td style={{ padding: tokens.spacing.tableBodyCell, fontSize: tokens.font.size.sm, color: tokens.color.textPrimary, fontWeight: tokens.font.weight.medium }}>
                      {item.title}
                    </td>
                    <td style={{ padding: tokens.spacing.tableBodyCell, fontSize: tokens.font.size.sm, color: tokens.color.textSecondary }}>
                      v{item.version}
                    </td>
                    <td style={{ padding: tokens.spacing.tableBodyCell }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Shield size={12} style={{ color: (item.approvedBy?.length ?? 0) >= 2 ? tokens.color.success : tokens.color.warning }} />
                        <span style={{ fontSize: tokens.font.size.xs, color: tokens.color.textSecondary }}>
                          {item.approvedBy?.length ?? 0}/2
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: tokens.spacing.tableBodyCell }}>
                      <span style={{
                        fontSize: tokens.font.size.xs,
                        padding: '2px 8px',
                        borderRadius: tokens.radius.pill,
                        background: tintedBg(item.isActive ? tokens.color.success : tokens.color.warning, 12),
                        color: item.isActive ? tokens.color.success : tokens.color.warning,
                        fontWeight: tokens.font.weight.bold,
                      }}>
                        {item.isActive ? 'Active' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'benchmarks' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <div className="ios-card" style={{ padding: tokens.spacing.cardPaddingCompact, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Shield size={16} style={{ color: tokens.color.warning }} />
              <span style={{ fontSize: tokens.font.size.sm, color: tokens.color.textSecondary }}>
                K-anonymity threshold: minimum 5 contributing tenants. Values include differential privacy noise.
              </span>
            </div>
          </div>

          <div className="ios-card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
                  {['Category', 'Metric', 'Value', 'Samples', 'Tenants'].map((h) => (
                    <th key={h} style={{
                      padding: tokens.spacing.tableHeaderCell,
                      textAlign: 'left',
                      fontSize: tokens.font.size.xs,
                      fontWeight: tokens.font.weight.semibold,
                      color: tokens.color.textTertiary,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.05em',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {benchmarks.map((item, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
                    <td style={{ padding: tokens.spacing.tableBodyCell, fontSize: tokens.font.size.sm, color: tokens.color.textPrimary, fontWeight: tokens.font.weight.medium }}>
                      {item.industryCategory}
                    </td>
                    <td style={{ padding: tokens.spacing.tableBodyCell, fontSize: tokens.font.size.sm, color: tokens.color.textSecondary }}>
                      {item.metricKey}
                    </td>
                    <td style={{ padding: tokens.spacing.tableBodyCell, fontSize: tokens.font.size.sm, fontWeight: tokens.font.weight.semibold, color: tokens.color.textPrimary }}>
                      {item.metricValue}
                    </td>
                    <td style={{ padding: tokens.spacing.tableBodyCell, fontSize: tokens.font.size.sm, color: tokens.color.textSecondary }}>
                      {item.sampleSize}
                    </td>
                    <td style={{ padding: tokens.spacing.tableBodyCell }}>
                      <span style={{
                        fontSize: tokens.font.size.xs,
                        padding: '2px 8px',
                        borderRadius: tokens.radius.pill,
                        background: tintedBg(item.contributingTenants >= 5 ? tokens.color.success : tokens.color.danger, 12),
                        color: item.contributingTenants >= 5 ? tokens.color.success : tokens.color.danger,
                        fontWeight: tokens.font.weight.bold,
                      }}>
                        {item.contributingTenants}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'coldstart' && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {COLD_START_PHASES.map((phase) => (
              <div
                key={phase.phase}
                className="ios-card"
                style={{
                  padding: tokens.spacing.cardPadding,
                  borderLeft: `4px solid ${phase.color}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{
                    fontSize: tokens.font.size.base,
                    fontWeight: tokens.font.weight.bold,
                    color: phase.color,
                  }}>
                    {phase.phase}
                  </span>
                  <span style={{
                    fontSize: tokens.font.size.xs,
                    padding: '2px 8px',
                    borderRadius: tokens.radius.pill,
                    background: tintedBg(phase.color, 12),
                    color: phase.color,
                    fontWeight: tokens.font.weight.medium,
                  }}>
                    {phase.range} experiences
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: tokens.font.size.xs, color: tokens.color.textTertiary, marginBottom: 4 }}>Knowledge Weights</div>
                    <div style={{ fontSize: tokens.font.size.sm, fontWeight: tokens.font.weight.semibold, color: tokens.color.textPrimary }}>{phase.weights}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: tokens.font.size.xs, color: tokens.color.textTertiary, marginBottom: 4 }}>Exploration Rate</div>
                    <div style={{ fontSize: tokens.font.size.sm, fontWeight: tokens.font.weight.semibold, color: tokens.color.textPrimary }}>{phase.explore}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: tokens.font.size.xs, color: tokens.color.textTertiary, marginBottom: 4 }}>Max Price Adjust</div>
                    <div style={{ fontSize: tokens.font.size.sm, fontWeight: tokens.font.weight.semibold, color: tokens.color.textPrimary }}>{phase.maxAdj}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
    </RoleGuard>
  );
}
