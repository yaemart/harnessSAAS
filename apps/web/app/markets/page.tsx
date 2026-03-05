'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, AlertTriangle, CheckCircle, Clock, Globe } from 'lucide-react';
import { RoleGuard } from '../../components/guards/role-guard';
import { useAuth } from '../../components/auth-context';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

// ── Types ────────────────────────────────────────────────────────────────────

interface MarketCompliance {
  id: string;
  country_code: string;
  country_name: string;
  region: string;
  currency_code: string;
  currency_symbol: string;
  tax_type: string;
  standard_tax_rate: number;
  reduced_tax_rate: number | null;
  import_duty_threshold_local: number | null;
  import_duty_threshold_usd: number | null;
  vat_threshold_local: number | null;
  marketplace_collects_tax: boolean;
  ioss_supported: boolean;
  prohibited_categories: string[];
  requires_ce_mark: boolean;
  tax_notes: string | null;
  data_source_url: string | null;
  effective_date: string;
  next_review_date: string | null;
  days_until_review: number | null;
  review_status: 'ok' | 'due_soon' | 'overdue';
  updated_at: string;
}

interface ComplianceSummary {
  total_markets: number;
  overdue_count: number;
  due_soon_count: number;
  overdue_markets: string[];
  due_soon_markets: string[];
  last_seed_updated_at: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const REGION_LABELS: Record<string, string> = {
  NA: 'North America',
  EU: 'Europe',
  UK: 'United Kingdom',
  AP: 'Asia Pacific',
  OCE: 'Oceania',
};

const TAX_TYPE_LABELS: Record<string, string> = {
  VAT: 'VAT',
  GST: 'GST',
  CT: 'Consumption Tax',
  ST: 'Sales Tax (State)',
};

function ReviewBadge({ status, days }: { status: MarketCompliance['review_status']; days: number | null }) {
  const cfg = {
    ok: { bg: 'rgba(34,197,94,0.10)', color: '#16a34a', label: days !== null ? `${days}d` : 'OK' },
    due_soon: { bg: 'rgba(234,179,8,0.12)', color: '#ca8a04', label: days !== null ? `${days}d` : 'Soon' },
    overdue: { bg: 'rgba(239,68,68,0.12)', color: '#dc2626', label: 'Overdue' },
  }[status];

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: cfg.bg, color: cfg.color,
    }}>
      {status === 'overdue' && <AlertTriangle size={10} />}
      {status === 'due_soon' && <Clock size={10} />}
      {status === 'ok' && <CheckCircle size={10} />}
      {cfg.label}
    </span>
  );
}

