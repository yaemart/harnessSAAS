'use client';

import { useState } from 'react';
import type { CommodityDetail, FAQ, CommodityMedia, ListingSummary } from '@/lib/types';
import { ProductSidebar } from './product-sidebar';
import { FAQTab, ManualTab, RecipesTab, FeedbackTab, type TabId } from './product-tabs';

interface ProductDetailProps {
  commodity: CommodityDetail;
  faqs: FAQ[];
  media: CommodityMedia[];
  listings: ListingSummary[];
}

function groupMedia(media: CommodityMedia[]) {
  const manuals: CommodityMedia[] = [];
  const recipes: CommodityMedia[] = [];
  const other: CommodityMedia[] = [];

  for (const m of media) {
    const t = m.type?.toLowerCase() ?? '';
    if (t.includes('recipe') || t.includes('demo')) {
      recipes.push(m);
    } else if (t.includes('manual') || t.includes('guide') || t.includes('usage') || t.includes('assembly') || t.includes('repair') || t.includes('cleaning')) {
      manuals.push(m);
    } else {
      other.push(m);
    }
  }

  return { manuals: [...manuals, ...other], recipes };
}

export function ProductDetail({ commodity, faqs, media, listings }: ProductDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>('faq');
  const [openFaq, setOpenFaq] = useState<number>(0);
  const [activeFeedbackType, setActiveFeedbackType] = useState(0);

  const { manuals, recipes } = groupMedia(media);
  const hasRecipes = recipes.length > 0;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'faq', label: 'FAQ' },
    { id: 'manual', label: 'Manual' },
    ...(hasRecipes ? [{ id: 'recipes' as TabId, label: 'Recipes' }] : []),
    { id: 'feedback', label: 'Feedback' },
  ];

  return (
    <div className="portal-detail-layout">
      <ProductSidebar
        commodity={commodity}
        listings={listings}
        hasRecipes={hasRecipes}
        onTabSelect={setActiveTab}
      />

      <div style={{ padding: '48px 56px', overflowY: 'auto' }}>
        {commodity.bulletPoints && commodity.bulletPoints.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontFamily: 'var(--portal-font-heading)', fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>
              {commodity.title}
            </h2>
            <ul style={{ paddingLeft: '20px', lineHeight: 2, fontSize: '13px', color: 'var(--portal-text-secondary)' }}>
              {commodity.bulletPoints.map((bp, i) => (
                <li key={i}>{bp}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="portal-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className="portal-tab"
              data-active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'faq' && (
          <FAQTab
            faqs={faqs}
            openFaq={openFaq}
            onToggle={(i) => setOpenFaq(openFaq === i ? -1 : i)}
          />
        )}
        {activeTab === 'manual' && (
          <ManualTab manuals={manuals} language={commodity.language} />
        )}
        {activeTab === 'recipes' && hasRecipes && (
          <RecipesTab recipes={recipes} productName={commodity.product.name} categoryCode={commodity.product.category?.name} />
        )}
        {activeTab === 'feedback' && (
          <FeedbackTab
            activeFeedbackType={activeFeedbackType}
            onFeedbackTypeChange={setActiveFeedbackType}
          />
        )}
      </div>
    </div>
  );
}
