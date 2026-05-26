'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'car-mode';

/**
 * Detects whether the app is running on an Android Automotive head unit
 * (or similar in-vehicle screen) and provides a manual toggle.
 *
 * Auto-detection heuristic:
 *   - Android user agent
 *   - Landscape orientation (width > height)
 *   - Screen wider than a typical phone (≥ 600 px)
 *
 * The user can also override the auto-detection via the toggle, which is
 * persisted in localStorage.
 */
export function useCarMode() {
    const [carMode, setCarMode] = useState(false);
    const [autoDetected, setAutoDetected] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved !== null) {
            setCarMode(saved === 'true');
            return;
        }

        // Auto-detect: Android + landscape + wide screen
        const isAndroid  = /android/i.test(navigator.userAgent);
        const isLandscape = window.innerWidth > window.innerHeight;
        const isWide      = window.innerWidth >= 600;
        if (isAndroid && isLandscape && isWide) {
            setCarMode(true);
            setAutoDetected(true);
        }
    }, []);

    function toggle() {
        setCarMode(prev => {
            const next = !prev;
            localStorage.setItem(STORAGE_KEY, String(next));
            return next;
        });
    }

    function enable()  { setCarMode(true);  localStorage.setItem(STORAGE_KEY, 'true'); }
    function disable() { setCarMode(false); localStorage.setItem(STORAGE_KEY, 'false'); }

    return { carMode, autoDetected, toggle, enable, disable };
}
