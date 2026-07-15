'use client';

import { useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Tab state synced with the `?tab=` query param so tabs are deep-linkable
 * (e.g. /nutrition?tab=pantry) and survive refresh. Tab switches use
 * history.replaceState so they don't pollute the back stack.
 */
export function useTabParam<T extends string>(valid: readonly T[], fallback: T) {
    const searchParams = useSearchParams();
    const fromUrl = searchParams.get('tab') as T | null;
    const initial = fromUrl && valid.includes(fromUrl) ? fromUrl : fallback;
    const [tab, setTabState] = useState<T>(initial);

    const setTab = useCallback((next: T) => {
        setTabState(next);
        const url = new URL(window.location.href);
        if (next === fallback) url.searchParams.delete('tab');
        else url.searchParams.set('tab', next);
        window.history.replaceState(window.history.state, '', url);
    }, [fallback]);

    return [tab, setTab] as const;
}
