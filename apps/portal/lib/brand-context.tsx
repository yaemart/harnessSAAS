'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { BrandPortalConfig } from './types';

export type { BrandPortalConfig };

const BrandContext = createContext<BrandPortalConfig>({
  brandId: '',
  brandCode: '',
  brandName: 'Brand',
  themeId: 'editorial',
  logoUrl: null,
  faviconUrl: null,
  seoTitle: null,
  seoDescription: null,
  primaryColor: null,
  welcomeMessage: null,
  supportEmail: null,
});

export function BrandProvider({
  config,
  children,
}: {
  config: BrandPortalConfig;
  children: ReactNode;
}) {
  return (
    <BrandContext.Provider value={config}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  return useContext(BrandContext);
}
