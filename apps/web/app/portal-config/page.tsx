'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../../components/tenant-context';
import { RoleGuard } from '../../components/guards/role-guard';
import {
  listPortalConfigs,
  savePortalConfig,
  listPortalFAQs,
  createPortalFAQ,
  updatePortalFAQ,
  deletePortalFAQ,
  getQRScanStats,
  listBrands,
  listCommodities,
  type PortalConfig,
  type PortalFAQ,
  type QRScanStats,
  type BrandSummary,
  type CommoditySummary,
} from '../../lib/api';
import { StatBadge } from '../../components/ui/stat-badge';

type Tab = 'configs' | 'faqs' | 'qr';

const THEME_OPTIONS = [
  { id: 'editorial', label: 'Editorial' },
  { id: 'minimal-mono', label: 'Minimal Mono' },
  { id: 'tech-neon', label: 'Tech Neon' },
  { id: 'natural-grove', label: 'Natural Grove' },
  { id: 'luxury-noir', label: 'Luxury Noir' },
];

function ConfigEditor({ config, onSave }: { config: PortalConfig; onSave: (data: Partial<PortalConfig>) => Promise<void> }) {
  const [form, setForm] = useState({
    themeId: config.themeId,
    customDomain: config.customDomain ?? '',
    logoUrl: config.logoUrl ?? '',
    seoTitle: config.seoTitle ?? '',
    seoDescription: config.seoDescription ?? '',
    primaryColor: config.primaryColor ?? '',
    welcomeMessage: config.welcomeMessage ?? '',
    supportEmail: config.supportEmail ?? '',
    isActive: config.isActive,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        themeId: form.themeId,
        customDomain: form.customDomain || null,
        logoUrl: form.logoUrl || null,
        seoTitle: form.seoTitle || null,
        seoDescription: form.seoDescription || null,
        primaryColor: form.primaryColor || null,
        welcomeMessage: form.welcomeMessage || null,
        supportEmail: form.supportEmail || null,
        isActive: form.isActive,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '700px' }}>
      <div>
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Theme</label>
        <select
          value={form.themeId}
          onChange={(e) => setForm({ ...form, themeId: e.target.value })}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)', background: 'var(--panel-bg)', color: 'var(--text-primary)', fontSize: '13px' }}
        >
          {THEME_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Custom Domain</label>
        <input
          type="text"
          value={form.customDomain}
          onChange={(e) => setForm({ ...form, customDomain: e.target.value })}
          placeholder="support.brand.com"
          style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)', background: 'var(--panel-bg)', color: 'var(--text-primary)', fontSize: '13px' }}
        />
      </div>
      <div>
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Logo URL</label>
        <input
          type="text"
          value={form.logoUrl}
          onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
          placeholder="https://..."
          style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)', background: 'var(--panel-bg)', color: 'var(--text-primary)', fontSize: '13px' }}
        />
      </div>
      <div>
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Support Email</label>
        <input
          type="email"
          value={form.supportEmail}
          onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
          placeholder="support@brand.com"
          style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)', background: 'var(--panel-bg)', color: 'var(--text-primary)', fontSize: '13px' }}
        />
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>SEO Title</label>
        <input
          type="text"
          value={form.seoTitle}
          onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
          placeholder="Brand Support Portal"
          style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)', background: 'var(--panel-bg)', color: 'var(--text-primary)', fontSize: '13px' }}
        />
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Welcome Message</label>
        <textarea
          value={form.welcomeMessage}
          onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
          placeholder="Welcome to our support portal..."
          rows={3}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)', background: 'var(--panel-bg)', color: 'var(--text-primary)', fontSize: '13px', resize: 'vertical' }}
        />
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-primary)' }}>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Portal Active
        </label>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            marginLeft: 'auto',
            padding: '8px 24px',
            borderRadius: '999px',
            background: 'var(--accent)',
            color: 'var(--bg-color)',
            border: 'none',
            fontSize: '13px',
            fontWeight: 600,
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

