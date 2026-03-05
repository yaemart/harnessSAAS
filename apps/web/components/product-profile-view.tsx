'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Edit3, Trash2, Box, Cpu, Sparkles, Globe, Loader2 } from 'lucide-react';
import { Card, PageHeader, Badge } from './ui';
import { useTenant } from './tenant-context';
import { useAuth } from './auth-context';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

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
    imageUrls: string[];
    // Expand this as needed from the actual API payload
}

interface ApprovedCostVersion {
    id: string;
    productGlobalId: string;
    purchaseCost: string | number | null;
    shippingCost: string | number | null;
    fbaFee: string | number | null;
    otherCost: string | number | null;
    currency: string;
    effectiveFrom: string;
    effectiveTo: string | null;
}

interface ProductProfileViewProps {
    productId: string;
    onBack: () => void;
}

export function ProductProfileView({ productId, onBack }: ProductProfileViewProps) {
    const { currentTenantId } = useTenant();
    const { authHeaders } = useAuth();
    const [product, setProduct] = useState<APITreeProduct | null>(null);
    const [markets, setMarkets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'core' | 'tech' | 'ai' | 'market'>('core');
    const [specialFeatures, setSpecialFeatures] = useState<string[]>([]);
    const [isAddingFeature, setIsAddingFeature] = useState(false);
    const [editingFeatureIndex, setEditingFeatureIndex] = useState<number | null>(null);
    const [generationContext, setGenerationContext] = useState<string>('');
    const [isSavingContext, setIsSavingContext] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatingMarketId, setGeneratingMarketId] = useState<string | null>(null);
    const [editingCommodity, setEditingCommodity] = useState<any | null>(null);
    const [approvedCost, setApprovedCost] = useState<ApprovedCostVersion | null>(null);
    const [approvedMappingCount, setApprovedMappingCount] = useState(0);

    const handleAutoGenerateTwin = async (marketId: string) => {
        if (!currentTenantId || !product) return;
        setGeneratingMarketId(marketId);
        try {
            const market = markets.find(m => m.id === marketId);
            const language = market?.languages?.find((l: any) => l.isDefault)?.language || 'EN';

            const res = await fetch(`${API_BASE}/mdm/products/${product.id}/graph/generate-commodity?tenantId=${currentTenantId}`, {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ marketId, language })
            });

            if (res.ok) {
                const data = await res.json();
                // Refresh product to get new commodities
                const updatedProdRes = await fetch(`${API_BASE}/mdm/products/${productId}?tenantId=${currentTenantId}`, {
                    headers: authHeaders
                });
                const updatedProdData = await updatedProdRes.json();
                setProduct(updatedProdData.item);
            } else {
                const err = await res.json();
                alert(`Generation failed: ${err.error || 'Unknown error'}`);
            }
        } catch (e) {
            console.error("Failed to generate commodity", e);
            alert("Network error during commodity generation.");
        } finally {
            setGeneratingMarketId(null);
        }
    };

    const generateKnowledgeGraph = async () => {
        if (!currentTenantId || !product) return;
        setIsGenerating(true);
        try {
            const res = await fetch(`${API_BASE}/mdm/products/${product.id}/graph/generate?tenantId=${currentTenantId}`, {
                method: 'POST',
                headers: authHeaders
            });
            if (res.ok) {
                const data = await res.json();
                // Update local product state with the new AI-generated fields
                setProduct(data.item);
                if (data.item?.structuredFeatures?.specialFeatures) {
                    setSpecialFeatures(data.item.structuredFeatures.specialFeatures);
                }
            } else {
                const err = await res.json();
                alert(`Generation failed: ${err.error || 'Unknown error'}`);
            }
        } catch (e) {
            console.error("Failed to generate knowledge graph", e);
            alert("Network error during AI generation.");
        } finally {
            setIsGenerating(false);
        }
    };

    const loadProduct = async () => {
        if (!currentTenantId) return;
        setLoading(true);
        try {
            const [prodRes, marketRes] = await Promise.all([
                fetch(`${API_BASE}/mdm/products/${productId}?tenantId=${currentTenantId}`, {
                    headers: authHeaders
                }),
                fetch(`${API_BASE}/mdm/markets?tenantId=${currentTenantId}`, {
                    headers: authHeaders
                }),
            ]);
            const prodData = await prodRes.json();
            const marketData = await marketRes.json();

            setProduct(prodData.item || null);
            setMarkets(marketData.items || []);

            if (prodData.item?.id) {
                const [approvedCostRes, approvedMappingRes] = await Promise.all([
                    fetch(`${API_BASE}/mdm/cost-versions/approved?tenantId=${currentTenantId}&productGlobalId=${prodData.item.id}&limit=1`, {
                        headers: authHeaders
                    }),
                    fetch(`${API_BASE}/mdm/mappings/approved?tenantId=${currentTenantId}&entity_type=PRODUCT&global_id=${prodData.item.id}&limit=500`, {
                        headers: authHeaders
                    }),
                ]);
                const [approvedCostData, approvedMappingData] = await Promise.all([
                    approvedCostRes.json().catch(() => ({ items: [] })),
                    approvedMappingRes.json().catch(() => ({ items: [] })),
                ]);
                setApprovedCost((approvedCostData.items?.[0] as ApprovedCostVersion | undefined) ?? null);
                setApprovedMappingCount(Array.isArray(approvedMappingData.items) ? approvedMappingData.items.length : 0);
            } else {
                setApprovedCost(null);
                setApprovedMappingCount(0);
            }

            if (prodData.item?.structuredFeatures?.specialFeatures) {
                setSpecialFeatures(prodData.item.structuredFeatures.specialFeatures);
            } else {
                setSpecialFeatures(['Auto-Shutoff', 'Boil-Dry Protection', 'LED Temperature Display']);
            }
            if (prodData.item?.structuredFeatures?.generationContext) {
                setGenerationContext(prodData.item.structuredFeatures.generationContext);
            } else {
                setGenerationContext("Designed for high-end home kitchens. Features a 10-speed motor and specialized dough hook. Emphasize noise reduction technology.");
            }
        } catch (e) {
            console.error("Failed to load product or markets", e);
        } finally {
            setLoading(false);
        }
    };

    const saveContext = async () => {
        if (!currentTenantId || !product) return;
        setIsSavingContext(true);
        try {
            const currentStructuredFeatures = product.structuredFeatures || {};
            await fetch(`${API_BASE}/mdm/products/${product.id}?tenantId=${currentTenantId}`, {
                method: 'PUT',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    structuredFeatures: {
                        ...currentStructuredFeatures,
                        generationContext
                    }
                })
            });
            setProduct(prev => prev ? { ...prev, structuredFeatures: { ...prev.structuredFeatures, generationContext } } : prev);
        } catch (e) {
            console.error("Failed to save context", e);
        } finally {
            setIsSavingContext(false);
        }
    };

    const saveFeatures = async (newFeatures: string[]) => {
        if (!currentTenantId || !product) return;
        setSpecialFeatures(newFeatures);
        try {
            const currentStructuredFeatures = product.structuredFeatures || {};
            await fetch(`${API_BASE}/mdm/products/${product.id}?tenantId=${currentTenantId}`, {
                method: 'PUT',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    structuredFeatures: {
                        ...currentStructuredFeatures,
                        specialFeatures: newFeatures
                    }
                })
            });
            setProduct(prev => prev ? { ...prev, structuredFeatures: { ...prev.structuredFeatures, specialFeatures: newFeatures } } : prev);
        } catch (e) {
            console.error("Failed to save features", e);
        }
    };

    useEffect(() => {
        loadProduct();
    }, [productId, currentTenantId, authHeaders.authorization, authHeaders['x-tenant-id']]);

    if (loading) {
        return <div style={{ padding: 40, textAlign: 'center' }}>Loading profile...</div>;
    }

    if (!product) {
        return (
            <div style={{ padding: 40, textAlign: 'center' }}>
                <p>Product not found.</p>
                <button className="secondary" onClick={onBack} title="Return to the dashboard">Go Back</button>
            </div>
        );
    }

    const tabs = [
        { id: 'core', label: 'Core Operations & Logistics', icon: <Box size={14} /> },
        { id: 'tech', label: 'Technical Specs', icon: <Cpu size={14} /> },
        { id: 'ai', label: 'AI Knowledge Graph', icon: <Sparkles size={14} /> },
        { id: 'market', label: 'Market Expansion', icon: <Globe size={14} /> }
    ] as const;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0 24px 24px 24px' }}>
            {/* Header Strip */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 0', borderBottom: '1px solid var(--border-color)', marginBottom: 24
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button className="secondary icon" onClick={onBack} title="Back to Dashboard" style={{ padding: 6 }}>
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                            <h2 style={{ margin: 0, fontSize: 20 }}>{product.name}</h2>
                            <Badge variant="warning">{product.lifecycleStage}</Badge>
                        </div>
                        <div className="small" style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                            SKU: {product.sku} | ID: {product.id}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Edit product core properties">
                        <Edit3 size={14} /> Edit Core Data
                    </button>
                    <button className="secondary danger" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }} title="Delete this product asset">
                        <Trash2 size={14} /> Delete
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border-color)', marginBottom: 24 }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        title={`Switch to ${tab.label} tab`}
                        className={activeTab === tab.id ? 'primary' : 'secondary'}
                        style={{
                            borderRadius: '4px 4px 0 0',
                            borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '1px solid transparent',
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 16px',
                            background: activeTab === tab.id ? 'var(--bg-primary)' : 'transparent',
                            boxShadow: 'none',
                            color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
                            fontWeight: activeTab === tab.id ? 600 : 400
                        }}
                        onClick={() => setActiveTab(tab.id as any)}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content Areas */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {activeTab === 'core' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <Card style={{ padding: 24 }}>
                            <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Box size={16} /> Asset Classification & Media
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 300px', gap: 32 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div>
                                        <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>Product Name</label>
                                        <input type="text" defaultValue={product.name} style={{ width: '100%', background: 'var(--bg-secondary)' }} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div>
                                            <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>Brand</label>
                                            <select style={{ width: '100%', background: 'var(--bg-secondary)' }}>
                                                <option>{product.brand?.name || 'Select Brand'}</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>Category</label>
                                            <select style={{ width: '100%', background: 'var(--bg-secondary)' }}>
                                                <option>{product.category?.name || 'Select Category'}</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>Lifecycle Stage</label>
                                        <select style={{ width: '100%', background: 'var(--bg-secondary)' }} defaultValue={product.lifecycleStage}>
                                            <option value="NEW">NEW</option>
                                            <option value="ACTIVE">ACTIVE</option>
                                            <option value="EOL">EOL</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>Master Image (CDN)</label>
                                    <div style={{
                                        border: '1px dashed var(--border-color)', borderRadius: 4, height: 180,
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        background: 'var(--bg-secondary)', cursor: 'pointer', position: 'relative', overflow: 'hidden'
                                    }}>
                                        {product.imageUrls?.[0] ? (
                                            <img src={product.imageUrls[0]} alt="Master" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <>
                                                <Box size={24} style={{ color: 'var(--text-tertiary)', marginBottom: 8 }} />
                                                <span className="small" style={{ color: 'var(--text-secondary)' }}>Click to upload via Cloudflare</span>
                                            </>
                                        )}
                                        <input type="file" style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }} title="Upload image" />
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                            <Card style={{ padding: 24 }}>
                                <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16 }}>Financials & Sourcing</h3>
                                <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: 'rgba(0, 122, 255, 0.06)', border: '1px solid rgba(0, 122, 255, 0.15)' }}>
                                    <div className="small" style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>
                                        Governed Read Model
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                                        {approvedCost ? `Approved Cost Version: ${approvedCost.id.slice(0, 8)}...` : 'No approved cost version'}
                                    </div>
                                    <div className="small" style={{ color: 'var(--text-secondary)' }}>
                                        Approved Product Mappings: {approvedMappingCount}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div>
                                            <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>Cost Price (USD)</label>
                                            <input
                                                type="number"
                                                defaultValue={approvedCost?.purchaseCost == null ? '' : Number(approvedCost.purchaseCost)}
                                                placeholder="e.g. 12.50"
                                                style={{ width: '100%', background: 'var(--bg-secondary)' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>Default MSRP (USD)</label>
                                            <input type="number" placeholder="e.g. 49.99" style={{ width: '100%', background: 'var(--bg-secondary)' }} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>Primary Supplier Name</label>
                                        <input type="text" defaultValue={product.brand?.name ? `${product.brand.name} Supply` : ''} placeholder="Shenzhen Mfg Co." style={{ width: '100%', background: 'var(--bg-secondary)' }} />
                                    </div>
                                    <div>
                                        <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>HS Code (Customs)</label>
                                        <input type="text" placeholder="e.g. 8509.40.00" style={{ width: '100%', background: 'var(--bg-secondary)', fontFamily: 'monospace' }} />
                                    </div>
                                </div>
                            </Card>

                            <Card style={{ padding: 24 }}>
                                <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16 }}>Logistics & Dimensions</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div>
                                            <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>Weight (kg)</label>
                                            <input type="number" placeholder="e.g. 1.2" style={{ width: '100%', background: 'var(--bg-secondary)' }} />
                                        </div>
                                        <div>
                                            <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>Volume (cbm)</label>
                                            <input type="number" placeholder="e.g. 0.04" style={{ width: '100%', background: 'var(--bg-secondary)' }} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>Dimensions (L x W x H cm)</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                            <input type="number" placeholder="L" style={{ width: '100%', background: 'var(--bg-secondary)' }} />
                                            <input type="number" placeholder="W" style={{ width: '100%', background: 'var(--bg-secondary)' }} />
                                            <input type="number" placeholder="H" style={{ width: '100%', background: 'var(--bg-secondary)' }} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>Packaging Type</label>
                                        <select style={{ width: '100%', background: 'var(--bg-secondary)' }}>
                                            <option>Carton Box</option>
                                            <option>Polybag</option>
                                            <option>Wooden Crate</option>
                                        </select>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                )}
                {activeTab === 'tech' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <Card style={{ padding: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                <div>
                                    <h3 style={{ marginTop: 0, marginBottom: 4, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Cpu size={16} /> Technical Specifications
                                    </h3>
                                    <p className="small" style={{ color: 'var(--text-secondary)', margin: 0 }}>
                                        Attributes inherited from Category schema: {product.category?.name || 'Home Appliances'}
                                    </p>
                                </div>
                                <button className="secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Edit dynamic category attributes">
                                    <Edit3 size={14} /> Edit JSON Source
                                </button>
                            </div>

                            {/* Simulated Dynamic Area based on CategoryAttributeSchema */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) minmax(250px, 1fr)', gap: '16px 32px' }}>
                                {/* Electrical Group */}
                                <div style={{ gridColumn: '1 / -1', marginTop: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>
                                    <span className="small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Electrical & Power</span>
                                </div>
                                <div>
                                    <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>Voltage (V)</label>
                                    <input type="text" defaultValue="110-120V / 220-240V" style={{ width: '100%', background: 'var(--bg-secondary)' }} />
                                </div>
                                <div>
                                    <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>Power Consumption (W)</label>
                                    <input type="number" defaultValue={850} style={{ width: '100%', background: 'var(--bg-secondary)' }} />
                                </div>
                                <div>
                                    <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>Plug Type</label>
                                    <select style={{ width: '100%', background: 'var(--bg-secondary)' }} defaultValue="US/EU Swappable">
                                        <option>US Standard (Type A/B)</option>
                                        <option>EU Standard (Type C/F)</option>
                                        <option>UK Standard (Type G)</option>
                                        <option>US/EU Swappable</option>
                                    </select>
                                </div>

                                {/* Materials Group */}
                                <div style={{ gridColumn: '1 / -1', marginTop: 24, paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>
                                    <span className="small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Construction & Materials</span>
                                </div>
                                <div>
                                    <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>Primary Material</label>
                                    <input type="text" defaultValue="304 Stainless Steel" style={{ width: '100%', background: 'var(--bg-secondary)' }} />
                                </div>
                                <div>
                                    <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>Finish Type</label>
                                    <select style={{ width: '100%', background: 'var(--bg-secondary)' }} defaultValue="Brushed">
                                        <option>Brushed</option>
                                        <option>Matte Black</option>
                                        <option>Glossy White</option>
                                        <option>Polished Chrome</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>BPA Free</label>
                                    <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                            <input type="checkbox" defaultChecked />
                                            <span className="small">Certified BPA-Free Plastics</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Functional Specs */}
                                <div style={{ gridColumn: '1 / -1', marginTop: 24, paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>
                                    <span className="small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Performance & Capacity</span>
                                </div>
                                <div>
                                    <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>Capacity (Liters)</label>
                                    <input type="number" defaultValue={2.5} style={{ width: '100%', background: 'var(--bg-secondary)' }} />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>Special Features (Array)</label>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                        {specialFeatures.map((feature, i) => (
                                            editingFeatureIndex === i ? (
                                                <input
                                                    key={i}
                                                    type="text"
                                                    autoFocus
                                                    defaultValue={feature}
                                                    style={{ width: 120, padding: '4px 8px', fontSize: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 4 }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const val = e.currentTarget.value.trim();
                                                            if (val) {
                                                                const newFeatures = [...specialFeatures];
                                                                newFeatures[i] = val;
                                                                saveFeatures(newFeatures);
                                                            }
                                                            setEditingFeatureIndex(null);
                                                        } else if (e.key === 'Escape') {
                                                            setEditingFeatureIndex(null);
                                                        }
                                                    }}
                                                    onBlur={(e) => {
                                                        const val = e.currentTarget.value.trim();
                                                        if (val && val !== feature) {
                                                            const newFeatures = [...specialFeatures];
                                                            newFeatures[i] = val;
                                                            saveFeatures(newFeatures);
                                                        }
                                                        setEditingFeatureIndex(null);
                                                    }}
                                                />
                                            ) : (
                                                <Badge key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 6 }}>
                                                    <span style={{ cursor: 'pointer' }} onClick={() => setEditingFeatureIndex(i)}>
                                                        {feature}
                                                    </span>
                                                    <button
                                                        title="Delete this AI extracted feature"
                                                        onClick={() => saveFeatures(specialFeatures.filter((_, idx) => idx !== i))}
                                                        style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.6 }}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </Badge>
                                            )
                                        ))}
                                        {isAddingFeature ? (
                                            <input
                                                type="text"
                                                autoFocus
                                                style={{ width: 120, padding: '4px 8px', fontSize: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 4 }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const val = e.currentTarget.value.trim();
                                                        if (val && !specialFeatures.includes(val)) {
                                                            saveFeatures([...specialFeatures, val]);
                                                        }
                                                        setIsAddingFeature(false);
                                                    } else if (e.key === 'Escape') {
                                                        setIsAddingFeature(false);
                                                    }
                                                }}
                                                onBlur={(e) => {
                                                    const val = e.currentTarget.value.trim();
                                                    if (val && !specialFeatures.includes(val)) {
                                                        saveFeatures([...specialFeatures, val]);
                                                    }
                                                    setIsAddingFeature(false);
                                                }}
                                                placeholder="Add feature..."
                                            />
                                        ) : (
                                            <button
                                                title="Manually specify an AI extracted feature"
                                                className="secondary small icon"
                                                onClick={() => setIsAddingFeature(true)}
                                            >
                                                +
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}
                {activeTab === 'ai' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {/* Generation Context Section */}
                        <Card style={{ padding: 24, borderLeft: '3px solid var(--accent)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ marginTop: 0, marginBottom: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Edit3 size={16} /> Generation Context & Seed Information
                                </h3>
                            </div>
                            <p className="small" style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                                Provide specific functions, material highlights, or brand angles manually. This context is injected into AI prompts to ensure accurate generation.
                            </p>
                            <textarea
                                placeholder="E.g., highlight the titanium blade durability, mention it's designed for professional chefs, emphasize the self-cleaning function..."
                                style={{ width: '100%', height: 80, background: 'var(--bg-secondary)', padding: '12px', resize: 'vertical' }}
                                value={generationContext}
                                onChange={(e) => setGenerationContext(e.target.value)}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                                <button
                                    title="Save AI generated data"
                                    className="primary small"
                                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                    onClick={saveContext}
                                    disabled={isSavingContext}
                                >
                                    {isSavingContext ? 'Saving...' : 'Save Context'}
                                </button>
                            </div>
                        </Card>

                        {/* Knowledge Graph Nodes */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) minmax(400px, 1fr)', gap: 24 }}>

                            {/* Scenarios / Category Features */}
                            <Card style={{ padding: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <h3 style={{ marginTop: 0, marginBottom: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Sparkles size={16} color="var(--primary)" /> Usage Scenarios / Culinary Center
                                    </h3>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="secondary small icon" title="View AI Prompt"><Globe size={14} /></button>
                                        <button
                                            className="secondary small"
                                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                            title="Generate 5 new items using AI"
                                            onClick={generateKnowledgeGraph}
                                            disabled={isGenerating}
                                        >
                                            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            {isGenerating ? 'Generating...' : 'Gen 5 Items'}
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {(product.scenarios || []).length === 0 ? (
                                        <p className="small" style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0' }}>No scenarios generated yet.</p>
                                    ) : (
                                        (product.scenarios || []).map((scenario, idx) => (
                                            <div key={idx} style={{ padding: 12, border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-secondary)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <Badge variant="success">Published</Badge>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button className="secondary small icon" style={{ padding: 2 }} title="Edit this item"><Edit3 size={12} /></button>
                                                        <button className="secondary danger icon" style={{ padding: 2 }} title="Delete this item"><Trash2 size={12} /></button>
                                                    </div>
                                                </div>
                                                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{scenario.split(':')[0]}</div>
                                                <div className="small" style={{ color: 'var(--text-secondary)' }}>{scenario.includes(':') ? scenario.split(':').slice(1).join(':') : scenario}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </Card>

                            {/* Target Intents / Q&A */}
                            <Card style={{ padding: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <h3 style={{ marginTop: 0, marginBottom: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Sparkles size={16} color="var(--primary)" /> Target Intents / Q&A
                                    </h3>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="secondary small icon" title="View AI Prompt"><Globe size={14} /></button>
                                        <button
                                            className="secondary small"
                                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                            title="Generate 5 new items using AI"
                                            onClick={generateKnowledgeGraph}
                                            disabled={isGenerating}
                                        >
                                            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            {isGenerating ? 'Generating...' : 'Gen 5 Items'}
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {(product.targetIntents || []).length === 0 ? (
                                        <p className="small" style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0' }}>No intents generated yet.</p>
                                    ) : (
                                        (product.targetIntents || []).map((intent, idx) => (
                                            <div key={idx} style={{ padding: 12, border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-secondary)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <Badge variant="success">Published</Badge>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button className="secondary small icon" style={{ padding: 2 }} title="Edit this item"><Edit3 size={12} /></button>
                                                        <button className="secondary danger icon" style={{ padding: 2 }} title="Delete this item"><Trash2 size={12} /></button>
                                                    </div>
                                                </div>
                                                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{intent}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </Card>

                            {/* Competitive Edges */}
                            <Card style={{ padding: 24, gridColumn: '1 / -1' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <h3 style={{ marginTop: 0, marginBottom: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Sparkles size={16} color="var(--primary)" /> Competitive Edges
                                    </h3>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="secondary small icon" title="View AI Prompt"><Globe size={14} /></button>
                                        <button
                                            className="secondary small"
                                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                            title="Generate 3 new AI instructions"
                                            onClick={generateKnowledgeGraph}
                                            disabled={isGenerating}
                                        >
                                            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            {isGenerating ? 'Generating...' : 'Gen 3 Items'}
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
                                    {Object.keys(product.competitiveEdges || {}).length === 0 ? (
                                        <p className="small" style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0', width: '100%' }}>No competitive edges generated yet.</p>
                                    ) : (
                                        Object.entries(product.competitiveEdges || {}).map(([key, val], idx) => (
                                            <div key={idx} style={{ flex: '0 0 300px', padding: 16, border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--bg-secondary)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                                    <Badge variant="success">Published</Badge>
                                                    <button className="secondary danger icon" style={{ padding: 2 }} title="Delete this published scenario"><Trash2 size={12} /></button>
                                                </div>
                                                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{key}</div>
                                                <div className="small" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{String(val)}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </Card>
                        </div>
                    </div>
                )}
                {activeTab === 'market' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <Card style={{ padding: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div>
                                    <h3 style={{ marginTop: 0, marginBottom: 4, fontSize: 16 }}>Market Adoption (Commodities)</h3>
                                    <p className="small" style={{ color: 'var(--text-secondary)', margin: 0 }}>
                                        Publish this product to localized markets. Each market creates an independent Commodity twin.
                                    </p>
                                </div>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                        <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Market</th>
                                        <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Status</th>
                                        <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Language</th>
                                        <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Localized Title</th>
                                        <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {markets.map((market) => {
                                        const prodWithComms = product as APITreeProduct & { commodities?: any[] };
                                        const commodity = prodWithComms?.commodities?.find((c: any) => c.marketId === market.id);
                                        const isActive = commodity?.status?.toLowerCase() === 'active';
                                        const isDraft = commodity?.status?.toLowerCase() === 'draft';

                                        return (
                                            <tr key={market.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '12px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ width: 24, height: 16, background: '#e0e0e0', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 'bold', color: '#333' }}>{market.code}</div>
                                                        <span style={{ fontWeight: commodity ? 600 : 'normal', color: commodity ? 'inherit' : 'var(--text-secondary)' }}>{market.name}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '12px' }}>
                                                    {isActive && <Badge variant="success">Active</Badge>}
                                                    {isDraft && <Badge variant="warning">Draft</Badge>}
                                                    {!commodity && <span className="small" style={{ color: 'var(--text-secondary)' }}>Not Adopted</span>}
                                                </td>
                                                <td style={{ padding: '12px', color: commodity ? 'inherit' : 'var(--text-secondary)', textTransform: 'uppercase', fontSize: 13 }}>
                                                    {commodity
                                                        ? commodity.language || market.languages?.find((l: any) => l.isDefault)?.language || 'EN'
                                                        : market.languages?.map((l: any) => l.language).join(', ') || '-'}
                                                </td>
                                                <td style={{ padding: '12px', fontSize: 13, color: commodity ? 'inherit' : 'var(--text-secondary)' }}>
                                                    {commodity ? (commodity.title || product.name) : '-'}
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                                    {commodity ? (
                                                        <button
                                                            className={isDraft ? "primary small" : "secondary small"}
                                                            title={isDraft ? "Publish this twin to make it live in this market" : "Manage the details of this localized twin"}
                                                            onClick={() => setEditingCommodity(commodity)}
                                                        >
                                                            {isDraft ? "Publish Twin" : "Manage Twin"}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            title="Provision a new local commodity for this missing market"
                                                            className="secondary small"
                                                            onClick={() => handleAutoGenerateTwin(market.id)}
                                                            disabled={generatingMarketId === market.id}
                                                            style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}
                                                        >
                                                            {generatingMarketId === market.id ? (
                                                                <>
                                                                    <Loader2 size={12} className="animate-spin" />
                                                                    <span>Generating...</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Sparkles size={12} />
                                                                    <span>Auto-Generate Twin</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </Card>
                    </div>
                )}
            </div>

            {editingCommodity && (
                <CommodityManagerModal
                    commodity={editingCommodity}
                    onClose={() => setEditingCommodity(null)}
                    onSave={async (updatedData) => {
                        try {
                            const res = await fetch(`${API_BASE}/mdm/commodities/${editingCommodity.id}?tenantId=${currentTenantId}`, {
                                method: 'PUT',
                                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                                body: JSON.stringify(updatedData)
                            });
                            if (res.ok) {
                                // Refresh product
                                const updatedProdRes = await fetch(`${API_BASE}/mdm/products/${productId}?tenantId=${currentTenantId}`, {
                                    headers: authHeaders
                                });
                                const updatedProdData = await updatedProdRes.json();
                                setProduct(updatedProdData.item);
                                setEditingCommodity(null);
                            } else {
                                const err = await res.json();
                                alert(`Failed to save: ${err.error || 'Unknown error'}`);
                            }
                        } catch (e) {
                            console.error("Save error", e);
                            alert("Network error while saving.");
                        }
                    }}
                />
            )}
        </div>
    );
}

function CommodityManagerModal({ commodity, onClose, onSave }: { commodity: any, onClose: () => void, onSave: (data: any) => Promise<void> }) {
    const [title, setTitle] = useState(commodity.title || '');
    const [bulletPoints, setBulletPoints] = useState<string[]>(
        Array.isArray(commodity.bulletPoints) ? commodity.bulletPoints : ['', '', '', '', '']
    );
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        await onSave({ title, bulletPoints });
        setIsSaving(false);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()}>
                <Card
                    style={{ width: '100%', maxWidth: 600, padding: 24, background: 'var(--bg-primary)' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3 style={{ margin: 0 }}>Manage Localized Twin ({commodity.market?.code})</h3>
                        <button className="secondary small icon" onClick={onClose}><Trash2 size={16} /></button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Localized Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                style={{ width: '100%' }}
                                placeholder="Localized product title"
                            />
                        </div>

                        <div>
                            <label className="small" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Bullet Points</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {bulletPoints.map((bp, i) => (
                                    <input
                                        key={i}
                                        type="text"
                                        value={bp}
                                        onChange={e => {
                                            const newBps = [...bulletPoints];
                                            newBps[i] = e.target.value;
                                            setBulletPoints(newBps);
                                        }}
                                        style={{ width: '100%' }}
                                        placeholder={`Bullet Point ${i + 1}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                        <button className="secondary" onClick={onClose}>Cancel</button>
                        <button className="primary" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
                        </button>
                    </div>
                </Card>
            </div>
        </div>
    );
}
