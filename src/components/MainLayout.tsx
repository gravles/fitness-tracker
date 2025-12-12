'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Auth } from '@/components/Auth';
import { DailyLogForm } from '@/components/DailyLogForm';
import { Loader2 } from 'lucide-react';

export default function MainLayout() {
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
        <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20 relative">
            <header className="px-6 pt-12 pb-4 bg-white sticky top-0 z-10 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Today</h1>
                        <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg font-bold text-gray-500">
                        {session.user.email?.[0].toUpperCase()}
                    </div>
                </div>
            </header>

            <main className="p-4 space-y-6">
                <DailyLogForm />
            </main>

            {/* Bottom Nav */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe pt-2 px-6 flex justify-between items-center z-20 md:max-w-md md:mx-auto">
                <button className="flex flex-col items-center gap-1 p-2 text-blue-600">
                    <span className="text-xl">🏠</span>
                    <span className="text-[10px] font-medium">Today</span>
                </button>
                <button className="flex flex-col items-center gap-1 p-2 text-gray-400">
                    <span className="text-xl">📊</span>
                    <span className="text-[10px] font-medium">Trends</span>
                </button>
                <button className="flex flex-col items-center gap-1 p-2 text-gray-400">
                    <span className="text-xl">📅</span>
                    <span className="text-[10px] font-medium">History</span>
                </button>
                <button className="flex flex-col items-center gap-1 p-2 text-gray-400">
                    <span className="text-xl">⚙️</span>
                    <span className="text-[10px] font-medium">Settings</span>
                </button>
            </nav>
        </div>
    );
}
