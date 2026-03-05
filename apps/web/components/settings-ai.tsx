'use client';

import { useState, useEffect } from 'react';
import { useTenant } from './tenant-context';
import { useAuth } from './auth-context';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

type ModelOption = {
    id: string;
    name: string;
    description: string;
    isLegacy?: boolean;
};

type ModelCatalogResponse = {
    defaultModelId?: string;
    currentModelId?: string;
    canEditModel?: boolean;
    policyApplied?: boolean;
    items?: ModelOption[];
    allItems?: ModelOption[];
};

type RoleKey = 'system_admin' | 'tenant_admin' | 'operator' | 'supplier' | 'viewer';

type RolePolicy = {
    includeLegacy?: boolean;
    allowedModelIds?: string[];
    blockedModelIds?: string[];
};

type AiModelPolicy = {
    includeLegacyByDefault?: boolean;
    allowedModelIds?: string[];
    blockedModelIds?: string[];
    roleOverrides?: Partial<Record<RoleKey, RolePolicy>>;
};

type ModelPolicyResponse = {
    policy?: AiModelPolicy | null;
    items?: ModelOption[];
};

type PolicyAuditItem = {
    id: string;
    eventType: 'AI_MODEL_POLICY_UPDATED' | 'AI_MODEL_POLICY_CLEARED';
    createdAt: string;
    details?: {
        actorRole?: string;
        actorUserId?: string;
        previousPolicy?: AiModelPolicy | null;
        newPolicy?: AiModelPolicy | null;
    } | null;
};

type PolicyAuditResponse = {
    items?: PolicyAuditItem[];
};

type PolicyAuditEventFilter = 'ALL' | 'AI_MODEL_POLICY_UPDATED' | 'AI_MODEL_POLICY_CLEARED';

type PolicyDiffSummary = {
    added: string[];
    removed: string[];
    changed: string[];
};

function flattenPolicyValue(
    value: unknown,
    prefix = '',
    out: Map<string, string> = new Map(),
): Map<string, string> {
    const key = prefix || '$';
    if (value === null || typeof value !== 'object') {
        out.set(key, JSON.stringify(value));
        return out;
    }
    if (Array.isArray(value)) {
        out.set(key, JSON.stringify(value));
        return out;
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
        out.set(key, '{}');
        return out;
    }
    for (const [childKey, childValue] of entries) {
        const childPath = prefix ? `${prefix}.${childKey}` : childKey;
        flattenPolicyValue(childValue, childPath, out);
    }
    return out;
}

function summarizePolicyDiff(previousPolicy: unknown, newPolicy: unknown): PolicyDiffSummary {
    const previousMap = flattenPolicyValue(previousPolicy ?? null);
    const newMap = flattenPolicyValue(newPolicy ?? null);
    const paths = Array.from(new Set([...previousMap.keys(), ...newMap.keys()])).sort();

    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];

    for (const path of paths) {
        const before = previousMap.get(path);
        const after = newMap.get(path);
        if (before === undefined && after !== undefined) {
            added.push(path);
            continue;
        }
        if (before !== undefined && after === undefined) {
            removed.push(path);
            continue;
        }
        if (before !== after) {
            changed.push(path);
        }
    }

    return { added, removed, changed };
}

const FALLBACK_MODELS: ModelOption[] = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast and cost-effective default choice' },
];

