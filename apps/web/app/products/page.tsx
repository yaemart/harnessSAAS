'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Package, TrendingUp, TrendingDown, Search, Filter, Eye, Heart, Inbox,
} from 'lucide-react';
import { useTenant } from '../../components/tenant-context';
import { useAuth } from '../../components/auth-context';
import { tintedBg } from '../../lib/design-tokens';
import { RoleGuard } from '../../components/guards/role-guard';
import { IronLawBanner } from '../../components/banners/iron-law-banner';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

interface Product {
  id: string;
  name: string;
  sku: string;
  lifecycleStage: string;
  category?: { name: string };
  commodities: {
    id: string;
    listings: { id: string }[];
  }[];
}

export default function ProductCockpitPage() {
  const { currentTenantId } = useTenant();
  const { authHeaders } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [lifecycle, setLifecycle] = useState<string>('All');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/mdm/products?tenantId=${currentTenantId}`, {
          headers: { ...authHeaders },
        });
        const data = await res.json();
        if (active) setProducts(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (active) setProducts([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [currentTenantId, authHeaders.authorization, authHeaders['x-tenant-id']]);

  const lifecycleOptions = useMemo(() => {
    const values = Array.from(new Set(products.map((p) => p.lifecycleStage).filter(Boolean)));
    return ['All', ...values];
  }, [products]);

  const categoryOptions = useMemo(() => {
    const values = Array.from(new Set(products.map((p) => p.category?.name ?? 'Uncategorized')));
    return ['All', ...values];
  }, [products]);

  const lifecycleColor = (stage: string) => {
    const s = stage.toUpperCase();
    if (s === 'GROWTH' || s === 'MATURE') return 'var(--success)';
    if (s === 'DECLINE' || s === 'ARCHIVED') return 'var(--danger)';
    if (s === 'LAUNCH' || s === 'NEW') return 'var(--accent)';
    return 'var(--warning)';
  };

  const filtered = products.filter((p) => {
    const categoryName = p.category?.name ?? 'Uncategorized';
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false;
    if (category !== 'All' && categoryName !== category) return false;
    if (lifecycle !== 'All' && p.lifecycleStage !== lifecycle) return false;
    return true;
  });

  return (
    <RoleGuard allowedRoles={['tenant_admin', 'operator']}>
    <main>
      <IronLawBanner />
      <div className="header">
        <div>
          <h1 className="ios-title">Product Cockpit</h1>
          <p className="ios-subtitle">Monitor product performance across lifecycle stages · Click any product → Product Workspace</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="ios-card" style={{ padding: 16, marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search products or SKUs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              borderRadius: 'var(--border-radius-md)',
              border: '1px solid var(--border-color)',
              background: 'var(--panel-bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={14} style={{ color: 'var(--text-tertiary)' }} />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--border-radius-md)',
              border: '1px solid var(--border-color)',
              background: 'var(--panel-bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
            }}
          >
            {categoryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {lifecycleOptions.map((stage) => {
            const active = lifecycle === stage;
            const color = stage === 'All' ? 'var(--accent)' : lifecycleColor(stage);
            return (
              <button
                key={stage}
                onClick={() => setLifecycle(stage)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '999px',
                  border: 'none',
                  background: active ? tintedBg(color, 18) : 'transparent',
                  color: active ? color : 'var(--text-secondary)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {stage}
              </button>
            );
          })}
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="ios-card" style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Loading products...</p>
        </div>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {filtered.map((product) => {
          const lcColor = lifecycleColor(product.lifecycleStage);
          const listingCount = product.commodities.reduce((acc, c) => acc + c.listings.length, 0);
          const healthScore = product.lifecycleStage === 'NEW' ? 95 : 75;
          return (
            <div key={product.id} className="ios-card" style={{ padding: 20 }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
                    {product.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>{product.sku}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: '999px',
                      background: tintedBg('var(--accent)', 10), color: 'var(--accent)',
                      fontSize: 10, fontWeight: 700,
                    }}>{product.category?.name ?? 'Uncategorized'}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: '999px',
                      background: tintedBg(lcColor, 15), color: lcColor,
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                    }}>{product.lifecycleStage}</span>
                  </div>
                </div>
              </div>

              {/* Health + Inbox Row */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Heart size={12} style={{ color: healthScore >= 70 ? 'var(--success)' : healthScore >= 40 ? 'var(--warning)' : 'var(--danger)' }} />
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: healthScore >= 70 ? 'var(--success)' : healthScore >= 40 ? 'var(--warning)' : 'var(--danger)',
                  }}>Health {healthScore}</span>
                </div>
                {listingCount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Inbox size={12} style={{ color: 'var(--warning)' }} />
                    <span style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>{listingCount} listings</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Package size={12} style={{ color: 'var(--text-tertiary)' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{product.commodities.length} commodities</span>
                </div>
              </div>

              {/* Metrics */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 10,
                padding: 12,
                background: tintedBg('var(--panel-bg-secondary)', 50),
                borderRadius: 'var(--border-radius-md)',
              }}>
                <MetricCell label="Product ID" value={product.id.slice(0, 8)} />
                <MetricCell label="SKU" value={product.sku} />
                <MetricCell label="Commodities" value={`${product.commodities.length}`} />
                <MetricCell label="Listings" value={`${listingCount}`} />
              </div>

              {/* View Details */}
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: '999px',
                  background: tintedBg('var(--accent)', 8),
                  color: 'var(--accent)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}>
                  <Eye size={13} />
                  View Details
                </span>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="ios-card" style={{ padding: 48, textAlign: 'center' }}>
          <Package size={40} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {products.length === 0 ? 'No products found for this tenant.' : 'No products match your filters.'}
          </p>
        </div>
      )}
    </main>
    </RoleGuard>
  );
}

function MetricCell({ label, value, trend, invert }: { label: string; value: string; trend?: number; invert?: boolean }) {
  const trendColor = trend !== undefined
    ? (invert ? (trend > 0 ? 'var(--danger)' : 'var(--success)') : (trend > 0 ? 'var(--success)' : 'var(--danger)'))
    : undefined;

  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
        {trend !== undefined && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 600, color: trendColor }}>
            {trend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
    </div>
  );
}
