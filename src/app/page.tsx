'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowRight, Flame, Trophy, Mic, Camera, Settings } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { getStreak, getMonthlyLogs, getBodyMetricsHistory, DailyLog, UserSettings } from '@/lib/api';
import { supabase } from '@/lib/supabase';
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
import { DailyGoalTracker } from '@/components/DailyGoalTracker';

export default function Dashboard() {
  const today = new Date();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [logs, setLogs] = useState<any[]>([]);
  const [advice, setAdvice] = useState<CoachingTip | null>(null);
  const [weeklyStats, setWeeklyStats] = useState({ avgWeight: 0, totalMovement: 0, avgProtein: 0, totalAlcohol: 0 });
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [greeting, setGreeting] = useState('');

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

      const [streakVal, recentLogs, recentMetrics, settings, { data: { session } }] = await Promise.all([
        getStreak(),
        getMonthlyLogs(start, end),
        getBodyMetricsHistory(start, end),
        getSettings(),
        supabase.auth.getSession()
      ]);

      const hour = today.getHours();
      const timeOfDay = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      const rawName = session?.user?.user_metadata?.full_name
        || session?.user?.user_metadata?.name
        || session?.user?.email?.split('@')[0]
        || '';
      const firstName = rawName.split(/[\s._-]/)[0];
      const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
      setGreeting(`${timeOfDay}${formattedName ? `, ${formattedName}` : ''}`);


      setStreak(streakVal);
      setLogs(recentLogs);
      setAdvice(getSmartAdvice(recentLogs, streakVal, settings || undefined));
      setSettings(settings);

      const todayStr = format(today, 'yyyy-MM-dd');
      setTodayLog(recentLogs.find((l: DailyLog) => l.date === todayStr) ?? null);

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
          <p className="text-sm font-medium text-[var(--color-text-muted)] mb-0.5">{format(today, 'EEEE, MMMM d')}</p>
          <h1 className="text-2xl font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>{greeting}</h1>
        </div>
        <Link
          href="/settings"
          className="p-3 bg-[var(--color-surface-elevated)] rounded-full border border-[var(--color-border-light)] shadow-sm text-[var(--color-text-muted)] hover:text-[var(--color-gold)] hover:border-[var(--color-gold)]/30 transition-all focus-ring tap-target"
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

          {/* Daily Goal Tracker */}
          <DailyGoalTracker todayLog={todayLog} settings={settings} />

          {/* Smart Coach Widget */}
          <div className="space-y-3">
            <SmartCoach tip={advice} />
            <button
              onClick={() => setShowInsightModal(true)}
              className="w-full py-3.5 rounded-xl font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 focus-ring tap-target border"
              style={{
                background: 'var(--color-navy)',
                color: 'var(--color-gold)',
                borderColor: 'rgba(201,168,76,0.25)',
              }}
              aria-label="View AI Weekly Analysis"
            >
              <span className="text-base" aria-hidden="true">📊</span>
              AI Weekly Analysis
            </button>
          </div>

          {/* Streak Card */}
          <div
            className="rounded-2xl p-6 shadow-xl relative overflow-hidden"
            style={{ background: 'var(--color-navy)' }}
          >
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg" style={{ background: 'rgba(201,168,76,0.15)' }}>
                    <Flame className="w-4 h-4" style={{ color: 'var(--color-gold)' }} aria-hidden="true" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(201,168,76,0.6)' }}>
                    Current Streak
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-6xl font-black tracking-tight"
                    style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-display)' }}
                  >
                    {streak}
                  </span>
                  <span className="text-xl font-semibold" style={{ color: 'rgba(228,234,242,0.5)' }}>days</span>
                </div>
                <p className="text-sm mt-2" style={{ color: 'rgba(228,234,242,0.45)' }}>
                  {streak === 0 ? 'Start your streak today' : streak < 7 ? 'Building momentum' : streak < 30 ? 'On a roll — keep it up' : 'Unstoppable'}
                </p>
              </div>
              <div style={{ opacity: 0.04 }} aria-hidden="true">
                <Flame className="w-28 h-28" style={{ color: 'var(--color-gold)' }} />
              </div>
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
                className="group relative p-5 rounded-2xl flex flex-col items-center justify-center gap-3 shadow-sm active:scale-[0.97] transition-all focus-ring tap-target"
                style={{
                  background: 'var(--color-gold-muted)',
                  border: '1px solid rgba(201,168,76,0.2)',
                }}
                aria-label="Log with voice"
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all"
                  style={{ background: 'var(--color-gold)', color: 'var(--color-navy)' }}
                >
                  <Mic className="w-6 h-6" aria-hidden="true" />
                </div>
                <span className="font-bold text-sm" style={{ color: 'var(--color-gold)' }}>Voice Log</span>
              </Link>

              {/* Snap Meal Card */}
              <Link
                href="/log?action=camera"
                className="group relative p-5 rounded-2xl flex flex-col items-center justify-center gap-3 shadow-sm active:scale-[0.97] transition-all focus-ring tap-target"
                style={{
                  background: 'rgba(29,95,168,0.08)',
                  border: '1px solid rgba(29,95,168,0.18)',
                }}
                aria-label="Snap a photo of your meal"
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:-rotate-3 transition-all"
                  style={{ background: 'var(--color-primary)', color: 'white' }}
                >
                  <Camera className="w-6 h-6" aria-hidden="true" />
                </div>
                <span className="font-bold text-sm" style={{ color: 'var(--color-primary)' }}>Snap Meal</span>
              </Link>
            </div>
          </section>

          {/* Log Today CTA */}
          <Link href="/log" className="block group focus-ring rounded-2xl">
            <div className="bg-[var(--color-primary)] p-5 rounded-2xl flex items-center justify-between shadow-lg shadow-[var(--color-primary)]/25 group-active:scale-[0.98] group-hover:shadow-[var(--color-primary)]/40 transition-all duration-200">
              <div>
                <h3 className="font-bold text-lg text-white mb-0.5">Log Today</h3>
                <p className="text-sm text-white/70 font-medium">Full daily log & details</p>
              </div>
              <div className="w-10 h-10 bg-white/15 text-white rounded-full flex items-center justify-center group-hover:bg-white/25 transition-colors" aria-hidden="true">
                <ArrowRight className="w-5 h-5" />
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
