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
 * @deprecated Use localStorage 'scheduled_reminders' instead
 */
export function scheduleReminder(time: { hour: number; minute: number }): void {
    // Store reminder preference
    localStorage.setItem('notification_reminder', JSON.stringify(time));
    console.log(`Reminder scheduled for ${time.hour}:${time.minute.toString().padStart(2, '0')}`);
}

interface ScheduledReminder {
    id: string;
    time: string; // HH:MM format
    title: string;
    body: string;
    tag: string;
}

/**
 * Check if any reminders should be sent (call this on app open)
 * Supports multiple reminder types with individual schedules
 */
export async function checkReminders(): Promise<void> {
    const remindersJson = localStorage.getItem('scheduled_reminders');
    if (!remindersJson) return;

    const reminders: ScheduledReminder[] = JSON.parse(remindersJson);
    const today = new Date().toDateString();
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    for (const reminder of reminders) {
        const lastNotifiedKey = `last_${reminder.id}_date`;
        const lastNotified = localStorage.getItem(lastNotifiedKey);

        // Skip if already notified today for this reminder
        if (lastNotified === today) continue;

        // Parse scheduled time
        const [hours, minutes] = reminder.time.split(':').map(Number);
        const scheduledTime = hours * 60 + minutes;

        // Check if it's past the scheduled time
        if (currentTime >= scheduledTime) {
            // For log reminder, check if user has logged today
            if (reminder.id === 'log-reminder') {
                const loggedToday = localStorage.getItem('logged_today') === today;
                if (loggedToday) continue; // Already logged, skip
            }

            // For move reminder, could check if movement completed
            // For now, always send if not sent today

            await sendLocalNotification(reminder.title, {
                body: reminder.body,
                tag: reminder.tag,
                data: { url: '/log' },
            });

            localStorage.setItem(lastNotifiedKey, today);
        }
    }
}

/**
 * Legacy check (for backward compatibility)
 */
export async function checkReminder(): Promise<void> {
    // First try new format
    await checkReminders();

    // Fall back to old format
    const reminderStr = localStorage.getItem('notification_reminder');
    if (!reminderStr) return;

    const lastNotified = localStorage.getItem('last_reminder_date');
    const today = new Date().toDateString();

    if (lastNotified === today) return;

    const reminder = JSON.parse(reminderStr);
    const now = new Date();

    if (now.getHours() >= reminder.hour) {
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

/**
 * Check for scheduled workout notifications
 * Sends notification if workout is scheduled within ±15 minutes of current time
 */
export async function checkScheduledWorkouts(): Promise<void> {
    // Dynamic import to avoid circular dependency
    const { getTodaysScheduledWorkouts, updateScheduledWorkout } = await import('./schedule-api');

    try {
        const workouts = await getTodaysScheduledWorkouts();
        if (!workouts || workouts.length === 0) return;

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        for (const workout of workouts) {
            // Skip if already reminded
            if (workout.reminder_sent) continue;

            // Parse scheduled time
            const [hours, minutes] = workout.scheduled_time.split(':').map(Number);
            const scheduledMinutes = hours * 60 + minutes;

            // Check if within 15 minutes before the scheduled time
            const diff = scheduledMinutes - currentMinutes;
            if (diff >= -15 && diff <= 15) {
                await sendLocalNotification(`🏋️ Time for: ${workout.title}`, {
                    body: `Your scheduled workout is ${diff <= 0 ? 'now' : `in ${diff} minutes`}!`,
                    tag: `workout-${workout.id}`,
                    data: { url: '/schedule' },
                });

                // Mark reminder as sent
                await updateScheduledWorkout(workout.id, { reminderSent: true });
            }
        }
    } catch (error) {
        console.error('Error checking scheduled workouts:', error);
    }
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
