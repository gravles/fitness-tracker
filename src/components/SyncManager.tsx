'use client';

import { useEffect, useState } from 'react';
import { MutationQueue, RequestQueueItem } from '@/lib/queue';
import { upsertDailyLog, addWorkout, updateSettings } from '@/lib/api';
import { toast } from 'sonner';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export function SyncManager() {
    const [isOnline, setIsOnline] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        setIsOnline(navigator.onLine);

        const handleOnline = () => {
            setIsOnline(true);
            toast.success('Back online', { icon: <Wifi className="w-4 h-4" /> });
            processQueue();
        };

        const handleOffline = () => {
            setIsOnline(false);
            toast('You are offline. Changes will save locally.', { icon: <WifiOff className="w-4 h-4" /> });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial check on mount
        if (navigator.onLine) {
            processQueue();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const processQueue = async () => {
        const queue = MutationQueue.getQueue();
        if (queue.length === 0) return;

        setIsSyncing(true);
        const toastId = toast.loading(`Syncing ${queue.length} items...`);

        let successCount = 0;
        let failCount = 0;

        for (const item of queue) {
            try {
                await processItem(item);
                MutationQueue.remove(item.id);
                successCount++;
            } catch (error) {
                console.error('Failed to sync item:', item, error);
                failCount++;
            }
        }

        setIsSyncing(false);
        toast.dismiss(toastId);

        if (successCount > 0) {
            toast.success(`Synced ${successCount} items`, { icon: <RefreshCw className="w-4 h-4" /> });
        }
        if (failCount > 0) {
            toast.error(`Failed to sync ${failCount} items. Will retry later.`);
        }
    };

    const processItem = async (item: RequestQueueItem) => {
        switch (item.type) {
            case 'LOG_DAILY': {
                // A queued payload may be a stale full-day snapshot — union its
                // food items with whatever the server has now instead of
                // replacing, so replays never wipe items logged elsewhere.
                const payload = { ...item.payload };
                if (Array.isArray(payload.food_items)) {
                    const [{ getDailyLog }, { unionFoodItems, foodTotals }] = await Promise.all([
                        import('@/lib/api'),
                        import('@/lib/food-merge'),
                    ]);
                    const server = payload.date ? await getDailyLog(payload.date).catch(() => null) : null;
                    payload.food_items = unionFoodItems(server?.food_items ?? [], payload.food_items);
                    const totals = foodTotals(payload.food_items);
                    payload.calories = totals.calories;
                    payload.protein_grams = totals.protein;
                    payload.carbs_grams = totals.carbs;
                    payload.fat_grams = totals.fat;
                }
                await upsertDailyLog(payload);
                break;
            }
            case 'ADD_WORKOUT':
                // Remove the temp ID we generated before sending to server
                const { id, ...cleanPayload } = item.payload;
                await addWorkout(cleanPayload);
                break;
            case 'UPDATE_SETTINGS':
                await updateSettings(item.payload);
                break;
            default:
                console.warn('Unknown queue item type:', item.type);
        }
    };

    return null; // Headless component
}
