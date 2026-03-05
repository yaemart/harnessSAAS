'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../components/auth-context';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

interface MonthlyRow {
  id: string;
  year: number;
  month: number;
  baseCurrency: string;
  targetCurrency: string;
  avgRate: number;
  minRate: number;
  maxRate: number;
  sampleCount: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COMMON_CURRENCIES = ['CNY', 'EUR', 'GBP', 'JPY', 'KRW', 'AUD', 'CAD', 'SGD', 'HKD'];

export function MonthlyAvgTable() {
  const { authHeaders } = useAuth();
  const [rows, setRows] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState('CNY');
  const [fromYear, setFromYear] = useState(String(new Date().getFullYear() - 1));
  const [toYear, setToYear] = useState(String(new Date().getFullYear()));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ target, fromYear, toYear });
      const res = await fetch(`${API}/exchange-rates/monthly?${params.toString()}`, {
        headers: authHeaders,
      });
      const d = await res.json();
      setRows(Array.isArray(d) ? d : []);
    } catch {
      // silent
    }
    setLoading(false);
  }, [authHeaders, target, fromYear, toYear]);

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
    width: 80,
  };

  const filtered = rows.filter((r) => r.targetCurrency === target);

  const globalMax = filtered.length ? Math.max(...filtered.map((r) => r.maxRate)) : 1;
  const globalMin = filtered.length ? Math.min(...filtered.map((r) => r.minRate)) : 0;

  return (
    <div style={panelStyle}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Monthly Averages</span>
        <select value={target} onChange={(e) => setTarget(e.target.value)} style={inputStyle}>
          {COMMON_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="number" value={fromYear} onChange={(e) => setFromYear(e.target.value)} style={inputStyle} min={2020} max={2030} />
        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>–</span>
        <input type="number" value={toYear} onChange={(e) => setToYear(e.target.value)} style={inputStyle} min={2020} max={2030} />
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>
          {filtered.length} months
        </span>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          No monthly data available. Data is calculated on the 1st of each month.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Period', 'Avg Rate', 'Min', 'Max', 'Spread', 'Samples', 'Range Bar'].map((h) => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const spread = ((r.maxRate - r.minRate) / r.avgRate * 100).toFixed(2);
                const barLeft = ((r.minRate - globalMin) / (globalMax - globalMin) * 100).toFixed(1);
                const barWidth = ((r.maxRate - r.minRate) / (globalMax - globalMin) * 100).toFixed(1);
                const avgPos = ((r.avgRate - globalMin) / (globalMax - globalMin) * 100).toFixed(1);

                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--panel-bg-secondary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 20px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {MONTH_NAMES[r.month - 1]} {r.year}
                    </td>
                    <td style={{ padding: '10px 20px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {r.avgRate.toFixed(6)}
                    </td>
                    <td style={{ padding: '10px 20px', color: 'var(--success)', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
                      {r.minRate.toFixed(6)}
                    </td>
                    <td style={{ padding: '10px 20px', color: 'var(--warning)', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
                      {r.maxRate.toFixed(6)}
                    </td>
                    <td style={{ padding: '10px 20px', color: 'var(--text-secondary)', fontSize: 12 }}>
                      {spread}%
                    </td>
                    <td style={{ padding: '10px 20px', color: 'var(--text-tertiary)', fontSize: 12 }}>
                      {r.sampleCount}d
                    </td>
                    <td style={{ padding: '10px 20px', minWidth: 120 }}>
                      <div style={{ position: 'relative', height: 8, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'visible' }}>
                        <div style={{
                          position: 'absolute',
                          left: `${barLeft}%`,
                          width: `${barWidth}%`,
                          height: '100%',
                          background: 'rgba(var(--accent-rgb),0.3)',
                          borderRadius: 4,
                        }} />
                        <div style={{
                          position: 'absolute',
                          left: `${avgPos}%`,
                          top: -2,
                          width: 2,
                          height: 12,
                          background: 'var(--accent)',
                          borderRadius: 1,
                          transform: 'translateX(-50%)',
                        }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
