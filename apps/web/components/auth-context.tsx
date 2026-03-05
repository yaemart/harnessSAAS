'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3300';

export type UserRole = 'system_admin' | 'tenant_admin' | 'operator' | 'supplier' | 'viewer';

export interface UserScope {
  scopeType: 'brand' | 'category' | 'platform' | 'market';
  scopeValue: string;
}

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: UserRole;
  name: string;
  email: string;
  scopes: UserScope[];
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
  hasRole: (...roles: UserRole[]) => boolean;
  hasScope: (type: UserScope['scopeType'], value: string) => boolean;
  authHeaders: Record<string, string>;
  accessToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scheduleRefresh = useCallback((tokenExpiresInMs: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const refreshAt = Math.max(tokenExpiresInMs - 60_000, 5_000);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setAccessToken(data.accessToken);
          scheduleRefresh(14 * 60 * 1000);
        } else {
          setAccessToken(null);
          setUserState(null);
          localStorage.removeItem('ai_os_auth_user');
        }
      } catch {
        setAccessToken(null);
        setUserState(null);
        localStorage.removeItem('ai_os_auth_user');
      }
    }, refreshAt);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setAccessToken(data.accessToken);
          scheduleRefresh(14 * 60 * 1000);

          const meRes = await fetch(`${API_BASE}/auth/me`, {
            headers: { authorization: `Bearer ${data.accessToken}` },
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            setUserState({
              userId: meData.id,
              tenantId: meData.tenantId,
              role: meData.role,
              name: meData.name,
              email: meData.email,
              scopes: (meData.scopes as string[]).map((s: string) => {
                const [scopeType, ...rest] = s.split(':');
                return { scopeType: scopeType as UserScope['scopeType'], scopeValue: rest.join(':') };
              }),
            });
          }
        } else {
          setAccessToken(null);
          setUserState(null);
          localStorage.removeItem('ai_os_auth_user');
        }
      } catch {
        setAccessToken(null);
        setUserState(null);
        localStorage.removeItem('ai_os_auth_user');
      } finally {
        setIsLoading(false);
      }
    };
    init();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleRefresh]);

  useEffect(() => {
    // Prevent stale in-memory "logged-in" state without a bearer token.
    if (!isLoading && user && !accessToken) {
      setUserState(null);
      localStorage.removeItem('ai_os_auth_user');
    }
  }, [isLoading, user, accessToken]);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Login failed');
    }

    const data = await res.json();
    setAccessToken(data.accessToken);
    setUserState(data.user);
    localStorage.setItem('ai_os_auth_user', JSON.stringify(data.user));
    scheduleRefresh(14 * 60 * 1000);
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
      });
    } catch { /* ignore */ }
    setAccessToken(null);
    setUserState(null);
    localStorage.removeItem('ai_os_auth_user');
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  };

  const setUser = (u: AuthUser) => {
    setUserState(u);
    localStorage.setItem('ai_os_auth_user', JSON.stringify(u));
  };

  const hasRole = (...roles: UserRole[]) => !!user && roles.includes(user.role);

  const hasScope = (type: UserScope['scopeType'], value: string) => {
    if (!user || user.scopes.length === 0) return true;
    return user.scopes.some((s) => s.scopeType === type && s.scopeValue === value);
  };

  const authHeaders: Record<string, string> = useMemo(
    () =>
      accessToken && user
        ? { authorization: `Bearer ${accessToken}`, 'x-tenant-id': user.tenantId }
        : ({} as Record<string, string>),
    [accessToken, user?.tenantId]
  );

  return (
    <AuthContext.Provider
      value={{
        user: isLoading ? null : user,
        isAuthenticated: !!accessToken,
        isLoading,
        login,
        logout,
        setUser,
        hasRole,
        hasScope,
        authHeaders,
        accessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
