'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../../../components/auth-context';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

interface RateRow {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  date: string;
  source: string;
}

interface CurrentRatesResponse {
  date: string | null;
  rates: RateRow[];
}

const COMMON_CURRENCIES = ['CNY', 'EUR', 'GBP', 'JPY', 'KRW', 'AUD', 'CAD', 'SGD', 'HKD', 'MXN', 'BRL', 'INR'];

export function CurrentRatesTable() {
  const { authHeaders } = useAuth();
  const [data, setData] = useState<CurrentRatesResponse>({ date: null, rates: [] });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/exchange-rates/current`, { headers: authHeaders });
      const d = await res.json() as CurrentRatesResponse;
      setData({ date: d.date ?? null, rates: Array.isArray(d.rates) ? d.rates : [] });
    } catch {
      // silent
    }
    setLoading(false);
  }, [authHeaders]);

  useEffect(() => { void load(); }, [load]);

  const rates = data.rates ?? [];
  const displayed = rates.filter((r) =>
    !filter || r.targetCurrency.toUpperCase().includes(filter.toUpperCase())
  );

  const common = displayed.filter((r) => COMMON_CURRENCIES.includes(r.targetCurrency));
  const rest = displayed.filter((r) => !COMMON_CURRENCIES.includes(r.targetCurrency));
  const sorted = [...common.sort((a, b) => COMMON_CURRENCIES.indexOf(a.targetCurrency) - COMMON_CURRENCIES.indexOf(b.targetCurrency)), ...rest];

  const panelStyle: React.CSSProperties = {
    background: 'var(--panel-bg)',
    border: '1px solid var(--panel-border)',
    borderRadius: 'var(--border-radius-lg)',
    boxShadow: 'var(--panel-shadow)',
    overflow: 'hidden',
  };

  return (
    <div style={panelStyle}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          Latest Rates
          {data.date && (
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8 }}>
              {new Date(data.date).toLocaleDateString()}
            </span>
          )}
        </span>
        <input
          style={{
            marginLeft: 'auto',
            padding: '5px 10px',
            borderRadius: 'var(--border-radius-sm)',
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: 12,
            width: 140,
            outline: 'none',
          }}
          placeholder="Filter currency..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          onClick={load}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 4 }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {loading && data.rates.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Loading...</div>
      ) : data.rates.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          No data. Configure an API provider and run a sync first.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Currency', 'Rate', 'vs 1 USD', 'Source'].map((h) => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.targetCurrency} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--panel-bg-secondary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {r.targetCurrency}
                    {COMMON_CURRENCIES.includes(r.targetCurrency) && (
                      <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)', padding: '1px 5px', borderRadius: 3 }}>key</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 20px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {r.rate.toFixed(6)}
                  </td>
                  <td style={{ padding: '10px 20px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    1 {r.targetCurrency} = {r.rate > 0 ? (1 / r.rate).toFixed(6) : 'N/A'} {r.baseCurrency}
                  </td>
                  <td style={{ padding: '10px 20px', color: 'var(--text-tertiary)', fontSize: 11 }}>{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
