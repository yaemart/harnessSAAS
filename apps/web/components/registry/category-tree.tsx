'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { tokens, tintedBg } from '../../lib/design-tokens';
import { useAuth } from '../auth-context';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3300';

export interface CategoryNode {
  id: string;
  code: string;
  name: string;
  nameZh?: string;
  level: number;
  icon: string;
  path: string;
  slugPath: string;
  status: string;
  source: string;
  mappingCount: number;
  hasChildren: boolean;
  enabled: boolean;
  sortOrder: number;
  attributeSchema?: any;
  googleTaxonomyId?: number | null;
}

interface Props {
  selectedId: string | null;
  onSelect: (cat: CategoryNode) => void;
  onRefreshSignal?: number;
}

async function fetchChildren(parentId: string | null, headers: Record<string, string>): Promise<CategoryNode[]> {
  const q = parentId ? `?parentId=${parentId}` : '';
  const res = await fetch(`${API}/system/categories${q}`, {
    headers,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to load categories');
  const data = await res.json();
  return data.items;
}

async function searchCategories(q: string, headers: Record<string, string>): Promise<CategoryNode[]> {
  const res = await fetch(`${API}/system/categories/search?q=${encodeURIComponent(q)}`, {
    headers,
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.items;
}

export default function CategoryTree({ selectedId, onSelect, onRefreshSignal }: Props) {
  const [roots, setRoots] = useState<CategoryNode[]>([]);
  const [expanded, setExpanded] = useState<Record<string, CategoryNode[]>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CategoryNode[] | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [addingChildFor, setAddingChildFor] = useState<string | null>(null);
  const [newChildName, setNewChildName] = useState('');
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  const { authHeaders } = useAuth();

  const loadRoots = useCallback(async () => {
    try {
      const items = await fetchChildren(null, authHeaders);
      setRoots(items);
    } catch {}
  }, [authHeaders]);

  useEffect(() => { loadRoots(); }, [loadRoots, onRefreshSignal]);

  const toggleExpand = useCallback(async (node: CategoryNode) => {
    if (expanded[node.id]) {
      setExpanded(prev => {
        const next = { ...prev };
        delete next[node.id];
        return next;
      });
      return;
    }
    setLoadingIds(prev => new Set(prev).add(node.id));
    try {
      const children = await fetchChildren(node.id, authHeaders);
      setExpanded(prev => ({ ...prev, [node.id]: children }));
    } catch {}
    setLoadingIds(prev => {
      const next = new Set(prev);
      next.delete(node.id);
      return next;
    });
  }, [expanded, authHeaders]);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q || q.length < 2) {
      setSearchResults(null);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const results = await searchCategories(q, authHeaders);
      setSearchResults(results);
    }, 300);
  }, [authHeaders]);

  const handleAddChild = useCallback(async (parentId: string, parentLevel: number) => {
    if (!newChildName.trim()) return;
    const code = newChildName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    try {
      const res = await fetch(`${API}/system/categories`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          name: newChildName.trim(),
          parentId,
          status: 'DRAFT',
        }),
      });
      if (res.ok) {
        setAddingChildFor(null);
        setNewChildName('');
        const children = await fetchChildren(parentId, authHeaders);
        setExpanded(prev => ({ ...prev, [parentId]: children }));
      }
    } catch {}
  }, [newChildName, authHeaders]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try {
      await fetch(`${API}/system/categories/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      loadRoots();
      setExpanded(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch {}
  }, [authHeaders, loadRoots]);

  const renderNode = (node: CategoryNode, depth: number) => {
    const isExpanded = !!expanded[node.id];
    const isSelected = selectedId === node.id;
    const isLoading = loadingIds.has(node.id);
    const isHovered = hoveredId === node.id;
    const children = expanded[node.id] || [];

    return (
      <div key={node.id}>
        <div
          onClick={() => onSelect(node)}
          onMouseEnter={() => setHoveredId(node.id)}
          onMouseLeave={() => setHoveredId(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 8px',
            paddingLeft: 8 + depth * 20,
            cursor: 'pointer',
            borderRadius: tokens.radius.sm,
            background: isSelected
              ? tintedBg(tokens.color.accent, 12)
              : isHovered
              ? tintedBg(tokens.color.textPrimary, 5)
              : 'transparent',
            borderLeft: isSelected ? `2px solid ${tokens.color.accent}` : '2px solid transparent',
            transition: 'background 0.15s',
            gap: 6,
            minHeight: 32,
          }}
        >
          {node.hasChildren ? (
            <span
              onClick={(e) => { e.stopPropagation(); toggleExpand(node); }}
              style={{
                fontSize: 10,
                width: 16,
                textAlign: 'center',
                color: tokens.color.textSecondary,
                cursor: 'pointer',
                transition: 'transform 0.15s',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                flexShrink: 0,
              }}
            >
              {isLoading ? '...' : '\u25B6'}
            </span>
          ) : (
            <span style={{ width: 16, flexShrink: 0 }} />
          )}

          {node.icon && <span style={{ fontSize: 14, flexShrink: 0 }}>{node.icon}</span>}

          <span style={{
            fontSize: tokens.font.size.sm,
            color: isSelected ? tokens.color.accent : tokens.color.textPrimary,
            fontWeight: isSelected ? tokens.font.weight.semibold : tokens.font.weight.normal,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {node.name}
          </span>

          {node.status === 'DRAFT' && (
            <span style={{
              fontSize: 9,
              padding: '1px 5px',
              borderRadius: 3,
              background: tintedBg(tokens.color.warning, 15),
              color: tokens.color.warning,
              fontWeight: 600,
            }}>DRAFT</span>
          )}

          {node.status === 'DEPRECATED' && (
            <span style={{
              fontSize: 9,
              padding: '1px 5px',
              borderRadius: 3,
              background: tintedBg(tokens.color.danger, 15),
              color: tokens.color.danger,
              fontWeight: 600,
            }}>DEP</span>
          )}

          {node.mappingCount > 0 && (
            <span style={{
              fontSize: 9,
              padding: '1px 6px',
              borderRadius: 8,
              background: tintedBg(tokens.color.accent, 15),
              color: tokens.color.accent,
              fontWeight: 600,
              flexShrink: 0,
            }}>{node.mappingCount}</span>
          )}

          {isHovered && node.level < 4 && (
            <span
              onClick={(e) => { e.stopPropagation(); setAddingChildFor(node.id); setNewChildName(''); }}
              title="Add child"
              style={{
                fontSize: 14,
                color: tokens.color.textSecondary,
                cursor: 'pointer',
                flexShrink: 0,
                lineHeight: 1,
              }}
            >+</span>
          )}

          {isHovered && (
            <span
              onClick={(e) => { e.stopPropagation(); handleDelete(node.id); }}
              title="Delete"
              style={{
                fontSize: 12,
                color: tokens.color.danger,
                cursor: 'pointer',
                flexShrink: 0,
                lineHeight: 1,
              }}
            >&times;</span>
          )}
        </div>

        {addingChildFor === node.id && (
          <div style={{ paddingLeft: 8 + (depth + 1) * 20, padding: '4px 8px' }}>
            <input
              autoFocus
              value={newChildName}
              onChange={(e) => setNewChildName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddChild(node.id, node.level);
                if (e.key === 'Escape') setAddingChildFor(null);
              }}
              placeholder="New category name..."
              style={{
                width: '100%',
                fontSize: 12,
                padding: '4px 8px',
                border: `1px solid ${tokens.color.panelBorder}`,
                borderRadius: tokens.radius.sm,
                background: tokens.color.panelBg,
                color: tokens.color.textPrimary,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
        )}

        {isExpanded && children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  const displayItems = searchResults ?? roots;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      borderRight: `1px solid ${tokens.color.panelBorder}`,
    }}>
      <div style={{ padding: '12px 12px 8px' }}>
        <input
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search categories..."
          style={{
            width: '100%',
            fontSize: 12,
            padding: '7px 10px',
            border: `1px solid ${tokens.color.panelBorder}`,
            borderRadius: tokens.radius.sm,
            background: tokens.color.panelBg,
            color: tokens.color.textPrimary,
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      </div>

      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '0 4px 12px',
      }}>
        {searchResults && (
          <div style={{
            fontSize: 10,
            color: tokens.color.textSecondary,
            padding: '4px 12px',
            marginBottom: 4,
          }}>
            {searchResults.length} results for &quot;{searchQuery}&quot;
          </div>
        )}
        {displayItems.map(node => renderNode(node, 0))}
        {displayItems.length === 0 && (
          <div style={{
            padding: 20,
            textAlign: 'center',
            color: tokens.color.textTertiary,
            fontSize: 12,
          }}>
            {searchQuery ? 'No matching categories' : 'No categories found'}
          </div>
        )}
      </div>

      <div style={{
        padding: '8px 12px',
        borderTop: `1px solid ${tokens.color.panelBorder}`,
        fontSize: 10,
        color: tokens.color.textTertiary,
      }}>
        {roots.length} L1 categories
      </div>
    </div>
  );
}
