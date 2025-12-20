'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Flame, Trophy, Mic, Camera } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { getStreak, getMonthlyLogs, getBodyMetricsHistory } from '@/lib/api';
import { SmartCoach } from '@/components/SmartCoach';
import { WeeklySummary } from '@/components/WeeklySummary';
import { RecentLogs } from '@/components/RecentLogs';
import { getSmartAdvice, CoachingTip } from '@/lib/smartCoach';

// ... imports
import { LevelProgress } from '@/components/LevelProgress';
import { XPHistoryModal } from '@/components/XPHistoryModal';
import { getSettings } from '@/lib/api';

export default function Dashboard() {
  const today = new Date();
  const [streak, setStreak] = useState(0);
  const [logs, setLogs] = useState<any[]>([]);
  const [advice, setAdvice] = useState<CoachingTip | null>(null);
  const [weeklyStats, setWeeklyStats] = useState({ avgWeight: 0, totalMovement: 0, avgProtein: 0, totalAlcohol: 0 });

  // Gamification State
  const [userLevel, setUserLevel] = useState({ level: 1, xp: 0 });
  const [showXPModal, setShowXPModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const start = format(subDays(today, 7), 'yyyy-MM-dd');
      const end = format(today, 'yyyy-MM-dd');

      // Parallel Fetching
      const [streakVal, recentLogs, recentMetrics, settings] = await Promise.all([
        getStreak(),
        getMonthlyLogs(start, end),
        getBodyMetricsHistory(start, end),
        getSettings()
      ]);

      setStreak(streakVal);
      setLogs(recentLogs);
      setAdvice(getSmartAdvice(recentLogs, streakVal));

      if (settings) {
        setUserLevel({
          level: settings.current_level || 1,
          xp: settings.total_xp || 0
        });
      }

      // Calculate Weekly Stats
      // ... existing calculation ...
      const totalMoved = recentLogs.reduce((acc, log) => acc + (log.movement_duration || 0), 0);
      const proteinLogs = recentLogs.filter(l => (l.protein_grams || 0) > 0);
      const totalProtein = proteinLogs.reduce((acc, log) => acc + (log.protein_grams || 0), 0);
      const totalAlcohol = recentLogs.reduce((acc, log) => acc + (log.alcohol_drinks || 0), 0);
      const weights = recentMetrics.map(m => m.weight).filter(w => w) as number[];
      const avgWeight = weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : 0;

      setWeeklyStats({
        avgWeight: parseFloat(avgWeight.toFixed(1)),
        totalMovement: totalMoved,
        avgProtein: proteinLogs.length > 0 ? Math.round(totalProtein / proteinLogs.length) : 0,
        totalAlcohol: totalAlcohol
      });

    } catch (error) {
      console.error(error);
    }
  }

  return (
    <main className="p-6 pt-12 pb-24 space-y-6">
      <header className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">{format(today, 'EEEE, MMMM d')}</p>
        </div>
        <Link href="/settings" className="p-2 bg-white rounded-full border border-gray-100 shadow-sm text-gray-400 hover:text-blue-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
        </Link>
      </header>

      {/* Level Progress */}
      <LevelProgress
        level={userLevel.level}
        xp={userLevel.xp}
        onClick={() => setShowXPModal(true)}
      />

      <XPHistoryModal
        isOpen={showXPModal}
        onClose={() => setShowXPModal(false)}
        lifetimeXP={userLevel.xp}
        onSync={loadData}
      />

      {/* Smart Coach Widget */}
      <SmartCoach tip={advice} />

      {/* Streak Card */}
      <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-6 text-white shadow-xl shadow-orange-200/50 relative overflow-hidden">
        {/* ... existing streak content ... */}
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

      {/* Weekly Summary */}
      <WeeklySummary stats={weeklyStats} />

      {/* Quick Actions */}
      <h3 className="font-bold text-gray-900 mb-2 px-1">Quick Add</h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link href="/log?action=voice" className="p-4 bg-purple-50 text-purple-700 rounded-2xl flex flex-col items-center justify-center gap-2 border border-purple-100 shadow-sm active:scale-95 transition-all">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
            <Mic className="w-5 h-5 text-purple-600" />
          </div>
          <span className="font-bold text-sm">Voice Log</span>
        </Link>
        <Link href="/log?action=camera" className="p-4 bg-blue-50 text-blue-700 rounded-2xl flex flex-col items-center justify-center gap-2 border border-blue-100 shadow-sm active:scale-95 transition-all">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
            <Camera className="w-5 h-5 text-blue-600" />
          </div>
          <span className="font-bold text-sm">Snap Meal</span>
        </Link>
      </div>

      <Link href="/log" className="block group">
        <div className="glass-card p-6 rounded-2xl flex items-center justify-between group-active:scale-[0.98] transition-all duration-200 hover:shadow-lg hover:shadow-blue-100/50 hover:border-blue-200">
          <div>
            <h3 className="font-bold text-xl text-gray-800 mb-1">Log Today</h3>
            <p className="text-sm text-gray-600 font-medium">Full daily log & details</p>
          </div>
          <div className="w-12 h-12 bg-gray-900 text-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <ArrowRight className="w-6 h-6" />
          </div>
        </div>
      </Link>

      {/* Recent Activity */}
      <RecentLogs logs={logs} />
    </main>
  );
}
