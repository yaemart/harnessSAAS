'use client';

import Link from 'next/link';
import type { WarrantyRecord } from '@/lib/portal-api-client';
import { formatDate } from '@/lib/format';

interface WarrantySuccessProps {
  warranty: WarrantyRecord;
}

export function WarrantySuccess({ warranty }: WarrantySuccessProps) {
  const purchaseDate = formatDate(warranty.purchaseDate, 'long');
  const expiryDate = formatDate(warranty.expiryDate, 'long');

  return (
    <div style={{ textAlign: 'center', padding: '40px', background: 'var(--portal-bg-warm)', border: '1px solid var(--portal-border)', borderRadius: 'var(--portal-radius-lg)' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
      <div style={{ fontFamily: 'var(--portal-font-heading)', fontSize: '24px', marginBottom: '8px' }}>
        Warranty Activated!
      </div>
      <div style={{ fontSize: '13px', color: 'var(--portal-text-tertiary)', marginBottom: '24px' }}>
        Your {warranty.commodity.product.name} is now protected.
      </div>

      <div style={{
        background: 'var(--portal-bg)',
        border: '1px solid var(--portal-border)',
        borderRadius: 'var(--portal-radius-md)',
        padding: '20px',
        marginBottom: '24px',
        textAlign: 'left',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
          <div>
            <div style={{ fontFamily: 'var(--portal-font-mono)', fontSize: '9px', letterSpacing: '2px', color: 'var(--portal-text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Product
            </div>
            <div style={{ fontWeight: 500 }}>{warranty.commodity.product.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--portal-text-tertiary)' }}>{warranty.commodity.title}</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--portal-font-mono)', fontSize: '9px', letterSpacing: '2px', color: 'var(--portal-text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Serial Number
            </div>
            <div style={{ fontFamily: 'var(--portal-font-mono)', fontWeight: 500 }}>{warranty.serialNumber}</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--portal-font-mono)', fontSize: '9px', letterSpacing: '2px', color: 'var(--portal-text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Purchased
            </div>
            <div>{purchaseDate}</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--portal-font-mono)', fontSize: '9px', letterSpacing: '2px', color: 'var(--portal-text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Expires
            </div>
            <div style={{ color: 'var(--portal-success)', fontWeight: 500 }}>{expiryDate}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <Link href="/warranty/list" className="portal-btn-primary" style={{ textDecoration: 'none' }}>
          <span>View My Warranties</span>
          <span>→</span>
        </Link>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            border: '1px solid var(--portal-border)',
            borderRadius: '999px',
            fontSize: '13px',
            color: 'var(--portal-text-secondary)',
            textDecoration: 'none',
            fontFamily: 'var(--portal-font-body)',
          }}
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
