'use client';

import { useState, useCallback } from 'react';
import { tokens } from '../../lib/design-tokens';
import CategoryTree, { type CategoryNode } from './category-tree';
import CategoryDetail from './category-detail';

export default function CategoryOntology() {
  const [selected, setSelected] = useState<CategoryNode | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const handleUpdate = useCallback(() => {
    setRefreshSignal(prev => prev + 1);
  }, []);

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 200px)',
      minHeight: 500,
      border: `1px solid ${tokens.color.panelBorder}`,
      borderRadius: tokens.radius.md,
      overflow: 'hidden',
      background: tokens.color.panelBg,
    }}>
      <div style={{ width: 320, flexShrink: 0, overflow: 'hidden' }}>
        <CategoryTree
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
          onRefreshSignal={refreshSignal}
        />
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <CategoryDetail
          category={selected}
          onUpdate={handleUpdate}
        />
      </div>
    </div>
  );
}
