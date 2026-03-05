'use client';

import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import type { PortalThemeDefinition } from './theme-registry';
import { getTheme } from './theme-registry';

interface PortalThemeContextType {
  theme: PortalThemeDefinition;
  brandName: string;
  brandAccentLetter?: string;
}

const PortalThemeContext = createContext<PortalThemeContextType>({
  theme: getTheme('editorial'),
  brandName: 'BRAND',
});

export function PortalThemeProvider({
  themeId,
  brandName,
  brandAccentLetter,
  children,
}: {
  themeId: string;
  brandName: string;
  brandAccentLetter?: string;
  children: ReactNode;
}) {
  const theme = getTheme(themeId);

  useEffect(() => {
    if (!theme.fonts.googleFontsUrl) return;

    const existingLink = document.querySelector(`link[data-portal-fonts="${theme.id}"]`);
    if (existingLink) return;

    document.querySelectorAll('link[data-portal-fonts]').forEach((el) => el.remove());

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = theme.fonts.googleFontsUrl;
    link.setAttribute('data-portal-fonts', theme.id);
    document.head.appendChild(link);
  }, [theme]);

  return (
    <PortalThemeContext.Provider value={{ theme, brandName, brandAccentLetter }}>
      <div className={theme.cssClass}>
        {children}
      </div>
    </PortalThemeContext.Provider>
  );
}

export function usePortalTheme() {
  return useContext(PortalThemeContext);
}
