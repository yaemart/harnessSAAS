'use client';

import { useState, useEffect } from 'react';
import { useTenant } from '../../components/tenant-context';
import { useAuth, type UserRole } from '../../components/auth-context';
import { RoleGuard } from '../../components/guards/role-guard';
import { tintedBg } from '../../lib/design-tokens';

// ─── Types ───

interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  tenantId: string;
  tenantName?: string;
  createdAt: string;
  scopes: { scopeType: string; scopeValue: string }[];
}

const ROLE_META: Record<string, { label: string; color: string; desc: string }> = {
  system_admin: { label: 'System Admin', color: 'var(--danger)', desc: 'Full platform access' },
  tenant_admin: { label: 'Tenant Admin', color: 'var(--accent)', desc: 'Full tenant access' },
  operator: { label: 'Operator', color: 'var(--success)', desc: 'Daily operations' },
  supplier: { label: 'Supplier', color: 'var(--warning)', desc: 'Supplier portal only' },
  viewer: { label: 'Viewer', color: 'var(--text-secondary)', desc: 'Read-only reports' },
};

// ─── Mock: ALL users across all tenants (System Admin view) ───

const ALL_USERS: TeamMember[] = [
  // GlobalTech
  { id: 'u-1', email: 'boss@globaltech.com', name: 'Alex Chen', role: 'tenant_admin', isActive: true, tenantId: 't-gt', tenantName: 'Global Tech Corp (HQ)', createdAt: '2025-11-01T08:00:00Z', scopes: [] },
  { id: 'u-2', email: 'ops@globaltech.com', name: 'Sarah Kim', role: 'operator', isActive: true, tenantId: 't-gt', tenantName: 'Global Tech Corp (HQ)', createdAt: '2025-12-15T09:00:00Z', scopes: [{ scopeType: 'brand', scopeValue: 'ChefPro' }, { scopeType: 'platform', scopeValue: 'Amazon' }] },
  { id: 'u-3', email: 'ops2@globaltech.com', name: 'Mike Johnson', role: 'operator', isActive: true, tenantId: 't-gt', tenantName: 'Global Tech Corp (HQ)', createdAt: '2026-01-10T10:00:00Z', scopes: [{ scopeType: 'brand', scopeValue: 'GlowSkin' }, { scopeType: 'platform', scopeValue: 'Shopee' }] },
  { id: 'u-4', email: 'factory@supplier.cn', name: 'Wang Wei', role: 'supplier', isActive: true, tenantId: 't-gt', tenantName: 'Global Tech Corp (HQ)', createdAt: '2026-01-20T07:00:00Z', scopes: [{ scopeType: 'brand', scopeValue: 'ChefPro' }] },
  { id: 'u-5', email: 'investor@vc.com', name: 'Jennifer Park', role: 'viewer', isActive: true, tenantId: 't-gt', tenantName: 'Global Tech Corp (HQ)', createdAt: '2026-02-01T08:00:00Z', scopes: [] },
  { id: 'u-6', email: 'intern@globaltech.com', name: 'David Lee', role: 'operator', isActive: false, tenantId: 't-gt', tenantName: 'Global Tech Corp (HQ)', createdAt: '2025-11-15T10:00:00Z', scopes: [{ scopeType: 'platform', scopeValue: 'TikTok Shop' }] },
  // Alpha
  { id: 'u-7', email: 'admin@alpha-ecom.com', name: 'Lisa Wang', role: 'tenant_admin', isActive: true, tenantId: 't-alpha', tenantName: 'Alpha E-Commerce', createdAt: '2025-10-01T08:00:00Z', scopes: [] },
  { id: 'u-8', email: 'ops@alpha-ecom.com', name: 'Tom Brown', role: 'operator', isActive: true, tenantId: 't-alpha', tenantName: 'Alpha E-Commerce', createdAt: '2025-12-01T08:00:00Z', scopes: [] },
  // Beta
  { id: 'u-9', email: 'admin@beta-retail.com', name: 'James Liu', role: 'tenant_admin', isActive: true, tenantId: 't-beta', tenantName: 'Beta Retail Ventures', createdAt: '2025-09-01T08:00:00Z', scopes: [] },
  // Platform
  { id: 'u-0', email: 'admin@system.io', name: 'Root Admin', role: 'system_admin', isActive: true, tenantId: 't-sys', tenantName: '— Platform —', createdAt: '2025-01-01T00:00:00Z', scopes: [] },
];

