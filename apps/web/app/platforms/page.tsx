'use client';

import { useState } from 'react';
import { Grid3X3, TrendingUp, TrendingDown, AlertTriangle, Info } from 'lucide-react';
import { tintedBg } from '../../lib/design-tokens';
import { RoleGuard } from '../../components/guards/role-guard';
import { IronLawBanner } from '../../components/banners/iron-law-banner';

type Metric = 'price' | 'margin' | 'adSpend' | 'roas' | 'stockDays' | 'rating';

const METRICS: { key: Metric; label: string }[] = [
  { key: 'price', label: 'Price' },
  { key: 'margin', label: 'Margin %' },
  { key: 'adSpend', label: 'Ad Spend' },
  { key: 'roas', label: 'ROAS' },
  { key: 'stockDays', label: 'Stock Days' },
  { key: 'rating', label: 'Rating' },
];

const PLATFORMS = ['Amazon US', 'Amazon DE', 'Amazon JP', 'Shopify', 'TikTok'];

interface ProductRow {
  name: string;
  sku: string;
  data: Record<string, Record<Metric, number | null>>;
}

const MOCK_DATA: ProductRow[] = [
  {
    name: 'BT Headphones X1', sku: 'SKU-4821',
    data: {
      'Amazon US': { price: 49.99, margin: 22.4, adSpend: 1200, roas: 4.8, stockDays: 22, rating: 4.3 },
      'Amazon DE': { price: 44.99, margin: 7.2, adSpend: 800, roas: 2.1, stockDays: 15, rating: 4.1 },
      'Amazon JP': { price: 52.99, margin: 18.1, adSpend: 400, roas: 3.2, stockDays: 34, rating: 4.5 },
      'Shopify': { price: 54.99, margin: 31.2, adSpend: 600, roas: 5.8, stockDays: 45, rating: null },
      'TikTok': { price: 39.99, margin: 12.5, adSpend: 300, roas: 2.9, stockDays: null, rating: null },
    },
  },
  {
    name: 'LED Desk Lamp Pro', sku: 'SKU-3344',
    data: {
      'Amazon US': { price: 34.99, margin: 18.9, adSpend: 450, roas: 2.1, stockDays: 67, rating: 4.6 },
      'Amazon DE': { price: 32.99, margin: 15.2, adSpend: 200, roas: 1.8, stockDays: 42, rating: 4.4 },
      'Amazon JP': { price: null, margin: null, adSpend: null, roas: null, stockDays: null, rating: null },
      'Shopify': { price: 39.99, margin: 28.4, adSpend: 180, roas: 4.2, stockDays: 55, rating: null },
      'TikTok': { price: 29.99, margin: 8.3, adSpend: 500, roas: 1.4, stockDays: null, rating: null },
    },
  },
  {
    name: 'Yoga Mat Ultra', sku: 'SKU-1192',
    data: {
      'Amazon US': { price: 29.99, margin: 31.2, adSpend: 320, roas: 6.2, stockDays: 45, rating: 4.7 },
      'Amazon DE': { price: 27.99, margin: 26.8, adSpend: 150, roas: 5.1, stockDays: 38, rating: 4.5 },
      'Amazon JP': { price: 31.99, margin: 28.4, adSpend: 100, roas: 4.8, stockDays: 52, rating: 4.8 },
      'Shopify': { price: 34.99, margin: 38.1, adSpend: 200, roas: 7.1, stockDays: 60, rating: null },
      'TikTok': { price: null, margin: null, adSpend: null, roas: null, stockDays: null, rating: null },
    },
  },
  {
    name: 'Face Serum 30ml', sku: 'SKU-7756',
    data: {
      'Amazon US': { price: 24.99, margin: 42.1, adSpend: 280, roas: 5.5, stockDays: 38, rating: 4.4 },
      'Amazon DE': { price: null, margin: null, adSpend: null, roas: null, stockDays: null, rating: null },
      'Amazon JP': { price: null, margin: null, adSpend: null, roas: null, stockDays: null, rating: null },
      'Shopify': { price: 29.99, margin: 52.3, adSpend: 150, roas: 8.2, stockDays: 42, rating: null },
      'TikTok': { price: 19.99, margin: 35.6, adSpend: 400, roas: 3.8, stockDays: 28, rating: null },
    },
  },
];

