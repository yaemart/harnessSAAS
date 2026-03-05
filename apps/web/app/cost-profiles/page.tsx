'use client';

import { useState } from 'react';
import {
  DollarSign, AlertTriangle, Clock, CheckCircle, Upload, Download,
} from 'lucide-react';
import { tintedBg } from '../../lib/design-tokens';
import { RoleGuard } from '../../components/guards/role-guard';
import { IronLawBanner } from '../../components/banners/iron-law-banner';

type FreshnessStatus = 'ok' | 'stale' | 'missing';

interface CostProfile {
  product: string;
  sku: string;
  cogsPerUnit: number | null;
  lastUpdated: string | null;
  status: FreshnessStatus;
  inboundShipping: number | null;
  fbaFee: number | null;
  platformFee: number | null;
  returnRate: number | null;
  targetMargin: number | null;
}

const PROFILES: CostProfile[] = [
  { product: 'BT Headphones X1', sku: 'SKU-4821', cogsPerUnit: 8.50, lastUpdated: '2 days ago', status: 'ok', inboundShipping: 12, fbaFee: 4.20, platformFee: 15.2, returnRate: 3.8, targetMargin: 20 },
  { product: 'LED Desk Lamp Pro', sku: 'SKU-3344', cogsPerUnit: 12.20, lastUpdated: '34 days ago', status: 'stale', inboundShipping: 8, fbaFee: 5.10, platformFee: 15.2, returnRate: 2.1, targetMargin: 18 },
  { product: 'Yoga Mat Ultra', sku: 'SKU-1192', cogsPerUnit: null, lastUpdated: null, status: 'missing', inboundShipping: null, fbaFee: null, platformFee: null, returnRate: null, targetMargin: null },
  { product: 'Cable Organiser Set', sku: 'SKU-0088', cogsPerUnit: 3.10, lastUpdated: '8 days ago', status: 'ok', inboundShipping: 15, fbaFee: 3.80, platformFee: 15.2, returnRate: 1.2, targetMargin: 25 },
  { product: 'Face Serum 30ml', sku: 'SKU-7756', cogsPerUnit: 4.80, lastUpdated: '5 days ago', status: 'ok', inboundShipping: 6, fbaFee: 3.20, platformFee: 15.2, returnRate: 4.5, targetMargin: 40 },
  { product: 'Phone Case Bundle', sku: 'SKU-9912', cogsPerUnit: 2.40, lastUpdated: '42 days ago', status: 'stale', inboundShipping: 10, fbaFee: 3.50, platformFee: 15.2, returnRate: 5.2, targetMargin: 15 },
];

const STATUS_CONFIG: Record<FreshnessStatus, { label: string; color: string; icon: React.ReactNode }> = {
  ok: { label: 'OK', color: 'var(--success)', icon: <CheckCircle size={14} /> },
  stale: { label: 'STALE', color: 'var(--danger)', icon: <AlertTriangle size={14} /> },
  missing: { label: 'MISSING', color: 'var(--warning)', icon: <Clock size={14} /> },
};

export default function CostProfilesPage() {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const staleCount = PROFILES.filter(p => p.status === 'stale').length;
  const missingCount = PROFILES.filter(p => p.status === 'missing').length;
  const okCount = PROFILES.filter(p => p.status === 'ok').length;

  return (
    <RoleGuard allowedRoles={['tenant_admin']}>
    <main>
      <IronLawBanner />
      <div className="header">
        <div>
          <h1 className="ios-title">Cost Profiles</h1>
          <p className="ios-subtitle">Profitability engine fuel — stale data = wrong decisions · Layer 3 Tools</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 'var(--border-radius-sm)',
            border: '1px solid var(--border-color)', background: 'var(--panel-bg)',
            color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
          }}>
            <Download size={14} /> Template
          </button>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 'var(--border-radius-sm)',
            border: 'none', background: 'var(--accent)',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <Upload size={14} /> Bulk Import
          </button>
        </div>
      </div>

      {/* Freshness Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Up to Date', count: okCount, color: 'var(--success)', icon: <CheckCircle size={16} /> },
          { label: 'Stale (>30d)', count: staleCount, color: 'var(--danger)', icon: <AlertTriangle size={16} /> },
          { label: 'Missing', count: missingCount, color: 'var(--warning)', icon: <Clock size={16} /> },
        ].map((s) => (
          <div key={s.label} className="ios-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ color: s.color }}>{s.icon}</div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.count}</div>
          </div>
        ))}
      </div>

      {/* Data Freshness Table */}
      <div className="ios-card" style={{ padding: 0, marginBottom: 24, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
          <thead>
            <tr>
              {['Product', 'COGS/unit', 'Inbound %', 'FBA Fee', 'Platform %', 'Return %', 'Target Margin', 'Last Updated', 'Status', ''].map((h) => (
                <th key={h} style={{
                  textAlign: h === 'Status' || h === '' ? 'center' : 'left',
                  padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PROFILES.map((p, idx) => {
              const sc = STATUS_CONFIG[p.status];
              return (
                <tr key={p.sku} style={{ background: p.status === 'stale' ? tintedBg('var(--danger)', 3) : p.status === 'missing' ? tintedBg('var(--warning)', 3) : 'transparent' }}>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.product}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.sku}</div>
                  </td>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', fontSize: 13, fontWeight: 600, color: p.cogsPerUnit != null ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                    {p.cogsPerUnit != null ? `$${p.cogsPerUnit.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', fontSize: 13, color: 'var(--text-primary)' }}>
                    {p.inboundShipping != null ? `${p.inboundShipping}%` : '—'}
                  </td>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', fontSize: 13, color: 'var(--text-primary)' }}>
                    {p.fbaFee != null ? `$${p.fbaFee.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', fontSize: 13, color: 'var(--text-primary)' }}>
                    {p.platformFee != null ? `${p.platformFee}%` : '—'}
                  </td>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', fontSize: 13, color: 'var(--text-primary)' }}>
                    {p.returnRate != null ? `${p.returnRate}%` : '—'}
                  </td>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                    {p.targetMargin != null ? `${p.targetMargin}%` : '—'}
                  </td>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', fontSize: 12, color: p.status === 'stale' ? 'var(--danger)' : 'var(--text-secondary)' }}>
                    {p.lastUpdated ?? 'Never'}
                  </td>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: '999px',
                      background: tintedBg(sc.color, 12), color: sc.color,
                    }}>
                      {sc.icon} {sc.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <button
                      onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                      style={{
                        padding: '4px 12px', borderRadius: 'var(--border-radius-sm)',
                        border: '1px solid var(--border-color)', background: 'var(--panel-bg)',
                        color: 'var(--accent)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cost Health Check */}
      <div className="ios-card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
          Cost Health Check
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            padding: '12px 16px', borderRadius: 'var(--border-radius-md)',
            background: tintedBg('var(--danger)', 5), borderLeft: '3px solid var(--danger)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              If COGS rises 10%, which products turn unprofitable?
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              LED Desk Lamp Pro (margin 18.9% → 8.9%) · Phone Case Bundle (margin 9.1% → −0.9%)
            </div>
          </div>
          <div style={{
            padding: '12px 16px', borderRadius: 'var(--border-radius-md)',
            background: tintedBg('var(--warning)', 5), borderLeft: '3px solid var(--warning)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              Break-even prices across platforms
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              BT Headphones X1: Amazon US $38.90 · Amazon DE $41.20 · Shopify $32.50
            </div>
          </div>
        </div>
      </div>
    </main>
    </RoleGuard>
  );
}