function BoolBadge({ value, trueLabel = 'Yes', falseLabel = 'No' }: { value: boolean; trueLabel?: string; falseLabel?: string }) {
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: value ? 'rgba(34,197,94,0.10)' : 'rgba(148,163,184,0.10)',
      color: value ? '#16a34a' : 'var(--text-tertiary)',
    }}>
      {value ? trueLabel : falseLabel}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MarketCompliancePage() {
  const { authHeaders } = useAuth();
  const [markets, setMarkets] = useState<MarketCompliance[]>([]);
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, sRes] = await Promise.all([
        fetch(`${API}/market-compliance`, { headers: authHeaders }),
        fetch(`${API}/market-compliance/summary`, { headers: authHeaders }),
      ]);
      if (!mRes.ok) throw new Error(`API ${mRes.status}`);
      const [mData, sData] = await Promise.all([mRes.json(), sRes.json()]) as [MarketCompliance[], ComplianceSummary];
      setMarkets(mData);
      setSummary(sData);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  const regions = ['ALL', ...Array.from(new Set(markets.map((m) => m.region))).sort()];
  const filtered = regionFilter === 'ALL' ? markets : markets.filter((m) => m.region === regionFilter);

  return (
    <RoleGuard allowedRoles={['system_admin']}>
      <div style={{ padding: 32, maxWidth: 1280, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <ShieldCheck size={22} color="var(--accent)" />
              <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', margin: 0 }}>
                Market Compliance
              </h1>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Tax rates, import duty thresholds and compliance status for each market. Data sourced from official tax authorities.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 'var(--border-radius-md)',
              border: '1px solid var(--border)', background: 'var(--panel-bg)',
              color: 'var(--text-secondary)', fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
            {[
              { label: 'Active Markets', value: summary.total_markets, icon: <Globe size={16} color="var(--accent)" />, accent: false },
              { label: 'Overdue Reviews', value: summary.overdue_count, icon: <AlertTriangle size={16} color="#dc2626" />, accent: summary.overdue_count > 0 },
              { label: 'Due Within 30d', value: summary.due_soon_count, icon: <Clock size={16} color="#ca8a04" />, accent: false },
              {
                label: 'Last Data Update',
                value: summary.last_seed_updated_at
                  ? new Date(summary.last_seed_updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '—',
                icon: <CheckCircle size={16} color="#16a34a" />,
                accent: false,
              },
            ].map((card) => (
              <div key={card.label} style={{
                padding: '18px 20px', borderRadius: 'var(--border-radius-lg)',
                border: `1px solid ${card.accent ? 'rgba(239,68,68,0.25)' : 'var(--border)'}`,
                background: card.accent ? 'rgba(239,68,68,0.04)' : 'var(--panel-bg)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                  {card.icon}
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{card.label}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: card.accent ? '#dc2626' : 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                  {card.value}
                </div>
                {card.accent && summary.overdue_markets.length > 0 && (
                  <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
                    {summary.overdue_markets.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Region Filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {regions.map((r) => (
            <button key={r} onClick={() => setRegionFilter(r)} style={{
              padding: '7px 16px', borderRadius: 'var(--border-radius-md)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              border: regionFilter === r ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              background: regionFilter === r ? 'rgba(var(--accent-rgb), 0.08)' : 'var(--panel-bg)',
              color: regionFilter === r ? 'var(--accent)' : 'var(--text-secondary)',
            }}>
              {r === 'ALL' ? 'All Regions' : (REGION_LABELS[r] ?? r)}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '14px 18px', borderRadius: 'var(--border-radius-md)',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            color: '#dc2626', fontSize: 13, marginBottom: 20,
          }}>
            {error}
          </div>
        )}

        {/* Market Cards */}
        {loading && !markets.length ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((m) => {
              const isExpanded = expandedId === m.id;
              return (
                <div key={m.id} style={{
                  borderRadius: 'var(--border-radius-lg)',
                  border: '1px solid var(--border)',
                  background: 'var(--panel-bg)',
                  overflow: 'hidden',
                  transition: 'box-shadow 0.15s',
                }}>
                  {/* Row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : m.id)}
                    style={{
                      width: '100%', display: 'grid', padding: '16px 20px', gap: 12,
                      gridTemplateColumns: '80px 1fr 90px 90px 100px 110px 90px 36px',
                      alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {/* Country */}
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {m.country_code}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                        {REGION_LABELS[m.region] ?? m.region}
                      </div>
                    </div>

                    {/* Name */}
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {m.country_name}
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400, marginTop: 1 }}>
                        {TAX_TYPE_LABELS[m.tax_type] ?? m.tax_type}
                      </div>
                    </div>

                    {/* Standard Rate */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {(m.standard_tax_rate * 100).toFixed(0)}%
                      </div>
                      {m.reduced_tax_rate !== null && (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          reduced {(m.reduced_tax_rate * 100).toFixed(0)}%
                        </div>
                      )}
                    </div>

                    {/* De Minimis */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {m.import_duty_threshold_usd !== null && m.import_duty_threshold_usd > 0
                          ? `$${m.import_duty_threshold_usd.toLocaleString()}`
                          : m.import_duty_threshold_usd === 0 ? <span style={{ color: '#dc2626' }}>Removed</span> : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>de minimis</div>
                    </div>

                    {/* Marketplace */}
                    <div style={{ textAlign: 'center' }}>
                      <BoolBadge value={m.marketplace_collects_tax} trueLabel="Platform" falseLabel="Seller" />
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>tax collection</div>
                    </div>

                    {/* Effective Date */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.effective_date}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>effective</div>
                    </div>

                    {/* Review Status */}
                    <div style={{ textAlign: 'center' }}>
                      <ReviewBadge status={m.review_status} days={m.days_until_review} />
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>next review</div>
                    </div>

                    {/* Expand toggle */}
                    <div style={{ fontSize: 18, color: 'var(--text-tertiary)', transition: 'transform 0.15s', transform: isExpanded ? 'rotate(180deg)' : 'none', textAlign: 'center' }}>
                      ›
                    </div>
                  </button>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div style={{
                      borderTop: '1px solid var(--border)',
                      padding: '20px 24px',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 24,
                      background: 'rgba(var(--accent-rgb), 0.02)',
                    }}>
                      {/* Column 1: Rates & Thresholds */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                          Tax &amp; Thresholds
                        </div>
                        <DetailRow label="Standard Rate" value={`${(m.standard_tax_rate * 100).toFixed(0)}% (${m.tax_type})`} />
                        {m.reduced_tax_rate !== null && (
                          <DetailRow label="Reduced Rate" value={`${(m.reduced_tax_rate * 100).toFixed(0)}%`} />
                        )}
                        {m.vat_threshold_local !== null && (
                          <DetailRow label="VAT Registration" value={`${m.currency_symbol}${m.vat_threshold_local.toLocaleString()}`} />
                        )}
                        <DetailRow
                          label="Import De Minimis"
                          value={
                            m.import_duty_threshold_usd === 0
                              ? 'Removed (2025-08-29)'
                              : m.import_duty_threshold_local !== null
                                ? `${m.currency_symbol}${m.import_duty_threshold_local.toLocaleString()} (~$${m.import_duty_threshold_usd})`
                                : '—'
                          }
                        />
                        <DetailRow label="Currency" value={`${m.currency_code} ${m.currency_symbol}`} />
                      </div>

                      {/* Column 2: Platform & Compliance Flags */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                          Platform &amp; Compliance
                        </div>
                        <DetailRow label="Marketplace Collects Tax" value={<BoolBadge value={m.marketplace_collects_tax} />} />
                        <DetailRow label="IOSS Supported" value={<BoolBadge value={m.ioss_supported} />} />
                        <DetailRow label="CE Mark Required" value={<BoolBadge value={m.requires_ce_mark} />} />
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>Prohibited Categories</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {m.prohibited_categories.map((cat) => (
                              <span key={cat} style={{
                                fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                background: 'rgba(239,68,68,0.08)', color: '#dc2626', fontWeight: 500,
                              }}>
                                {cat.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Column 3: Data Provenance */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                          Data Provenance
                        </div>
                        <DetailRow label="Effective Date" value={m.effective_date} />
                        <DetailRow label="Next Review" value={m.next_review_date ?? '—'} />
                        <DetailRow
                          label="Review Status"
                          value={<ReviewBadge status={m.review_status} days={m.days_until_review} />}
                        />
                        <DetailRow label="Last Updated" value={new Date(m.updated_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} />
                        {m.data_source_url && (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Source</div>
                            <a href={m.data_source_url} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', wordBreak: 'break-all' }}>
                              {m.data_source_url}
                            </a>
                          </div>
                        )}
                        {m.tax_notes && (
                          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                            {m.tax_notes}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </RoleGuard>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}
