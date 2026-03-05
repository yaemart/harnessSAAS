'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type AppearanceMode = 'light' | 'dark' | 'system';
export type EngineTheme = 'glass' | 'terminal' | 'cyberpunk' | 'brutalism' | 'antigravity' | 'solarized-light' | 'vsc-dark' | 'vsc-light' | 'monokai';

interface ThemeContextType {
    appearance: AppearanceMode;
    engine: EngineTheme;
    setAppearance: (mode: AppearanceMode) => void;
    setEngine: (theme: EngineTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function AppThemeProvider({ children }: { children: ReactNode }) {
    const [appearance, setAppearance] = useState<AppearanceMode>('dark');
    const [engine, setEngine] = useState<EngineTheme>('glass');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const savedApp = localStorage.getItem('ai_os_appearance') as AppearanceMode;
        const savedEng = localStorage.getItem('ai_os_engine') as EngineTheme;
        if (savedApp) setAppearance(savedApp);
        if (savedEng) setEngine(savedEng);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        localStorage.setItem('ai_os_appearance', appearance);
        localStorage.setItem('ai_os_engine', engine);

        const root = document.documentElement;

        // Evaluate dark mode
        let isDark = false;
        if (appearance === 'dark') {
            isDark = true;
        } else if (appearance === 'system') {
            isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }

        if (isDark) {
            root.classList.add('dark');
            root.style.colorScheme = 'dark';
        } else {
            root.classList.remove('dark');
            root.style.colorScheme = 'light';
        }

        // Handle Engine
        root.classList.remove('theme-glass', 'theme-terminal', 'theme-cyberpunk', 'theme-brutalism', 'theme-antigravity', 'theme-solarized-light', 'theme-vsc-dark', 'theme-vsc-light', 'theme-monokai');
        if (engine !== 'glass') {
            root.classList.add(`theme-${engine}`);
        }

    }, [appearance, engine, mounted]);

    // Before mount, we render nothing or children, but wait avoiding hydration mismatch 
    // For context provider, safe to just render children immediately but avoid dynamic className on server
    return (
        <ThemeContext.Provider value={{ appearance, engine, setAppearance, setEngine }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useAppTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useAppTheme must be used within AppThemeProvider');
    }
    return context;
}
