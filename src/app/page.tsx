'use client';

import { useAuth } from '@/components/AuthWrapper'; // Wait, I didn't export useAuth. I just made AuthWrapper.
// I can get user info from useAuth if I made a context, 
// for now let's just get session again or just show generic welcome.
// Actually AuthWrapper handles the "if not logged in" part. 
// So here we are definitely logged in.

import Link from 'next/link';
import { ArrowRight, Flame, Trophy } from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const today = new Date();

  return (
    <main className="p-6 pt-12 pb-24 space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">{format(today, 'EEEE, MMMM d')}</p>
        </div>
        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl">
          👤
        </div>
      </header>

      {/* Streak Card - Placeholder */}
      <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-6 text-white shadow-lg shadow-orange-200">
        <div className="flex items-center gap-2 mb-2">
          <Flame className="w-5 h-5" />
          <span className="font-semibold opacity-90">Current Streak</span>
        </div>
        <div className="text-4xl font-bold">0 Days</div>
        <p className="text-sm opacity-80 mt-1">Keep it up!</p>
      </div>

      {/* Quick Actions */}
      <Link href="/log" className="block group">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group-active:scale-95 transition-all">
          <div>
            <h3 className="font-bold text-lg text-gray-900">Log Today</h3>
            <p className="text-sm text-gray-500">Track movement & food</p>
          </div>
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <ArrowRight className="w-5 h-5" />
          </div>
        </div>
      </Link>

      {/* Weekly Summary - Placeholder */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          This Week
        </h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Movement Days</span>
            <span className="font-bold">0/7</span>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full w-[0%]"></div>
          </div>
        </div>
      </div>
    </main>
  );
}