const TENANT_SUMMARY = [
  { id: 't-gt', name: 'Global Tech Corp (HQ)', userCount: 6, activeCount: 5 },
  { id: 't-alpha', name: 'Alpha E-Commerce', userCount: 2, activeCount: 2 },
  { id: 't-beta', name: 'Beta Retail Ventures', userCount: 1, activeCount: 1 },
];

const PERMISSION_MATRIX = [
  { resource: 'Products', tenant_admin: 'Full', operator: 'Read/Write', supplier: '—', viewer: 'Read' },
  { resource: 'Ads Campaigns', tenant_admin: 'Full', operator: 'Read/Write', supplier: '—', viewer: 'Read' },
  { resource: 'Support Cases', tenant_admin: 'Full', operator: 'Read/Write', supplier: '—', viewer: '—' },
  { resource: 'Portal Config', tenant_admin: 'Full', operator: '—', supplier: '—', viewer: '—' },
  { resource: 'Team Management', tenant_admin: 'Full', operator: '—', supplier: '—', viewer: '—' },
  { resource: 'Agent Authority', tenant_admin: 'Full', operator: '—', supplier: '—', viewer: '—' },
  { resource: 'Constitution Rules', tenant_admin: 'Full', operator: 'Read', supplier: '—', viewer: '—' },
  { resource: 'Cost Profiles', tenant_admin: 'Full', operator: 'Read', supplier: '—', viewer: 'Read' },
  { resource: 'Purchase Orders', tenant_admin: 'Full', operator: 'Read', supplier: 'Read/Write', viewer: '—' },
  { resource: 'Executive Reports', tenant_admin: 'Full', operator: '—', supplier: '—', viewer: 'Read' },
];

// ─── Page Entry ───

export default function TeamPage() {
  return (
    <RoleGuard allowedRoles={['system_admin', 'tenant_admin']}>
      <TeamRouter />
    </RoleGuard>
  );
}

