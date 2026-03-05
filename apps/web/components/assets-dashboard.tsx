'use client';

import React, { useState, useEffect } from 'react';
import { Layers, Box, Globe, BarChart2, ChevronRight, Search, SlidersHorizontal, ArrowUpRight, TrendingUp, Activity, Trash2 } from 'lucide-react';
import { useTenant } from './tenant-context';
import { useAuth } from './auth-context';
import { Card, PageHeader, Badge } from './ui';
import { SovereignGovernanceInsight } from './sovereign-governance-insight';
import { AssetCreationForm } from './asset-creation-form';
import { ProductProfileView } from './product-profile-view';
import { Sparkles, Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

type ListingMapStatus = 'unmapped' | 'ai_suggested' | 'mapped' | 'rejected';
type ListingStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

interface APITreeListing {
    id: string;
    platform: { name: string; code: string };
    title: string;
    externalListingId: string;
    origin: string;
    mappingStatus: ListingMapStatus;
    status: ListingStatus;
}

interface APITreeCommodity {
    id: string;
    market: { name: string; currency: string };
    language: string;
    title: string;
    lifecycleStage: string;
    listings: APITreeListing[];
}

interface APITreeProduct {
    id: string;
    sku: string;
    name: string;
    lifecycleStage: string;
    category?: { name: string };
    brand?: { name: string };
    structuredFeatures: Record<string, any>;
    scenarios: string[];
    targetIntents: string[];
    competitiveEdges: Record<string, any>;
    commodities: APITreeCommodity[];
}

export function AssetsDashboard() {
    const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
    const { currentTenant, currentTenantId } = useTenant();
    const { authHeaders } = useAuth();
    const [products, setProducts] = useState<APITreeProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showDnaModal, setShowDnaModal] = useState(false);
    const [activeProductProfileId, setActiveProductProfileId] = useState<string | null>(null);

    const loadData = () => {
        if (!currentTenantId) return;
        setLoading(true);
        fetch(`${API_BASE}/mdm/products?tenantId=${currentTenantId}`, {
            headers: { ...authHeaders },
        })
            .then(res => res.json())
            .then(data => {
                setProducts(data.items ?? []);
                if (data.items?.length > 0 && !selectedAsset) {
                    setSelectedAsset(data.items[0].id);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadData();
    }, [currentTenantId, authHeaders.authorization, authHeaders['x-tenant-id']]);

    const assetDetails = products.find(a => a.id === selectedAsset);

    return (
        <>
            {activeProductProfileId ? (
                <ProductProfileView
                    productId={activeProductProfileId}
                    onBack={() => setActiveProductProfileId(null)}
                />
            ) : (
                <main style={{
                    display: 'grid',
                    gridTemplateColumns: selectedAsset ? '1fr 350px' : '1fr',
                    gap: 24,
                    height: 'calc(100vh - 64px)'
                }}>

                    {/* Main Asset Table View */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <PageHeader
                            title="Product Assets"
                            subtitle={`4-Tier Immutable Architecture (Product → Commodity → Listing → Performance) · ${currentTenant?.name}`}
                            actions={
                                <>
                                    <button className="primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setIsCreating(true)} title="Create a new product asset">
                                        + Create Asset
                                    </button>
                                    <button className="secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Filter the asset list">
                                        <SlidersHorizontal size={16} /> Filters
                                    </button>
                                    <div style={{ position: 'relative' }}>
                                        <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-secondary)' }} />
                                        <input type="text" placeholder="Search DNA, ASIN..." style={{ paddingLeft: 36, width: 220 }} />
                                    </div>
                                </>
                            }
                        />

                        <Card className="table-wrap" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: 'none', borderRadius: 0 }}>
                            {loading ? (
                                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading asset tree...</div>
                            ) : products.length === 0 ? (
                                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    <p>No products found for this tenant.</p>
                                    <button className="primary" style={{ marginTop: 16 }} onClick={() => setIsCreating(true)} title="Create your first product asset">+ Create Product</button>
                                </div>
                            ) : (
                                <table style={{ minWidth: 800 }}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: 40 }}>Lvl</th>
                                            <th>Core Asset ID</th>
                                            <th>Name / Market / Platform</th>
                                            <th>Health / Metrics</th>
                                            <th>Capital / Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.map((product) => {
                                            // Mocking some visual details missing from DB metrics model
                                            const healthScore = product.lifecycleStage === 'NEW' ? 95 : 75;
                                            const capitalAllocated = Math.floor(Math.random() * 50000 + 5000).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

                                            return (
                                                <React.Fragment key={product.id}>
                                                    {/* Level 1: Product */}
                                                    <tr
                                                        style={{ background: selectedAsset === product.id ? 'rgba(0,122,255,0.05)' : 'transparent', cursor: 'pointer' }}
                                                        onClick={() => setSelectedAsset(product.id)}
                                                    >
                                                        <td><Layers size={16} color="var(--accent)" /></td>
                                                        <td style={{ fontWeight: 600, fontSize: 13 }}>{product.sku}</td>
                                                        <td>
                                                            <div style={{ fontWeight: 600 }}>{product.name}</div>
                                                            <div className="small">{product.category?.name ?? 'Uncategorized'}</div>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <div style={{
                                                                    width: 60, height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.1)', overflow: 'hidden'
                                                                }}>
                                                                    <div style={{
                                                                        width: `${healthScore}%`, height: '100%',
                                                                        background: healthScore > 80 ? 'var(--success)' : healthScore > 50 ? 'var(--warning)' : 'var(--danger)'
                                                                    }} />
                                                                </div>
                                                                <span className="small">{healthScore}/100</span>
                                                            </div>
                                                        </td>
                                                        <td style={{ fontWeight: 600 }}>{capitalAllocated}</td>
                                                    </tr>
                                                    {product.commodities.map((cmd) => (
                                                        <React.Fragment key={cmd.id}>
                                                            <tr style={{ background: 'rgba(0,0,0,0.01)' }}>
                                                                <td style={{ paddingLeft: 32 }}><Globe size={16} color="var(--text-secondary)" /></td>
                                                                <td><span className="small">{cmd.id.split('-').shift()}</span></td>
                                                                <td>
                                                                    <div>{cmd.market.name}</div>
                                                                    <div className="small">Lang: {cmd.language}</div>
                                                                </td>
                                                                <td>
                                                                    <span className="small">Inventory: </span>
                                                                    <span style={{ fontWeight: 600 }}>-</span>
                                                                </td>
                                                                <td>
                                                                    <span className="small" style={{ color: 'var(--text-secondary)' }}>{cmd.lifecycleStage}</span>
                                                                </td>
                                                            </tr>

                                                            {/* Level 3: Listings */}
                                                            {cmd.listings.map((lst) => (
                                                                <tr key={lst.id} style={{ background: 'rgba(0,0,0,0.02)' }}>
                                                                    <td style={{ paddingLeft: 56 }}><Box size={16} color="var(--text-tertiary)" /></td>
                                                                    <td><span className="small" title={lst.id}>{lst.id.slice(0, 8)}...</span></td>
                                                                    <td>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                            <span>{lst.platform.name}</span>
                                                                        </div>
                                                                        <div className="small">{lst.externalListingId}</div>
                                                                    </td>
                                                                    <td>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                                            <div><span className="small">Mapping:</span> <span style={{ fontWeight: 600 }}>{lst.mappingStatus}</span></div>
                                                                        </div>
                                                                    </td>
                                                                    <td>
                                                                        <Badge variant={lst.status === 'ACTIVE' ? 'success' : lst.status === 'ARCHIVED' ? 'danger' : 'warning'}>
                                                                            {lst.status}
                                                                        </Badge>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </React.Fragment>
                                                    ))}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </Card>
                    </div>

                    {/* Slide-out Insights Panel */}
                    {selectedAsset && assetDetails && (
                        <Card style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <h3 style={{ fontSize: 18 }}>Asset Insights</h3>
                                <button className="secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setSelectedAsset(null)} title="Close the asset insights panel">
                                    Close
                                </button>
                            </div>

                            <div style={{ marginBottom: 24 }}>
                                <div className="small" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 700 }}>Core Entity</div>
                                <div style={{ fontSize: 24, fontWeight: 700 }}>{assetDetails.name}</div>
                                <div className="small" style={{ color: 'var(--text-secondary)' }}>SKU: {assetDetails.sku} · {assetDetails.category?.name}</div>
                            </div>

                            <div style={{ marginBottom: 24, padding: 16, background: 'rgba(0, 122, 255, 0.05)', borderRadius: 12, border: '1px solid rgba(0, 122, 255, 0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <TrendingUp size={18} color="var(--accent)" />
                                    <span style={{ fontWeight: 600, color: 'var(--accent)' }}>System Management</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                    <div>
                                        <div className="small" style={{ color: 'var(--text-secondary)' }}>Total Listings</div>
                                        <div style={{ fontSize: 24, fontWeight: 700 }}>
                                            {assetDetails.commodities.reduce((acc, cmd) => acc + cmd.listings.length, 0)}
                                        </div>
                                    </div>
                                    <button className="secondary" style={{ padding: '6px 12px', fontSize: 12 }} title="Configure system management rules for this asset">Configure</button>
                                </div>
                            </div>

                            <div style={{ marginBottom: 24, padding: 16, background: 'rgba(236, 72, 153, 0.05)', borderRadius: 12, border: '1px solid rgba(236, 72, 153, 0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Sparkles size={18} color="var(--primary)" />
                                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>KG Generation</span>
                                    </div>
                                    <button
                                        className="primary"
                                        style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                                        disabled={isGenerating}
                                        title="Launch AI Knowledge Graph generation for this asset"
                                        onClick={async () => {
                                            if (!currentTenantId) return;
                                            setIsGenerating(true);
                                            try {
                                                const res = await fetch(`${API_BASE}/mdm/products/${assetDetails.id}/graph/generate?tenantId=${currentTenantId}`, { method: 'POST' });
                                                if (res.ok) {
                                                    loadData(); // refresh
                                                } else {
                                                    alert('Failed to generate PKG');
                                                }
                                            } catch (e) { console.error(e) }
                                            finally { setIsGenerating(false); }
                                        }}
                                    >
                                        {isGenerating ? <Loader2 size={14} className="spin" /> : 'Generate Insights'}
                                    </button>
                                </div>

                                {assetDetails.scenarios?.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div>
                                            <div className="small" style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>Usage Scenarios</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                {assetDetails.scenarios.map(s => <Badge key={s} variant="info" style={{ fontSize: 11, background: 'rgba(236, 72, 153, 0.1)', color: 'var(--primary)', borderColor: 'rgba(236, 72, 153, 0.2)' }}>{s}</Badge>)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="small" style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>Target Intents</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                {assetDetails.targetIntents.map(i => <Badge key={i} variant="info" style={{ fontSize: 11 }}>{i}</Badge>)}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {(!assetDetails.scenarios || assetDetails.scenarios.length === 0) && (
                                    <span className="small" style={{ color: 'var(--text-secondary)' }}>Knowledge Graph is currently empty. Run AI Generation to extract features.</span>
                                )}
                            </div>

                            <div style={{ marginBottom: 24 }}>
                                <div className="small" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, fontWeight: 700 }}>Governance Control</div>
                                <SovereignGovernanceInsight
                                    compact
                                    governance={{
                                        reasoningLog: null,
                                        constitution: { version: 'v3.3-sovereign' },
                                        riskLevel: 'MEDIUM',
                                        executionStatus: 'COMPLETED',
                                        targetKey: null,
                                        receipt: null,
                                    }}
                                    constitution={{
                                        pass: true,
                                        hardViolations: [],
                                        ruleRiskScore: 0.12,
                                        version: 'v3.3-sovereign'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: 24 }}>
                                <div className="small" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, fontWeight: 700 }}>Active Swarms</div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div style={{ padding: 12, background: 'rgba(0,0,0,0.02)', borderRadius: 12, border: '1px solid var(--sidebar-border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontWeight: 600, fontSize: 14 }}>Traffic / Ads Swarm</span>
                                            <Activity size={14} color="var(--success)" />
                                        </div>
                                        <div className="small" style={{ color: 'var(--text-secondary)' }}>Currently monitoring active listings and checking rules.</div>
                                    </div>

                                    <div style={{ padding: 12, background: 'rgba(0,0,0,0.02)', borderRadius: 12, border: '1px solid var(--sidebar-border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontWeight: 600, fontSize: 14 }}>Listing Swarm</span>
                                            <Activity size={14} color="var(--warning)" />
                                        </div>
                                        <div className="small" style={{ color: 'var(--text-secondary)' }}>Monitoring unmapped external SKUs for smart linking.</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <button
                                    className="primary"
                                    style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                                    title="Open detailed product profile view"
                                    onClick={() => {
                                        setShowDnaModal(false);
                                        setActiveProductProfileId(assetDetails?.id || null);
                                    }}
                                >
                                    Open Full DNA Profile <ArrowUpRight size={16} />
                                </button>

                                <button
                                    className="secondary danger"
                                    style={{
                                        width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
                                        color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)'
                                    }}
                                    title="Permanently delete this product asset"
                                    onClick={async () => {
                                        if (!window.confirm("Are you sure you want to delete this product? All unlinked commodities will be permanently lost.")) return;
                                        try {
                                            const res = await fetch(`${API_BASE}/mdm/products/${assetDetails.id}?tenantId=${currentTenantId}`, {
                                                method: 'DELETE'
                                            });
                                            const data = await res.json();
                                            if (res.ok) {
                                                setSelectedAsset(null);
                                                loadData();
                                            } else {
                                                alert(data.error || 'Failed to delete product');
                                            }
                                        } catch (e) {
                                            console.error(e);
                                            alert('Error connecting to server to delete product');
                                        }
                                    }}
                                >
                                    Delete Product <Trash2 size={16} />
                                </button>
                            </div>
                        </Card>
                    )}

                    {isCreating && (
                        <AssetCreationForm
                            onClose={() => setIsCreating(false)}
                            onSuccess={() => { setIsCreating(false); loadData(); }}
                        />
                    )}

                    {showDnaModal && assetDetails && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
                            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40
                        }} onClick={() => setShowDnaModal(false)}>
                            <Card style={{ width: '100%', maxWidth: 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 'inherit', padding: 24 }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 16, flexShrink: 0 }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: 18 }}>DNA Profile Structure</h3>
                                            <div className="small" style={{ color: 'var(--text-secondary)' }}>Core Asset ID: {assetDetails.id}</div>
                                        </div>
                                        <button className="secondary" onClick={() => setShowDnaModal(false)}>Close</button>
                                    </div>
                                    <pre style={{ overflowY: 'auto', flex: 1, minHeight: 0, fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: 16, borderRadius: 8, margin: 0 }}>
                                        {JSON.stringify(assetDetails, null, 2)}
                                    </pre>
                                </div>
                            </Card>
                        </div>
                    )}
                </main>
            )}
        </>
    );
}
