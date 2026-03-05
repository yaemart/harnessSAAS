'use client';

import type { ReactNode } from 'react';
import { BrandProvider, type BrandPortalConfig } from '@/lib/brand-context';
import { PortalThemeProvider } from '@/lib/themes/portal-theme-context';

export function PortalShell({
  brandConfig,
  children,
}: {
  brandConfig: BrandPortalConfig;
  children: ReactNode;
}) {
  const accentLetter = brandConfig.brandName.length > 1
    ? brandConfig.brandName.charAt(brandConfig.brandName.length - 1)
    : undefined;

  return (
    <BrandProvider config={brandConfig}>
      <PortalThemeProvider
        themeId={brandConfig.themeId}
        brandName={brandConfig.brandName}
        brandAccentLetter={accentLetter}
      >
        {children}
      </PortalThemeProvider>
    </BrandProvider>
  );
}
