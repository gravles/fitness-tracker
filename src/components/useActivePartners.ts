'use client';

import { useState, useEffect } from 'react';
import { Partnership, getPartnerships } from '@/lib/partner-api';

// One fetch shared by every share button on screen; refreshed after a minute
const TTL_MS = 60_000;
let cache: { at: number; promise: Promise<Partnership[]> } | null = null;

function loadActivePartners(): Promise<Partnership[]> {
    if (!cache || Date.now() - cache.at > TTL_MS) {
        cache = {
            at: Date.now(),
            promise: getPartnerships()
                .then(all => all.filter(p => p.status === 'active' && !!p.otherUserId))
                .catch(() => []),
        };
    }
    return cache.promise;
}

/** Active, linked partners — empty until loaded, so share UI stays hidden for solo users. */
export function useActivePartners(): Partnership[] {
    const [partners, setPartners] = useState<Partnership[]>([]);
    useEffect(() => {
        let cancelled = false;
        loadActivePartners().then(p => { if (!cancelled) setPartners(p); });
        return () => { cancelled = true; };
    }, []);
    return partners;
}
