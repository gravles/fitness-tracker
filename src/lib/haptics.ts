/**
 * Haptic Feedback Utility
 * Provides tactile feedback on mobile devices that support the Vibration API
 */

type HapticPattern = 'tap' | 'success' | 'error' | 'warning' | 'heavy';

const patterns: Record<HapticPattern, number | number[]> = {
    tap: 10,           // Subtle tap for button presses
    success: 50,       // Single pulse for achievements
    error: [50, 50, 50], // Triple short pulse for errors
    warning: [30, 30], // Double pulse for warnings
    heavy: 100,        // Strong feedback for important actions
};

/**
 * Check if haptic feedback is supported
 */
export function isHapticSupported(): boolean {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Trigger a haptic pattern
 */
export function haptic(pattern: HapticPattern = 'tap'): void {
    if (!isHapticSupported()) return;

    try {
        navigator.vibrate(patterns[pattern]);
    } catch (e) {
        // Silently fail - haptics are optional
    }
}

/**
 * Convenience functions for common interactions
 */
export const haptics = {
    /** Subtle tap for button presses */
    tap: () => haptic('tap'),

    /** Celebratory pulse for achievements, level ups, PRs */
    success: () => haptic('success'),

    /** Error feedback */
    error: () => haptic('error'),

    /** Warning/alert feedback */
    warning: () => haptic('warning'),

    /** Heavy impact for important actions like saving */
    heavy: () => haptic('heavy'),
};

export default haptics;
