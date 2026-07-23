'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/components/LanguageProvider';
import { format, subDays } from 'date-fns';
import { getStreak, getMonthlyLogs, getBodyMetricsHistory, DailyLog, UserSettings, isAuthError } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { checkReminders, checkScheduledWorkouts } from '@/lib/notifications';
import { SmartCoach } from '@/components/SmartCoach';
import { OnboardingModal } from '@/components/OnboardingModal';
import { AIWeeklyInsightModal } from '@/components/AIWeeklyInsightModal';
import { FeatureTutorial } from '@/components/FeatureTutorial';
import { getSmartAdvice, CoachingTip } from '@/lib/smartCoach';
import { XPHistoryModal } from '@/components/XPHistoryModal';
import { ShareModal } from '@/components/ShareModal';
import { getSettings } from '@/lib/api';
import { DashboardSkeleton } from '@/components/Skeleton';
import { LoadError } from '@/components/ui';
import { ReadinessCheckIn } from '@/components/ReadinessCheckIn';
import { PlannedMealsCard } from '@/components/PlannedMealsCard';
import { SupplementDosesCard } from '@/components/SupplementDosesCard';
import { WhatsNewModal, useWhatsNew } from '@/components/WhatsNewModal';
import { PartnerCard } from '@/components/PartnerCard';
import { ensureMyProfile } from '@/lib/partner-api';
import { HomeHeader } from '@/components/kinetic/HomeHeader';
import { WellnessCheckIn } from '@/components/kinetic/WellnessCheckIn';
import { NutritionBentoTile } from '@/components/kinetic/NutritionBentoTile';
import { MetricBentoTile } from '@/components/kinetic/MetricBentoTile';
import { UpNextCard } from '@/components/kinetic/UpNextCard';
import { HabitStrip } from '@/components/kinetic/HabitStrip';
import { XpRow } from '@/components/kinetic/XpRow';

export default function Dashboard() {
  const today = new Date();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showWhatsNew, dismissWhatsNew] = useWhatsNew();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [streak, setStreak] = useState<number | null>(null);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [advice, setAdvice] = useState<CoachingTip | null>(null);
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [greeting, setGreeting] = useState('');

  // Bento tiles — 7-day series
  const [weightSeries, setWeightSeries] = useState<number[]>([]);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [movementSeries, setMovementSeries] = useState<number[]>([]);
  const [weeklyMovement, setWeeklyMovement] = useState(0);

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
    // Partner invite deep-link (from the invite email). The invite itself is
    // matched by verified email, so we just make sure a profile exists and
    // land the user on the partner page where the pending invite shows.
    if (searchParams.get('invite')) {
      ensureMyProfile().catch(() => {});
      router.replace('/partner');
    }
  }, [searchParams, router]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    setLoadError(false);
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

      // Bento series — weight sparkline + latest, per-day movement minutes
      const weights = recentMetrics.map(m => m.weight).filter((w): w is number => !!w);
      setWeightSeries(weights);
      setLatestWeight(weights.length > 0 ? weights[weights.length - 1] : null);

      const logByDate = new Map(recentLogs.map(l => [l.date, l]));
      const perDayMovement = Array.from({ length: 7 }, (_, i) => {
        const d = format(subDays(today, 6 - i), 'yyyy-MM-dd');
        return logByDate.get(d)?.movement_duration || 0;
      });
      setMovementSeries(perDayMovement);
      setWeeklyMovement(perDayMovement.reduce((a, b) => a + b, 0));

      // Check if any reminders should be sent
      checkReminders();
      checkScheduledWorkouts();

    } catch (error) {
      console.error(error);
      if (!isAuthError(error)) setLoadError(true);
      // Ensure SmartCoach always has a tip even when data loading fails
      setAdvice(getSmartAdvice([], 0, undefined));
    } finally {
      setIsLoading(false);
    }
  }

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
    <main className="relative overflow-hidden p-4 pt-11 space-y-2.5 max-w-2xl mx-auto">
      {/* Ambient gold glow, top-right (mock 2a) */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{
          top: -80,
          right: -80,
          width: 260,
          height: 260,
          background: 'radial-gradient(circle, color-mix(in srgb, var(--color-gold) 10%, transparent), transparent 65%)',
        }}
      />

      <HomeHeader streak={isLoading ? null : streak} />

      <div className="px-1 pb-0.5">
        <p
          className="text-[11px] font-semibold uppercase"
          style={{ letterSpacing: '0.12em', color: 'var(--color-gold-text)' }}
        >
          {format(today, 'EEEE · MMM d')}
        </p>
        <h1
          className="mt-0.5 text-[22px] font-extrabold text-gradient-greeting"
          style={{ letterSpacing: '-0.03em' }}
        >
          {greeting}
        </h1>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <DashboardSkeleton />
      ) : loadError ? (
        <LoadError onRetry={loadData} />
      ) : (
        <>
          {/* Bento grid — nutrition rings + weight/movement sparklines */}
          <div className="grid gap-2.5" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
            <NutritionBentoTile todayLog={todayLog} settings={settings} />
            <MetricBentoTile
              label={t.dashboard.weight}
              value={latestWeight !== null ? latestWeight.toFixed(1) : '—'}
              points={weightSeries}
              sparkColor="var(--color-gold)"
              href="/trends"
              aria-label="Weight trend — open trends"
            />
            <MetricBentoTile
              label={t.dashboard.movement}
              value={
                <>
                  {weeklyMovement}
                  <span className="text-[11px] font-normal text-[var(--color-text-muted)]"> min/wk</span>
                </>
              }
              points={movementSeries}
              sparkColor="var(--color-primary)"
              href="/trends"
              aria-label="Movement trend — open trends"
            />
          </div>

          <UpNextCard />

          <HabitStrip logs={logs} />

          {/* Smart Coach */}
          <SmartCoach tip={advice} onWeeklyAnalysis={() => setShowInsightModal(true)} stagger={120} />

          {/* Compact XP row — off by default, toggle lives in /more */}
          <XpRow level={userLevel.level} xp={userLevel.xp} onClick={() => setShowXPModal(true)} />

          <ReadinessCheckIn />

          {/* Evening wellness check-in — the old /log Wellness tab lives here now */}
          <WellnessCheckIn stagger={140} />

          {/* Today's coach-planned meals — hidden entirely when none are planned */}
          <PlannedMealsCard stagger={150} onLogged={loadData} />

          {/* Today's supplement/medication doses — hidden when none are scheduled */}
          <SupplementDosesCard stagger={160} />

          {/* Workout partners — hidden when there are no partnerships or invites */}
          <PartnerCard stagger={165} />

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
