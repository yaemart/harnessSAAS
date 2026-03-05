'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../components/auth-context';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

interface SnapshotRow {
  date: string;
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  source: string;
}

const COMMON_CURRENCIES = ['CNY', 'EUR', 'GBP', 'JPY', 'KRW', 'AUD', 'CAD', 'SGD', 'HKD'];

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function DailyRateChart() {
  const { authHeaders } = useAuth();
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState('CNY');
  const [from, setFrom] = useState(() => formatDate(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(() => formatDate(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to, target });
      const res = await fetch(`${API}/exchange-rates/daily?${params.toString()}`, {
        headers: authHeaders,
      });
      const d = await res.json();
      setRows(Array.isArray(d) ? d : []);
    } catch {
      // silent
    }
    setLoading(false);
  }, [authHeaders, target, from, to]);

  useEffect(() => { void load(); }, [load]);

  const panelStyle: React.CSSProperties = {
    background: 'var(--panel-bg)',
    border: '1px solid var(--panel-border)',
    borderRadius: 'var(--border-radius-lg)',
    boxShadow: 'var(--panel-shadow)',
    overflow: 'hidden',
  };

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: 'var(--border-radius-sm)',
    border: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: 12,
    outline: 'none',
  };

  const rates = rows.filter((r) => r.targetCurrency === target);

  const minRate = rates.length ? Math.min(...rates.map((r) => r.rate)) : 0;
  const maxRate = rates.length ? Math.max(...rates.map((r) => r.rate)) : 1;
  const range = maxRate - minRate || 1;

  const CHART_H = 140;
  const CHART_W = 800;
  const PAD = { top: 12, bottom: 24, left: 48, right: 16 };
  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  const points = rates.map((r, i) => {
    const x = PAD.left + (i / Math.max(rates.length - 1, 1)) * innerW;
    const y = PAD.top + innerH - ((r.rate - minRate) / range) * innerH;
    return { x, y, r };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  const area = points.length > 1
    ? `M${points[0].x},${PAD.top + innerH} ` +
      points.map((p) => `L${p.x},${p.y}`).join(' ') +
      ` L${points[points.length - 1].x},${PAD.top + innerH} Z`
    : '';

  const labelCount = Math.min(rates.length, 6);
  const labelIndices = rates.length <= 6
    ? rates.map((_, i) => i)
    : Array.from({ length: labelCount }, (_, i) => Math.round(i * (rates.length - 1) / (labelCount - 1)));

  return (
    <div style={panelStyle}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Daily Rate Trend</span>
        <select value={target} onChange={(e) => setTarget(e.target.value)} style={inputStyle}>
          {COMMON_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>to</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>
          {rates.length} data points
        </span>
      </div>

      <div style={{ padding: '20px 20px 12px' }}>
        {loading ? (
          <div style={{ height: CHART_H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Loading...</div>
        ) : rates.length === 0 ? (
          <div style={{ height: CHART_H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No data for selected range</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ display: 'block', minWidth: 400 }}>
              <defs>
                <linearGradient id="er-area-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                </linearGradient>
              </defs>

              {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const y = PAD.top + innerH * (1 - pct);
                const val = (minRate + range * pct).toFixed(4);
                return (
                  <g key={pct}>
                    <line x1={PAD.left} y1={y} x2={CHART_W - PAD.right} y2={y} stroke="var(--border)" strokeWidth={0.5} />
                    <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize={9} fill="var(--text-tertiary)">{val}</text>
                  </g>
                );
              })}

              {area && <path d={area} fill="url(#er-area-grad)" />}
              {points.length > 1 && (
                <polyline points={polyline} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
              )}

              {labelIndices.map((i) => {
                const p = points[i];
                const label = new Date(rates[i].date).toLocaleDateString('en', { month: 'short', day: 'numeric' });
                return (
                  <text key={i} x={p.x} y={PAD.top + innerH + 16} textAnchor="middle" fontSize={9} fill="var(--text-tertiary)">{label}</text>
                );
              })}

              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={2} fill="var(--accent)" opacity={0.7} />
              ))}
            </svg>
          </div>
        )}

        {rates.length > 0 && (
          <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
            {[
              { label: 'Latest', val: rates[rates.length - 1]?.rate.toFixed(6) },
              { label: 'High', val: maxRate.toFixed(6) },
              { label: 'Low', val: minRate.toFixed(6) },
              { label: 'Avg', val: (rates.reduce((a, r) => a + r.rate, 0) / rates.length).toFixed(6) },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{val}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