function FAQManager({ tenantId, brands, commodities }: { tenantId: string; brands: BrandSummary[]; commodities: CommoditySummary[] }) {
  const [faqs, setFaqs] = useState<PortalFAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBrand, setFilterBrand] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ brandId: '', commodityId: '', question: '', answer: '', category: '' });
  const [error, setError] = useState<string | null>(null);

  const loadFAQs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPortalFAQs(tenantId, { brandId: filterBrand || undefined, limit: 100 });
      setFaqs(data.faqs);
    } catch (err) {
      console.error('Failed to load FAQs:', err);
      setError('Failed to load FAQs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, filterBrand]);

  useEffect(() => { loadFAQs(); }, [loadFAQs]);

  const handleCreate = async () => {
    if (!form.brandId || !form.question.trim() || !form.answer.trim()) return;
    await createPortalFAQ(tenantId, {
      brandId: form.brandId,
      commodityId: form.commodityId || null,
      question: form.question,
      answer: form.answer,
      category: form.category || null,
    });
    setForm({ brandId: '', commodityId: '', question: '', answer: '', category: '' });
    setShowCreate(false);
    loadFAQs();
  };

  const handleToggleActive = async (faq: PortalFAQ) => {
    await updatePortalFAQ(tenantId, faq.id, { isActive: !faq.isActive });
    loadFAQs();
  };

  const handleDelete = async (faqId: string) => {
    if (!window.confirm('Are you sure you want to delete this FAQ?')) return;
    await deletePortalFAQ(tenantId, faqId);
    loadFAQs();
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <select
          value={filterBrand}
          onChange={(e) => setFilterBrand(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)', background: 'var(--panel-bg)', color: 'var(--text-primary)', fontSize: '13px' }}
        >
          <option value="">All Brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{
            marginLeft: 'auto',
            padding: '8px 18px',
            borderRadius: '999px',
            background: 'var(--accent)',
            color: 'var(--bg-color)',
            border: 'none',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showCreate ? 'Cancel' : '+ New FAQ'}
        </button>
      </div>

      {showCreate && (
        <div className="ios-card" style={{ padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <select
              value={form.brandId}
              onChange={(e) => setForm({ ...form, brandId: e.target.value })}
              style={{ padding: '8px 12px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)', background: 'var(--panel-bg)', color: 'var(--text-primary)', fontSize: '13px' }}
            >
              <option value="">Select Brand *</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select
              value={form.commodityId}
              onChange={(e) => setForm({ ...form, commodityId: e.target.value })}
              style={{ padding: '8px 12px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)', background: 'var(--panel-bg)', color: 'var(--text-primary)', fontSize: '13px' }}
            >
              <option value="">Brand-level (all products)</option>
              {commodities
                .filter((c) => !form.brandId || c.product.brand.id === form.brandId)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.product.name} — {c.title}</option>
                ))}
            </select>
          </div>
          <input
            type="text"
            value={form.question}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
            placeholder="Question *"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)', background: 'var(--panel-bg)', color: 'var(--text-primary)', fontSize: '13px', marginBottom: '12px' }}
          />
          <textarea
            value={form.answer}
            onChange={(e) => setForm({ ...form, answer: e.target.value })}
            placeholder="Answer *"
            rows={3}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)', background: 'var(--panel-bg)', color: 'var(--text-primary)', fontSize: '13px', resize: 'vertical', marginBottom: '12px' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="text"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Category (e.g. usage, warranty)"
              style={{ padding: '8px 12px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)', background: 'var(--panel-bg)', color: 'var(--text-primary)', fontSize: '13px', flex: 1 }}
            />
            <button
              onClick={handleCreate}
              disabled={!form.brandId || !form.question.trim() || !form.answer.trim()}
              style={{
                padding: '8px 18px',
                borderRadius: '999px',
                background: 'var(--success)',
                color: 'var(--bg-color)',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: !form.brandId || !form.question.trim() || !form.answer.trim() ? 0.5 : 1,
              }}
            >
              Create
            </button>
          </div>
        </div>
      )}

      {error && (
        <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Loading FAQs...</p>
      ) : faqs.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>No FAQs found. Create one above.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Brand</th>
                <th>Product</th>
                <th>Question</th>
                <th>Category</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {faqs.map((faq) => (
                <tr key={faq.id}>
                  <td style={{ fontSize: '12px' }}>{faq.brand.name}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{faq.commodity?.title ?? '—'}</td>
                  <td style={{ fontSize: '12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {faq.question}
                  </td>
                  <td>
                    {faq.category && (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                        color: 'var(--accent)',
                      }}>
                        {faq.category}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggleActive(faq)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '16px',
                      }}
                    >
                      {faq.isActive ? '✅' : '⬜'}
                    </button>
                  </td>
                  <td>
                    <button
                      onClick={() => handleDelete(faq.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '11px',
                        color: 'var(--danger)',
                        fontWeight: 600,
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function QRDashboard({ tenantId }: { tenantId: string }) {
  const [stats, setStats] = useState<QRScanStats | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getQRScanStats(tenantId, { days })
      .then(setStats)
      .catch((err) => { console.error('Failed to load QR stats:', err); })
      .finally(() => setLoading(false));
  }, [tenantId, days]);

  if (loading) return <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Loading QR stats...</p>;
  if (!stats) return <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Failed to load QR stats.</p>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          style={{ padding: '8px 12px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)', background: 'var(--panel-bg)', color: 'var(--text-primary)', fontSize: '13px' }}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <StatBadge label="Total Scans" value={stats.total} />
        <StatBadge label="Sources" value={stats.bySource.length} trendColor="var(--success)" />
        <StatBadge label="Products" value={stats.byCommodity.length} trendColor="var(--warning)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="ios-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>By Source</h3>
          {stats.bySource.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>No scan data</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.bySource.map((s) => (
                <div key={s.source} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 500, width: '100px', color: 'var(--text-primary)' }}>{s.source}</span>
                  <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (s.count / stats.total) * 100)}%`, height: '100%', borderRadius: '4px', background: 'var(--accent)' }} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '30px', textAlign: 'right' }}>{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ios-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>Top Products</h3>
          {stats.byCommodity.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>No scan data</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.byCommodity.slice(0, 10).map((c) => (
                <div key={c.commodityId} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{c.productName}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{c.title}</div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)' }}>{c.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PortalConfigPage() {
  const { currentTenantId } = useTenant();
  const [tab, setTab] = useState<Tab>('configs');
  const [configs, setConfigs] = useState<PortalConfig[]>([]);
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [commodities, setCommodities] = useState<CommoditySummary[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!currentTenantId) return;
    setLoading(true);
    try {
      const [configData, brandData, commodityData] = await Promise.all([
        listPortalConfigs(currentTenantId),
        listBrands(currentTenantId),
        listCommodities(currentTenantId),
      ]);
      setConfigs(configData.configs);
      setBrands(brandData.brands);
      setCommodities(commodityData.commodities);
    } catch (err) {
      console.error('Failed to load portal config data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTenantId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveConfig = async (brandId: string, data: Partial<PortalConfig>) => {
    if (!currentTenantId) return;
    const result = await savePortalConfig(currentTenantId, brandId, data);
    setConfigs((prev) => prev.map((c) => (c.brandId === brandId ? result.config : c)));
  };

  const selectedConfig = selectedBrand ? configs.find((c) => c.brandId === selectedBrand) : null;

  return (
    <RoleGuard allowedRoles={['tenant_admin']}>
      <main>
        <div className="header">
          <h1 className="ios-title">Portal Configuration</h1>
          <p className="ios-subtitle">Manage brand portals, FAQs, and QR code analytics</p>
        </div>

        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
          {([
            { id: 'configs' as Tab, label: 'Brand Portals' },
            { id: 'faqs' as Tab, label: 'FAQ Management' },
            { id: 'qr' as Tab, label: 'QR Analytics' },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 18px',
                borderRadius: '999px',
                border: 'none',
                fontSize: '13px',
                fontWeight: tab === t.id ? 600 : 400,
                background: tab === t.id ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 10%, transparent)',
                color: tab === t.id ? 'var(--bg-color)' : 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Loading...</p>
        ) : (
          <>
            {tab === 'configs' && (
              <div>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                  <StatBadge label="Total Portals" value={configs.length} />
                  <StatBadge label="Active" value={configs.filter((c) => c.isActive).length} trendColor="var(--success)" />
                  <StatBadge label="Inactive" value={configs.filter((c) => !c.isActive).length} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '24px' }}>
                  <div className="ios-card" style={{ padding: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                      Brands
                    </div>
                    {configs.map((config) => (
                      <button
                        key={config.brandId}
                        onClick={() => setSelectedBrand(config.brandId)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 'var(--border-radius-sm)',
                          border: 'none',
                          background: selectedBrand === config.brandId ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                          color: selectedBrand === config.brandId ? 'var(--accent)' : 'var(--text-primary)',
                          fontWeight: selectedBrand === config.brandId ? 600 : 400,
                          fontSize: '13px',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: config.isActive ? 'var(--success)' : 'var(--text-tertiary)',
                          flexShrink: 0,
                        }} />
                        {config.brand.name}
                      </button>
                    ))}
                    {brands
                      .filter((b) => !configs.some((c) => c.brandId === b.id))
                      .map((b) => (
                        <button
                          key={b.id}
                          onClick={() => setSelectedBrand(b.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 'var(--border-radius-sm)',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-tertiary)',
                            fontSize: '13px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontStyle: 'italic',
                          }}
                        >
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1px dashed var(--text-tertiary)', flexShrink: 0 }} />
                          {b.name} (not configured)
                        </button>
                      ))}
                  </div>

                  <div className="ios-card" style={{ padding: '24px' }}>
                    {selectedConfig ? (
                      <>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                          {selectedConfig.brand.name}
                        </h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
                          Theme: {selectedConfig.themeId} · Domain: {selectedConfig.customDomain ?? 'not set'}
                        </p>
                        <ConfigEditor
                          config={selectedConfig}
                          onSave={(data) => handleSaveConfig(selectedConfig.brandId, data)}
                        />
                      </>
                    ) : selectedBrand ? (
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
                        <p>This brand has no portal configuration yet.</p>
                        <button
                          onClick={async () => {
                            if (!currentTenantId) return;
                            const result = await savePortalConfig(currentTenantId, selectedBrand, { themeId: 'editorial', isActive: true });
                            setConfigs((prev) => [...prev, result.config]);
                          }}
                          style={{
                            marginTop: '12px',
                            padding: '8px 18px',
                            borderRadius: '999px',
                            background: 'var(--accent)',
                            color: 'var(--bg-color)',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Create Portal Config
                        </button>
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Select a brand to configure its portal.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === 'faqs' && currentTenantId && (
              <FAQManager tenantId={currentTenantId} brands={brands} commodities={commodities} />
            )}

            {tab === 'qr' && currentTenantId && (
              <QRDashboard tenantId={currentTenantId} />
            )}
          </>
        )}
      </main>
    </RoleGuard>
  );
}