function avgForMetric(metric: Metric): number {
  let sum = 0, count = 0;
  for (const row of MOCK_DATA) {
    for (const platform of PLATFORMS) {
      const val = row.data[platform]?.[metric];
      if (val != null) { sum += val; count++; }
    }
  }
  return count > 0 ? sum / count : 0;
}

function cellColor(val: number | null, avg: number): string {
  if (val == null) return 'var(--text-tertiary)';
  if (val > avg * 1.05) return 'var(--success)';
  if (val < avg * 0.95) return 'var(--danger)';
  return 'var(--text-primary)';
}

function formatVal(val: number | null, metric: Metric): string {
  if (val == null) return '—';
  if (metric === 'price' || metric === 'adSpend') return `$${val.toLocaleString()}`;
  if (metric === 'margin') return `${val}%`;
  if (metric === 'roas') return `${val}x`;
  if (metric === 'stockDays') return `${val}d`;
  if (metric === 'rating') return `${val}★`;
  return String(val);
}

const INSIGHTS = [
  { icon: <AlertTriangle size={14} />, color: 'var(--warning)', text: 'Amazon DE margin is 15% lower than US — main factors: shipping + return rate' },
  { icon: <TrendingUp size={14} />, color: 'var(--success)', text: 'Shopify ROAS has beaten Amazon for 7 consecutive days — consider budget shift' },
  { icon: <Info size={14} />, color: 'var(--accent)', text: 'TikTok Shop shows strong growth for Face Serum — 3.8x ROAS with minimal spend' },
];

export default function PlatformsPage() {
  const [activeMetric, setActiveMetric] = useState<Metric>('margin');
  const avg = avgForMetric(activeMetric);

  return (
    <RoleGuard allowedRoles={['tenant_admin', 'operator']}>
    <main>
      <IronLawBanner />
      <div className="header">
        <div>
          <h1 className="ios-title">Platform Matrix</h1>
          <p className="ios-subtitle">Cross-platform comparison for all products · Layer 3 Tools</p>
        </div>
      </div>

      {/* Metric Switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: tintedBg('var(--panel-bg-secondary)', 50), padding: 4, borderRadius: '999px', width: 'fit-content' }}>
        {METRICS.map((m) => {
          const active = activeMetric === m.key;
          return (
            <button key={m.key} onClick={() => setActiveMetric(m.key)} style={{
              padding: '8px 16px', borderRadius: '999px', border: 'none',
              background: active ? tintedBg('var(--accent)', 18) : 'transparent',
              color: active ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer',
            }}>{m.label}</button>
          );
        })}
      </div>

      {/* Matrix Table */}
      <div className="ios-card" style={{ padding: 0, marginBottom: 24, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', left: 0, background: 'var(--panel-bg)', zIndex: 1 }}>Product</th>
              {PLATFORMS.map((p) => (
                <th key={p} style={{ textAlign: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_DATA.map((row) => (
              <tr key={row.sku}>
                <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', position: 'sticky', left: 0, background: 'var(--panel-bg)', zIndex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{row.sku}</div>
                </td>
                {PLATFORMS.map((platform) => {
                  const val = row.data[platform]?.[activeMetric] ?? null;
                  const color = cellColor(val, avg);
                  return (
                    <td key={platform} style={{
                      padding: '10px 16px', borderBottom: '1px solid var(--border-color)',
                      textAlign: 'center', fontSize: 14, fontWeight: 700, color,
                      background: val == null ? tintedBg('var(--text-tertiary)', 5) : 'transparent',
                    }}>
                      {formatVal(val, activeMetric)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cross-Platform Insights */}
      <div className="ios-card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Cross-Platform Insights</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {INSIGHTS.map((insight, idx) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 'var(--border-radius-md)',
              background: tintedBg(insight.color, 5),
              borderLeft: `3px solid ${insight.color}`,
            }}>
              <div style={{ color: insight.color, flexShrink: 0 }}>{insight.icon}</div>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{insight.text}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
    </RoleGuard>
  );
}
