/**
 * native.ts
 * Platform detection for Capacitor native apps.
 * Safe to import anywhere — falls back gracefully on web / SSR.
 */

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export type Platform = 'ios' | 'android' | 'web';

/**
 * True when running inside a Capacitor iOS or Android shell.
 * Always false in a regular web browser or during SSR.
 *
 * NOTE: do NOT call this during the initial React render — the Capacitor
 * bridge is injected asynchronously and may not be ready yet.
 * Use the `useIsNative()` hook in components instead.
 */
export function isNative(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return Capacitor.isNativePlatform();
    } catch {
        return false;
    }
}

/** Returns 'ios' | 'android' | 'web' */
export function getPlatform(): Platform {
    if (typeof window === 'undefined') return 'web';
    try {
        return Capacitor.getPlatform() as Platform;
    } catch {
        return 'web';
    }
}

export const isIos     = (): boolean => getPlatform() === 'ios';
export const isAndroid = (): boolean => getPlatform() === 'android';

/**
 * React hook for platform detection in components.
 * Re-evaluates after mount so the Capacitor bridge has time to initialise.
 * Use this instead of calling isNative() directly in component code.
 */
export function useIsNative(): boolean {
    const [native, setNative] = useState(false);
    useEffect(() => {
        setNative(isNative());
    }, []);
    return native;
}
