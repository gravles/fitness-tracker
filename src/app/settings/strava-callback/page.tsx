'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function StravaCallbackPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState('Authenticating...');
    const processed = useRef(false);

    useEffect(() => {
        if (processed.current) return;
        processed.current = true;

        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error) {
            setStatus('Connection failed or rejected.');
            setTimeout(() => router.push('/settings'), 2000);
            return;
        }

        if (!code) {
            setStatus('No code found.');
            setTimeout(() => router.push('/settings'), 2000);
            return;
        }

        // Perform Exchange
        async function doExchange() {
            try {
                // Get current session token for the API call
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    setStatus('You must be logged in.');
                    return;
                }

                const res = await fetch('/api/strava/exchange', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({ code })
                });

                if (!res.ok) {
                    const d = await res.json();
                    throw new Error(d.error || 'Exchange failed');
                }

                setStatus('Success! Redirecting...');
                router.push('/settings?strava_connected=true');

            } catch (err: any) {
                console.error(err);
                setStatus('Error: ' + err.message);
                setTimeout(() => router.push('/settings'), 3000);
            }
        }

        doExchange();

    }, [searchParams, router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center max-w-sm w-full text-center">
                {status.includes('Error') ? (
                    <div className="text-red-500 font-bold mb-4">⚠️ Authorization Failed</div>
                ) : (
                    <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
                )}
                <h1 className="text-lg font-bold text-gray-800 mb-2">Connecting Strava</h1>
                <p className="text-gray-500 text-sm">{status}</p>
            </div>
        </div>
    );
}
