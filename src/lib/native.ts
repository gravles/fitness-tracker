/**
 * native.ts
 * Platform detection for Capacitor native apps.
 * Safe to import anywhere — falls back gracefully on web / SSR.
 */

export type Platform = 'ios' | 'android' | 'web';

function cap(): any {
    return typeof window !== 'undefined' ? (window as any).Capacitor : undefined;
}

/**
 * True when running inside a Capacitor iOS or Android shell.
 * Always false in a regular web browser or during SSR.
 */
export function isNative(): boolean {
    return cap()?.isNativePlatform?.() === true;
}

/** Returns 'ios' | 'android' | 'web' */
export function getPlatform(): Platform {
    return (cap()?.getPlatform?.() as Platform) ?? 'web';
}

export const isIos     = (): boolean => getPlatform() === 'ios';
export const isAndroid = (): boolean => getPlatform() === 'android';
