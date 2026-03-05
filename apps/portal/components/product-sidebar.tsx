'use client';

import Link from 'next/link';
import type { CommodityDetail, ListingSummary } from '@/lib/types';
import type { TabId } from './product-tabs';

interface ProductSidebarProps {
  commodity: CommodityDetail;
  listings: ListingSummary[];
  hasRecipes: boolean;
  onTabSelect: (tab: TabId) => void;
}

const PLATFORM_URLS: Record<string, string> = {
  amazon: 'https://www.amazon.com/dp/',
  amazon_us: 'https://www.amazon.com/dp/',
  amazon_uk: 'https://www.amazon.co.uk/dp/',
  amazon_de: 'https://www.amazon.de/dp/',
  amazon_fr: 'https://www.amazon.fr/dp/',
  amazon_it: 'https://www.amazon.it/dp/',
  amazon_es: 'https://www.amazon.es/dp/',
  amazon_jp: 'https://www.amazon.co.jp/dp/',
  amazon_ca: 'https://www.amazon.ca/dp/',
  amazon_au: 'https://www.amazon.com.au/dp/',
  walmart: 'https://www.walmart.com/ip/',
  target: 'https://www.target.com/p/-/A-',
  ebay: 'https://www.ebay.com/itm/',
  shopify: '',
  tiktok_shop: 'https://www.tiktok.com/@shop/product/',
};

const PLATFORM_ICONS: Record<string, string> = {
  amazon: '🛒',
  walmart: '🏪',
  target: '🎯',
  ebay: '📦',
  shopify: '🛍️',
  tiktok_shop: '🎵',
};

function buildListingUrl(listing: ListingSummary): string | null {
  const code = listing.platform.code.toLowerCase();
  const base = PLATFORM_URLS[code];
  if (!base) return null;
  const safeId = encodeURIComponent(listing.externalListingId);
  return `${base}${safeId}`;
}

function getPlatformIcon(code: string): string {
  const normalized = code.toLowerCase();
  for (const [key, icon] of Object.entries(PLATFORM_ICONS)) {
    if (normalized.includes(key)) return icon;
  }
  return '🛒';
}

export function ProductSidebar({ commodity, listings, hasRecipes, onTabSelect }: ProductSidebarProps) {
  return (
    <div className="portal-sidebar">
      <Link
        href="/"
        style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--portal-text-tertiary)', cursor: 'pointer', marginBottom: '36px', textDecoration: 'none' }}
      >
        ← Back
      </Link>

      {commodity.product.imageUrls?.[0] ? (
        <img
          src={commodity.product.imageUrls[0]}
          alt={commodity.product.name}
          style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '20px', borderRadius: 'var(--portal-radius-md)' }}
        />
      ) : (
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>📦</div>
      )}

      <div style={{ fontFamily: 'var(--portal-font-heading)', fontSize: '28px', fontWeight: 600, marginBottom: '4px' }}>
        {commodity.product.name}
      </div>
      <div style={{ fontFamily: 'var(--portal-font-mono)', fontSize: '11px', color: 'var(--portal-text-tertiary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--portal-success)', display: 'inline-block' }} />
        {commodity.market.name} · {commodity.language.toUpperCase()}
      </div>

      <div className="portal-warranty-card">
        <div style={{ fontFamily: 'var(--portal-font-mono)', fontSize: '9px', letterSpacing: '2px', color: 'var(--portal-text-tertiary)', textTransform: 'uppercase', marginBottom: '10px' }}>Warranty</div>
        {commodity.warrantyPeriodMonths ? (
          <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--portal-success)', marginBottom: '8px' }}>
            {commodity.warrantyPeriodMonths} months coverage
          </div>
        ) : (
          <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--portal-text-tertiary)', marginBottom: '8px' }}>
            No warranty info
          </div>
        )}
        <Link
          href={`/warranty?commodity=${commodity.id}`}
          style={{ fontSize: '11px', color: 'var(--portal-accent)', fontFamily: 'var(--portal-font-mono)', textDecoration: 'none' }}
        >
          Register Warranty →
        </Link>
      </div>

      <ul style={{ listStyle: 'none', marginBottom: '28px' }}>
        {([
          { icon: '❓', label: 'FAQ & Troubleshooting', tab: 'faq' as TabId },
          { icon: '📖', label: 'Manual & Guides', tab: 'manual' as TabId },
          ...(hasRecipes ? [{ icon: '🥘', label: 'Recipes', tab: 'recipes' as TabId }] : []),
          { icon: '💬', label: 'Contact Support', href: '/chat' },
          { icon: '💡', label: 'Product Feedback', tab: 'feedback' as TabId },
        ] as const).map((item) => (
          <li key={item.label} style={{ borderBottom: '1px solid var(--portal-border)' }}>
            {'href' in item && item.href ? (
              <Link
                href={item.href}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0', fontSize: '13px', color: 'var(--portal-text-secondary)', textDecoration: 'none', transition: 'all 0.2s' }}
              >
                <span style={{ fontSize: '16px', width: '24px' }}>{item.icon}</span>
                {item.label}
                <span style={{ marginLeft: 'auto', color: 'var(--portal-text-muted)', fontSize: '12px' }}>›</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => 'tab' in item && item.tab && onTabSelect(item.tab)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0', fontSize: '13px', color: 'var(--portal-text-secondary)', cursor: 'pointer', transition: 'all 0.2s', background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
              >
                <span style={{ fontSize: '16px', width: '24px' }}>{item.icon}</span>
                {item.label}
                <span style={{ marginLeft: 'auto', color: 'var(--portal-text-muted)', fontSize: '12px' }}>›</span>
              </button>
            )}
          </li>
        ))}
      </ul>

      <div>
        <div style={{ fontFamily: 'var(--portal-font-mono)', fontSize: '9px', letterSpacing: '2px', color: 'var(--portal-text-tertiary)', textTransform: 'uppercase', marginBottom: '12px' }}>Purchase</div>
        {listings.map((listing) => {
          const url = buildListingUrl(listing);
          if (!url) return null;
          return (
            <a
              key={listing.id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="portal-channel-btn"
              style={{ textDecoration: 'none' }}
            >
              <span style={{ fontSize: '18px' }}>{getPlatformIcon(listing.platform.code)}</span>
              <span>{listing.platform.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: '10px' }}>↗</span>
            </a>
          );
        })}
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <a
            href="#"
            className="portal-channel-btn"
            style={{ textDecoration: 'none', opacity: 0.7 }}
            onClick={(e) => e.preventDefault()}
          >
            <span style={{ fontSize: '18px' }}>🏢</span>
            <span>B2B Inquiry</span>
            <span style={{ marginLeft: 'auto', fontSize: '9px', fontFamily: 'var(--portal-font-mono)', color: 'var(--portal-text-muted)' }}>Coming Soon</span>
          </a>
          <a
            href="#"
            className="portal-channel-btn"
            style={{ textDecoration: 'none', opacity: 0.7 }}
            onClick={(e) => e.preventDefault()}
          >
            <span style={{ fontSize: '18px' }}>🌟</span>
            <span>Creator Collab</span>
            <span style={{ marginLeft: 'auto', fontSize: '9px', fontFamily: 'var(--portal-font-mono)', color: 'var(--portal-text-muted)' }}>Coming Soon</span>
          </a>
        </div>
      </div>
    </div>
  );
}
