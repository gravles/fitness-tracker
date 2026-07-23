'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * The /log screen was dissolved into the main tabs: food capture/editing lives
 * on Eat (/nutrition), activity on the Workout tab (/schedule), wellness in the
 * Home check-in. This redirect keeps old deep links (PWA shortcuts, bookmarks,
 * watch intents) working.
 */
export default function LogRedirect() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const action = searchParams.get('action');
        const date = searchParams.get('date');
        if (action === 'workout') {
            router.replace('/schedule');
            return;
        }
        const params = new URLSearchParams();
        if (action) params.set('action', action);
        if (date) params.set('date', date);
        const qs = params.toString();
        router.replace(`/nutrition${qs ? `?${qs}` : ''}`);
    }, [router, searchParams]);

    return (
        <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} aria-label="Redirecting" />
        </div>
    );
}
