'use client';

import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { useBrand } from '@/lib/brand-context';
import { sendOTP, verifyOTP, PortalClientError } from '@/lib/portal-api-client';
import { setAuth } from '@/lib/auth';

interface EmailVerifyProps {
  onVerified: () => void;
}

type Step = 'email' | 'code';

const OTP_INPUT_STYLE: React.CSSProperties = {
  width: '48px',
  height: '56px',
  textAlign: 'center',
  fontSize: '24px',
  fontFamily: 'var(--portal-font-mono)',
  fontWeight: 600,
  border: '1px solid var(--portal-border)',
  borderRadius: 'var(--portal-radius-md)',
  background: 'var(--portal-bg)',
  color: 'var(--portal-text-primary)',
  outline: 'none',
};

export function EmailVerify({ onVerified }: EmailVerifyProps) {
  const { brandId } = useBrand();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const focusFirstInput = useCallback(() => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, []);

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !brandId) return;
    setError('');
    setLoading(true);
    try {
      await sendOTP(email.trim(), brandId);
      setStep('code');
      setCooldown(60);
      focusFirstInput();
    } catch (err) {
      if (err instanceof PortalClientError) {
        setError(err.message);
      } else {
        setError('Failed to send verification code');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleCodeInput(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...code];
    next[index] = value.slice(-1);
    setCode(next);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleCodeKeyDown(index: number, key: string) {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleCodePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setCode(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      const result = await verifyOTP(email.trim(), brandId, fullCode);
      setAuth(result.token, result.consumer);
      onVerified();
    } catch (err) {
      if (err instanceof PortalClientError) {
        setError(err.message);
      } else {
        setError('Verification failed');
      }
      setCode(['', '', '', '', '', '']);
      focusFirstInput();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || !brandId) return;
    setError('');
    setLoading(true);
    try {
      await sendOTP(email.trim(), brandId);
      setCooldown(60);
      setCode(['', '', '', '', '', '']);
    } catch (err) {
      if (err instanceof PortalClientError) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (step === 'email') {
    return (
      <form onSubmit={handleSendCode}>
        <div style={{ marginBottom: '20px' }}>
          <label className="portal-form-label">Email Address</label>
          <input
            className="portal-form-input"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <div style={{ fontSize: '11px', color: 'var(--portal-text-tertiary)', marginTop: '6px' }}>
            We&apos;ll send a 6-digit verification code to your email
          </div>
        </div>
        {error && (
          <div style={{ fontSize: '12px', color: 'var(--portal-danger)', marginBottom: '16px' }}>{error}</div>
        )}
        <button
          type="submit"
          className="portal-btn-primary"
          style={{ width: '100%' }}
          disabled={loading || !email.trim()}
        >
          <span>{loading ? 'Sending...' : 'Send Verification Code'}</span>
          <span>→</span>
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyCode}>
      <div style={{ marginBottom: '20px' }}>
        <label className="portal-form-label">Verification Code</label>
        <div style={{ fontSize: '12px', color: 'var(--portal-text-tertiary)', marginBottom: '16px' }}>
          Enter the 6-digit code sent to <strong>{email}</strong>
        </div>
        <div
          style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}
          onPaste={handleCodePaste}
        >
          {code.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleCodeInput(i, e.target.value)}
              onKeyDown={(e) => handleCodeKeyDown(i, e.key)}
              style={OTP_INPUT_STYLE}
            />
          ))}
        </div>
      </div>
      {error && (
        <div style={{ fontSize: '12px', color: 'var(--portal-danger)', marginBottom: '16px', textAlign: 'center' }}>{error}</div>
      )}
      <button
        type="submit"
        className="portal-btn-primary"
        style={{ width: '100%', marginBottom: '12px' }}
        disabled={loading || code.join('').length !== 6}
      >
        <span>{loading ? 'Verifying...' : 'Verify & Continue'}</span>
        <span>→</span>
      </button>
      <div style={{ textAlign: 'center' }}>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || loading}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '12px',
            color: cooldown > 0 ? 'var(--portal-text-tertiary)' : 'var(--portal-accent)',
            cursor: cooldown > 0 ? 'default' : 'pointer',
            fontFamily: 'var(--portal-font-mono)',
          }}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
        </button>
        <span style={{ margin: '0 8px', color: 'var(--portal-text-tertiary)' }}>·</span>
        <button
          type="button"
          onClick={() => { setStep('email'); setCode(['', '', '', '', '', '']); setError(''); }}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '12px',
            color: 'var(--portal-text-tertiary)',
            cursor: 'pointer',
            fontFamily: 'var(--portal-font-mono)',
          }}
        >
          Change Email
        </button>
      </div>
    </form>
  );
}
