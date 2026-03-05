'use client';

import Link from 'next/link';
import { usePortalTheme } from '@/lib/themes/portal-theme-context';

export function PortalNav() {
  const { brandName, brandAccentLetter } = usePortalTheme();

  const displayName = brandAccentLetter
    ? brandName.replace(brandAccentLetter, `|||${brandAccentLetter}|||`)
    : brandName;

  const parts = displayName.split('|||');

  return (
    <nav className="portal-nav">
      <Link href="/" className="portal-nav-brand" style={{ textDecoration: 'none', color: 'inherit' }}>
        {parts.map((part, i) =>
          part === brandAccentLetter ? (
            <span key={i} className="portal-nav-brand-accent">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </Link>
      <div className="portal-nav-links">
        <Link href="/" className="portal-nav-link">Products</Link>
        <Link href="/warranty" className="portal-nav-link">Warranty</Link>
        <Link href="/warranty/list" className="portal-nav-link">My Warranties</Link>
      </div>
      <Link href="/chat" className="portal-btn-nav" style={{ textDecoration: 'none' }}>
        Contact Support
      </Link>
    </nav>
  );
}
