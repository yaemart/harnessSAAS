'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { isLoggedIn } from '@/lib/auth';
import { EmailVerify } from './email-verify';
import { WarrantyForm } from './warranty-form';
import { WarrantySuccess } from './warranty-success';
import type { WarrantyRecord } from '@/lib/portal-api-client';

type FlowStep = 'auth' | 'register' | 'success';

const STEP_INDEX: Record<FlowStep, number> = { auth: 0, register: 1, success: 2 };

interface ScreenWarrantyProps {
  commodityId?: string;
}

export function ScreenWarranty({ commodityId }: ScreenWarrantyProps) {
  const [step, setStep] = useState<FlowStep>('auth');
  const [warranty, setWarranty] = useState<WarrantyRecord | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) setStep('register');
    setHydrated(true);
  }, []);

  const activeIdx = STEP_INDEX[step];

  const stepLabels = useMemo(() => [
    { num: 1, label: 'Verify identity' },
    { num: 2, label: 'Enter product details' },
    { num: 3, label: 'Instant activation' },
  ], []);

  if (!hydrated) {
    return (
      <div style={{ maxWidth: '560px', margin: '80px auto', padding: '0 24px', textAlign: 'center', color: 'var(--portal-text-tertiary)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div>
      <div style={{ maxWidth: '560px', margin: '80px auto', padding: '0 24px' }}>
        <Link
          href="/"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--portal-text-tertiary)', cursor: 'pointer', marginBottom: '32px', textDecoration: 'none' }}
        >
          ← Back to Home
        </Link>

        <div style={{ fontSize: '48px', marginBottom: '24px' }}>🛡️</div>
        <h1 style={{ fontFamily: 'var(--portal-font-heading)', fontSize: '36px', fontWeight: 300, marginBottom: '8px' }}>
          Register Your Warranty
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--portal-text-tertiary)', lineHeight: 1.8, marginBottom: '40px' }}>
          Activate your warranty to unlock full support, faster replacements, and exclusive product updates.
        </p>

        <div className="portal-warranty-steps" style={{ marginBottom: '40px' }}>
          {stepLabels.map((s, i) => {
            const isActive = i === activeIdx;
            const isCompleted = i < activeIdx;
            return (
              <div key={s.num} className="portal-warranty-step" style={{ opacity: isActive || isCompleted ? 1 : 0.5 }}>
                <div
                  className="portal-warranty-step-num"
                  style={{
                    background: isActive ? 'var(--portal-accent)' : isCompleted ? 'var(--portal-success)' : undefined,
                    color: (isActive || isCompleted) ? 'var(--portal-bg, #fff)' : undefined,
                  }}
                >
                  {isCompleted ? '✓' : s.num}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--portal-text-tertiary)', lineHeight: 1.4 }}>{s.label}</div>
              </div>
            );
          })}
        </div>

        {step === 'auth' && (
          <EmailVerify onVerified={() => setStep('register')} />
        )}

        {step === 'register' && (
          <WarrantyForm
            commodityId={commodityId}
            onSuccess={(w) => {
              setWarranty(w);
              setStep('success');
            }}
          />
        )}

        {step === 'success' && warranty && (
          <WarrantySuccess warranty={warranty} />
        )}
      </div>
    </div>
  );
}
