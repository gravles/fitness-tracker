export interface RequestQueueItem {
    id: string;
    type: 'LOG_DAILY' | 'ADD_WORKOUT' | 'UPDATE_SETTINGS' | 'ADD_FAVORITE' | 'DELETE_FAVORITE' | 'BODY_METRICS';
    payload: any;
    timestamp: number;
    retryCount: number;
}

const STORAGE_KEY = 'offline_mutation_queue';

export class MutationQueue {
    static getQueue(): RequestQueueItem[] {
        if (typeof window === 'undefined') return [];
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Failed to parse offline queue', e);
            return [];
        }
    }

    static saveQueue(queue: RequestQueueItem[]) {
        if (typeof window === 'undefined') return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    }

    static enqueue(type: RequestQueueItem['type'], payload: any) {
        const queue = this.getQueue();
        const item: RequestQueueItem = {
            id: crypto.randomUUID(),
            type,
            payload,
            timestamp: Date.now(),
            retryCount: 0
        };
        queue.push(item);
        this.saveQueue(queue);
        return item;
    }

    static remove(id: string) {
        const queue = this.getQueue();
        const filtered = queue.filter(item => item.id !== id);
        this.saveQueue(filtered);
    }

    static clear() {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(STORAGE_KEY);
    }
}
