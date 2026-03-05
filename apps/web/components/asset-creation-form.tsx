import React, { useState, useEffect } from 'react';
import { useTenant } from './tenant-context';
import { X, ChevronRight, Check } from 'lucide-react';
import { Card } from './ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

interface AssetCreationFormProps {
    onClose: () => void;
    onSuccess: () => void;
}

export function AssetCreationForm({ onClose, onSuccess }: AssetCreationFormProps) {
    const { currentTenantId } = useTenant();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [isSaving, setIsSaving] = useState(false);

    // Form Data States
    const [productData, setProductData] = useState({ name: '', sku: '', categoryId: '', brandId: '' });
    const [commodityData, setCommodityData] = useState<{ marketIds: string[]; language: string; title: string }>({ marketIds: [], language: 'en', title: '' });
    const [listingData, setListingData] = useState<{ platformIds: string[]; externalListingId: string; title: string }>({ platformIds: [], externalListingId: '', title: '' });

    // Lookups
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
    const [markets, setMarkets] = useState<{ id: string; name: string; code: string }[]>([]);
    const [platforms, setPlatforms] = useState<{ id: string; name: string; code: string }[]>([]);

    useEffect(() => {
        if (!currentTenantId) return;

        Promise.all([
            fetch(`${API_BASE}/mdm/categories?tenantId=${currentTenantId}`).then(r => r.json()),
            fetch(`${API_BASE}/mdm/brands?tenantId=${currentTenantId}`).then(r => r.json()),
            fetch(`${API_BASE}/mdm/markets?tenantId=${currentTenantId}`).then(r => r.json()),
            fetch(`${API_BASE}/mdm/platforms?tenantId=${currentTenantId}`).then(r => r.json()),
        ]).then(([catData, brandData, mktData, platData]) => {
            setCategories(catData.items ?? []);
            setBrands(brandData.items ?? []);
            setMarkets(mktData.items ?? []);
            setPlatforms(platData.items ?? []);

            // Auto defaults if available
            if (brandData.items?.[0]) setProductData(p => ({ ...p, brandId: brandData.items[0].id }));
            if (mktData.items?.[0]) setCommodityData(p => ({ ...p, marketIds: [mktData.items[0].id] }));
            if (platData.items?.[0]) setListingData(p => ({ ...p, platformIds: [platData.items[0].id] }));
        }).catch(console.error);
    }, [currentTenantId]);

    const handleSubmit = async () => {
        if (!currentTenantId) return;
        setIsSaving(true);
        try {
            // Step 1: Create Product
            const prodRes = await fetch(`${API_BASE}/mdm/products?tenantId=${currentTenantId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData),
            });
            if (!prodRes.ok) throw new Error('Failed to create Product');
            const createdProduct = await prodRes.json();
            const productId = createdProduct.item.id;

            // Step 2: Create Commodity (if market selected)
            let createdCommodityIds: string[] = [];
            if (commodityData.marketIds.length > 0) {
                for (const mId of commodityData.marketIds) {
                    const mkt = markets.find(m => m.id === mId);
                    const autoLang = mkt?.code === 'JP' ? 'ja' : mkt?.code === 'DE' ? 'de' : mkt?.code === 'MX' ? 'es' : 'en';

                    const commRes = await fetch(`${API_BASE}/mdm/commodities?tenantId=${currentTenantId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            productId,
                            marketId: mId,
                            language: autoLang,
                            title: `${productData.name} - ${mkt?.code}`,
                        }),
                    });
                    if (!commRes.ok) throw new Error('Failed to create Commodity');
                    const createdCommodity = await commRes.json();
                    createdCommodityIds.push(createdCommodity.item.id);
                }
            }

            // Step 3: Create Listing (if platform selected & commodity created)
            if (createdCommodityIds.length > 0 && listingData.platformIds.length > 0 && listingData.externalListingId) {
                let listingCount = 0;
                for (let i = 0; i < createdCommodityIds.length; i++) {
                    const cId = createdCommodityIds[i];
                    for (let j = 0; j < listingData.platformIds.length; j++) {
                        const pId = listingData.platformIds[j];
                        const suffix = listingCount === 0 ? '' : `-${listingCount}`; // Append suffix for multiple listings to avoid unique constraint clash on externalListingId
                        const listRes = await fetch(`${API_BASE}/mdm/listings?tenantId=${currentTenantId}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                commodityId: cId,
                                platformId: pId,
                                externalListingId: listingData.externalListingId + suffix,
                                title: listingData.title || commodityData.title || productData.name,
                            }),
                        });
                        if (!listRes.ok) throw new Error('Failed to create Listing');
                        listingCount++;
                    }
                }
            }

            onSuccess();
        } catch (error) {
            console.error(error);
            alert('Error creating asset. Check console for details.');
        } finally {
            setIsSaving(false);
        }
    };

    const isStep1Valid = productData.name.trim() !== '' && productData.sku.trim() !== '' && productData.categoryId !== '' && productData.brandId !== '';

    return (
        <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 450,
            background: 'var(--panel-bg)', borderLeft: '1px solid var(--border-color)',
            display: 'flex', flexDirection: 'column', zIndex: 100,
            boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', animation: 'slideIn 0.2s ease-out'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Create New Asset</h3>
                <button className="icon-btn" onClick={onClose} title="Close form and discard changes"><X size={18} /></button>
            </div>

            {/* Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}>
                {[1, 2, 3].map((s) => (
                    <React.Fragment key={s}>
                        <div style={{
                            width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: step > s ? 'var(--success)' : step === s ? 'var(--accent)' : 'var(--bg-secondary)',
                            color: step >= s ? '#fff' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600
                        }}>
                            {step > s ? <Check size={14} /> : s}
                        </div>
                        {s < 3 && <div style={{ flex: 1, height: 2, background: step > s ? 'var(--success)' : 'var(--bg-secondary)', margin: '0 8px' }} />}
                    </React.Fragment>
                ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                {step === 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ marginBottom: 8 }}>
                            <h4 style={{ margin: '0 0 4px', fontSize: 14 }}>Global Product (DNA)</h4>
                            <p className="small" style={{ color: 'var(--text-secondary)', margin: 0 }}>Establish the unified semantic core representation.</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label className="small" style={{ fontWeight: 600 }}>Brand</label>
                            <select value={productData.brandId} onChange={e => setProductData({ ...productData, brandId: e.target.value })}>
                                <option value="" disabled>Select Brand...</option>
                                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label className="small" style={{ fontWeight: 600 }}>Category <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <select value={productData.categoryId} onChange={e => setProductData({ ...productData, categoryId: e.target.value })}>
                                <option value="" disabled>Select Core Category...</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label className="small" style={{ fontWeight: 600 }}>SKU Code <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input type="text" placeholder="e.g. GRINDER-V1" value={productData.sku} onChange={e => setProductData({ ...productData, sku: e.target.value })} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label className="small" style={{ fontWeight: 600 }}>Product Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input type="text" placeholder="Global marketing name" value={productData.name} onChange={e => setProductData({ ...productData, name: e.target.value })} />
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ marginBottom: 8 }}>
                            <h4 style={{ margin: '0 0 4px', fontSize: 14 }}>Market Commodity</h4>
                            <p className="small" style={{ color: 'var(--text-secondary)', margin: 0 }}>Spawn a localized digital twin for a specific market.</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label className="small" style={{ fontWeight: 600 }}>Select Market(s)</label>
                            <select
                                multiple
                                style={{ height: 120 }}
                                value={commodityData.marketIds}
                                onChange={e => {
                                    const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                                    setCommodityData({ ...commodityData, marketIds: selected });
                                }}
                            >
                                {markets.map(m => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
                            </select>
                            <span className="small" style={{ color: 'var(--text-secondary)' }}>Hold Ctrl/Cmd to select multiple markets.</span>
                        </div>
                        {commodityData.marketIds.length > 0 && (
                            <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                                Auto-localization (Language mapping) and dynamic titles will be applied based on the target Market DNA.
                            </div>
                        )}
                    </div>
                )}

                {step === 3 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ marginBottom: 8 }}>
                            <h4 style={{ margin: '0 0 4px', fontSize: 14 }}>Sales Channel Binding</h4>
                            <p className="small" style={{ color: 'var(--text-secondary)', margin: 0 }}>Link external listing streams (e.g. Amazon ASIN) to the Market Commodity.</p>
                        </div>
                        {!commodityData.marketIds.length && (
                            <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                                You opted to skip Commodity creation. You cannot bind a Listing without a Market Commodity.
                            </div>
                        )}
                        {commodityData.marketIds.length > 0 && (
                            <>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <label className="small" style={{ fontWeight: 600 }}>Target Platform(s)</label>
                                    <select
                                        multiple
                                        style={{ height: 80 }}
                                        value={listingData.platformIds}
                                        onChange={e => {
                                            const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                                            setListingData({ ...listingData, platformIds: selected });
                                        }}
                                    >
                                        {platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <span className="small" style={{ color: 'var(--text-secondary)' }}>Hold Ctrl/Cmd to select multiple platforms.</span>
                                </div>
                                {listingData.platformIds.length === 1 && (
                                    <>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <label className="small" style={{ fontWeight: 600 }}>External Listing ID (e.g. ASIN)</label>
                                            <input type="text" placeholder="B0XXXXX..." value={listingData.externalListingId} onChange={e => setListingData({ ...listingData, externalListingId: e.target.value })} />
                                        </div>
                                    </>
                                )}
                                {listingData.platformIds.length > 1 && (
                                    <>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <label className="small" style={{ fontWeight: 600 }}>Base External ID</label>
                                            <input type="text" placeholder="B0XXXXX..." value={listingData.externalListingId} onChange={e => setListingData({ ...listingData, externalListingId: e.target.value })} />
                                        </div>
                                        <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                                            Multiple platforms selected. System will auto-append tracking suffixes to the base ID to prevent collisions.
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                {step > 1 ? (
                    <button className="secondary" onClick={() => setStep((s) => s - 1 as 1 | 2 | 3)} title="Go back to the previous step">Back</button>
                ) : <div />}

                {step < 3 ? (
                    <button className="primary" onClick={() => setStep((s) => s + 1 as 1 | 2 | 3)} disabled={!isStep1Valid} title="Proceed to the next step">
                        Next Step <ChevronRight size={16} />
                    </button>
                ) : (
                    <button className="primary" onClick={handleSubmit} disabled={isSaving || !isStep1Valid} title="Save the asset configuration to the MDM database">
                        {isSaving ? 'Submitting...' : 'Complete & Save'}
                    </button>
                )}
            </div>
        </div>
    );
}
