'use client';

import { useState, useEffect, useCallback } from 'react';
import { tokens, tintedBg } from '../../lib/design-tokens';
import { Badge, SmallButton } from './shared';
import { useAuth } from '../auth-context';
import type { CategoryNode } from './category-tree';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

type Tab = 'mappings' | 'attributes' | 'info' | 'ai';

interface Mapping {
  id: string;
  platform: string;
  marketCode: string | null;
  externalCategoryId: string | null;
  externalPath: string | null;
  mappingType: string;
  confidenceScore: number;
  direction: string;
  status: string;
  source: string;
  notes: string | null;
  platformCategory?: { name: string; path: string } | null;
}

interface Alias {
  id: string;
  alias: string;
  language: string;
  source: string;
  weight: number;
}

interface Props {
  category: CategoryNode | null;
  onUpdate: () => void;
}

const PLATFORMS = [
  { code: 'AMAZON', label: 'Amazon', markets: ['US', 'DE', 'CA', 'JP', 'UK', 'FR', 'ES', 'IT'] },
  { code: 'WALMART', label: 'Walmart', markets: [] },
  { code: 'SHOPIFY', label: 'Shopify', markets: [] },
  { code: 'WAYFAIR', label: 'Wayfair', markets: [] },
  { code: 'EBAY', label: 'eBay', markets: [] },
  { code: 'TEMU', label: 'Temu', markets: [] },
  { code: 'TIKTOK_SHOP', label: 'TikTok Shop', markets: [] },
  { code: 'GOOGLE', label: 'Google', markets: [] },
];

async function apiFetch(path: string, authHeaders: Record<string, string>, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function ConfidenceDot({ score }: { score: number }) {
  const color = score >= 0.8 ? tokens.color.success : score >= 0.5 ? tokens.color.warning : tokens.color.danger;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block',
      }} />
      {Math.round(score * 100)}%
    </span>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: active ? tintedBg(tokens.color.accent, 10) : 'transparent',
      border: 'none',
      borderBottom: active ? `2px solid ${tokens.color.accent}` : '2px solid transparent',
      color: active ? tokens.color.accent : tokens.color.textSecondary,
      fontSize: 12,
      fontWeight: active ? 600 : 400,
      padding: '8px 14px',
      cursor: 'pointer',
      fontFamily: 'inherit',
      transition: 'all 0.15s',
    }}>{label}</button>
  );
}

