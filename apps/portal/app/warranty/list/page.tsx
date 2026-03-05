'use client';

import Link from 'next/link';
import { WarrantyList } from '@/components/warranty-list';

export default function WarrantyListPage() {
  return (
    <div style={{ maxWidth: '640px', margin: '80px auto', padding: '0 24px' }}>
      <Link
        href="/"
        style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--portal-text-tertiary)', cursor: 'pointer', marginBottom: '32px', textDecoration: 'none' }}
      >
        ← Back to Home
      </Link>

      <div style={{ fontSize: '48px', marginBottom: '24px' }}>🛡️</div>
      <h1 style={{ fontFamily: 'var(--portal-font-heading)', fontSize: '36px', fontWeight: 300, marginBottom: '8px' }}>
        My Warranties
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--portal-text-tertiary)', lineHeight: 1.8, marginBottom: '40px' }}>
        View and manage your registered product warranties.
      </p>

      <WarrantyList />
    </div>
  );
}
