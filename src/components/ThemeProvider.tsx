'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';

interface ThemeContextValue {
    theme: Theme;
    setTheme: (t: Theme) => void;
    resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'system',
    setTheme: () => {},
    resolvedTheme: 'light',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('system');
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

    // Read from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('theme') as Theme | null;
        if (stored === 'dark' || stored === 'light' || stored === 'system') {
            setThemeState(stored);
        }
    }, []);

    // Always stamp a resolved class on <html> — the CSS dark tokens live only
    // under html.dark (no @media fallback), so "system" must apply a class too.
    function applyResolved(resolved: 'light' | 'dark') {
        const html = document.documentElement;
        html.classList.remove('dark', 'light');
        html.classList.add(resolved);
        setResolvedTheme(resolved);
    }

    // Apply class to <html> whenever theme changes
    useEffect(() => {
        if (theme === 'dark' || theme === 'light') {
            applyResolved(theme);
        } else {
            // system: follow OS
            const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            applyResolved(dark ? 'dark' : 'light');
        }
    }, [theme]);

    // Track OS preference changes while on "system"
    useEffect(() => {
        if (theme !== 'system') return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => applyResolved(e.matches ? 'dark' : 'light');
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [theme]);

    function setTheme(t: Theme) {
        setThemeState(t);
        localStorage.setItem('theme', t);
    }

    return (
        <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
