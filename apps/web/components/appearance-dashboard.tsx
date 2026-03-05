'use client';

import { useAppTheme } from './theme-context';
import { Sun, Moon, Monitor, CheckCircle2 } from 'lucide-react';
import { useTenant } from './tenant-context';

export function AppearanceDashboard() {
    const { appearance, engine, setAppearance, setEngine } = useAppTheme();
    const { currentTenant } = useTenant();

    return (
        <main>
            <div className="header">
                <div>
                    <h1 className="ios-title">Appearance & Theme</h1>
                    <p className="ios-subtitle">Customize the Anti-Gravity OS interface and global aesthetic engine · {currentTenant?.name}</p>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>

                {/* Section 1: Core Aesthetic */}
                <section>
                    <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Core Aesthetic</h2>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, maxWidth: 900 }}>
                        <button
                            className={`ios-card theme-button ${appearance === 'light' ? 'active' : ''}`}
                            onClick={() => setAppearance('light')}
                            title="Switch to Light Mode aesthetics"
                            style={{ padding: 4, display: 'flex', flexDirection: 'column', textAlign: 'left', border: appearance === 'light' ? '2px solid var(--accent)' : '1px solid var(--sidebar-border)' }}
                        >
                            <div style={{ height: 120, background: '#ffffff', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(0,0,0,0.1)' }} />
                            <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Sun size={18} color={appearance === 'light' ? 'var(--accent)' : 'var(--text-secondary)'} />
                                    <span style={{ fontWeight: appearance === 'light' ? 600 : 500 }}>Light Mode</span>
                                </div>
                                {appearance === 'light' && <CheckCircle2 size={18} color="var(--accent)" />}
                            </div>
                        </button>

                        <button
                            className={`ios-card theme-button ${appearance === 'dark' ? 'active' : ''}`}
                            onClick={() => setAppearance('dark')}
                            title="Switch to Dark Mode aesthetics"
                            style={{ padding: 4, display: 'flex', flexDirection: 'column', textAlign: 'left', border: appearance === 'dark' ? '2px solid var(--accent)' : '1px solid var(--sidebar-border)' }}
                        >
                            <div style={{ height: 120, background: '#09090b', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(255,255,255,0.1)' }} />
                            <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Moon size={18} color={appearance === 'dark' ? 'var(--accent)' : 'var(--text-secondary)'} />
                                    <span style={{ fontWeight: appearance === 'dark' ? 600 : 500 }}>Dark Mode</span>
                                </div>
                                {appearance === 'dark' && <CheckCircle2 size={18} color="var(--accent)" />}
                            </div>
                        </button>

                        <button
                            className={`ios-card theme-button ${appearance === 'system' ? 'active' : ''}`}
                            onClick={() => setAppearance('system')}
                            title="Follow system default theme"
                            style={{ padding: 4, display: 'flex', flexDirection: 'column', textAlign: 'left', border: appearance === 'system' ? '2px solid var(--accent)' : '1px solid var(--sidebar-border)' }}
                        >
                            <div style={{ display: 'flex', height: 120, borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--sidebar-border)', overflow: 'hidden' }}>
                                <div style={{ flex: 1, background: '#ffffff' }} />
                                <div style={{ flex: 1, background: '#09090b' }} />
                            </div>
                            <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Monitor size={18} color={appearance === 'system' ? 'var(--accent)' : 'var(--text-secondary)'} />
                                    <span style={{ fontWeight: appearance === 'system' ? 600 : 500 }}>System Default</span>
                                </div>
                                {appearance === 'system' && <CheckCircle2 size={18} color="var(--accent)" />}
                            </div>
                        </button>
                    </div>
                </section>

                {/* Section 2: Interface Engine */}
                <section>
                    <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Interface Engine</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 600 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Color Theme</label>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Specifies the color theme used in the workbench.</span>
                            <select
                                value={engine}
                                onChange={(e) => setEngine(e.target.value as any)}
                                style={{
                                    padding: '6px 12px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--sidebar-border)',
                                    background: 'var(--panel-bg-secondary)', color: 'var(--text-primary)',
                                    cursor: 'pointer', maxWidth: 300, fontSize: 13
                                }}
                            >
                                <option value="solarized-light">Solarized Light</option>
                                <option value="vsc-dark">VS Code Dark</option>
                                <option value="vsc-light">VS Code Light</option>
                                <option value="monokai">Monokai</option>
                                <option value="antigravity">Antigravity Editor</option>
                                <option value="glass">iOS Glassmorphism</option>
                                <option value="terminal">Terminal Classic</option>
                                <option value="cyberpunk">Cyberpunk / Neon</option>
                                <option value="brutalism">Neo-Brutalism</option>
                            </select>
                        </div>
                    </div>
                </section>

            </div>
        </main>
    );
}
