import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry } from "@serwist/precaching";
import { installSerwist } from "@serwist/sw";

declare const self: ServiceWorkerGlobalScope & {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
};

installSerwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: defaultCache,
});

// Push notification handler
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options: NotificationOptions = {
        body: data.body || 'New notification',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: data.tag || 'default',
        data: data.data || {},
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Life Logger', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If a window is already open, focus it
                for (const client of clientList) {
                    if (client.url.includes(url) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise open a new window
                if (self.clients.openWindow) {
                    return self.clients.openWindow(url);
                }
            })
    );
});

// Background sync for offline logging (future enhancement)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-logs') {
        event.waitUntil(syncLogs());
    }
});

async function syncLogs(): Promise<void> {
    // This would sync any pending offline logs to the server
    // For now, just log that sync happened
    console.log('Background sync triggered');
}