function TeamRouter() {
  const { hasRole } = useAuth();
  if (hasRole('system_admin')) return <SystemAdminView />;
  return <TenantAdminView />;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// System Admin — platform-level user management
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ─── Plan config (mirrors opa-policy.ts) ───
const PLAN_META = {
  starter:    { label: 'Starter',    color: 'var(--text-secondary)', aiOps: 100,     budget: '5,000' },
  pro:        { label: 'Pro',        color: 'var(--accent)',         aiOps: 1000,    budget: '50,000' },
  enterprise: { label: 'Enterprise', color: '#AF52DE',               aiOps: Infinity, budget: '∞' },
} as const;
type PlanKey = keyof typeof PLAN_META;

interface TenantPlanRow {
  id: string;
  code: string;
  name: string;
  plan: PlanKey;
  status: string;
  updatedAt: string;
  quotas: { maxDailyOps: number; maxDailyBudget: number };
}

function TenantPlansPanel() {
  const { authHeaders } = useAuth();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3300';

  const [tenants, setTenants] = useState<TenantPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch(`${API}/admin/tenants/plans`, { headers: authHeaders })
      .then(r => r.json())
      .then(d => setTenants(d.tenants ?? []))
      .catch(() => setTenants([]))
      .finally(() => setLoading(false));
  }, [API, authHeaders]);

  async function changePlan(tenantId: string, plan: string) {
    setSaving(tenantId);
    setMsg(null);
    try {
      const r = await fetch(`${API}/admin/tenants/${tenantId}/plan`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (r.ok) {
        setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, plan: plan as PlanKey } : t));
        setMsg({ id: tenantId, ok: true, text: `Updated to ${plan}` });
      } else {
        setMsg({ id: tenantId, ok: false, text: 'Update failed' });
      }
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--text-secondary)', fontSize: 14 }}>Loading…</div>;

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Tenant Plans</h2>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
          background: tintedBg('#AF52DE', 15), color: '#AF52DE',
        }}>BILLING</span>
      </div>

      {/* Plan quota legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {(Object.entries(PLAN_META) as [PlanKey, typeof PLAN_META[PlanKey]][]).map(([key, m]) => (
          <div key={key} style={{
            padding: '10px 16px', borderRadius: 10,
            background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
            boxShadow: 'var(--panel-shadow)', minWidth: 160,
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: m.color, marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              AI ops/day: <b style={{ color: 'var(--text-primary)' }}>{m.aiOps === Infinity ? '∞' : m.aiOps.toLocaleString()}</b>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Budget/day: <b style={{ color: 'var(--text-primary)' }}>{m.budget}</b>
            </div>
          </div>
        ))}
      </div>

      {/* Tenant table */}
      <div style={{
        background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
        borderRadius: 12, boxShadow: 'var(--panel-shadow)', overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--panel-border)', background: 'var(--surface-secondary)' }}>
              {['Tenant', 'Status', 'Current Plan', 'AI Ops Limit', 'Change Plan', ''].map(h => (
                <th key={h} style={{
                  padding: '10px 16px', textAlign: 'left',
                  fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenants.map((t, i) => {
              const meta = PLAN_META[t.plan] ?? PLAN_META.starter;
              const isSaving = saving === t.id;
              const rowMsg = msg?.id === t.id ? msg : null;
              return (
                <tr key={t.id} style={{
                  borderBottom: i < tenants.length - 1 ? '1px solid var(--panel-border)' : 'none',
                  transition: 'background 0.15s',
                }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{t.code}</div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                      background: t.status === 'active' ? tintedBg('var(--success)', 12) : tintedBg('var(--danger)', 12),
                      color: t.status === 'active' ? 'var(--success)' : 'var(--danger)',
                    }}>{t.status}</span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                      background: tintedBg(meta.color, 12), color: meta.color,
                    }}>{meta.label}</span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-primary)' }}>
                    {t.quotas.maxDailyOps >= 999_999 ? '∞' : t.quotas.maxDailyOps.toLocaleString()}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <select
                      value={t.plan}
                      disabled={isSaving}
                      onChange={e => changePlan(t.id, e.target.value)}
                      style={{
                        fontSize: 13, padding: '5px 10px', borderRadius: 8,
                        border: '1px solid var(--panel-border)', background: 'var(--input-bg)',
                        color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
                      }}
                    >
                      {(Object.keys(PLAN_META) as PlanKey[]).map(k => (
                        <option key={k} value={k}>{PLAN_META[k].label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 12 }}>
                    {isSaving && <span style={{ color: 'var(--text-secondary)' }}>Saving…</span>}
                    {rowMsg && (
                      <span style={{ color: rowMsg.ok ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                        {rowMsg.text}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SystemAdminView() {
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'users' | 'plans'>('users');

  const filtered = ALL_USERS.filter(u => {
    if (tenantFilter !== 'all' && u.tenantId !== tenantFilter) return false;
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    return true;
  });

  const totalActive = ALL_USERS.filter(u => u.isActive).length;

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <h1 className="ios-title">Platform Administration</h1>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: '999px',
          background: tintedBg('var(--danger)', 15), color: 'var(--danger)',
        }}>
          PLATFORM
        </span>
      </div>
      <p className="ios-subtitle" style={{ marginBottom: 24 }}>
        All users across all tenants — platform-level administration
      </p>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid var(--panel-border)', paddingBottom: 0 }}>
        {([['users', 'User Management'], ['plans', 'Tenant Plans']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 600, border: 'none',
              background: 'none', cursor: 'pointer', borderRadius: '8px 8px 0 0',
              color: activeTab === key ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === key ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'all 0.15s',
            }}
          >{label}</button>
        ))}
      </div>

      {activeTab === 'plans' ? <TenantPlansPanel /> : (<>
      {/* Tenant overview cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard label="Total Users" value={ALL_USERS.length} color="var(--accent)" />
        <StatCard label="Active" value={totalActive} color="var(--success)" />
        <StatCard label="Tenants" value={TENANT_SUMMARY.length} color="var(--accent)" />
        {TENANT_SUMMARY.map(t => (
          <div
            key={t.id}
            onClick={() => setTenantFilter(tenantFilter === t.id ? 'all' : t.id)}
            style={{
              padding: 16, borderRadius: 'var(--border-radius-lg)', cursor: 'pointer',
              background: tenantFilter === t.id ? tintedBg('var(--accent)', 10) : 'var(--panel-bg)',
              border: `1px solid ${tenantFilter === t.id ? 'var(--accent)' : 'var(--panel-border)'}`,
              boxShadow: 'var(--panel-shadow)', minWidth: 140,
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
              {t.name}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
              {t.userCount} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>users</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 2 }}>{t.activeCount} active</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Role:</span>
        {['all', 'system_admin', 'tenant_admin', 'operator', 'supplier', 'viewer'].map(r => {
          const meta = r === 'all' ? { label: 'All', color: 'var(--accent)' } : ROLE_META[r];
          return (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              style={{
                padding: '4px 12px', borderRadius: '999px', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', border: '1px solid',
                borderColor: roleFilter === r ? meta.color : 'var(--panel-border)',
                background: roleFilter === r ? tintedBg(meta.color, 15) : 'transparent',
                color: roleFilter === r ? meta.color : 'var(--text-secondary)',
              }}
            >
              {meta.label}
            </button>
          );
        })}
        {tenantFilter !== 'all' && (
          <button
            onClick={() => setTenantFilter('all')}
            style={{
              marginLeft: 8, padding: '4px 12px', borderRadius: '999px', fontSize: 11,
              fontWeight: 600, cursor: 'pointer', border: '1px solid var(--warning)',
              background: tintedBg('var(--warning)', 15), color: 'var(--warning)',
            }}
          >
            ✕ Clear tenant filter
          </button>
        )}
      </div>

      {/* Table */}
      <UserTable members={filtered} showTenant />

      <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
        <ActionButton label="+ Create User" disabled />
        <ActionButton label="Bulk Import" disabled />
        <ActionButton label="Export CSV" disabled />
      </div>
      </>)}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tenant Admin — own org team management
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function TenantAdminView() {
  const { currentTenantId } = useTenant();
  const [tab, setTab] = useState<'members' | 'permissions'>('members');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const myTeam = ALL_USERS.filter(u => u.tenantId === 't-gt' && u.role !== 'system_admin');

  const filteredMembers = roleFilter === 'all'
    ? myTeam
    : myTeam.filter(m => m.role === roleFilter);

  const activeCount = myTeam.filter(m => m.isActive).length;
  const roleCounts = myTeam.reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <h1 className="ios-title" style={{ marginBottom: 4 }}>My Team</h1>
      <p className="ios-subtitle" style={{ marginBottom: 24 }}>
        Manage your organization&apos;s team members, roles, and access scopes
      </p>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard label="Team Size" value={myTeam.length} color="var(--accent)" />
        <StatCard label="Active" value={activeCount} color="var(--success)" />
        <StatCard label="Operators" value={roleCounts['operator'] ?? 0} color="var(--success)" />
        <StatCard label="Suppliers" value={roleCounts['supplier'] ?? 0} color="var(--warning)" />
        <StatCard label="Viewers" value={roleCounts['viewer'] ?? 0} color="var(--text-secondary)" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--panel-border)' }}>
        {(['members', 'permissions'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'transparent', border: 'none',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            {t === 'members' ? 'Team Members' : 'Permission Matrix'}
          </button>
        ))}
      </div>

      {tab === 'members' ? (
        <>
          {/* Role filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {['all', 'tenant_admin', 'operator', 'supplier', 'viewer'].map(r => {
              const meta = r === 'all' ? { label: 'All', color: 'var(--accent)' } : ROLE_META[r];
              return (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  style={{
                    padding: '5px 14px', borderRadius: '999px', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', border: '1px solid',
                    borderColor: roleFilter === r ? meta.color : 'var(--panel-border)',
                    background: roleFilter === r ? tintedBg(meta.color, 15) : 'transparent',
                    color: roleFilter === r ? meta.color : 'var(--text-secondary)',
                  }}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
          <UserTable members={filteredMembers} showTenant={false} />
          <div style={{ marginTop: 20 }}>
            <ActionButton label="+ Invite Team Member" disabled />
          </div>
        </>
      ) : (
        <PermissionsMatrix />
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Shared components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      padding: 16, borderRadius: 'var(--border-radius-lg)',
      background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
      boxShadow: 'var(--panel-shadow)', minWidth: 110,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function ActionButton({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      title={disabled ? 'Coming soon' : undefined}
      style={{
        padding: '10px 18px', borderRadius: '999px', fontSize: 13, fontWeight: 600,
        background: disabled ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--accent)',
        color: disabled ? 'var(--text-tertiary)' : '#fff',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function UserTable({ members, showTenant }: { members: TeamMember[]; showTenant: boolean }) {
  return (
    <div className="table-wrap">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '12px 16px' }}>Member</th>
            {showTenant && <th style={{ textAlign: 'left', padding: '12px 16px' }}>Tenant</th>}
            <th style={{ textAlign: 'left', padding: '12px 16px' }}>Role</th>
            <th style={{ textAlign: 'left', padding: '12px 16px' }}>Scopes</th>
            <th style={{ textAlign: 'center', padding: '12px 16px' }}>Status</th>
            <th style={{ textAlign: 'right', padding: '12px 16px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map(m => {
            const meta = ROLE_META[m.role] ?? { label: m.role, color: 'var(--text-secondary)', desc: '' };
            return (
              <tr key={m.id} style={{ borderTop: '1px solid var(--panel-border)' }}>
                <td style={{ padding: '8px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{m.email}</div>
                </td>
                {showTenant && (
                  <td style={{ padding: '8px 16px' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.tenantName}</span>
                  </td>
                )}
                <td style={{ padding: '8px 16px' }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: '999px',
                    fontSize: 11, fontWeight: 700,
                    background: tintedBg(meta.color, 15), color: meta.color,
                  }}>
                    {meta.label}
                  </span>
                </td>
                <td style={{ padding: '8px 16px' }}>
                  {m.scopes.length > 0 ? (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {m.scopes.map((s, i) => (
                        <span key={i} style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 'var(--border-radius-sm)',
                          background: 'color-mix(in srgb, var(--text-tertiary) 12%, transparent)',
                          color: 'var(--text-secondary)', fontWeight: 500,
                        }}>
                          {s.scopeType}: {s.scopeValue}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>All access</span>
                  )}
                </td>
                <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                    background: m.isActive ? 'var(--success)' : 'var(--text-tertiary)',
                    boxShadow: m.isActive ? '0 0 6px var(--success)' : 'none',
                  }} />
                </td>
                <td style={{ padding: '8px 16px', textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button
                    disabled
                    title="Coming soon"
                    style={{
                      padding: '4px 10px', borderRadius: '999px', fontSize: 11, fontWeight: 600,
                      background: 'transparent', border: '1px solid var(--panel-border)',
                      color: 'var(--text-tertiary)', cursor: 'not-allowed',
                    }}
                  >
                    Edit
                  </button>
                  {!m.isActive && (
                    <button
                      disabled
                      title="Coming soon"
                      style={{
                        padding: '4px 10px', borderRadius: '999px', fontSize: 11, fontWeight: 600,
                        background: 'transparent', border: '1px solid var(--panel-border)',
                        color: 'var(--text-tertiary)', cursor: 'not-allowed',
                      }}
                    >
                      Reactivate
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PermissionsMatrix() {
  return (
    <div className="table-wrap">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '12px 16px' }}>Resource</th>
            <th style={{ textAlign: 'center', padding: '12px 16px' }}>Tenant Admin</th>
            <th style={{ textAlign: 'center', padding: '12px 16px' }}>Operator</th>
            <th style={{ textAlign: 'center', padding: '12px 16px' }}>Supplier</th>
            <th style={{ textAlign: 'center', padding: '12px 16px' }}>Viewer</th>
          </tr>
        </thead>
        <tbody>
          {PERMISSION_MATRIX.map((row) => (
            <tr key={row.resource} style={{ borderTop: '1px solid var(--panel-border)' }}>
              <td style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {row.resource}
              </td>
              {(['tenant_admin', 'operator', 'supplier', 'viewer'] as const).map(role => {
                const val = row[role];
                const color = val === 'Full' ? 'var(--accent)'
                  : val === 'Read/Write' ? 'var(--success)'
                  : val === 'Read' ? 'var(--warning)'
                  : 'var(--text-tertiary)';
                return (
                  <td key={role} style={{ padding: '8px 16px', textAlign: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color }}>{val}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
