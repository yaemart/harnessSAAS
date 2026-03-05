'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTenant } from './tenant-context';
import { useAuth } from './auth-context';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

type MappingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED' | 'SOFT_REVOKED';
type EntityType = 'PRODUCT' | 'LISTING' | 'SUPPLIER' | 'WAREHOUSE';

type MappingItem = {
  id: string;
  tenantId: string;
  entityType: EntityType;
  globalId: string;
  sourceSystem: string;
  externalId: string;
  externalSubId: string | null;
  status: MappingStatus;
  confidenceScore: string | number | null;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  reason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type MappingHistory = {
  id: string;
  action: string;
  oldStatus: MappingStatus | null;
  newStatus: MappingStatus | null;
  changedBy: string;
  reason: string | null;
  createdAt: string;
};

type MappingDetail = {
  mapping: MappingItem;
  external_data: Record<string, unknown>;
  candidates: Record<string, unknown>;
  audit_history: MappingHistory[];
};

type RefItem = { id: string; name: string; code?: string };

function fmt(dateLike?: string | null) {
  if (!dateLike) return '-';
  return new Date(dateLike).toLocaleString();
}

export function MappingReviewDashboard() {
  const { currentTenantId } = useTenant();
  const { authHeaders } = useAuth();
  const [statusFilter, setStatusFilter] = useState<MappingStatus | 'ALL'>('PENDING');
  const [entityFilter, setEntityFilter] = useState<EntityType | 'ALL'>('ALL');
  const [sourceFilter, setSourceFilter] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MappingItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MappingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opMsg, setOpMsg] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  const [approvedGlobalId, setApprovedGlobalId] = useState('');
  const [rejectReason, setRejectReason] = useState('not matched');
  const [revokeReason, setRevokeReason] = useState('manual revoke');
  const [createName, setCreateName] = useState('');
  const [createBrandId, setCreateBrandId] = useState('');
  const [createCategoryId, setCreateCategoryId] = useState('');
  const [createSku, setCreateSku] = useState('');

  const [brands, setBrands] = useState<RefItem[]>([]);
  const [categories, setCategories] = useState<RefItem[]>([]);

  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<{
    summary: { total_new_mappings: number; approved: number; pending: number; rejected: number; revoked: number; soft_revoked: number };
    p0_double_approved_conflicts: number;
    go_no_go: 'GO' | 'NO-GO';
    generated_at: string;
  } | null>(null);

  async function handleReconcileDryRun() {
    if (!currentTenantId) return;
    setReconcileLoading(true);
    setReconcileResult(null);
    try {
      const res = await fetch(`${API_BASE}/mdm/mappings/reconcile/dry-run?tenantId=${currentTenantId}`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setReconcileResult(data);
    } catch {
      setError('Reconcile dry-run failed');
    } finally {
      setReconcileLoading(false);
    }
  }

  async function loadRefs() {
    if (!currentTenantId) return;
    try {
      const [brandsRes, categoriesRes] = await Promise.all([
        fetch(`${API_BASE}/mdm/brands?tenantId=${currentTenantId}`, { headers: { ...authHeaders } }),
        fetch(`${API_BASE}/mdm/categories?tenantId=${currentTenantId}&flat=true`, { headers: { ...authHeaders } }),
      ]);
      const [brandsJson, categoriesJson] = await Promise.all([brandsRes.json(), categoriesRes.json()]);
      setBrands((brandsJson.items ?? []).map((x: any) => ({ id: x.id, name: x.name, code: x.code })));
      setCategories((categoriesJson.items ?? []).map((x: any) => ({ id: x.id, name: x.name, code: x.code })));
    } catch {
      // non-blocking
    }
  }

  async function loadMappings() {
    if (!currentTenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('tenantId', currentTenantId);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (entityFilter !== 'ALL') params.set('entity_type', entityFilter);
      if (sourceFilter.trim()) params.set('source_system', sourceFilter.trim());
      if (q.trim()) params.set('q', q.trim());
      params.set('page_size', '100');

      const res = await fetch(`${API_BASE}/mdm/mappings?${params.toString()}`, {
        headers: { ...authHeaders },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || 'load mappings failed');
      setItems(data.items ?? []);
      if (!selectedId && data.items?.length) setSelectedId(data.items[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load mappings failed');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    if (!currentTenantId) return;
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/mdm/mappings/${id}?tenantId=${currentTenantId}`, {
        headers: { ...authHeaders },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || 'load detail failed');
      setDetail(data);
      setApprovedGlobalId(data.mapping?.globalId || '');
    } catch (e) {
      setDetail(null);
      setError(e instanceof Error ? e.message : 'load detail failed');
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadMappings();
    loadRefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenantId, statusFilter, entityFilter, sourceFilter, authHeaders.authorization, authHeaders['x-tenant-id']]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selectedCount = useMemo(
    () => Object.values(selectedIds).filter(Boolean).length,
    [selectedIds],
  );

  async function postAction(path: string, body: Record<string, unknown>) {
    if (!currentTenantId || !selectedId) return;
    setOpMsg(null);
    const res = await fetch(`${API_BASE}${path}?tenantId=${currentTenantId}`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || data?.error || data?.error_code || 'operation failed');
    await loadMappings();
    await loadDetail(selectedId);
    setOpMsg('Operation completed');
  }

  async function handleApprove() {
    if (!selectedId || !approvedGlobalId.trim() || !detail) return;
    await postAction(`/mdm/mappings/${selectedId}/approve`, {
      approved_global_id: approvedGlobalId.trim(),
      expected_version: detail.mapping.version,
      comment: 'approved from mapping review',
    });
  }

  async function handleReject() {
    if (!selectedId || !detail) return;
    await postAction(`/mdm/mappings/${selectedId}/reject`, {
      reason: rejectReason.trim() || 'rejected',
      expected_version: detail.mapping.version,
    });
  }

  async function handleRevoke() {
    if (!selectedId || !detail) return;
    await postAction(`/mdm/mappings/${selectedId}/revoke`, {
      reason: revokeReason.trim() || 'revoked',
      expected_version: detail.mapping.version,
    });
  }

  async function handleCreateAndApprove() {
    if (!selectedId || !detail) return;
    if (!createName.trim() || !createBrandId || !createCategoryId) {
      setError('name/brand/category are required');
      return;
    }
    await postAction(`/mdm/mappings/${selectedId}/create-and-approve`, {
      new_entity_data: {
        name: createName.trim(),
        brand_id: createBrandId,
        category_id: createCategoryId,
        sku: createSku.trim() || undefined,
      },
      expected_version: detail.mapping.version,
      comment: 'create and approve from mapping review',
    });
  }

  async function handleBatchApprove() {
    if (!currentTenantId) return;
    const ids = Object.keys(selectedIds).filter((x) => selectedIds[x]);
    if (ids.length === 0 || !approvedGlobalId.trim()) {
      setError('Select rows and fill approved global id');
      return;
    }
    setOpMsg(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/mdm/mappings/batch-approve?tenantId=${currentTenantId}`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapping_ids: ids,
          approved_global_id: approvedGlobalId.trim(),
          comment: 'batch approve from mapping review',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || data?.error || data?.error_code || 'batch approve failed');
        return;
      }
      setSelectedIds({});
      await loadMappings();
      if (selectedId) await loadDetail(selectedId);
      const softMsg = data.soft_revoked > 0 ? ` (${data.soft_revoked} auto soft-revoked)` : '';
      setOpMsg(`Batch approved: ${data.approved ?? ids.length}${softMsg}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'batch approve failed');
    }
  }

  return (
    <main>
      <div className="header">
        <div>
          <h1 className="ios-title">Mapping Review</h1>
          <p className="ios-subtitle">Master Data Governance Queue · Human-in-the-loop</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select data-testid="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as MappingStatus | 'ALL')}>
          <option value="ALL">ALL</option>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="REVOKED">REVOKED</option>
          <option value="SOFT_REVOKED">SOFT_REVOKED</option>
        </select>

        <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value as EntityType | 'ALL')}>
          <option value="ALL">ALL ENTITY</option>
          <option value="PRODUCT">PRODUCT</option>
          <option value="LISTING">LISTING</option>
          <option value="SUPPLIER">SUPPLIER</option>
          <option value="WAREHOUSE">WAREHOUSE</option>
        </select>

        <input
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          placeholder="source_system"
          style={{ width: 140 }}
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search external id"
          style={{ width: 220 }}
        />
        <button className="secondary" onClick={() => loadMappings()}>Refresh</button>
      </div>

      {error ? <div className="card" style={{ color: 'var(--danger)', marginBottom: 16 }}>{error}</div> : null}
      {opMsg ? <div className="card" style={{ color: 'var(--success)', marginBottom: 16 }}>{opMsg}</div> : null}

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '10px 16px' }}>
        <button className="secondary" onClick={() => void handleReconcileDryRun()} disabled={reconcileLoading}>
          {reconcileLoading ? 'Running…' : 'Reconcile Dry-Run'}
        </button>
        {reconcileResult && (
          <>
            <span style={{ fontWeight: 700, fontSize: 14, color: reconcileResult.go_no_go === 'GO' ? 'var(--success, #16a34a)' : 'var(--danger, #dc2626)' }}>
              {reconcileResult.go_no_go === 'GO' ? '✓ GO' : '✗ NO-GO'}
            </span>
            <span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>
              P0冲突: <strong style={{ color: reconcileResult.p0_double_approved_conflicts > 0 ? 'var(--danger, #dc2626)' : 'inherit' }}>{reconcileResult.p0_double_approved_conflicts}</strong>
              {' · '}APPROVED: {reconcileResult.summary.approved}
              {' · '}PENDING: {reconcileResult.summary.pending}
              {' · '}SOFT_REVOKED: {reconcileResult.summary.soft_revoked}
              {' · '}<span style={{ opacity: 0.6 }}>{reconcileResult.generated_at.slice(0, 19).replace('T', ' ')} UTC</span>
            </span>
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16 }}>
        <div className="card table-wrap" style={{ overflow: 'auto' }}>
          {loading ? <div style={{ padding: 16 }}>Loading mappings...</div> : null}
          <table>
            <thead>
              <tr>
                <th />
                <th>ID</th>
                <th>Entity</th>
                <th>Source</th>
                <th>External ID</th>
                <th>Status</th>
                <th>Score</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={8}>No mapping records.</td></tr>
              ) : null}
              {items.map((it) => (
                <tr
                  key={it.id}
                  onClick={() => setSelectedId(it.id)}
                  style={{
                    cursor: 'pointer',
                    background: selectedId === it.id ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                  }}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={!!selectedIds[it.id]}
                      onChange={(e) => setSelectedIds((prev) => ({ ...prev, [it.id]: e.target.checked }))}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="small">{it.id.slice(0, 8)}...</td>
                  <td>{it.entityType}</td>
                  <td>{it.sourceSystem}</td>
                  <td>{it.externalId}</td>
                  <td><span className={`status ${it.status}`}>{it.status}</span></td>
                  <td>{it.confidenceScore ?? '-'}</td>
                  <td>{fmt(it.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ padding: 12, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="small">Selected: {selectedCount}</span>
            <input
              value={approvedGlobalId}
              onChange={(e) => setApprovedGlobalId(e.target.value)}
              placeholder="approved global id"
              style={{ width: 260 }}
            />
            <button className="approve" disabled={selectedCount === 0} onClick={() => void handleBatchApprove()}>
              Batch Approve
            </button>
          </div>
        </div>

        <div className="card" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 180px)' }}>
          {!selectedId ? <div>Select one mapping record.</div> : null}
          {detailLoading ? <div>Loading detail...</div> : null}
          {detail && !detailLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h3 style={{ margin: '0 0 8px' }}>Mapping Detail</h3>
                <div className="small">ID: {detail.mapping.id}</div>
                <div className="small">Status: {detail.mapping.status}</div>
                <div className="small">Version: {detail.mapping.version}</div>
                <div className="small">Entity: {detail.mapping.entityType}</div>
                <div className="small">Source: {detail.mapping.sourceSystem}</div>
                <div className="small">External: {detail.mapping.externalId}</div>
                <div className="small">Current Global: {detail.mapping.globalId}</div>
              </div>

              <div style={{ padding: 12, border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Approve</div>
                <input
                  value={approvedGlobalId}
                  onChange={(e) => setApprovedGlobalId(e.target.value)}
                  placeholder="approved global id"
                  style={{ width: '100%', marginBottom: 8 }}
                />
                <button className="approve" onClick={() => void handleApprove()}>Approve</button>
              </div>

              <div style={{ padding: 12, border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Reject</div>
                <input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="reject reason"
                  style={{ width: '100%', marginBottom: 8 }}
                />
                <button className="reject" onClick={() => void handleReject()}>Reject</button>
              </div>

              <div style={{ padding: 12, border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Revoke</div>
                <input
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="revoke reason"
                  style={{ width: '100%', marginBottom: 8 }}
                />
                <button className="secondary danger" onClick={() => void handleRevoke()}>Revoke</button>
              </div>

              {detail.mapping.entityType === 'PRODUCT' ? (
                <div style={{ padding: 12, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Create Product and Approve</div>
                  <input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="product name" style={{ width: '100%', marginBottom: 8 }} />
                  <select value={createBrandId} onChange={(e) => setCreateBrandId(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
                    <option value="">Select brand</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code || '-'})</option>)}
                  </select>
                  <select value={createCategoryId} onChange={(e) => setCreateCategoryId(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
                    <option value="">Select category</option>
                    {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name} ({cat.code || '-'})</option>)}
                  </select>
                  <input value={createSku} onChange={(e) => setCreateSku(e.target.value)} placeholder="sku (optional)" style={{ width: '100%', marginBottom: 8 }} />
                  <button className="approve" onClick={() => void handleCreateAndApprove()}>Create + Approve</button>
                </div>
              ) : null}

              <div style={{ padding: 12, border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Audit History</div>
                {detail.audit_history.length === 0 ? (
                  <div className="small">No history.</div>
                ) : detail.audit_history.map((h) => (
                  <div key={h.id} style={{ padding: '6px 0', borderBottom: '1px dashed var(--border-color)' }}>
                    <div className="small"><strong>{h.action}</strong> ({h.oldStatus || '-'} → {h.newStatus || '-'})</div>
                    <div className="small">By: {h.changedBy}</div>
                    <div className="small">Reason: {h.reason || '-'}</div>
                    <div className="small">{fmt(h.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

