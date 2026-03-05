'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/auth-context';

const DEMO_USERS = [
  { email: 'admin@system.io',      role: 'system_admin',  label: 'System Admin',  tenant: 'Global Tech Corp', icon: '🛡' },
  { email: 'boss@globaltech.com',  role: 'tenant_admin',  label: 'Tenant Admin',  tenant: 'Global Tech Corp', icon: '👔' },
  { email: 'ops@globaltech.com',   role: 'operator',      label: 'Operator',      tenant: 'Global Tech Corp', icon: '⚙' },
  { email: 'factory@supplier.cn',  role: 'supplier',      label: 'Supplier',      tenant: 'Global Tech Corp', icon: '🏭' },
  { email: 'investor@vc.com',      role: 'viewer',        label: 'Viewer',        tenant: 'Global Tech Corp', icon: '📊' },
] as const;

const DEMO_PASSWORD = 'harness123';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [loggingInAs, setLoggingInAs] = useState<string | null>(null);
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setError('');
    setLoggingInAs(demoEmail);
    try {
      await login(demoEmail, DEMO_PASSWORD);
      router.push('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoggingInAs(null);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-color)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        padding: 32,
        background: 'var(--panel-bg)',
        borderRadius: 'var(--border-radius-lg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--panel-shadow)',
        position: 'relative',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}>
            AI OS Enterprise
          </h1>
          <p style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            marginTop: 8,
          }}>
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginBottom: 6,
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--border-radius-sm)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginBottom: 6,
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--border-radius-sm)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 12px',
              borderRadius: 'var(--border-radius-sm)',
              background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
              color: 'var(--danger)',
              fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 16px',
              borderRadius: 'var(--border-radius-sm)',
              background: loading ? 'var(--text-tertiary)' : 'var(--accent)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Quick Login */}
        <div style={{ marginTop: 24, position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            disabled={!!loggingInAs}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: 'var(--border-radius-sm)',
              background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
              border: '1px dashed color-mix(in srgb, var(--accent) 40%, transparent)',
              color: 'var(--accent)',
              fontSize: 13,
              fontWeight: 600,
              cursor: loggingInAs ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 16 }}>⚡</span>
            {loggingInAs ? 'Logging in...' : 'Quick Demo Login'}
            <span style={{
              display: 'inline-block',
              transform: showPicker ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              fontSize: 10,
            }}>▼</span>
          </button>

          {showPicker && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              marginBottom: 8,
              background: 'var(--panel-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius-md)',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
              overflow: 'hidden',
              zIndex: 50,
              animation: 'slideUp 0.15s ease-out',
            }}>
              <div style={{
                padding: '10px 14px 6px',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                Select Demo Account
              </div>

              {DEMO_USERS.map((user) => (
                <button
                  key={user.email}
                  type="button"
                  onClick={() => {
                    setShowPicker(false);
                    handleDemoLogin(user.email);
                  }}
                  disabled={!!loggingInAs}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: loggingInAs === user.email
                      ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                      : 'transparent',
                    border: 'none',
                    borderTop: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)',
                    cursor: loggingInAs ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    textAlign: 'left',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!loggingInAs) e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 8%, transparent)';
                  }}
                  onMouseLeave={(e) => {
                    if (loggingInAs !== user.email) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 }}>
                    {user.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      lineHeight: 1.3,
                    }}>
                      {user.label}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: 'var(--text-tertiary)',
                      lineHeight: 1.3,
                    }}>
                      {user.email}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 'var(--border-radius-sm)',
                    background: 'color-mix(in srgb, var(--text-tertiary) 12%, transparent)',
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>
                    {user.role.replaceAll('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* System Status */}
        <div style={{
          marginTop: 16,
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--text-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--success)',
            display: 'inline-block',
          }} />
          System Online
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
