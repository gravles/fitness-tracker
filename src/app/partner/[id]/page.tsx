'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, Loader2, Flame, CalendarCheck, Dumbbell, Beef, Moon, Trophy, MoreVertical, PauseCircle, PlayCircle, XCircle, Lock } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { useLanguage } from '@/components/LanguageProvider';
import { Card, StatTile } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { confirm } from '@/components/ConfirmDialog';
import {
    PartnerDashboard, ShareLevel,
    getPartnerDashboard, updateShareLevel, setPartnershipStatus, sendNudge,
} from '@/lib/partner-api';

const ENCOURAGEMENTS = ['💪', '🔥', '👏'];

export default function PartnerDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const { t } = useLanguage();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<PartnerDashboard | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [nudgeSent, setNudgeSent] = useState(false);

    const load = useCallback(async () => {
        try {
            const dashboard = await getPartnerDashboard(id);
            setData(dashboard);
        } catch (error: any) {
            console.error('Failed to load partner dashboard', error);
            toast.error(error.message || 'Failed to load partner');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    async function handleShareLevel(level: ShareLevel) {
        if (!data || data.partnership.myShareLevel === level) return;
        setBusy(true);
        haptics.tap();
        try {
            await updateShareLevel(id, level);
            setData({ ...data, partnership: { ...data.partnership, myShareLevel: level } });
        } catch (error: any) {
            toast.error(error.message || 'Something went wrong');
        } finally {
            setBusy(false);
        }
    }

    async function handleStatus(op: 'pause' | 'resume' | 'end') {
        if (op === 'end') {
            const ok = await confirm({
                title: t.partner.actions.endConfirmTitle,
                message: t.partner.actions.endConfirmMessage,
                danger: true,
            });
            if (!ok) return;
        }
        setBusy(true);
        setMenuOpen(false);
        try {
            await setPartnershipStatus(id, op);
            if (op === 'end') {
                router.push('/partner');
                return;
            }
            await load();
        } catch (error: any) {
            toast.error(error.message || 'Something went wrong');
        } finally {
            setBusy(false);
        }
    }

    async function handleNudge(emoji: string) {
        haptics.tap();
        try {
            await sendNudge(id, 'encouragement', emoji);
            setNudgeSent(true);
            haptics.success();
            toast.success(t.partner.dashboard.encourageSent);
            setTimeout(() => setNudgeSent(false), 60_000);
        } catch (error: any) {
            haptics.error();
            toast.error(error.message || 'Something went wrong');
        }
    }

    const partnerName = data?.partner?.name || 'Partner';
    const summary = data?.summary;
    const isPaused = data?.partnership?.status === 'paused';

    return (
        <main className="min-h-screen bg-[var(--color-bg)] pb-24">
            <header className="sticky top-0 z-40 bg-[var(--color-surface)]/80 backdrop-blur-lg border-b border-[var(--color-border)]">
                <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/partner" className="p-2 -ml-2 rounded-full hover:bg-[var(--color-surface-elevated)]">
                        <ChevronLeft className="w-5 h-5 text-[var(--color-text)]" />
                    </Link>
                    <h1 className="font-bold text-[var(--color-text)] truncate">{partnerName}</h1>
                    <div className="relative">
                        <button
                            className="p-2 -mr-2 rounded-full hover:bg-[var(--color-surface-elevated)]"
                            onClick={() => setMenuOpen(!menuOpen)}
                            aria-label="Partnership options"
                        >
                            <MoreVertical className="w-5 h-5 text-[var(--color-text)]" />
                        </button>
                        {menuOpen && (
                            <div className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] shadow-lg overflow-hidden">
                                {isPaused ? (
                                    <button
                                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)]"
                                        disabled={busy}
                                        onClick={() => handleStatus('resume')}
                                    >
                                        <PlayCircle className="w-4 h-4" /> {t.partner.actions.resume}
                                    </button>
                                ) : (
                                    <button
                                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)]"
                                        disabled={busy}
                                        onClick={() => handleStatus('pause')}
                                    >
                                        <PauseCircle className="w-4 h-4" /> {t.partner.actions.pause}
                                    </button>
                                )}
                                <button
                                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[var(--color-danger)] hover:bg-[var(--color-bg-subtle)]"
                                    disabled={busy}
                                    onClick={() => handleStatus('end')}
                                >
                                    <XCircle className="w-4 h-4" /> {t.partner.actions.end}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="max-w-md mx-auto px-4 py-6 space-y-6" onClick={() => menuOpen && setMenuOpen(false)}>
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
                    </div>
                ) : !data ? null : (
                    <>
                        {isPaused && (
                            <Card padding="sm" elevated={false}>
                                <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-2">
                                    <PauseCircle className="w-4 h-4 shrink-0" /> {t.partner.dashboard.pausedNotice}
                                </p>
                            </Card>
                        )}

                        {summary && (
                            <>
                                {/* Encouragement */}
                                <section>
                                    <h2 className="text-sm font-bold text-[var(--color-text)] mb-3">
                                        {t.partner.dashboard.encourage}
                                    </h2>
                                    <div className="flex gap-2">
                                        {ENCOURAGEMENTS.map(emoji => (
                                            <button
                                                key={emoji}
                                                disabled={nudgeSent}
                                                onClick={() => handleNudge(emoji)}
                                                className="flex-1 py-3 text-2xl rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-elevated)] shadow-sm transition-all active:scale-[0.95] disabled:opacity-40"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </section>

                                {/* Weekly stats */}
                                <section>
                                    <h2 className="text-sm font-bold text-[var(--color-text)] mb-3">
                                        {t.partner.dashboard.thisWeek}
                                    </h2>
                                    <div className="grid grid-cols-2 gap-3">
                                        <StatTile
                                            icon={Flame}
                                            iconColor="var(--color-gold-text)"
                                            label={t.partner.dashboard.streak}
                                            value={summary.streak}
                                            stagger={0}
                                        />
                                        <StatTile
                                            icon={CalendarCheck}
                                            label={t.partner.dashboard.daysLogged}
                                            value={`${summary.daysLogged} / 7`}
                                            stagger={50}
                                        />
                                        <StatTile
                                            icon={Dumbbell}
                                            label={t.partner.dashboard.workouts}
                                            value={summary.workoutsCount}
                                            stagger={100}
                                        />
                                        <StatTile
                                            icon={Beef}
                                            label={t.partner.dashboard.proteinDays}
                                            value={`${summary.proteinDays} / 7`}
                                            stagger={150}
                                        />
                                        <StatTile
                                            icon={Moon}
                                            label={t.partner.dashboard.avgSleep}
                                            value={`${summary.avgSleep} / 5`}
                                            stagger={200}
                                        />
                                        {summary.level != null && (
                                            <StatTile
                                                icon={Trophy}
                                                iconColor="var(--color-gold-text)"
                                                label={t.partner.dashboard.level}
                                                value={summary.level}
                                                stagger={250}
                                            />
                                        )}
                                    </div>
                                    {summary.lastNote && (
                                        <Card padding="sm" elevated={false} className="mt-3">
                                            <p className="text-[11px] font-medium text-[var(--color-text-muted)] mb-1">
                                                {t.partner.dashboard.lastNote}
                                            </p>
                                            <p className="text-sm italic text-[var(--color-text-secondary)]">
                                                “{summary.lastNote}”
                                            </p>
                                        </Card>
                                    )}
                                </section>

                                {/* Full activity or summary-only notice */}
                                {data.full ? (
                                    <>
                                        {data.full.recentWorkouts.length > 0 && (
                                            <section>
                                                <h2 className="text-sm font-bold text-[var(--color-text)] mb-3">
                                                    {t.partner.dashboard.recentWorkouts}
                                                </h2>
                                                <div className="space-y-2">
                                                    {data.full.recentWorkouts.map((w, i) => (
                                                        <Card key={`${w.date}-${i}`} padding="sm">
                                                            <div className="flex items-center justify-between">
                                                                <div className="min-w-0">
                                                                    <p className="font-semibold text-sm text-[var(--color-text)] capitalize">
                                                                        {w.activityType || 'Workout'}
                                                                    </p>
                                                                    <p className="text-xs text-[var(--color-text-muted)] truncate">
                                                                        {w.exercises.length > 0
                                                                            ? w.exercises.slice(0, 3).join(' · ')
                                                                            : (w.duration ? `${w.duration} min` : '')}
                                                                    </p>
                                                                </div>
                                                                <span className="text-xs text-[var(--color-text-muted)] shrink-0 ml-2">
                                                                    {format(parseISO(w.date), 'MMM d')}
                                                                </span>
                                                            </div>
                                                        </Card>
                                                    ))}
                                                </div>
                                            </section>
                                        )}
                                        {data.full.recentLogs.length > 0 && (
                                            <section>
                                                <h2 className="text-sm font-bold text-[var(--color-text)] mb-3">
                                                    {t.partner.dashboard.recentNutrition}
                                                </h2>
                                                <div className="space-y-2">
                                                    {data.full.recentLogs.map(l => (
                                                        <Card key={l.date} padding="sm" elevated={false}>
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="font-semibold text-[var(--color-text)]">
                                                                    {format(parseISO(l.date), 'EEE, MMM d')}
                                                                </span>
                                                                <span className="text-[var(--color-text-secondary)] tabular-nums">
                                                                    {l.calories ? `${l.calories} kcal` : '—'}
                                                                    {l.proteinGrams ? ` · ${l.proteinGrams}g protein` : ''}
                                                                </span>
                                                            </div>
                                                        </Card>
                                                    ))}
                                                </div>
                                            </section>
                                        )}
                                    </>
                                ) : (
                                    <Card padding="sm" elevated={false}>
                                        <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-2">
                                            <Lock className="w-4 h-4 shrink-0" /> {t.partner.dashboard.summaryOnly}
                                        </p>
                                    </Card>
                                )}
                            </>
                        )}

                        {/* My share level */}
                        <section>
                            <h2 className="text-sm font-bold text-[var(--color-text)] mb-3">
                                {t.partner.shareLevel.title}
                            </h2>
                            <div className="grid grid-cols-2 gap-3">
                                {(['summary', 'full'] as ShareLevel[]).map(level => {
                                    const selected = data.partnership.myShareLevel === level;
                                    return (
                                        <button
                                            key={level}
                                            disabled={busy}
                                            onClick={() => handleShareLevel(level)}
                                            className={`p-4 rounded-xl border text-left transition-all ${
                                                selected
                                                    ? 'border-[var(--color-gold)] bg-[var(--color-gold-muted)]'
                                                    : 'border-[var(--color-border-light)] bg-[var(--color-surface-elevated)]'
                                            }`}
                                        >
                                            <p className={`text-sm font-bold ${selected ? 'text-[var(--color-gold-text)]' : 'text-[var(--color-text)]'}`}>
                                                {level === 'summary' ? t.partner.shareLevel.summary : t.partner.shareLevel.full}
                                            </p>
                                            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                                                {level === 'summary' ? t.partner.shareLevel.summaryDesc : t.partner.shareLevel.fullDesc}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}
