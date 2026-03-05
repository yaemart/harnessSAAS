'use client';

import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { RoleGuard } from '../../components/guards/role-guard';
import { useAuth } from '../../components/auth-context';
import { RateConfigPanel } from './components/RateConfigPanel';
import { CurrentRatesTable } from './components/CurrentRatesTable';
import { DailyRateChart } from './components/DailyRateChart';
import { MonthlyAvgTable } from './components/MonthlyAvgTable';

type Tab = 'current' | 'daily' | 'monthly';

export default function ExchangeRatesPage() {
  const { hasRole } = useAuth();
  const isSystemAdmin = hasRole('system_admin');
  const [tab, setTab] = useState<Tab>('current');

  const TABS: { key: Tab; label: string }[] = [
    { key: 'current', label: 'Current Rates' },
    { key: 'daily', label: 'Daily History' },
    { key: 'monthly', label: 'Monthly Averages' },
  ];

  return (
    <RoleGuard allowedRoles={['system_admin', 'tenant_admin', 'operator', 'viewer']}>
      <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <TrendingUp size={22} color="var(--accent)" />
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', margin: 0 }}>
              Exchange Rates
            </h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            Real-time and historical currency exchange rate data
          </p>
        </div>

        {isSystemAdmin && (
          <div style={{ marginBottom: 28 }}>
            <RateConfigPanel />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--border-radius-md)',
                border: tab === t.key ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                background: tab === t.key ? 'rgba(var(--accent-rgb), 0.08)' : 'var(--panel-bg)',
                color: tab === t.key ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: tab === t.key ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'current' && <CurrentRatesTable />}
        {tab === 'daily' && <DailyRateChart />}
        {tab === 'monthly' && <MonthlyAvgTable />}
      </div>
    </RoleGuard>
  );
}
