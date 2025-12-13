'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Flame, Trophy } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { getStreak, getMonthlyLogs, getBodyMetricsHistory } from '@/lib/api';
import { SmartCoach } from '@/components/SmartCoach';
import { WeeklySummary } from '@/components/WeeklySummary';
import { RecentLogs } from '@/components/RecentLogs';
import { getSmartAdvice, CoachingTip } from '@/lib/smartCoach';

export default function Dashboard() {
  const today = new Date();
  const [streak, setStreak] = useState(0);
  const [logs, setLogs] = useState<any[]>([]);
  const [advice, setAdvice] = useState<CoachingTip | null>(null);
  const [weeklyStats, setWeeklyStats] = useState({ avgWeight: 0, totalMovement: 0, avgProtein: 0 });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const streakVal = await getStreak();
      setStreak(streakVal);

      // Fetch last 7 days + buffer
      const start = format(subDays(today, 7), 'yyyy-MM-dd');
      const end = format(today, 'yyyy-MM-dd');
      const [recentLogs, recentMetrics] = await Promise.all([
        getMonthlyLogs(start, end),
        getBodyMetricsHistory(start, end)
      ]);

      setLogs(recentLogs);
      setAdvice(getSmartAdvice(recentLogs, streakVal));

      // Calculate Weekly Stats
      const totalMoved = recentLogs.reduce((acc, log) => acc + (log.movement_duration || 0), 0);
      const totalProtein = recentLogs.reduce((acc, log) => acc + (log.protein_grams || 0), 0);

      // Calculate avg weight (if any)
      const weights = recentMetrics.map(m => m.weight).filter(w => w) as number[];
      const avgWeight = weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : 0;

      setWeeklyStats({
        avgWeight: parseFloat(avgWeight.toFixed(1)),
        totalMovement: totalMoved,
        avgProtein: Math.round(totalProtein / (recentLogs.length || 1))
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
      </header>

      {/* Smart Coach Widget */}
      <SmartCoach tip={advice} />

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

      {/* Weekly Summary */}
      <WeeklySummary stats={weeklyStats} />

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

      {/* Recent Activity */}
      <RecentLogs logs={logs} />
    </main>
  );
}
