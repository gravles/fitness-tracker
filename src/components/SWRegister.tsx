'use client';

import { useEffect } from 'react';

declare global {
    interface Window {
        serwist: any;
    }
}

export function SWRegister() {
    useEffect(() => {
        if ('serviceWorker' in navigator && window.serwist !== undefined) {
            window.serwist.register();
        }
    }, []);

    return null;
}
