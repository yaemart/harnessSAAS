import './globals.css';
import type { ReactNode } from 'react';
import { SidebarNav } from '../components/sidebar-nav';
import { TenantProvider } from '../components/tenant-context';
import { AppThemeProvider } from '../components/theme-context';
import { AuthProvider } from '../components/auth-context';
import { AuthGuard } from '../components/guards/auth-guard';

export const metadata = {
  title: 'AI OS Console',
  description: 'Enterprise AI Operating System for E-Commerce',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme')||'dark';document.documentElement.className=t;document.documentElement.style.colorScheme=t==='dark'?'dark':'light'})()` }} />
      </head>
      <body suppressHydrationWarning>
        <AppThemeProvider>
          <AuthProvider>
            <AuthGuard>
              <TenantProvider>
                <div className="app-container">
                  <SidebarNav />
                  <div className="main-content">
                    {children}
                  </div>
                </div>
              </TenantProvider>
            </AuthGuard>
          </AuthProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
