'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PlusCircle, Calendar, Settings, TrendingUp } from 'lucide-react';

export function BottomNav() {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-200 pb-safe pt-2 px-6 flex justify-between items-center z-50 max-w-2xl mx-auto shadow-lg shadow-gray-200">
            <Link href="/" className={`flex flex-col items-center gap-1 p-2 ${isActive('/') ? 'text-blue-600' : 'text-gray-400'}`}>
                <Home className="w-6 h-6" />
                <span className="text-[10px] font-medium">Dashboard</span>
            </Link>

            <Link href="/log" className={`flex flex-col items-center gap-1 p-2 ${isActive('/log') ? 'text-blue-600' : 'text-gray-400'}`}>
                <PlusCircle className="w-6 h-6" />
                <span className="text-[10px] font-medium">Log</span>
            </Link>

            <Link href="/calendar" className={`flex flex-col items-center gap-1 p-2 ${isActive('/calendar') ? 'text-blue-600' : 'text-gray-400'}`}>
                <Calendar className="w-6 h-6" />
                <span className="text-[10px] font-medium">History</span>
            </Link>

            <Link href="/trends" className={`flex flex-col items-center gap-1 p-2 ${isActive('/trends') ? 'text-blue-600' : 'text-gray-400'}`}>
                <TrendingUp className="w-6 h-6" />
                <span className="text-[10px] font-medium">Trends</span>
            </Link>

            <Link href="/settings" className={`flex flex-col items-center gap-1 p-2 ${isActive('/settings') ? 'text-blue-600' : 'text-gray-400'}`}>
                <Settings className="w-6 h-6" />
                <span className="text-[10px] font-medium">Settings</span>
            </Link>
        </nav>
    );
}
