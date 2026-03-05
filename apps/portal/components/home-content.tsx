import Link from 'next/link';
import type { ProductSummary } from '@/lib/types';

interface HomeContentProps {
  brandName: string;
  welcomeMessage: string | null;
  products: ProductSummary[];
}

const CATEGORY_ICONS: Record<string, string> = {
  'kitchen': '🍳',
  'audio': '🎧',
  'climate': '🌡️',
  'lighting': '💡',
  'fitness': '💪',
  'beauty': '💄',
  'outdoor': '🏕️',
};

function getProductIcon(product: ProductSummary): string {
  const catName = product.category?.name?.toLowerCase() ?? '';
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (catName.includes(key)) return icon;
  }
  return '📦';
}

export function HomeContent({ brandName, welcomeMessage, products }: HomeContentProps) {
  return (
    <>
      {/* Hero */}
      <div className="portal-hero">
        <div className="portal-hero-left">
          <div className="portal-hero-eyebrow">Brand Support Portal</div>
          <h1 className="portal-hero-title">
            Your product,<br />
            <em>fully supported</em><br />
            everywhere.
          </h1>
          <p className="portal-hero-sub">
            {welcomeMessage ?? 'Register warranty, get instant support, access guides and recipes — all in one place, in your language.'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '380px' }}>
            <Link href="/warranty" className="portal-btn-primary" style={{ textDecoration: 'none' }}>
              <span>Register Warranty</span>
              <span>→</span>
            </Link>
          </div>
          <div className="portal-mcp-badge" style={{ marginTop: '20px' }}>
            <div className="portal-agent-dot" />
            AI Agent Connect Available · MCP
          </div>
        </div>

        <div className="portal-hero-right">
          <div style={{ position: 'relative', width: '320px', height: '420px' }}>
            {products[0] && (
              <div className="portal-float-card portal-float-card--main">
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>{getProductIcon(products[0])}</div>
                <div style={{ fontFamily: 'var(--portal-font-heading)', fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>{products[0].name}</div>
                <div style={{ fontSize: '11px', color: 'var(--portal-text-tertiary)', marginBottom: '12px' }}>
                  {products[0].commodities[0]?.title ?? products[0].sku}
                </div>
                <span style={{
                  display: 'inline-block',
                  background: 'var(--portal-accent)',
                  color: 'var(--portal-bg, #fff)',
                  fontSize: '9px',
                  letterSpacing: '1px',
                  padding: '3px 8px',
                  borderRadius: '10px',
                  fontFamily: 'var(--portal-font-mono)',
                }}>View Details</span>
              </div>
            )}
            <div className="portal-float-card portal-float-card--warranty">
              <div style={{ fontFamily: 'var(--portal-font-mono)', fontSize: '9px', letterSpacing: '2px', color: 'var(--portal-text-tertiary)', textTransform: 'uppercase' as const, marginBottom: '10px' }}>Warranty Status</div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--portal-success)', marginBottom: '8px' }}>✓ Register to activate</div>
              <div className="portal-warranty-track">
                <div className="portal-warranty-fill" style={{ width: '0%' }} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--portal-text-tertiary)', fontFamily: 'var(--portal-font-mono)' }}>Scan QR or register manually</div>
            </div>
            <div className="portal-float-card portal-float-card--chat">
              <div style={{ background: 'var(--portal-bg-warm)', borderRadius: '8px', padding: '8px 10px', marginBottom: '6px', fontSize: '11px', lineHeight: 1.5 }}>I need help with my product</div>
              <div style={{ background: 'var(--portal-text-primary)', color: 'var(--portal-bg)', borderRadius: '8px', padding: '8px 10px', marginBottom: '6px', fontSize: '11px', lineHeight: 1.5 }}>
                I&apos;m here to help. What product do you have and what&apos;s the issue?
              </div>
              <div style={{ fontSize: '9px', color: 'var(--portal-text-muted)', fontFamily: 'var(--portal-font-mono)', marginTop: '4px' }}>Agent · just now</div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div style={{ padding: 'var(--portal-space-4xl)', borderTop: '1px solid var(--portal-border)' }}>
        <div className="portal-section-label">
          {products.length > 0 ? `${brandName} Products` : 'Products'}
        </div>
        <div className="portal-product-grid">
          {products.map((product) => {
            const firstCommodity = product.commodities[0];
            const href = firstCommodity ? `/p/${firstCommodity.id}` : '#';
            const icon = getProductIcon(product);
            const marketInfo = firstCommodity
              ? `${firstCommodity.language.toUpperCase()}`
              : product.sku;

            return (
              <Link
                key={product.id}
                href={href}
                className="portal-product-tile"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ fontSize: '36px', marginBottom: '16px' }}>{icon}</div>
                <div style={{ fontFamily: 'var(--portal-font-heading)', fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>
                  {product.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--portal-text-tertiary)', fontFamily: 'var(--portal-font-mono)', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--portal-success)' }}>●</span> {marketInfo}
                  {product.category && ` · ${product.category.name}`}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
                  {['Support', 'Manual', 'FAQ'].map((action) => (
                    <span
                      key={action}
                      style={{
                        fontSize: '10px',
                        letterSpacing: '1px',
                        padding: '4px 10px',
                        border: '1px solid var(--portal-stone)',
                        color: 'var(--portal-text-secondary)',
                        borderRadius: 'var(--portal-radius-sm)',
                      }}
                    >
                      {action}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}

          {products.length === 0 && (
            <div
              className="portal-product-tile"
              style={{
                border: '2px dashed var(--portal-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '8px',
                minHeight: '180px',
                background: 'transparent',
              }}
            >
              <div style={{ fontSize: '28px', color: 'var(--portal-text-muted)' }}>📦</div>
              <div style={{ fontSize: '12px', color: 'var(--portal-text-muted)', letterSpacing: '1px', textTransform: 'uppercase' as const }}>No products available</div>
            </div>
          )}

          <Link
            href="/warranty"
            className="portal-product-tile"
            style={{
              textDecoration: 'none',
              color: 'inherit',
              border: '2px dashed var(--portal-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '8px',
              minHeight: '180px',
              background: 'transparent',
            }}
          >
            <div style={{ fontSize: '28px', color: 'var(--portal-text-muted)' }}>＋</div>
            <div style={{ fontSize: '12px', color: 'var(--portal-text-muted)', letterSpacing: '1px', textTransform: 'uppercase' as const }}>Register New Product</div>
          </Link>
        </div>
      </div>
    </>
  );
}
