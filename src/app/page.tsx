'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Flame, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { getStreak } from '@/lib/api';

export default function Dashboard() {
  const today = new Date();
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    getStreak().then(setStreak).catch(console.error);
  }, []);

  return (
    <main className="p-6 pt-12 pb-24 space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">{format(today, 'EEEE, MMMM d')}</p>
        </div>
        {/* User avatar/profile link could go here */}
      </header>

      {/* Streak Card */}
      <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-6 text-white shadow-xl shadow-orange-200/50 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-5 h-5 animate-pulse" />
            <span className="font-semibold opacity-90 tracking-wide uppercase text-xs">Current Streak</span>
          </div>
          <div className="text-5xl font-black tracking-tight">{streak} <span className="text-2xl font-medium opacity-80">Days</span></div>
          <p className="text-sm opacity-80 mt-2 font-medium">Keep the fire burning! 🔥</p>
        </div>
        <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
          <Flame className="w-32 h-32" />
        </div>
      </div>

      {/* Quick Actions */}
      <Link href="/log" className="block group">
        <div className="glass-card p-6 rounded-2xl flex items-center justify-between group-active:scale-[0.98] transition-all duration-200 hover:shadow-lg hover:shadow-blue-100/50 hover:border-blue-200">
          <div>
            <h3 className="font-bold text-xl text-gray-800 mb-1">Log Today</h3>
            <p className="text-sm text-gray-600 font-medium">Track movement & nutrition</p>
          </div>
          <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform">
            <ArrowRight className="w-6 h-6" />
          </div>
        </div>
      </Link>

      {/* Weekly Summary - Placeholder can remain or be updated. 
                For MVP Phase 1 completion, Streak is the big one. 
                I will leave Weekly Summary static for now to minimize scope creep unless explicitly asked.
            */}
    </main>
  );
}
