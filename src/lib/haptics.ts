/**
 * Haptic Feedback Utility
 *
 * On native (iOS / Android) uses @capacitor/haptics for real motor feedback:
 *   - Impact styles:       Light, Medium, Heavy
 *   - Notification types:  Success, Warning, Error
 *
 * On web falls back to the Vibration API (works in Chrome on Android,
 * silently ignored everywhere else).
 */

import { isNative } from './native';

type HapticPattern = 'tap' | 'success' | 'error' | 'warning' | 'heavy';

// Web fallback patterns (milliseconds)
const webPatterns: Record<HapticPattern, number | number[]> = {
    tap:     10,
    success: 50,
    error:   [50, 50, 50],
    warning: [30, 30],
    heavy:   100,
};

async function nativeHaptic(pattern: HapticPattern): Promise<void> {
    try {
        const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
        switch (pattern) {
            case 'tap':     await Haptics.impact({ style: ImpactStyle.Light });             break;
            case 'success': await Haptics.notification({ type: NotificationType.Success }); break;
            case 'error':   await Haptics.notification({ type: NotificationType.Error });   break;
            case 'warning': await Haptics.notification({ type: NotificationType.Warning }); break;
            case 'heavy':   await Haptics.impact({ style: ImpactStyle.Heavy });             break;
        }
    } catch {
        // Silently fail — haptics are optional
    }
}

function webHaptic(pattern: HapticPattern): void {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
    try { navigator.vibrate(webPatterns[pattern]); } catch { /* ignore */ }
}

export function isHapticSupported(): boolean {
    return isNative() || (typeof navigator !== 'undefined' && 'vibrate' in navigator);
}

/**
 * Trigger a haptic pattern. Fire-and-forget — safe to call from synchronous event handlers.
 */
export function haptic(pattern: HapticPattern = 'tap'): void {
    if (isNative()) {
        nativeHaptic(pattern); // intentionally not awaited
    } else {
        webHaptic(pattern);
    }
}

export const haptics = {
    /** Subtle tap for button presses */
    tap:     () => haptic('tap'),
    /** Celebratory pulse for achievements, level-ups, PRs */
    success: () => haptic('success'),
    /** Error feedback */
    error:   () => haptic('error'),
    /** Warning / alert */
    warning: () => haptic('warning'),
    /** Strong impact for important actions like saving */
    heavy:   () => haptic('heavy'),
};

export default haptics;
