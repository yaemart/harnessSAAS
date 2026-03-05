'use client';

import { useAuth, type UserRole } from '../auth-context';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

function AccessDenied() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '16px',
    }}>
      <h1 style={{ fontSize: '48px', fontWeight: 700, color: 'var(--danger, #F87171)' }}>403</h1>
      <p style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>
        Access Denied — you do not have permission to view this page.
      </p>
    </div>
  );
}

export function RoleGuard({ allowedRoles, fallback, children }: RoleGuardProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return null;
  if (!allowedRoles.includes(user.role)) return <>{fallback ?? <AccessDenied />}</>;

  return <>{children}</>;
}
