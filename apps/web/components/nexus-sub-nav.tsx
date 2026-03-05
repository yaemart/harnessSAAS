'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox, BarChart3, Bot, Shield, Database, Zap } from 'lucide-react';

interface SubNavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: string;
}

const NAV_ITEMS: SubNavItem[] = [
  { label: 'Unified Inbox', path: '/support', icon: <Inbox size={16} /> },
  { label: 'Intelligence', path: '/intelligence', icon: <BarChart3 size={16} /> },
  { label: 'Agent Activity', path: '/support/agent-activity', icon: <Bot size={16} />, badge: 'Soon' },
  { label: 'Warranties', path: '/support/warranties', icon: <Shield size={16} />, badge: 'Soon' },
  { label: 'Knowledge', path: '/support/knowledge', icon: <Database size={16} />, badge: 'Soon' },
];

export function NexusSubNav() {
  const pathname = usePathname();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2,
      padding: '4px 6px',
      background: 'color-mix(in srgb, var(--panel-bg) 80%, transparent)',
      borderRadius: 'var(--border-radius-lg)',
      border: '1px solid var(--panel-border)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 12px 0 8px',
        borderRight: '1px solid var(--panel-border)',
        marginRight: 6,
      }}>
        <Zap size={14} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.02em' }}>
          Nexus
        </span>
      </div>
      {NAV_ITEMS.map(item => {
        const isActive = pathname === item.path;
        const isDisabled = !!item.badge;

        if (isDisabled) {
          return (
            <span
              key={item.path}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 10px', borderRadius: 'var(--border-radius-md)',
                fontSize: 12, fontWeight: 500, textDecoration: 'none',
                color: 'var(--text-tertiary)', cursor: 'default',
              }}
            >
              {item.icon}
              <span className="sidebar-nav-label">{item.label}</span>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 5px',
                borderRadius: '999px', background: 'color-mix(in srgb, var(--text-tertiary) 12%, transparent)',
                color: 'var(--text-tertiary)',
              }}>
                {item.badge}
              </span>
            </span>
          );
        }

        return (
          <Link
            key={item.path}
            href={item.path}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 10px', borderRadius: 'var(--border-radius-md)',
              fontSize: 12, fontWeight: isActive ? 700 : 500, textDecoration: 'none',
              background: isActive ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ color: isActive ? 'var(--accent)' : 'var(--text-tertiary)' }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
