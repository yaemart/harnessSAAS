import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import '../lib/themes/editorial.css';
import '../lib/themes/minimal-mono.css';
import '../lib/themes/tech-neon.css';
import '../lib/themes/natural-grove.css';
import '../lib/themes/luxury-noir.css';
import { PortalShell } from './portal-shell';
import { PortalNav } from '@/components/portal-nav';

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const seoTitle = h.get('x-portal-seo-title');
  const seoDescription = h.get('x-portal-seo-description');
  const brandName = h.get('x-portal-brand-name') ?? 'Brand';
  const faviconUrl = h.get('x-portal-favicon-url');

  return {
    title: seoTitle ?? `${brandName} Support Portal`,
    description: seoDescription ?? `Product support, warranty registration, and customer service for ${brandName}`,
    ...(faviconUrl ? { icons: { icon: faviconUrl } } : {}),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();

  const brandConfig = {
    brandId: h.get('x-portal-brand-id') ?? '',
    brandCode: h.get('x-portal-brand-code') ?? '',
    brandName: h.get('x-portal-brand-name') ?? 'Brand',
    themeId: h.get('x-portal-theme-id') ?? 'editorial',
    logoUrl: h.get('x-portal-logo-url'),
    faviconUrl: h.get('x-portal-favicon-url'),
    seoTitle: h.get('x-portal-seo-title'),
    seoDescription: h.get('x-portal-seo-description'),
    primaryColor: h.get('x-portal-primary-color'),
    welcomeMessage: h.get('x-portal-welcome-message'),
    supportEmail: h.get('x-portal-support-email'),
  };

  return (
    <html lang="en">
      <body>
        <PortalShell brandConfig={brandConfig}>
          <PortalNav />
          <div style={{ paddingTop: 'var(--portal-nav-height)' }}>
            {children}
          </div>
        </PortalShell>
      </body>
    </html>
  );
}
