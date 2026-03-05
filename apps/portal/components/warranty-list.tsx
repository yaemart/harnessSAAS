'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { fetchMyWarranties, type WarrantyRecord, PortalClientError } from '@/lib/portal-api-client';
import { isLoggedIn } from '@/lib/auth';
import { formatDate } from '@/lib/format';

function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'var(--portal-success)';
    case 'expired': return 'var(--portal-danger)';
    case 'voided': return 'var(--portal-text-tertiary)';
    default: return 'var(--portal-text-secondary)';
  }
}

function daysUntilExpiry(expiryDate: string): number {
  const diff = new Date(expiryDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function warrantyProgress(purchaseDate: string, expiryDate: string): number {
  const start = new Date(purchaseDate).getTime();
  const end = new Date(expiryDate).getTime();
  const now = Date.now();
  if (now >= end) return 100;
  if (now <= start) return 0;
  return Math.round(((now - start) / (end - start)) * 100);
}

function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--portal-bg-card, var(--portal-bg-warm))',
      border: '1px solid var(--portal-border)',
      borderRadius: 'var(--portal-radius-lg)',
      padding: '20px',
      animation: 'pulse 1.5s ease-in-out infinite',
    }}>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: 'var(--portal-radius-sm)', background: 'var(--portal-border)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: '16px', width: '60%', background: 'var(--portal-border)', borderRadius: '4px', marginBottom: '8px' }} />
          <div style={{ height: '12px', width: '40%', background: 'var(--portal-border)', borderRadius: '4px', marginBottom: '12px' }} />
          <div style={{ height: '8px', width: '100%', background: 'var(--portal-border)', borderRadius: '4px' }} />
        </div>
      </div>
    </div>
  );
}

export function WarrantyList() {
  const [warranties, setWarranties] = useState<WarrantyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  const loadWarranties = useCallback(() => {
    setError('');
    setLoading(true);
    fetchMyWarranties()
      .then((data) => setWarranties(data.warranties))
      .catch((err) => {
        if (err instanceof PortalClientError) setError(err.message);
        else setError('Failed to load warranties');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const ok = isLoggedIn();
    setLoggedIn(ok);
    if (!ok) {
      setLoading(false);
      return;
    }
    loadWarranties();
  }, [loadWarranties]);

  if (loggedIn === false) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <div style={{ fontFamily: 'var(--portal-font-heading)', fontSize: '20px', marginBottom: '8px' }}>
          Sign in to view your warranties
        </div>
        <div style={{ fontSize: '13px', color: 'var(--portal-text-tertiary)', marginBottom: '24px' }}>
          Register a new warranty to get started
        </div>
        <Link href="/warranty" className="portal-btn-primary" style={{ textDecoration: 'none' }}>
          <span>Register Warranty</span>
          <span>→</span>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ fontSize: '13px', color: 'var(--portal-danger)', marginBottom: '16px' }}>{error}</div>
        <button
          onClick={loadWarranties}
          className="portal-btn-primary"
          style={{ margin: '0 auto' }}
        >
          <span>Retry</span>
          <span>↻</span>
        </button>
      </div>
    );
  }

  if (warranties.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛡️</div>
        <div style={{ fontFamily: 'var(--portal-font-heading)', fontSize: '20px', marginBottom: '8px' }}>
          No warranties registered yet
        </div>
        <div style={{ fontSize: '13px', color: 'var(--portal-text-tertiary)', marginBottom: '24px' }}>
          Register your product to activate warranty coverage
        </div>
        <Link href="/warranty" className="portal-btn-primary" style={{ textDecoration: 'none' }}>
          <span>Register Warranty</span>
          <span>→</span>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ fontFamily: 'var(--portal-font-mono)', fontSize: '9px', letterSpacing: '2px', color: 'var(--portal-text-tertiary)', textTransform: 'uppercase' }}>
          {warranties.length} Registered Product{warranties.length !== 1 ? 's' : ''}
        </div>
        <Link href="/warranty" style={{ fontSize: '12px', color: 'var(--portal-accent)', textDecoration: 'none', fontFamily: 'var(--portal-font-mono)' }}>
          + Register New
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {warranties.map((w) => {
          const days = daysUntilExpiry(w.expiryDate);
          const progress = warrantyProgress(w.purchaseDate, w.expiryDate);
          return (
            <div
              key={w.id}
              style={{
                background: 'var(--portal-bg-card, var(--portal-bg-warm))',
                border: '1px solid var(--portal-border)',
                borderRadius: 'var(--portal-radius-lg)',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                {w.commodity.product.imageUrls?.[0] ? (
                  <img
                    src={w.commodity.product.imageUrls[0]}
                    alt={w.commodity.product.name}
                    style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: 'var(--portal-radius-sm)' }}
                  />
                ) : (
                  <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>📦</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '2px' }}>
                    {w.commodity.product.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--portal-text-tertiary)', fontFamily: 'var(--portal-font-mono)', marginBottom: '8px' }}>
                    SN: {w.serialNumber}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: getStatusColor(w.status) }}>
                      {w.status === 'active' ? `✓ Active — ${days} days left` : w.status === 'expired' ? '✗ Expired' : w.status}
                    </span>
                  </div>
                  <div className="portal-warranty-track" style={{ marginBottom: '4px' }}>
                    <div className="portal-warranty-fill" style={{ width: `${100 - progress}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--portal-text-tertiary)', fontFamily: 'var(--portal-font-mono)' }}>
                    <span>{formatDate(w.purchaseDate)}</span>
                    <span>{formatDate(w.expiryDate)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
