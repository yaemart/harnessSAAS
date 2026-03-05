'use client';

import { useState } from 'react';
import { Megaphone, TrendingUp, TrendingDown, Pause, Play, AlertTriangle, Zap, DollarSign, BarChart3 } from 'lucide-react';
import { tintedBg } from '../../lib/design-tokens';
import { RoleGuard } from '../../components/guards/role-guard';
import { IronLawBanner } from '../../components/banners/iron-law-banner';

type Platform = 'All' | 'Amazon US' | 'Amazon DE' | 'Shopify' | 'TikTok';

interface AdCampaign {
  id: string;
  name: string;
  platform: Exclude<Platform, 'All'>;
  product: string;
  status: 'active' | 'paused' | 'learning';
  spend7d: number;
  roas: number;
  roasTrend: 'up' | 'down' | 'flat';
  acos: number;
  impressions: number;
  clicks: number;
  agentNote?: string;
  confidence?: number;
}

const CAMPAIGNS: AdCampaign[] = [
  { id: 'C-001', name: 'Auto Top-of-Search', platform: 'Amazon US', product: 'BT Headphones X1', status: 'active', spend7d: 840, roas: 4.8, roasTrend: 'up', acos: 20.8, impressions: 42000, clicks: 1260, agentNote: 'ROAS +11% after bid adjustment', confidence: 88 },
  { id: 'C-002', name: 'EU Competitor Defense', platform: 'Amazon DE', product: 'BT Headphones X1', status: 'active', spend7d: 520, roas: 2.1, roasTrend: 'down', acos: 47.6, impressions: 28000, clicks: 560, agentNote: 'ROAS declining — recommend pausing 3 keywords', confidence: 82 },
  { id: 'C-003', name: 'Brand Awareness', platform: 'TikTok', product: 'Face Serum 30ml', status: 'learning', spend7d: 300, roas: 1.4, roasTrend: 'up', acos: 71.4, impressions: 180000, clicks: 3600 },
  { id: 'C-004', name: 'Retargeting', platform: 'Shopify', product: 'Yoga Mat Ultra', status: 'active', spend7d: 180, roas: 7.1, roasTrend: 'up', acos: 14.1, impressions: 12000, clicks: 480, agentNote: 'Top performer — consider 20% budget increase', confidence: 91 },
  { id: 'C-005', name: 'Product Launch', platform: 'Amazon US', product: 'LED Desk Lamp Pro', status: 'paused', spend7d: 0, roas: 0, roasTrend: 'flat', acos: 0, impressions: 0, clicks: 0, agentNote: 'Paused by AdAgent — ROAS below 1.0x threshold', confidence: 95 },
  { id: 'C-006', name: 'Holiday Push', platform: 'Amazon DE', product: 'Yoga Mat Ultra', status: 'active', spend7d: 420, roas: 3.2, roasTrend: 'flat', acos: 31.3, impressions: 35000, clicks: 1050 },
];

const STATUS_STYLES: Record<AdCampaign['status'], { bg: string; color: string; label: string }> = {
  active: { bg: tintedBg('var(--success)', 12), color: 'var(--success)', label: 'ACTIVE' },
  paused: { bg: tintedBg('var(--text-tertiary)', 12), color: 'var(--text-tertiary)', label: 'PAUSED' },
  learning: { bg: tintedBg('var(--warning)', 12), color: 'var(--warning)', label: 'LEARNING' },
};

export default function AdsPage() {
  const [platformFilter, setPlatformFilter] = useState<Platform>('All');
  const filtered = platformFilter === 'All' ? CAMPAIGNS : CAMPAIGNS.filter(c => c.platform === platformFilter);

  const totalSpend = filtered.reduce((s, c) => s + c.spend7d, 0);
  const totalRevenue = filtered.reduce((s, c) => s + c.spend7d * c.roas, 0);
  const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const agentSuggestions = filtered.filter(c => c.agentNote).length;

  return (
    <RoleGuard allowedRoles={['tenant_admin', 'operator']}>
    <main>
      <IronLawBanner />
      <div className="header">
        <div>
          <h1 className="ios-title">Ads Center</h1>
          <p className="ios-subtitle">Cross-platform ad management · Layer 3 Tools</p>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Spend (7d)', value: `$${totalSpend.toLocaleString()}`, icon: <DollarSign size={16} /> },
          { label: 'Avg ROAS', value: `${avgRoas.toFixed(1)}x`, icon: <BarChart3 size={16} /> },
          { label: 'Agent Suggestions', value: String(agentSuggestions), icon: <Zap size={16} /> },
          { label: 'Active Campaigns', value: String(filtered.filter(c => c.status === 'active').length), icon: <Play size={16} /> },
        ].map((kpi) => (
          <div key={kpi.label} className="ios-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ color: 'var(--accent)' }}>{kpi.icon}</div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Platform Filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: tintedBg('var(--panel-bg-secondary)', 50), padding: 4, borderRadius: '999px', width: 'fit-content' }}>
        {(['All', 'Amazon US', 'Amazon DE', 'Shopify', 'TikTok'] as Platform[]).map((p) => {
          const active = platformFilter === p;
          return (
            <button key={p} onClick={() => setPlatformFilter(p)} style={{
              padding: '8px 16px', borderRadius: '999px', border: 'none',
              background: active ? tintedBg('var(--accent)', 18) : 'transparent',
              color: active ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer',
            }}>{p}</button>
          );
        })}
      </div>

      {/* Campaign List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map((campaign) => {
          const statusStyle = STATUS_STYLES[campaign.status];
          return (
            <div key={campaign.id} className="ios-card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{campaign.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: statusStyle.bg, color: statusStyle.color }}>{statusStyle.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {campaign.platform} · {campaign.product}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ROAS</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: campaign.roas >= 3 ? 'var(--success)' : campaign.roas >= 1 ? 'var(--warning)' : 'var(--danger)' }}>
                      {campaign.roas.toFixed(1)}x
                    </span>
                    {campaign.roasTrend === 'up' && <TrendingUp size={14} style={{ color: 'var(--success)' }} />}
                    {campaign.roasTrend === 'down' && <TrendingDown size={14} style={{ color: 'var(--danger)' }} />}
                  </div>
                </div>
              </div>

              {/* Metrics Row */}
              <div style={{ display: 'flex', gap: 24, marginBottom: campaign.agentNote ? 12 : 0 }}>
                {[
                  { label: 'Spend (7d)', value: `$${campaign.spend7d.toLocaleString()}` },
                  { label: 'ACoS', value: `${campaign.acos}%` },
                  { label: 'Impressions', value: campaign.impressions.toLocaleString() },
                  { label: 'Clicks', value: campaign.clicks.toLocaleString() },
                  { label: 'CTR', value: campaign.impressions > 0 ? `${((campaign.clicks / campaign.impressions) * 100).toFixed(1)}%` : '—' },
                ].map((m) => (
                  <div key={m.label}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Agent Note */}
              {campaign.agentNote && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: 'var(--border-radius-sm)',
                  background: tintedBg('var(--accent)', 6),
                  borderLeft: '3px solid var(--accent)',
                }}>
                  <Zap size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>{campaign.agentNote}</span>
                  {campaign.confidence != null && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                      {campaign.confidence}% conf
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
    </RoleGuard>
  );
}