export default function CategoryDetail({ category, onUpdate }: Props) {
  const [tab, setTab] = useState<Tab>('mappings');
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loading, setLoading] = useState(false);
  const [newAlias, setNewAlias] = useState('');
  const [newAliasLang, setNewAliasLang] = useState('en');
  const [addMappingPlatform, setAddMappingPlatform] = useState('');
  const [addMappingMarket, setAddMappingMarket] = useState('');
  const [addMappingExtId, setAddMappingExtId] = useState('');
  const [addMappingType, setAddMappingType] = useState('EXACT');
  const [showAddMapping, setShowAddMapping] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [aiAttributes, setAiAttributes] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameZh, setEditNameZh] = useState('');
  const [editStatus, setEditStatus] = useState('');

  const { authHeaders } = useAuth();
  const api = useCallback((path: string, options?: RequestInit) => apiFetch(path, authHeaders, options), [authHeaders]);

  const loadData = useCallback(async () => {
    if (!category) return;
    setLoading(true);
    try {
      const [mapData, aliasData] = await Promise.all([
        api(`/system/categories/${category.id}/mappings`),
        api(`/system/categories/${category.id}/aliases`),
      ]);
      setMappings(mapData.items);
      setAliases(aliasData.items);
    } catch {}
    setLoading(false);
  }, [category, api]);

  useEffect(() => {
    if (category) {
      loadData();
      setEditName(category.name);
      setEditNameZh(category.nameZh || '');
      setEditStatus(category.status);
      setAiSuggestions([]);
      setAiAttributes(null);
    }
  }, [category, loadData]);

  const totalSlots = PLATFORMS.reduce((acc, p) => acc + (p.markets.length || 1), 0);
  const mappedSlots = mappings.length;
  const coverage = totalSlots > 0 ? Math.round((mappedSlots / totalSlots) * 100) : 0;

  const handleAddMapping = async () => {
    if (!category || !addMappingPlatform) return;
    await api(`/system/categories/${category.id}/mappings`, {
      method: 'POST',
      body: JSON.stringify({
        platform: addMappingPlatform,
        marketCode: addMappingMarket || null,
        externalCategoryId: addMappingExtId || null,
        mappingType: addMappingType,
      }),
    });
    setShowAddMapping(false);
    setAddMappingPlatform('');
    setAddMappingMarket('');
    setAddMappingExtId('');
    loadData();
    onUpdate();
  };

  const handleDeleteMapping = async (mapId: string) => {
    if (!category) return;
    await api(`/system/categories/${category.id}/mappings/${mapId}`, { method: 'DELETE' });
    loadData();
    onUpdate();
  };

  const handleAddAlias = async () => {
    if (!category || !newAlias.trim()) return;
    await api(`/system/categories/${category.id}/aliases`, {
      method: 'POST',
      body: JSON.stringify({ alias: newAlias.trim(), language: newAliasLang }),
    });
    setNewAlias('');
    loadData();
  };

  const handleDeleteAlias = async (aliasId: string) => {
    if (!category) return;
    await api(`/system/categories/${category.id}/aliases/${aliasId}`, { method: 'DELETE' });
    loadData();
  };

  const handleUpdateInfo = async () => {
    if (!category) return;
    await api(`/system/categories/${category.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: editName,
        nameZh: editNameZh || null,
        status: editStatus,
      }),
    });
    onUpdate();
  };

  const handleAiSuggestMappings = async () => {
    if (!category) return;
    setAiLoading('mappings');
    try {
      const data = await api(`/system/ai/suggest-mappings`, {
        method: 'POST',
        body: JSON.stringify({ globalCategoryId: category.id }),
      });
      setAiSuggestions(data.suggestions);
    } catch {}
    setAiLoading(null);
  };

  const handleAiGenerateAttributes = async () => {
    if (!category) return;
    setAiLoading('attributes');
    try {
      const data = await api(`/system/ai/generate-attributes`, {
        method: 'POST',
        body: JSON.stringify({ globalCategoryId: category.id }),
      });
      setAiAttributes(data);
    } catch {}
    setAiLoading(null);
  };

  const handleApplySuggestion = async (suggestion: any) => {
    if (!category) return;
    await api(`/system/categories/${category.id}/mappings`, {
      method: 'POST',
      body: JSON.stringify({
        platform: suggestion.platform,
        platformCategoryId: suggestion.platformCategoryId,
        externalCategoryId: suggestion.externalCategoryId,
        externalPath: suggestion.platformCategoryPath,
        mappingType: suggestion.mappingType,
        confidenceScore: suggestion.confidence,
        source: 'ai',
      }),
    });
    setAiSuggestions(prev => prev.filter(s => s !== suggestion));
    loadData();
    onUpdate();
  };

  const handleApplyAttributes = async () => {
    if (!category || !aiAttributes) return;
    await api(`/system/categories/${category.id}`, {
      method: 'PUT',
      body: JSON.stringify({ attributeSchema: aiAttributes.attributes }),
    });
    setAiAttributes(null);
    onUpdate();
  };

  if (!category) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: tokens.color.textTertiary, fontSize: 13,
      }}>
        Select a category from the tree
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${tokens.color.panelBorder}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {category.icon && <span style={{ fontSize: 18 }}>{category.icon}</span>}
          <span style={{ fontSize: 15, fontWeight: 600, color: tokens.color.textPrimary }}>{category.name}</span>
          <Badge text={`L${category.level}`} color={tokens.color.accent} />
          <Badge text={category.status} color={
            category.status === 'ACTIVE' ? tokens.color.success :
            category.status === 'DRAFT' ? tokens.color.warning :
            tokens.color.danger
          } />
        </div>
        <div style={{ fontSize: 11, color: tokens.color.textTertiary }}>{category.path}</div>
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${tokens.color.panelBorder}` }}>
        <TabButton label="Mappings" active={tab === 'mappings'} onClick={() => setTab('mappings')} />
        <TabButton label="Attributes" active={tab === 'attributes'} onClick={() => setTab('attributes')} />
        <TabButton label="Info" active={tab === 'info'} onClick={() => setTab('info')} />
        <TabButton label="AI" active={tab === 'ai'} onClick={() => setTab('ai')} />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {loading && <div style={{ color: tokens.color.textTertiary, fontSize: 12 }}>Loading...</div>}

        {!loading && tab === 'mappings' && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
            }}>
              <div style={{ fontSize: 11, color: tokens.color.textSecondary }}>
                {mappedSlots}/{totalSlots} slots mapped
              </div>
              <SmallButton label="+ Add Mapping" accent onClick={() => setShowAddMapping(!showAddMapping)} />
            </div>

            <div style={{
              height: 4,
              background: tokens.color.panelBorder,
              borderRadius: 2,
              marginBottom: 16,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${coverage}%`,
                background: coverage >= 80 ? tokens.color.success : coverage >= 50 ? tokens.color.warning : tokens.color.danger,
                borderRadius: 2,
                transition: 'width 0.3s',
              }} />
            </div>

            {showAddMapping && (
              <div style={{
                padding: 12,
                background: tokens.color.panelBgSecondary,
                borderRadius: tokens.radius.sm,
                border: `1px solid ${tokens.color.panelBorder}`,
                marginBottom: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={addMappingPlatform} onChange={e => {
                    setAddMappingPlatform(e.target.value);
                    setAddMappingMarket('');
                  }} style={selectStyle}>
                    <option value="">Platform...</option>
                    {PLATFORMS.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
                  </select>
                  {PLATFORMS.find(p => p.code === addMappingPlatform)?.markets.length ? (
                    <select value={addMappingMarket} onChange={e => setAddMappingMarket(e.target.value)} style={selectStyle}>
                      <option value="">Market...</option>
                      {PLATFORMS.find(p => p.code === addMappingPlatform)?.markets.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={addMappingExtId}
                    onChange={e => setAddMappingExtId(e.target.value)}
                    placeholder="External Category ID"
                    style={inputStyle}
                  />
                  <select value={addMappingType} onChange={e => setAddMappingType(e.target.value)} style={selectStyle}>
                    <option value="EXACT">Exact</option>
                    <option value="CLOSE">Close</option>
                    <option value="FORCED">Forced</option>
                  </select>
                  <SmallButton label="Save" accent onClick={handleAddMapping} />
                </div>
              </div>
            )}

            {PLATFORMS.map(platform => {
              const platformMappings = mappings.filter(m => m.platform === platform.code);
              if (platformMappings.length === 0 && !showAddMapping) return null;

              return (
                <div key={platform.code} style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: tokens.color.textSecondary,
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>{platform.label}</div>
                  {platformMappings.map(m => (
                    <div key={m.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 10px',
                      background: tokens.color.panelBgSecondary,
                      borderRadius: tokens.radius.sm,
                      marginBottom: 4,
                      fontSize: 12,
                    }}>
                      {m.marketCode && (
                        <Badge text={m.marketCode} color={tokens.color.accent} />
                      )}
                      <span style={{ color: tokens.color.textPrimary, flex: 1 }}>
                        {m.externalCategoryId || m.platformCategory?.name || '-'}
                      </span>
                      {m.externalPath && (
                        <span style={{ color: tokens.color.textTertiary, fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.externalPath}
                        </span>
                      )}
                      <Badge text={m.mappingType} color={
                        m.mappingType === 'EXACT' ? tokens.color.success :
                        m.mappingType === 'CLOSE' ? tokens.color.warning :
                        tokens.color.danger
                      } />
                      <ConfidenceDot score={m.confidenceScore} />
                      <span
                        onClick={() => handleDeleteMapping(m.id)}
                        style={{ cursor: 'pointer', color: tokens.color.danger, fontSize: 14 }}
                      >&times;</span>
                    </div>
                  ))}
                  {platformMappings.length === 0 && (
                    <div style={{ fontSize: 11, color: tokens.color.textTertiary, padding: '4px 10px' }}>
                      No mapping
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && tab === 'attributes' && (
          <div>
            <div style={{
              fontSize: 11, color: tokens.color.textSecondary, marginBottom: 12,
            }}>
              Aliases help AI classification accuracy. Add common names in multiple languages.
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <input
                value={newAlias}
                onChange={e => setNewAlias(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddAlias(); }}
                placeholder="Add alias (Enter to submit)"
                style={{ ...inputStyle, flex: 1 }}
              />
              <select value={newAliasLang} onChange={e => setNewAliasLang(e.target.value)} style={{ ...selectStyle, width: 60 }}>
                <option value="en">EN</option>
                <option value="zh">ZH</option>
              </select>
            </div>

            {['en', 'zh'].map(lang => {
              const langAliases = aliases.filter(a => a.language === lang);
              if (langAliases.length === 0) return null;
              return (
                <div key={lang} style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 600, color: tokens.color.textTertiary,
                    marginBottom: 4, textTransform: 'uppercase',
                  }}>{lang === 'en' ? 'English' : 'Chinese'}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {langAliases.map(a => (
                      <span key={a.id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 8px', borderRadius: 12,
                        background: tintedBg(tokens.color.accent, 8),
                        border: `1px solid ${tintedBg(tokens.color.accent, 20)}`,
                        fontSize: 11, color: tokens.color.textPrimary,
                      }}>
                        {a.alias}
                        <span
                          onClick={() => handleDeleteAlias(a.id)}
                          style={{ cursor: 'pointer', color: tokens.color.textTertiary, fontSize: 12, lineHeight: 1 }}
                        >&times;</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}

            {category.attributeSchema && (
              <div style={{ marginTop: 16 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: tokens.color.textSecondary,
                  marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>Attribute Schema</div>
                <pre style={{
                  fontSize: 11, padding: 12, borderRadius: tokens.radius.sm,
                  background: tokens.color.panelBgSecondary,
                  border: `1px solid ${tokens.color.panelBorder}`,
                  overflow: 'auto', maxHeight: 300,
                  color: tokens.color.textPrimary,
                }}>
                  {JSON.stringify(category.attributeSchema, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {!loading && tab === 'info' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <InfoRow label="ID" value={category.id} />
            <InfoRow label="Code" value={category.code} />
            <InfoRow label="Level" value={`L${category.level}`} />
            <InfoRow label="Path" value={category.path} />
            <InfoRow label="Slug Path" value={category.slugPath} />
            <InfoRow label="Source" value={category.source} />
            {category.googleTaxonomyId != null && (
              <InfoRow label="Google ID" value={String(category.googleTaxonomyId)} />
            )}

            <div style={{ marginTop: 8, borderTop: `1px solid ${tokens.color.panelBorder}`, paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: tokens.color.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>
                Edit
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <label style={labelStyle}>Name (EN)</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Name (ZH)</label>
                  <input value={editNameZh} onChange={e => setEditNameZh(e.target.value)} style={inputStyle} placeholder="Chinese name..." />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={selectStyle}>
                    <option value="DRAFT">DRAFT</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DEPRECATED">DEPRECATED</option>
                  </select>
                </div>
                <SmallButton label="Save Changes" accent onClick={handleUpdateInfo} />
              </div>
            </div>
          </div>
        )}

        {!loading && tab === 'ai' && (
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginBottom: 16,
            }}>
              <AiCard
                icon="&#x1F5FA;"
                title="Suggest Mappings"
                desc="AI recommends platform category mappings"
                loading={aiLoading === 'mappings'}
                onClick={handleAiSuggestMappings}
              />
              <AiCard
                icon="&#x1F4CB;"
                title="Generate Attributes"
                desc="AI generates required + recommended attributes"
                loading={aiLoading === 'attributes'}
                onClick={handleAiGenerateAttributes}
              />
            </div>

            {aiSuggestions.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: tokens.color.textSecondary,
                  marginBottom: 8, textTransform: 'uppercase',
                }}>AI Mapping Suggestions</div>
                {aiSuggestions.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: tokens.radius.sm,
                    background: tokens.color.panelBgSecondary,
                    border: `1px solid ${tokens.color.panelBorder}`,
                    marginBottom: 6, fontSize: 12,
                  }}>
                    <Badge text={s.platform} color={tokens.color.accent} />
                    <span style={{ color: tokens.color.textPrimary, flex: 1 }}>
                      {s.platformCategoryName}
                    </span>
                    <ConfidenceDot score={s.confidence} />
                    <Badge text={s.mappingType} color={
                      s.mappingType === 'EXACT' ? tokens.color.success : tokens.color.warning
                    } />
                    <SmallButton label="Apply" accent onClick={() => handleApplySuggestion(s)} />
                  </div>
                ))}
                {aiSuggestions.length > 0 && aiSuggestions[0].reason && (
                  <div style={{
                    fontSize: 10, color: tokens.color.textTertiary, marginTop: 4, fontStyle: 'italic',
                  }}>
                    Reason: {aiSuggestions[0].reason}
                  </div>
                )}
              </div>
            )}

            {aiAttributes && (
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: tokens.color.textSecondary,
                  marginBottom: 8, textTransform: 'uppercase',
                }}>AI Generated Attributes</div>

                {aiAttributes.attributes.required && (
                  <AttrGroup title="Required" items={aiAttributes.attributes.required} color={tokens.color.danger} />
                )}
                {aiAttributes.attributes.recommended && (
                  <AttrGroup title="Recommended" items={aiAttributes.attributes.recommended} color={tokens.color.warning} />
                )}

                <div style={{ marginTop: 8 }}>
                  <SmallButton label="Apply to Category" accent onClick={handleApplyAttributes} />
                </div>
              </div>
            )}

            {!aiSuggestions.length && !aiAttributes && !aiLoading && (
              <div style={{
                textAlign: 'center', color: tokens.color.textTertiary, fontSize: 12, padding: 20,
              }}>
                Click an AI tool above to get started
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
      <span style={{ width: 80, color: tokens.color.textTertiary, flexShrink: 0 }}>{label}</span>
      <span style={{ color: tokens.color.textPrimary, wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}

function AiCard({ icon, title, desc, loading, onClick }: {
  icon: string; title: string; desc: string; loading: boolean; onClick: () => void;
}) {
  return (
    <div
      onClick={loading ? undefined : onClick}
      style={{
        padding: 14,
        borderRadius: tokens.radius.sm,
        border: `1px solid ${tokens.color.panelBorder}`,
        background: tokens.color.panelBgSecondary,
        cursor: loading ? 'wait' : 'pointer',
        opacity: loading ? 0.6 : 1,
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ fontSize: 20, marginBottom: 6 }} dangerouslySetInnerHTML={{ __html: icon }} />
      <div style={{ fontSize: 12, fontWeight: 600, color: tokens.color.textPrimary, marginBottom: 2 }}>
        {loading ? 'Processing...' : title}
      </div>
      <div style={{ fontSize: 10, color: tokens.color.textTertiary }}>{desc}</div>
    </div>
  );
}

function AttrGroup({ title, items, color }: { title: string; items: any[]; color: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color, marginBottom: 4, textTransform: 'uppercase' }}>{title}</div>
      {items.map((attr: any, i: number) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 8px', fontSize: 11, borderBottom: `1px solid ${tokens.color.panelBorder}`,
        }}>
          <span style={{ color: tokens.color.textPrimary, flex: 1 }}>{attr.label}</span>
          <span style={{ color: tokens.color.textTertiary }}>{attr.type}</span>
          {attr.confidence && <ConfidenceDot score={attr.confidence} />}
        </div>
      ))}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  fontSize: 12,
  padding: '6px 10px',
  border: `1px solid ${tokens.color.panelBorder}`,
  borderRadius: tokens.radius.sm,
  background: tokens.color.panelBg,
  color: tokens.color.textPrimary,
  outline: 'none',
  fontFamily: 'inherit',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: tokens.color.textTertiary,
  display: 'block',
  marginBottom: 3,
  textTransform: 'uppercase' as const,
  fontWeight: 600,
};
