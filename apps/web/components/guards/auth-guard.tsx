'use client';

import { useAuth } from '../auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

const PUBLIC_PATHS = ['/login'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublic) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, isPublic, router]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated && !isPublic) return null;

  return <>{children}</>;
}
