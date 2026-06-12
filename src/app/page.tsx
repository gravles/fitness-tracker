'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Flame, Mic, Camera, Barcode, Settings } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { format, subDays } from 'date-fns';
import { getStreak, getMonthlyLogs, getBodyMetricsHistory, DailyLog, UserSettings } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { checkReminders, checkScheduledWorkouts } from '@/lib/notifications';
import { SmartCoach } from '@/components/SmartCoach';
import { OnboardingModal } from '@/components/OnboardingModal';
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
import { TodayHero } from '@/components/TodayHero';
import { NextWorkoutTile } from '@/components/NextWorkoutTile';
import { WhatsNewModal, useWhatsNew } from '@/components/WhatsNewModal';

export default function Dashboard() {
  const today = new Date();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showWhatsNew, dismissWhatsNew] = useWhatsNew();

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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { t } = useLanguage();

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
      const timeOfDay = hour < 12 ? t.dashboard.greeting.morning : hour < 17 ? t.dashboard.greeting.afternoon : t.dashboard.greeting.evening;
      const rawName = settings?.display_name
        || session?.user?.user_metadata?.full_name
        || session?.user?.user_metadata?.name
        || session?.user?.email?.split('@')[0]
        || '';
      const firstName = rawName.split(/[\s._-]/)[0];
      const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
      setGreeting(`${timeOfDay}${formattedName ? `, ${formattedName}` : ''}`);

      // Show onboarding modal for new users (no settings row yet)
      if (!settings) {
        setShowOnboarding(true);
      }

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
      // Ensure SmartCoach always has a tip even when data loading fails
      setAdvice(getSmartAdvice([], 0, undefined));
    } finally {
      setIsLoading(false);
    }
  }

  const quickActions = [
    { href: '/log?action=voice', icon: Mic, label: t.dashboard.voiceLog, ariaLabel: 'Log with voice' },
    { href: '/log?action=camera', icon: Camera, label: t.dashboard.snapMeal, ariaLabel: 'Snap a photo of your meal' },
    { href: '/log?action=barcode', icon: Barcode, label: t.dashboard.barcode, ariaLabel: 'Scan a barcode' },
  ];

  return (
    <>
    {showOnboarding && (
      <OnboardingModal
        onComplete={(name) => {
          setShowOnboarding(false);
          if (name) {
            const hour = today.getHours();
            const timeOfDay = hour < 12 ? t.dashboard.greeting.morning : hour < 17 ? t.dashboard.greeting.afternoon : t.dashboard.greeting.evening;
            setGreeting(`${timeOfDay}, ${name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()}`);
          }
          loadData(); // refresh settings after onboarding
        }}
      />
    )}
    {!showOnboarding && showWhatsNew && (
      <WhatsNewModal onClose={dismissWhatsNew} />
    )}
    <main className="p-6 pt-12 pb-28 space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <header className="flex justify-between items-start mb-2">
        <div>
          <p className="text-sm font-medium text-[var(--color-text-muted)] mb-0.5">{format(today, 'EEEE, MMMM d')}</p>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">{greeting}</h1>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: 'var(--color-gold-muted)', border: '1px solid var(--color-gold-border)' }}
              aria-label={`${t.dashboard.streak.label}: ${streak} ${t.dashboard.streak.days}`}
              title={streak === 0 ? t.dashboard.streak.zero : streak < 7 ? t.dashboard.streak.low : streak < 30 ? t.dashboard.streak.mid : t.dashboard.streak.high}
            >
              <Flame className="w-4 h-4" style={{ color: 'var(--color-gold-text)' }} aria-hidden="true" />
              <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--color-gold-text)' }}>{streak}</span>
            </div>
          )}
          <Link
            href="/settings"
            className="p-2.5 bg-[var(--color-surface-elevated)] rounded-full border border-[var(--color-border-light)] shadow-sm text-[var(--color-text-muted)] hover:text-[var(--color-gold-text)] transition-all focus-ring tap-target"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* Loading State */}
      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Today hero — rings for protein / calories / checklist */}
          <TodayHero todayLog={todayLog} settings={settings} stagger={0} />

          {/* Bento row — level + next workout */}
          <div className="grid grid-cols-2 gap-3">
            <LevelProgress
              level={userLevel.level}
              xp={userLevel.xp}
              onClick={() => setShowXPModal(true)}
              stagger={60}
            />
            <NextWorkoutTile stagger={120} />
          </div>

          {/* Smart Coach */}
          <SmartCoach tip={advice} onWeeklyAnalysis={() => setShowInsightModal(true)} stagger={180} />

          {/* Quick Actions */}
          <section aria-labelledby="quick-add-heading" className="animate-in" style={{ ['--stagger' as string]: '240ms' }}>
            <h3 id="quick-add-heading" className="font-semibold text-sm text-[var(--color-text)] uppercase tracking-wide mb-3 px-1">{t.dashboard.quickAdd}</h3>
            <div className="grid grid-cols-3 gap-3">
              {quickActions.map(({ href, icon: Icon, label, ariaLabel }) => (
                <Link
                  key={href}
                  href={href}
                  className="group p-4 flex flex-col items-center justify-center gap-2 border border-[var(--color-border-light)] bg-[var(--color-surface-elevated)] shadow-sm active:scale-[0.97] hover:border-[var(--color-gold-border)] transition-all focus-ring tap-target"
                  style={{ borderRadius: 'var(--radius-card)' }}
                  aria-label={ariaLabel}
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
                    style={{ background: 'var(--color-gold-muted)', color: 'var(--color-gold-text)' }}
                  >
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <span className="font-semibold text-xs text-[var(--color-text-secondary)]">{label}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* Weekly Summary */}
          <WeeklySummary stats={weeklyStats} />

          {/* Recent Activity */}
          <RecentLogs logs={logs} />

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
    </>
  );
}
