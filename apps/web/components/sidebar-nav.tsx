'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Palette,
    UserCog,
    BarChart3,
    Package,
    Layers,
    Server,
    Truck,
    Cpu,
    Library,
    Inbox,
    Grid3X3,
    Megaphone,
    Users,
    Link2,
    DollarSign,
    Globe,
    Shield,
    Database,
    Zap,
    GitPullRequestArrow,
    TrendingUp,
    ShieldCheck,
    BrainCircuit,
} from 'lucide-react';
import { useTenant } from './tenant-context';
import { useAuth, type UserRole } from './auth-context';

interface NavItem {
    name: string;
    path: string;
    icon: React.ReactNode;
    roles: readonly UserRole[];
    group?: string;
}

export function SidebarNav() {
    const pathname = usePathname();
    const { currentTenantId, tenants, switchTenant } = useTenant();
    const { hasRole, user, logout } = useAuth();

    const NAV_ITEMS: NavItem[] = [
        // ─── System Admin: Platform-level (no tenant business data) ───
        { name: 'Platform Ops', path: '/ops', icon: <Server size={20} />, roles: ['system_admin'], group: 'Platform' },
        { name: 'Knowledge Console', path: '/knowledge', icon: <Library size={20} />, roles: ['system_admin'], group: 'Platform' },
        { name: 'Harness Monitor', path: '/harness', icon: <Cpu size={20} />, roles: ['system_admin'], group: 'Platform' },
        { name: 'Exchange Rates', path: '/exchange-rates', icon: <TrendingUp size={20} />, roles: ['system_admin'], group: 'Platform' },
        { name: 'Market Compliance', path: '/markets', icon: <ShieldCheck size={20} />, roles: ['system_admin'], group: 'Platform' },
        { name: 'User Management', path: '/team', icon: <Users size={20} />, roles: ['system_admin'], group: 'Platform' },
        { name: 'Global Registry', path: '/registry', icon: <Database size={20} />, roles: ['system_admin'], group: 'Platform' },
        { name: 'AI Platform Config', path: '/platform-ai', icon: <BrainCircuit size={20} />, roles: ['system_admin'], group: 'Platform' },

        // ─── Tenant Admin: Company-level ───
        { name: 'Business Overview', path: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['tenant_admin'], group: 'Business' },
        { name: 'Agent Authority', path: '/agent-auth', icon: <UserCog size={20} />, roles: ['tenant_admin'], group: 'Business' },
        { name: 'Cost Profiles', path: '/cost-profiles', icon: <DollarSign size={20} />, roles: ['tenant_admin'], group: 'Business' },
        { name: 'AI Engine', path: '/ai-engine', icon: <BrainCircuit size={20} />, roles: ['tenant_admin'], group: 'Business' },
        { name: 'Integrations', path: '/settings', icon: <Link2 size={20} />, roles: ['tenant_admin'], group: 'Business' },
        { name: 'My Team', path: '/team', icon: <Users size={20} />, roles: ['tenant_admin'], group: 'Business' },

        // ─── Operator: Daily operations ───
        { name: 'Inbox', path: '/', icon: <Inbox size={20} />, roles: ['operator'], group: 'Operations' },
        { name: 'Products', path: '/products', icon: <Package size={20} />, roles: ['tenant_admin', 'operator'], group: 'Operations' },
        { name: 'Assets', path: '/assets', icon: <Layers size={20} />, roles: ['tenant_admin', 'operator'], group: 'Operations' },
        { name: 'Mapping Review', path: '/mapping-review', icon: <GitPullRequestArrow size={20} />, roles: ['tenant_admin', 'operator'], group: 'Operations' },
        { name: 'Platform Matrix', path: '/platforms', icon: <Grid3X3 size={20} />, roles: ['tenant_admin', 'operator'], group: 'Operations' },
        { name: 'Ads', path: '/ads', icon: <Megaphone size={20} />, roles: ['tenant_admin', 'operator'], group: 'Operations' },
        { name: 'Nexus', path: '/support', icon: <Zap size={20} />, roles: ['tenant_admin', 'operator'], group: 'Operations' },
        { name: 'Portal Config', path: '/portal-config', icon: <Globe size={20} />, roles: ['tenant_admin'], group: 'Operations' },
        { name: 'Governance', path: '/governance', icon: <Shield size={20} />, roles: ['tenant_admin'], group: 'Operations' },
        { name: 'Exchange Rates', path: '/exchange-rates', icon: <TrendingUp size={20} />, roles: ['tenant_admin', 'operator', 'viewer'], group: 'Operations' },

        // ─── Supplier ───
        { name: 'Supplier Portal', path: '/purchase', icon: <Truck size={20} />, roles: ['supplier'], group: 'Supplier' },

        // ─── Viewer ───
        { name: 'Executive Report', path: '/dashboard', icon: <BarChart3 size={20} />, roles: ['viewer'], group: 'Reports' },

        // ─── Shared settings ───
        { name: 'Appearance', path: '/appearance', icon: <Palette size={20} />, roles: ['system_admin', 'tenant_admin', 'operator'], group: 'Settings' },
    ];

    const visibleItems = NAV_ITEMS.filter((item) => hasRole(...item.roles));

    if (!user) return null;

    let lastGroup = '';

    return (
        <nav className="sidebar">
            {/* Desktop header */}
            <div className="sidebar-desktop-only" style={{ padding: '16px 12px', marginBottom: '24px' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                    AI OS Enterprise
                </h2>
                <div style={{ marginTop: 12 }}>
                    {hasRole('system_admin') ? (
                        <div style={{
                            width: '100%', padding: '8px',
                            borderRadius: 'var(--border-radius-sm)',
                            background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                            border: '1px solid var(--sidebar-border)',
                            color: 'var(--accent)', fontSize: '13px', fontWeight: 600, textAlign: 'center',
                        }}>
                            Platform View
                        </div>
                    ) : hasRole('supplier') ? (
                        <div style={{
                            width: '100%', padding: '8px',
                            borderRadius: 'var(--border-radius-sm)',
                            background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
                            border: '1px solid var(--sidebar-border)',
                            color: 'var(--warning)', fontSize: '13px', fontWeight: 600, textAlign: 'center',
                        }}>
                            Supplier View
                        </div>
                    ) : (
                        <select
                            value={currentTenantId}
                            onChange={(e) => switchTenant(e.target.value)}
                            style={{
                                width: '100%', padding: '8px',
                                borderRadius: 'var(--border-radius-sm)',
                                background: 'var(--panel-bg)',
                                border: '1px solid var(--sidebar-border)',
                                color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                            }}
                        >
                            {tenants.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Nav items */}
            <div className="sidebar-nav-items" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {visibleItems.map((item) => {
                    const isActive = pathname === item.path
                        || (item.path !== '/' && pathname.startsWith(item.path))
                        || (item.name === 'Nexus' && pathname.startsWith('/intelligence'));

                    const showGroupLabel = item.group && item.group !== lastGroup;
                    if (item.group) lastGroup = item.group;

                    return (
                        <div key={item.path + item.name}>
                            {showGroupLabel && (
                                <div className="sidebar-desktop-only" style={{
                                    fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
                                    textTransform: 'uppercase', letterSpacing: '0.08em',
                                    padding: '12px 14px 4px', marginTop: 4,
                                }}>
                                    {item.group}
                                </div>
                            )}
                            <Link
                                href={item.path}
                                className="sidebar-nav-link"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '10px 14px',
                                    borderRadius: 'var(--border-radius-sm)',
                                    background: isActive ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                                    color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                                    fontWeight: isActive ? 600 : 500,
                                    textDecoration: 'none',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                <div style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}>
                                    {item.icon}
                                </div>
                                <span className="sidebar-nav-label" style={{ fontSize: 14 }}>{item.name}</span>
                            </Link>
                        </div>
                    );
                })}
            </div>

            {/* Desktop footer */}
            <div className="sidebar-desktop-only">
                {user && (
                    <div style={{
                        padding: '12px',
                        borderTop: '1px solid var(--sidebar-border)',
                        marginBottom: 8,
                    }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {user.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {user.role.replaceAll('_', ' ')}
                        </div>
                        <button
                            onClick={() => { logout(); window.location.href = '/login'; }}
                            style={{
                                marginTop: 8, width: '100%', padding: '6px 10px',
                                borderRadius: 'var(--border-radius-sm)',
                                background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
                                color: 'var(--danger)', fontSize: 12, fontWeight: 500,
                                border: 'none', cursor: 'pointer',
                            }}
                        >
                            Sign Out
                        </button>
                    </div>
                )}

                <div style={{ marginTop: 'auto', padding: '16px 12px' }}>
                    <div style={{
                        background: 'color-mix(in srgb, var(--success) 10%, transparent)',
                        padding: '12px', borderRadius: 'var(--border-radius-md)',
                        display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', flexShrink: 0, boxShadow: '0 0 8px var(--success)' }} />
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>System Online</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>5 Swarms Active</div>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
