'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowRight, Flame, Trophy, Mic, Camera, Settings } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { getStreak, getMonthlyLogs, getBodyMetricsHistory } from '@/lib/api';
import { checkReminders, checkScheduledWorkouts } from '@/lib/notifications';
import { SmartCoach } from '@/components/SmartCoach';
import { WeeklySummary } from '@/components/WeeklySummary';
import { RecentLogs } from '@/components/RecentLogs';
import { AIWeeklyInsightModal } from '@/components/AIWeeklyInsightModal';
import { FeatureTutorial } from '@/components/FeatureTutorial';
import { getSmartAdvice, CoachingTip } from '@/lib/smartCoach';
import { LevelProgress } from '@/components/LevelProgress';
import { XPHistoryModal } from '@/components/XPHistoryModal';
import { ShareModal } from '@/components/ShareModal';
import { getSettings } from '@/lib/api';
import { DashboardSkeleton } from '@/components/Skeleton';
import { UpcomingWorkouts } from '@/components/UpcomingWorkouts';

export default function Dashboard() {
  const today = new Date();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [logs, setLogs] = useState<any[]>([]);
  const [advice, setAdvice] = useState<CoachingTip | null>(null);
  const [weeklyStats, setWeeklyStats] = useState({ avgWeight: 0, totalMovement: 0, avgProtein: 0, totalAlcohol: 0 });

  // Gamification State
  const [userLevel, setUserLevel] = useState({ level: 1, xp: 0 });
  const [showXPModal, setShowXPModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [showFeatureTutorial, setShowFeatureTutorial] = useState(false);

  useEffect(() => {
    if (searchParams.get('tutorial') === 'true') {
      setShowFeatureTutorial(true);
      router.replace('/');
    }
  }, [searchParams, router]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const start = format(subDays(today, 7), 'yyyy-MM-dd');
      const end = format(today, 'yyyy-MM-dd');

      const [streakVal, recentLogs, recentMetrics, settings] = await Promise.all([
        getStreak(),
        getMonthlyLogs(start, end),
        getBodyMetricsHistory(start, end),
        getSettings()
      ]);

      setStreak(streakVal);
      setLogs(recentLogs);
      setAdvice(getSmartAdvice(recentLogs, streakVal, settings || undefined));

      if (settings) {
        setUserLevel({
          level: settings.current_level || 1,
          xp: settings.total_xp || 0
        });
      }

      // Calculate Weekly Stats
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

      // Check if any reminders should be sent
      checkReminders();
      checkScheduledWorkouts();

    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="p-6 pt-12 pb-24 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <header className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-text)]">Dashboard</h1>
          <p className="text-[var(--color-text-muted)]">{format(today, 'EEEE, MMMM d')}</p>
        </div>
        <Link
          href="/settings"
          className="p-3 bg-[var(--color-surface-elevated)] rounded-full border border-[var(--color-border-light)] shadow-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/30 transition-all focus-ring tap-target"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" aria-hidden="true" />
        </Link>
      </header>

      {/* Loading State */}
      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
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
            currentLevel={userLevel.level}
            onSync={loadData}
            onShare={() => {
              setShowXPModal(false);
              setShowShareModal(true);
            }}
          />

          <ShareModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            type="level"
            data={{
              title: `Level ${userLevel.level} Achieved!`,
              subtitle: `${userLevel.xp.toLocaleString()} XP earned`,
              emoji: '🏆',
              stats: [
                { label: 'Total XP', value: userLevel.xp.toLocaleString() },
                { label: 'Current Level', value: userLevel.level }
              ]
            }}
          />

          {/* Smart Coach Widget */}
          <div className="space-y-3">
            <SmartCoach tip={advice} />
            <button
              onClick={() => setShowInsightModal(true)}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 focus-ring tap-target"
              aria-label="View AI Weekly Analysis"
            >
              <span className="text-xl" aria-hidden="true">📊</span>
              View AI Weekly Analysis
            </button>
          </div>

          {/* Streak Card */}
          <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-6 text-white shadow-xl shadow-orange-500/20 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-5 h-5 animate-pulse" aria-hidden="true" />
                <span className="font-semibold opacity-90 tracking-wide uppercase text-xs">Current Streak</span>
              </div>
              <div className="text-5xl font-black tracking-tight">
                {streak} <span className="text-2xl font-medium opacity-80">Days</span>
              </div>
              <p className="text-sm opacity-80 mt-2 font-medium">Keep the fire burning! 🔥</p>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12" aria-hidden="true">
              <Flame className="w-32 h-32" />
            </div>
          </div>

          {/* Weekly Summary */}
          <WeeklySummary stats={weeklyStats} />

          {/* Upcoming Workouts */}
          <UpcomingWorkouts />

          {/* Quick Actions - Enhanced */}
          <section aria-labelledby="quick-add-heading">
            <h3 id="quick-add-heading" className="font-bold text-[var(--color-text)] mb-3 px-1">Quick Add</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Voice Log Card */}
              <Link
                href="/log?action=voice"
                className="group relative p-5 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 hover:from-purple-500/20 hover:to-indigo-500/20 rounded-2xl flex flex-col items-center justify-center gap-3 border border-purple-200/50 dark:border-purple-500/20 shadow-sm hover:shadow-lg hover:shadow-purple-500/10 active:scale-[0.97] transition-all focus-ring tap-target overflow-hidden"
                aria-label="Log with voice"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400/0 to-purple-600/0 group-hover:from-purple-400/5 group-hover:to-purple-600/10 transition-all" aria-hidden="true" />
                <div className="relative w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-110 group-hover:rotate-3 transition-all">
                  <Mic className="w-6 h-6 text-white" aria-hidden="true" />
                </div>
                <span className="relative font-bold text-sm text-purple-700 dark:text-purple-300">Voice Log</span>
              </Link>

              {/* Snap Meal Card */}
              <Link
                href="/log?action=camera"
                className="group relative p-5 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 rounded-2xl flex flex-col items-center justify-center gap-3 border border-blue-200/50 dark:border-blue-500/20 shadow-sm hover:shadow-lg hover:shadow-blue-500/10 active:scale-[0.97] transition-all focus-ring tap-target overflow-hidden"
                aria-label="Snap a photo of your meal"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400/0 to-cyan-600/0 group-hover:from-blue-400/5 group-hover:to-cyan-600/10 transition-all" aria-hidden="true" />
                <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 group-hover:-rotate-3 transition-all">
                  <Camera className="w-6 h-6 text-white" aria-hidden="true" />
                </div>
                <span className="relative font-bold text-sm text-blue-700 dark:text-blue-300">Snap Meal</span>
              </Link>
            </div>
          </section>

          {/* Log Today CTA */}
          <Link href="/log" className="block group focus-ring rounded-2xl">
            <div className="glass-card glow-card p-6 rounded-2xl flex items-center justify-between group-active:scale-[0.98] transition-all duration-200">
              <div>
                <h3 className="font-bold text-xl text-[var(--color-text)] mb-1">Log Today</h3>
                <p className="text-sm text-[var(--color-text-secondary)] font-medium">Full daily log & details</p>
              </div>
              <div className="w-12 h-12 bg-[var(--color-text)] text-[var(--color-bg)] rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform" aria-hidden="true">
                <ArrowRight className="w-6 h-6" />
              </div>
            </div>
          </Link>

          {/* Recent Activity */}
          <RecentLogs logs={logs} />

          <AIWeeklyInsightModal
            isOpen={showInsightModal}
            onClose={() => setShowInsightModal(false)}
            logs={logs}
          />

          <FeatureTutorial
            forceOpen={showFeatureTutorial}
            onClose={() => setShowFeatureTutorial(false)}
          />
        </>
      )}
    </main>
  );
}