export function SettingsAi() {
    const { currentTenantId } = useTenant();
    const { authHeaders } = useAuth();
    const [geminiKey, setGeminiKey] = useState('');
    const [modelId, setModelId] = useState('gemini-2.5-flash');
    const [models, setModels] = useState<ModelOption[]>(FALLBACK_MODELS);
    const [allModels, setAllModels] = useState<ModelOption[]>(FALLBACK_MODELS);
    const [canEditModel, setCanEditModel] = useState(true);
    const [policyApplied, setPolicyApplied] = useState(false);
    const [policySaving, setPolicySaving] = useState(false);
    const [policyMessage, setPolicyMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [includeLegacyByDefault, setIncludeLegacyByDefault] = useState(false);
    const [allowedModelIdsInput, setAllowedModelIdsInput] = useState('');
    const [blockedModelIdsInput, setBlockedModelIdsInput] = useState('');
    const [operatorIncludeLegacy, setOperatorIncludeLegacy] = useState('');
    const [operatorAllowedInput, setOperatorAllowedInput] = useState('');
    const [operatorBlockedInput, setOperatorBlockedInput] = useState('');
    const [tenantAdminIncludeLegacy, setTenantAdminIncludeLegacy] = useState('');
    const [tenantAdminAllowedInput, setTenantAdminAllowedInput] = useState('');
    const [tenantAdminBlockedInput, setTenantAdminBlockedInput] = useState('');
    const [supplierIncludeLegacy, setSupplierIncludeLegacy] = useState('');
    const [supplierAllowedInput, setSupplierAllowedInput] = useState('');
    const [supplierBlockedInput, setSupplierBlockedInput] = useState('');
    const [viewerIncludeLegacy, setViewerIncludeLegacy] = useState('');
    const [viewerAllowedInput, setViewerAllowedInput] = useState('');
    const [viewerBlockedInput, setViewerBlockedInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [showKey, setShowKey] = useState(false);
    const [policyAuditItems, setPolicyAuditItems] = useState<PolicyAuditItem[]>([]);
    const [policyAuditLoading, setPolicyAuditLoading] = useState(false);
    const [policyAuditEventFilter, setPolicyAuditEventFilter] = useState<PolicyAuditEventFilter>('ALL');
    const [expandedAuditIds, setExpandedAuditIds] = useState<Record<string, boolean>>({});

    const parseIdList = (raw: string) => Array.from(new Set(
        raw
            .split(/[\n,]/)
            .map((x) => x.trim())
            .filter(Boolean)
    ));

    const hydratePolicyForm = (policy: AiModelPolicy | null | undefined) => {
        setIncludeLegacyByDefault(Boolean(policy?.includeLegacyByDefault));
        setAllowedModelIdsInput((policy?.allowedModelIds ?? []).join(', '));
        setBlockedModelIdsInput((policy?.blockedModelIds ?? []).join(', '));
        const op = policy?.roleOverrides?.operator;
        if (typeof op?.includeLegacy === 'boolean') {
            setOperatorIncludeLegacy(op.includeLegacy ? 'true' : 'false');
        } else {
            setOperatorIncludeLegacy('');
        }
        setOperatorAllowedInput((op?.allowedModelIds ?? []).join(', '));
        setOperatorBlockedInput((op?.blockedModelIds ?? []).join(', '));

        const ta = policy?.roleOverrides?.tenant_admin;
        if (typeof ta?.includeLegacy === 'boolean') {
            setTenantAdminIncludeLegacy(ta.includeLegacy ? 'true' : 'false');
        } else {
            setTenantAdminIncludeLegacy('');
        }
        setTenantAdminAllowedInput((ta?.allowedModelIds ?? []).join(', '));
        setTenantAdminBlockedInput((ta?.blockedModelIds ?? []).join(', '));

        const sp = policy?.roleOverrides?.supplier;
        if (typeof sp?.includeLegacy === 'boolean') {
            setSupplierIncludeLegacy(sp.includeLegacy ? 'true' : 'false');
        } else {
            setSupplierIncludeLegacy('');
        }
        setSupplierAllowedInput((sp?.allowedModelIds ?? []).join(', '));
        setSupplierBlockedInput((sp?.blockedModelIds ?? []).join(', '));

        const vw = policy?.roleOverrides?.viewer;
        if (typeof vw?.includeLegacy === 'boolean') {
            setViewerIncludeLegacy(vw.includeLegacy ? 'true' : 'false');
        } else {
            setViewerIncludeLegacy('');
        }
        setViewerAllowedInput((vw?.allowedModelIds ?? []).join(', '));
        setViewerBlockedInput((vw?.blockedModelIds ?? []).join(', '));
    };

    const buildPolicyPayload = (): AiModelPolicy => {
        const opIncludeLegacy = operatorIncludeLegacy === 'true'
            ? true
            : operatorIncludeLegacy === 'false'
                ? false
                : undefined;
        const taIncludeLegacy = tenantAdminIncludeLegacy === 'true'
            ? true
            : tenantAdminIncludeLegacy === 'false'
                ? false
                : undefined;
        const spIncludeLegacy = supplierIncludeLegacy === 'true'
            ? true
            : supplierIncludeLegacy === 'false'
                ? false
                : undefined;
        const vwIncludeLegacy = viewerIncludeLegacy === 'true'
            ? true
            : viewerIncludeLegacy === 'false'
                ? false
                : undefined;
        return {
            includeLegacyByDefault,
            allowedModelIds: parseIdList(allowedModelIdsInput),
            blockedModelIds: parseIdList(blockedModelIdsInput),
            roleOverrides: {
                tenant_admin: {
                    includeLegacy: taIncludeLegacy,
                    allowedModelIds: parseIdList(tenantAdminAllowedInput),
                    blockedModelIds: parseIdList(tenantAdminBlockedInput),
                },
                operator: {
                    includeLegacy: opIncludeLegacy,
                    allowedModelIds: parseIdList(operatorAllowedInput),
                    blockedModelIds: parseIdList(operatorBlockedInput),
                },
                supplier: {
                    includeLegacy: spIncludeLegacy,
                    allowedModelIds: parseIdList(supplierAllowedInput),
                    blockedModelIds: parseIdList(supplierBlockedInput),
                },
                viewer: {
                    includeLegacy: vwIncludeLegacy,
                    allowedModelIds: parseIdList(viewerAllowedInput),
                    blockedModelIds: parseIdList(viewerBlockedInput),
                }
            }
        };
    };

    const refreshModelCatalog = async () => {
        if (!currentTenantId) return;
        const catalogRaw = await fetch(`${API_BASE}/mdm/ai-config/models?tenantId=${currentTenantId}`, {
            headers: { ...authHeaders },
        }).then(r => r.json());
        const catalog = catalogRaw as ModelCatalogResponse;
        if (Array.isArray(catalog.items) && catalog.items.length > 0) {
            setModels(catalog.items);
            setModelId((prev) => {
                const exists = catalog.items?.some((m) => m.id === prev);
                return exists ? prev : (catalog.currentModelId ?? prev);
            });
        }
        if (Array.isArray(catalog.allItems) && catalog.allItems.length > 0) {
            setAllModels(catalog.allItems);
        } else if (Array.isArray(catalog.items) && catalog.items.length > 0) {
            setAllModels(catalog.items);
        }
        setCanEditModel(catalog.canEditModel ?? true);
        setPolicyApplied(Boolean(catalog.policyApplied));
    };

    const refreshPolicyAudit = async (eventFilter?: PolicyAuditEventFilter) => {
        if (!currentTenantId) return;
        setPolicyAuditLoading(true);
        const currentFilter = eventFilter ?? policyAuditEventFilter;
        const filterQuery = currentFilter === 'ALL' ? '' : `&eventType=${encodeURIComponent(currentFilter)}`;
        try {
            const raw = await fetch(`${API_BASE}/mdm/ai-config/model-policy/audit?tenantId=${currentTenantId}&limit=20${filterQuery}`, {
                headers: { ...authHeaders },
            }).then((r) => r.json());
            const data = raw as PolicyAuditResponse;
            setPolicyAuditItems(Array.isArray(data.items) ? data.items : []);
        } catch {
            setPolicyAuditItems([]);
        } finally {
            setPolicyAuditLoading(false);
        }
    };

    const exportPolicyAudit = () => {
        const payload = {
            exportedAt: new Date().toISOString(),
            filter: policyAuditEventFilter,
            items: policyAuditItems,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `ai-model-policy-audit-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    };

    const toggleAuditExpanded = (id: string) => {
        setExpandedAuditIds((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    // Fetch existing settings from server
    useEffect(() => {
        if (!currentTenantId) return;
        setLoading(true);
        Promise.all([
            fetch(`${API_BASE}/mdm/ai-config?tenantId=${currentTenantId}`, {
                headers: { ...authHeaders },
            }).then(r => r.json()),
            fetch(`${API_BASE}/mdm/ai-config/models?tenantId=${currentTenantId}`, {
                headers: { ...authHeaders },
            }).then(r => r.json()),
            fetch(`${API_BASE}/mdm/ai-config/model-policy?tenantId=${currentTenantId}`, {
                headers: { ...authHeaders },
            }).then(r => r.json()).catch(() => ({ policy: null })),
        ])
            .then(([config, catalogRaw, policyRaw]) => {
                const catalog = catalogRaw as ModelCatalogResponse;
                const policyResp = policyRaw as ModelPolicyResponse;
                if (config.geminiKey) setGeminiKey(config.geminiKey);
                if (Array.isArray(catalog.items) && catalog.items.length > 0) {
                    setModels(catalog.items);
                }
                if (Array.isArray(catalog.allItems) && catalog.allItems.length > 0) {
                    setAllModels(catalog.allItems);
                } else if (Array.isArray(catalog.items) && catalog.items.length > 0) {
                    setAllModels(catalog.items);
                }
                setCanEditModel(catalog.canEditModel ?? true);
                setPolicyApplied(Boolean(catalog.policyApplied));
                hydratePolicyForm(policyResp.policy ?? null);
                if (config.modelId) {
                    setModelId(config.modelId);
                } else if (catalog.currentModelId) {
                    setModelId(catalog.currentModelId);
                }
                void refreshPolicyAudit(policyAuditEventFilter);
            })
            .catch(e => console.error('Failed to fetch AI config:', e))
            .finally(() => setLoading(false));
    }, [currentTenantId, authHeaders]);

    useEffect(() => {
        if (!currentTenantId) return;
        void refreshPolicyAudit(policyAuditEventFilter);
    }, [policyAuditEventFilter]);

    const handleSave = async () => {
        if (!currentTenantId) return;
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE}/mdm/ai-config?tenantId=${currentTenantId}`, {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ geminiKey, modelId })
            });
            if (res.ok) {
                alert('AI Configuration saved successfully');
            } else {
                const err = await res.json();
                alert(`Error: ${err.error || 'Failed to save configuration'}`);
            }
        } catch (e) {
            console.error(e);
            alert('A network error occurred');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        if (!currentTenantId) return;
        setTesting(true);
        setTestResult(null);
        try {
            const res = await fetch(`${API_BASE}/mdm/ai-config/test?tenantId=${currentTenantId}`, {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ geminiKey, modelId })
            });
            const data = await res.json();
            setTestResult({
                success: res.ok,
                message: data.message || (res.ok ? 'Connection established successfully!' : data.error || 'Connection failed')
            });
        } catch (e) {
            setTestResult({ success: false, message: 'Network error during test' });
        } finally {
            setTesting(false);
        }
    };

    const handleSavePolicy = async () => {
        if (!currentTenantId) return;
        setPolicySaving(true);
        setPolicyMessage(null);
        try {
            const policy = buildPolicyPayload();
            const res = await fetch(`${API_BASE}/mdm/ai-config/model-policy?tenantId=${currentTenantId}`, {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ policy }),
            });
            const data = await res.json();
            if (!res.ok) {
                setPolicyMessage({ ok: false, text: data.error || 'Failed to save model policy' });
                return;
            }
            await refreshModelCatalog();
            await refreshPolicyAudit();
            setPolicyMessage({ ok: true, text: 'Model policy saved successfully.' });
        } catch (e) {
            setPolicyMessage({ ok: false, text: 'Network error while saving model policy.' });
        } finally {
            setPolicySaving(false);
        }
    };

    const handleResetPolicy = async () => {
        if (!currentTenantId) return;
        setPolicySaving(true);
        setPolicyMessage(null);
        try {
            const res = await fetch(`${API_BASE}/mdm/ai-config/model-policy?tenantId=${currentTenantId}`, {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ policy: null }),
            });
            const data = await res.json();
            if (!res.ok) {
                setPolicyMessage({ ok: false, text: data.error || 'Failed to clear model policy' });
                return;
            }
            hydratePolicyForm(null);
            await refreshModelCatalog();
            await refreshPolicyAudit();
            setPolicyMessage({ ok: true, text: 'Model policy cleared. Default visibility rules are active.' });
        } catch {
            setPolicyMessage({ ok: false, text: 'Network error while clearing model policy.' });
        } finally {
            setPolicySaving(false);
        }
    };

    if (loading) return <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 48 }}>Loading AI Configuration...</p>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Google / Vertex AI Section */}
            <div style={{
                background: 'var(--panel-bg)',
                borderRadius: 'var(--border-radius-lg)',
                border: '1px solid var(--panel-border)',
                padding: 24,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'linear-gradient(135deg, #4285F4 0%, #34A853 100%)',
                        display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700, fontSize: 18
                    }}>G</div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Google Vertex AI (Gemini)</h3>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>Powering Knowledge Graphs and Agent Reasoning</p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                            Gemini API Key
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showKey ? "text" : "password"}
                                value={geminiKey}
                                onChange={(e) => setGeminiKey(e.target.value)}
                                placeholder="Paste your Gemini API key from Google AI Studio"
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: 8,
                                    border: '1px solid var(--panel-border)',
                                    background: 'var(--panel-bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: 14,
                                    fontFamily: 'monospace'
                                }}
                            />
                            <button
                                onClick={() => setShowKey(!showKey)}
                                style={{
                                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', color: 'var(--text-tertiary)',
                                    cursor: 'pointer', fontSize: 12
                                }}
                            >
                                {showKey ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
                            Preferred Model
                        </label>
                        <select
                            value={modelId}
                            onChange={(e) => setModelId(e.target.value)}
                            disabled={!canEditModel}
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: 8,
                                border: '1px solid var(--panel-border)',
                                background: 'var(--panel-bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: 14,
                                cursor: canEditModel ? 'pointer' : 'not-allowed',
                                opacity: canEditModel ? 1 : 0.7,
                            }}
                        >
                            {models.map(m => (
                                <option key={m.id} value={m.id}>
                                    {m.name} — {m.description}{m.isLegacy ? ' (Legacy)' : ''}
                                </option>
                            ))}
                        </select>
                        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
                            Selected model will be used for reasoning tasks. Ensure your quota supports this model.
                        </p>
                        {policyApplied && (
                            <p style={{ marginTop: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
                                Model list is filtered by tenant policy and role.
                            </p>
                        )}
                    </div>

                    {testResult && (
                        <div style={{
                            padding: '12px 16px', borderRadius: 8,
                            background: testResult.success ? 'rgba(52, 168, 83, 0.1)' : 'rgba(234, 67, 53, 0.1)',
                            border: `1px solid ${testResult.success ? 'var(--success)' : 'var(--danger)'}`,
                            display: 'flex', alignItems: 'center', gap: 10
                        }}>
                            <span style={{ fontSize: 16 }}>{testResult.success ? '✅' : '❌'}</span>
                            <span style={{ fontSize: 13, color: testResult.success ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
                                {testResult.message}
                            </span>
                        </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button
                            onClick={handleTest}
                            disabled={testing || !geminiKey}
                            style={{
                                padding: '10px 20px', borderRadius: 8,
                                border: '1px solid var(--panel-border)',
                                background: 'transparent', color: 'var(--text-primary)',
                                fontWeight: 600, cursor: (testing || !geminiKey) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s', opacity: testing ? 0.7 : 1
                            }}
                        >
                            {testing ? 'Testing...' : 'Test Connection'}
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={saving || !geminiKey}
                            style={{
                                padding: '10px 24px', borderRadius: 8, border: 'none',
                                background: 'var(--accent)', color: 'white',
                                fontWeight: 600, cursor: (saving || !geminiKey) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s', opacity: saving ? 0.7 : 1
                            }}
                        >
                            {saving ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </div>
            </div>

            <div style={{
                background: 'var(--panel-bg)',
                borderRadius: 'var(--border-radius-lg)',
                border: '1px solid var(--panel-border)',
                padding: 24,
            }}>
                <div style={{ marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Model Visibility Policy</h3>
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
                        Control which models are visible by default and add operator-specific overrides.
                    </p>
                </div>

                <div style={{ display: 'grid', gap: 14 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                        <input
                            type="checkbox"
                            checked={includeLegacyByDefault}
                            onChange={(e) => setIncludeLegacyByDefault(e.target.checked)}
                            disabled={!canEditModel}
                        />
                        Include legacy models by default (all roles)
                    </label>

                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
                            Allowed Model IDs (comma/newline separated)
                        </label>
                        <textarea
                            value={allowedModelIdsInput}
                            onChange={(e) => setAllowedModelIdsInput(e.target.value)}
                            placeholder="Leave empty to allow all models"
                            disabled={!canEditModel}
                            rows={2}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: 8,
                                border: '1px solid var(--panel-border)',
                                background: 'var(--panel-bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: 13
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
                            Blocked Model IDs (comma/newline separated)
                        </label>
                        <textarea
                            value={blockedModelIdsInput}
                            onChange={(e) => setBlockedModelIdsInput(e.target.value)}
                            placeholder="Example: gemini-1.5-pro"
                            disabled={!canEditModel}
                            rows={2}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: 8,
                                border: '1px solid var(--panel-border)',
                                background: 'var(--panel-bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: 13
                            }}
                        />
                    </div>

                    <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: 12 }}>
                        <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-tertiary)' }}>Role Overrides (optional)</p>
                        <div style={{ display: 'grid', gap: 10 }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Tenant Admin</p>
                            <select
                                value={tenantAdminIncludeLegacy}
                                onChange={(e) => setTenantAdminIncludeLegacy(e.target.value)}
                                disabled={!canEditModel}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: '1px solid var(--panel-border)',
                                    background: 'var(--panel-bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: 13
                                }}
                            >
                                <option value="">Legacy visibility: inherit default</option>
                                <option value="true">Legacy visibility: force enabled</option>
                                <option value="false">Legacy visibility: force disabled</option>
                            </select>
                            <textarea
                                value={tenantAdminAllowedInput}
                                onChange={(e) => setTenantAdminAllowedInput(e.target.value)}
                                placeholder="Tenant admin allowed models (optional)"
                                disabled={!canEditModel}
                                rows={2}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: '1px solid var(--panel-border)',
                                    background: 'var(--panel-bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: 13
                                }}
                            />
                            <textarea
                                value={tenantAdminBlockedInput}
                                onChange={(e) => setTenantAdminBlockedInput(e.target.value)}
                                placeholder="Tenant admin blocked models (optional)"
                                disabled={!canEditModel}
                                rows={2}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: '1px solid var(--panel-border)',
                                    background: 'var(--panel-bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: 13
                                }}
                            />

                            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Operator</p>
                            <select
                                value={operatorIncludeLegacy}
                                onChange={(e) => setOperatorIncludeLegacy(e.target.value)}
                                disabled={!canEditModel}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: '1px solid var(--panel-border)',
                                    background: 'var(--panel-bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: 13
                                }}
                            >
                                <option value="">Legacy visibility: inherit default</option>
                                <option value="true">Legacy visibility: force enabled</option>
                                <option value="false">Legacy visibility: force disabled</option>
                            </select>
                            <textarea
                                value={operatorAllowedInput}
                                onChange={(e) => setOperatorAllowedInput(e.target.value)}
                                placeholder="Operator allowed models (optional)"
                                disabled={!canEditModel}
                                rows={2}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: '1px solid var(--panel-border)',
                                    background: 'var(--panel-bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: 13
                                }}
                            />
                            <textarea
                                value={operatorBlockedInput}
                                onChange={(e) => setOperatorBlockedInput(e.target.value)}
                                placeholder="Operator blocked models (optional)"
                                disabled={!canEditModel}
                                rows={2}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: '1px solid var(--panel-border)',
                                    background: 'var(--panel-bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: 13
                                }}
                            />

                            <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Supplier</p>
                            <select
                                value={supplierIncludeLegacy}
                                onChange={(e) => setSupplierIncludeLegacy(e.target.value)}
                                disabled={!canEditModel}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: '1px solid var(--panel-border)',
                                    background: 'var(--panel-bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: 13
                                }}
                            >
                                <option value="">Legacy visibility: inherit default</option>
                                <option value="true">Legacy visibility: force enabled</option>
                                <option value="false">Legacy visibility: force disabled</option>
                            </select>
                            <textarea
                                value={supplierAllowedInput}
                                onChange={(e) => setSupplierAllowedInput(e.target.value)}
                                placeholder="Supplier allowed models (optional)"
                                disabled={!canEditModel}
                                rows={2}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: '1px solid var(--panel-border)',
                                    background: 'var(--panel-bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: 13
                                }}
                            />
                            <textarea
                                value={supplierBlockedInput}
                                onChange={(e) => setSupplierBlockedInput(e.target.value)}
                                placeholder="Supplier blocked models (optional)"
                                disabled={!canEditModel}
                                rows={2}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: '1px solid var(--panel-border)',
                                    background: 'var(--panel-bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: 13
                                }}
                            />

                            <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Viewer</p>
                            <select
                                value={viewerIncludeLegacy}
                                onChange={(e) => setViewerIncludeLegacy(e.target.value)}
                                disabled={!canEditModel}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: '1px solid var(--panel-border)',
                                    background: 'var(--panel-bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: 13
                                }}
                            >
                                <option value="">Legacy visibility: inherit default</option>
                                <option value="true">Legacy visibility: force enabled</option>
                                <option value="false">Legacy visibility: force disabled</option>
                            </select>
                            <textarea
                                value={viewerAllowedInput}
                                onChange={(e) => setViewerAllowedInput(e.target.value)}
                                placeholder="Viewer allowed models (optional)"
                                disabled={!canEditModel}
                                rows={2}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: '1px solid var(--panel-border)',
                                    background: 'var(--panel-bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: 13
                                }}
                            />
                            <textarea
                                value={viewerBlockedInput}
                                onChange={(e) => setViewerBlockedInput(e.target.value)}
                                placeholder="Viewer blocked models (optional)"
                                disabled={!canEditModel}
                                rows={2}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: '1px solid var(--panel-border)',
                                    background: 'var(--panel-bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: 13
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        Available models: {allModels.map((m) => m.id).join(', ')}
                    </div>

                    {policyMessage && (
                        <div style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            fontSize: 13,
                            color: policyMessage.ok ? 'var(--success)' : 'var(--danger)',
                            border: `1px solid ${policyMessage.ok ? 'var(--success)' : 'var(--danger)'}`,
                            background: policyMessage.ok ? 'rgba(52,168,83,0.08)' : 'rgba(234,67,53,0.08)'
                        }}>
                            {policyMessage.text}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <button
                            onClick={handleResetPolicy}
                            disabled={policySaving || !canEditModel}
                            style={{
                                padding: '10px 18px',
                                borderRadius: 8,
                                border: '1px solid var(--panel-border)',
                                background: 'transparent',
                                color: 'var(--text-primary)',
                                fontWeight: 600,
                                cursor: (policySaving || !canEditModel) ? 'not-allowed' : 'pointer',
                                opacity: policySaving ? 0.7 : 1,
                            }}
                        >
                            Clear Policy
                        </button>
                        <button
                            onClick={handleSavePolicy}
                            disabled={policySaving || !canEditModel}
                            style={{
                                padding: '10px 18px',
                                borderRadius: 8,
                                border: 'none',
                                background: 'var(--accent)',
                                color: 'white',
                                fontWeight: 600,
                                cursor: (policySaving || !canEditModel) ? 'not-allowed' : 'pointer',
                                opacity: policySaving ? 0.7 : 1,
                            }}
                        >
                            {policySaving ? 'Saving Policy...' : 'Save Policy'}
                        </button>
                    </div>
                </div>
            </div>

            <div style={{
                background: 'var(--panel-bg)',
                borderRadius: 'var(--border-radius-lg)',
                border: '1px solid var(--panel-border)',
                padding: 24,
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Policy Audit</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select
                            value={policyAuditEventFilter}
                            onChange={(e) => setPolicyAuditEventFilter(e.target.value as PolicyAuditEventFilter)}
                            style={{
                                padding: '6px 10px',
                                borderRadius: 8,
                                border: '1px solid var(--panel-border)',
                                background: 'var(--panel-bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: 12,
                            }}
                        >
                            <option value="ALL">All Events</option>
                            <option value="AI_MODEL_POLICY_UPDATED">Updated</option>
                            <option value="AI_MODEL_POLICY_CLEARED">Cleared</option>
                        </select>
                        <button
                            onClick={exportPolicyAudit}
                            disabled={policyAuditItems.length === 0}
                            style={{
                                padding: '6px 10px',
                                borderRadius: 8,
                                border: '1px solid var(--panel-border)',
                                background: 'transparent',
                                color: 'var(--text-primary)',
                                cursor: policyAuditItems.length === 0 ? 'not-allowed' : 'pointer',
                                fontSize: 12,
                                fontWeight: 600,
                            }}
                        >
                            Export JSON
                        </button>
                        <button
                            onClick={() => void refreshPolicyAudit(policyAuditEventFilter)}
                            disabled={policyAuditLoading}
                            style={{
                                padding: '6px 10px',
                                borderRadius: 8,
                                border: '1px solid var(--panel-border)',
                                background: 'transparent',
                                color: 'var(--text-primary)',
                                cursor: policyAuditLoading ? 'not-allowed' : 'pointer',
                                fontSize: 12,
                                fontWeight: 600,
                            }}
                        >
                            {policyAuditLoading ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>
                </div>

                {policyAuditItems.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No model policy audit events yet.</p>
                ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                        {policyAuditItems.map((item) => {
                            const details = item.details ?? {};
                            const prevAllowed = details.previousPolicy?.allowedModelIds?.length ?? 0;
                            const newAllowed = details.newPolicy?.allowedModelIds?.length ?? 0;
                            const prevBlocked = details.previousPolicy?.blockedModelIds?.length ?? 0;
                            const newBlocked = details.newPolicy?.blockedModelIds?.length ?? 0;
                            const expanded = Boolean(expandedAuditIds[item.id]);
                            const diff = summarizePolicyDiff(details.previousPolicy ?? null, details.newPolicy ?? null);
                            return (
                                <div
                                    key={item.id}
                                    style={{
                                        border: '1px solid var(--panel-border)',
                                        borderRadius: 10,
                                        padding: '10px 12px',
                                        background: 'var(--panel-bg-secondary)',
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                                            {item.eventType === 'AI_MODEL_POLICY_CLEARED' ? 'Policy Cleared' : 'Policy Updated'}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                                {new Date(item.createdAt).toLocaleString()}
                                            </span>
                                            <button
                                                onClick={() => toggleAuditExpanded(item.id)}
                                                style={{
                                                    padding: '4px 8px',
                                                    borderRadius: 6,
                                                    border: '1px solid var(--panel-border)',
                                                    background: 'transparent',
                                                    color: 'var(--text-primary)',
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {expanded ? 'Hide Diff' : 'View Diff'}
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                        Actor: {(details.actorRole ?? 'unknown')} ({details.actorUserId ?? 'unknown'})
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                        Allowed IDs: {prevAllowed} → {newAllowed} | Blocked IDs: {prevBlocked} → {newBlocked}
                                    </div>
                                    {expanded && (
                                        <div style={{ marginTop: 10 }}>
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                                                <span style={{
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    color: 'var(--success)',
                                                    border: '1px solid var(--panel-border)',
                                                    borderRadius: 999,
                                                    padding: '2px 8px',
                                                    background: 'var(--panel-bg)',
                                                }}>
                                                    Added: {diff.added.length}
                                                </span>
                                                <span style={{
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    color: 'var(--danger)',
                                                    border: '1px solid var(--panel-border)',
                                                    borderRadius: 999,
                                                    padding: '2px 8px',
                                                    background: 'var(--panel-bg)',
                                                }}>
                                                    Removed: {diff.removed.length}
                                                </span>
                                                <span style={{
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    color: 'var(--warning)',
                                                    border: '1px solid var(--panel-border)',
                                                    borderRadius: 999,
                                                    padding: '2px 8px',
                                                    background: 'var(--panel-bg)',
                                                }}>
                                                    Changed: {diff.changed.length}
                                                </span>
                                            </div>
                                            {(diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0) && (
                                                <div style={{
                                                    border: '1px solid var(--panel-border)',
                                                    borderRadius: 8,
                                                    padding: 8,
                                                    background: 'var(--panel-bg)',
                                                    marginBottom: 10,
                                                }}>
                                                    {diff.added.length > 0 && (
                                                        <div style={{ fontSize: 11, color: 'var(--success)', marginBottom: 4 }}>
                                                            + {diff.added.join(', ')}
                                                        </div>
                                                    )}
                                                    {diff.removed.length > 0 && (
                                                        <div style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 4 }}>
                                                            - {diff.removed.join(', ')}
                                                        </div>
                                                    )}
                                                    {diff.changed.length > 0 && (
                                                        <div style={{ fontSize: 11, color: 'var(--warning)' }}>
                                                            ~ {diff.changed.join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                            <div>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                                                    Previous Policy
                                                </div>
                                                <pre style={{
                                                    margin: 0,
                                                    padding: 8,
                                                    borderRadius: 8,
                                                    border: '1px solid var(--panel-border)',
                                                    background: 'var(--panel-bg)',
                                                    color: 'var(--text-secondary)',
                                                    fontSize: 11,
                                                    overflowX: 'auto',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                }}>
                                                    {JSON.stringify(details.previousPolicy ?? null, null, 2)}
                                                </pre>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                                                    New Policy
                                                </div>
                                                <pre style={{
                                                    margin: 0,
                                                    padding: 8,
                                                    borderRadius: 8,
                                                    border: '1px solid var(--panel-border)',
                                                    background: 'var(--panel-bg)',
                                                    color: 'var(--text-secondary)',
                                                    fontSize: 11,
                                                    overflowX: 'auto',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                }}>
                                                    {JSON.stringify(details.newPolicy ?? null, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Provider List / Future Extensions */}
            <div style={{ opacity: 0.5, pointerEvents: 'none' }}>
                <div style={{
                    background: 'var(--panel-bg)',
                    borderRadius: 'var(--border-radius-lg)',
                    border: '1px solid var(--panel-border)',
                    padding: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: '#00A67E',
                            display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center',
                            color: 'white', fontWeight: 700, fontSize: 18
                        }}>O</div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>OpenAI</h3>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>GPT-4o and o1-preview support (Coming Soon)</p>
                        </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--panel-bg-secondary)', padding: '4px 8px', borderRadius: 4 }}>Locked</span>
                </div>
            </div>
        </div>
    );
}
