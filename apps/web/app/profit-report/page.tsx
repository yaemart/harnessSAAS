'use client';

import { useState } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Percent, BarChart3, Bot,
} from 'lucide-react';
import { useAuth } from '../../components/auth-context';
import { tintedBg } from '../../lib/design-tokens';
import { RoleGuard } from '../../components/guards/role-guard';
import { IronLawBanner } from '../../components/banners/iron-law-banner';

type DateRange = '7d' | '30d' | '90d';

const DATE_LABELS: Record<DateRange, string> = {
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
};

const COST_BREAKDOWN = [
  { name: 'Referral Fee', amount: 38400, pctOfRevenue: 15.2 },
  { name: 'FBA Fee', amount: 31200, pctOfRevenue: 12.4 },
  { name: 'Storage', amount: 8900, pctOfRevenue: 3.5 },
  { name: 'Inbound Shipping', amount: 6200, pctOfRevenue: 2.5 },
  { name: 'Returns', amount: 5100, pctOfRevenue: 2.0 },
  { name: 'FX Loss', amount: 3400, pctOfRevenue: 1.3 },
  { name: 'VAT', amount: 12800, pctOfRevenue: 5.1 },
  { name: 'Ad Spend', amount: 22500, pctOfRevenue: 8.9 },
];

const TOP_PROFITABLE = [
  { name: 'Organic Face Serum 30ml', sku: 'SKU-7756', profit: 28400, margin: 42.1 },
  { name: 'Premium Yoga Mat Set', sku: 'SKU-1192', profit: 18200, margin: 31.2 },
  { name: 'Stainless Steel Water Bottle', sku: 'SKU-5501', profit: 14600, margin: 26.7 },
  { name: 'Wireless Headphones', sku: 'SKU-4821', profit: 12800, margin: 22.4 },
  { name: 'Smart LED Desk Lamp', sku: 'SKU-3344', profit: 8100, margin: 18.9 },
];

const BOTTOM_PROFITABLE = [
  { name: 'Kids Building Blocks 500pc', sku: 'SKU-2289', profit: 1200, margin: 8.3 },
  { name: 'Phone Case Bundle', sku: 'SKU-9912', profit: 2400, margin: 9.1 },
  { name: 'USB-C Hub Adapter', sku: 'SKU-6634', profit: 3100, margin: 10.4 },
  { name: 'Silicone Baking Set', sku: 'SKU-8847', profit: 3800, margin: 11.2 },
  { name: 'Travel Neck Pillow', sku: 'SKU-4455', profit: 4200, margin: 12.8 },
];

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  borderBottom: '1px solid var(--border-color)',
  color: 'var(--text-secondary)',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderBottom: '1px solid var(--border-color)',
  fontSize: 13,
  color: 'var(--text-primary)',
};

export default function ProfitReportPage() {
  const { hasRole } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const totalRevenue = 252400;
  const totalCost = 128500;
  const grossProfit = totalRevenue - totalCost;
  const netMargin = ((grossProfit / totalRevenue) * 100);

  const summaryCards = [
    { label: 'Total Revenue', value: `$${(totalRevenue / 1000).toFixed(1)}K`, icon: <DollarSign size={18} />, color: 'var(--accent)' },
    { label: 'Total Cost', value: `$${(totalCost / 1000).toFixed(1)}K`, icon: <TrendingDown size={18} />, color: 'var(--danger)' },
    { label: 'Gross Profit', value: `$${(grossProfit / 1000).toFixed(1)}K`, icon: <TrendingUp size={18} />, color: 'var(--success)' },
    { label: 'Net Margin', value: `${netMargin.toFixed(1)}%`, icon: <Percent size={18} />, color: 'var(--success)' },
  ];

  const formatCurrency = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(0)}`;

  return (
    <RoleGuard allowedRoles={['tenant_admin', 'operator']}>
    <main>
      <IronLawBanner />
      <div className="header">
        <div>
          <h1 className="ios-title">Profit Report</h1>
          <p className="ios-subtitle">Financial performance analysis · Layer 3 Tools</p>
        </div>
      </div>

      {/* Date Range Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: tintedBg('var(--panel-bg-secondary)', 50), padding: 4, borderRadius: '999px', width: 'fit-content' }}>
        {(Object.keys(DATE_LABELS) as DateRange[]).map((range) => {
          const active = dateRange === range;
          return (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              style={{
                padding: '8px 20px',
                borderRadius: '999px',
                border: 'none',
                background: active ? tintedBg('var(--accent)', 18) : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {DATE_LABELS[range]}
            </button>
          );
        })}
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {summaryCards.map((card) => (
          <div key={card.label} className="ios-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{
                padding: 6,
                background: tintedBg(card.color, 10),
                color: card.color,
                borderRadius: 'var(--border-radius-md)',
              }}>
                {card.icon}
              </div>
              <span className="small" style={{ color: 'var(--text-secondary)' }}>{card.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Cost Breakdown */}
      <div className="ios-card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
          Cost Breakdown
        </h2>
        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Component</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>% of Revenue</th>
                <th style={{ ...thStyle, textAlign: 'left', width: '30%' }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {COST_BREAKDOWN.map((row) => (
                <tr key={row.name}>
                  <td style={tdStyle}>{row.name}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatCurrency(row.amount)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-secondary)' }}>{row.pctOfRevenue}%</td>
                  <td style={{ ...tdStyle }}>
                    <div style={{
                      height: 6,
                      borderRadius: '999px',
                      background: tintedBg('var(--border-color)', 30),
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(row.pctOfRevenue * 4, 100)}%`,
                        borderRadius: '999px',
                        background: row.pctOfRevenue > 10 ? 'var(--danger)' : row.pctOfRevenue > 5 ? 'var(--warning)' : 'var(--accent)',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top / Bottom Profitable */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <ProfitTable title="Top 5 Most Profitable" icon={<TrendingUp size={16} />} data={TOP_PROFITABLE} color="var(--success)" formatCurrency={formatCurrency} />
        <ProfitTable title="Bottom 5 Least Profitable" icon={<TrendingDown size={16} />} data={BOTTOM_PROFITABLE} color="var(--danger)" formatCurrency={formatCurrency} />
      </div>
    </main>
    </RoleGuard>
  );
}

function ProfitTable({ title, icon, data, color, formatCurrency }: {
  title: string;
  icon: React.ReactNode;
  data: { name: string; sku: string; profit: number; margin: number }[];
  color: string;
  formatCurrency: (v: number) => string;
}) {
  return (
    <div className="ios-card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ color }}>{icon}</div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
      </div>
      <div className="table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Product</th>
              <th style={{ textAlign: 'right', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Profit</th>
              <th style={{ textAlign: 'right', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Margin</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.sku}>
                <td style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{row.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{row.sku}</div>
                </td>
                <td style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)', textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {formatCurrency(row.profit)}
                </td>
                <td style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)', textAlign: 'right', fontSize: 13, fontWeight: 600, color }}>
                  {row.margin}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
