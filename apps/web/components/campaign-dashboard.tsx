'use client';

import { useState } from 'react';
import { useTenant } from './tenant-context';
import { Card, PageHeader, StatBadge, Badge } from './ui';
import { ShoppingCart, Package } from 'lucide-react';

const AMAZON_CAMPAIGNS = [
    { id: 'CAM-AMZ-101', name: 'US Auto Top-of-Search', strategy: 'Growth', bidCap: '$2.50', spend: 450, roas: 3.2, status: 'ACTIVE' },
    { id: 'CAM-AMZ-102', name: 'EU Competitor Defense', strategy: 'Defensive', bidCap: '$1.80', spend: 89, roas: 1.5, status: 'LEARNING' },
];

const WALMART_CAMPAIGNS = [
    { id: 'CAM-WLM-401', name: 'WFS Grocery Top', strategy: 'Inventory Protection', bidCap: '$1.00', spend: 120, roas: 4.1, status: 'ACTIVE' },
];

export function CampaignDashboard() {
    const { currentTenant } = useTenant();
    const [platform, setPlatform] = useState<'amazon' | 'walmart'>('amazon');

    return (
        <main>
            <PageHeader
                title="Platform Campaigns"
                subtitle={`Platform Execution Sub-Services (Low Concentration) · ${currentTenant?.name}`}
            />

            <div style={{ marginBottom: 24, paddingBottom: 16 }}>
                <p className="small" style={{ color: 'var(--text-secondary)' }}>
                    Architecture Enforced: <strong>Decentralization Mode</strong>. There is no unified campaign table.
                    Amazon and Walmart execution services (Low Concentration) communicate directly with the core MDM via asynchronous Event Bus (Kafka/Pulsar).
                </p>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                <button
                    onClick={() => setPlatform('amazon')}
                    title="View Amazon Advertising Campaigns"
                    style={{
                        padding: '12px 24px',
                        border: platform === 'amazon' ? '2px solid var(--accent)' : '1px solid var(--sidebar-border)',
                        background: platform === 'amazon' ? 'rgba(194, 159, 109, 0.1)' : 'var(--panel-bg)',
                        borderRadius: 'var(--border-radius-sm)',
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontWeight: 600
                    }}
                >
                    <ShoppingCart size={18} color={platform === 'amazon' ? 'var(--accent)' : 'var(--text-secondary)'} />
                    Amazon Ads Service
                </button>
                <button
                    onClick={() => setPlatform('walmart')}
                    title="View Walmart Connect Campaigns"
                    style={{
                        padding: '12px 24px',
                        border: platform === 'walmart' ? '2px solid var(--accent)' : '1px solid var(--sidebar-border)',
                        background: platform === 'walmart' ? 'rgba(194, 159, 109, 0.1)' : 'var(--panel-bg)',
                        borderRadius: 'var(--border-radius-sm)',
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontWeight: 600
                    }}
                >
                    <Package size={18} color={platform === 'walmart' ? 'var(--accent)' : 'var(--text-secondary)'} />
                    Walmart Connect Service
                </button>
            </div>

            {platform === 'amazon' && (
                <Card style={{ padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <h3 style={{ margin: 0 }}>Amazon Sponsored Campaigns</h3>
                        <Badge variant="info">Subscribing to: topic/agent-decisions/amazon</Badge>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                        <StatBadge label="Total Spend (7d)" value="$539.00" />
                        <StatBadge label="Agg. ROAS" value="2.9x" trend="Trending up" />
                        <StatBadge label="Agent Adjustments" value="231" />
                        <StatBadge label="API Rate Limit" value="98%" trendColor="var(--success)" trend="Healthy" />
                    </div>

                    <table style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Campaign ID</th>
                                <th>Name</th>
                                <th>Supervisor Strategy</th>
                                <th>Bid Cap</th>
                                <th>Spend / ROAS</th>
                                <th>Engine State</th>
                            </tr>
                        </thead>
                        <tbody>
                            {AMAZON_CAMPAIGNS.map(c => (
                                <tr key={c.id}>
                                    <td className="small" style={{ fontFamily: 'monospace' }}>{c.id}</td>
                                    <td><strong>{c.name}</strong></td>
                                    <td><span className="small">{c.strategy}</span></td>
                                    <td>{c.bidCap}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 12 }}>
                                            <span>${c.spend}</span>
                                            <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{c.roas}x</span>
                                        </div>
                                    </td>
                                    <td>
                                        <Badge variant={c.status === 'ACTIVE' ? 'success' : 'warning'}>{c.status}</Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            {platform === 'walmart' && (
                <Card style={{ padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <h3 style={{ margin: 0 }}>Walmart Sponsored Campaigns</h3>
                        <Badge variant="warning">Subscribing to: topic/agent-decisions/walmart</Badge>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                        <StatBadge label="Total Spend (7d)" value="$120.00" />
                        <StatBadge label="Agg. ROAS" value="4.1x" />
                        <StatBadge label="Agent Adjustments" value="45" />
                        <StatBadge label="API Rate Limit" value="99%" trendColor="var(--success)" trend="Healthy" />
                    </div>

                    <table style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Campaign ID</th>
                                <th>Name</th>
                                <th>Supervisor Strategy</th>
                                <th>Bid Cap</th>
                                <th>Spend / ROAS</th>
                                <th>Engine State</th>
                            </tr>
                        </thead>
                        <tbody>
                            {WALMART_CAMPAIGNS.map(c => (
                                <tr key={c.id}>
                                    <td className="small" style={{ fontFamily: 'monospace' }}>{c.id}</td>
                                    <td><strong>{c.name}</strong></td>
                                    <td><span className="small">{c.strategy}</span></td>
                                    <td>{c.bidCap}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 12 }}>
                                            <span>${c.spend}</span>
                                            <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{c.roas}x</span>
                                        </div>
                                    </td>
                                    <td>
                                        <Badge variant={c.status === 'ACTIVE' ? 'success' : 'warning'}>{c.status}</Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}
        </main>
    );
}
