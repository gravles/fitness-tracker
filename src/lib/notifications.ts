/**
 * Push Notification Utilities
 * Handles requesting permission, subscribing to push, and managing notifications
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
    return (
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    );
}

/**
 * Get current notification permission status
 */
export function getPermissionStatus(): NotificationPermission | 'unsupported' {
    if (!isPushSupported()) return 'unsupported';
    return Notification.permission;
}

/**
 * Request notification permission
 */
export async function requestPermission(): Promise<NotificationPermission> {
    if (!isPushSupported()) {
        throw new Error('Push notifications are not supported');
    }

    return await Notification.requestPermission();
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
    if (!isPushSupported()) return null;

    const permission = await requestPermission();
    if (permission !== 'granted') {
        console.log('Notification permission denied');
        return null;
    }

    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription && VAPID_PUBLIC_KEY) {
        // Create new subscription
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: VAPID_PUBLIC_KEY,
        });
    }

    if (subscription) {
        // Save subscription to backend
        await saveSubscription(subscription);
    }

    return subscription;
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
    if (!isPushSupported()) return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
        await subscription.unsubscribe();
        await deleteSubscription();
        return true;
    }

    return false;
}

/**
 * Send a local notification (for testing or offline use)
 */
export async function sendLocalNotification(
    title: string,
    options?: NotificationOptions
): Promise<void> {
    if (getPermissionStatus() !== 'granted') return;

    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        ...options,
    });
}

/**
 * Schedule a daily reminder notification
 */
export function scheduleReminder(time: { hour: number; minute: number }): void {
    // Store reminder preference
    localStorage.setItem('notification_reminder', JSON.stringify(time));

    // In a real app, you'd schedule this on the backend
    // For now, we'll check on app open
    console.log(`Reminder scheduled for ${time.hour}:${time.minute.toString().padStart(2, '0')}`);
}

/**
 * Check if reminder should be sent (call this on app open)
 */
export async function checkReminder(): Promise<void> {
    const reminderStr = localStorage.getItem('notification_reminder');
    if (!reminderStr) return;

    const lastNotified = localStorage.getItem('last_reminder_date');
    const today = new Date().toDateString();

    if (lastNotified === today) return; // Already notified today

    const reminder = JSON.parse(reminderStr);
    const now = new Date();

    if (now.getHours() >= reminder.hour) {
        // It's past reminder time - check if they've logged today
        // This would normally check the backend
        const hasLoggedToday = localStorage.getItem('logged_today') === today;

        if (!hasLoggedToday) {
            await sendLocalNotification("Don't forget to log today! 📝", {
                body: 'Keep your streak going - log your activity now.',
                tag: 'daily-reminder',
                data: { url: '/log' },
            });
            localStorage.setItem('last_reminder_date', today);
        }
    }
}

/**
 * Send streak warning notification
 */
export async function sendStreakWarning(streakDays: number): Promise<void> {
    await sendLocalNotification(`Protect your ${streakDays}-day streak! 🔥`, {
        body: 'Log now to keep your streak alive.',
        tag: 'streak-warning',
        data: { url: '/log' },
    });
}

// Helper functions

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function saveSubscription(subscription: PushSubscription): Promise<void> {
    try {
        await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription.toJSON()),
        });
    } catch (error) {
        console.error('Failed to save push subscription', error);
    }
}

async function deleteSubscription(): Promise<void> {
    try {
        await fetch('/api/notifications/subscribe', {
            method: 'DELETE',
        });
    } catch (error) {
        console.error('Failed to delete push subscription', error);
    }
}
