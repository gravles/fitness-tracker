'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Auth } from '@/components/Auth';
import { BottomNav } from '@/components/BottomNav';
import { Loader2 } from 'lucide-react';

export function AuthWrapper({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-white">
                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
            </div>
        );
    }

    if (!session) {
        return <Auth />;
    }

    return (
        <>
            {children}
            <BottomNav />
        </>
    );
}
