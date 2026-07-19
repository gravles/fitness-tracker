'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import { Gauge, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/LanguageProvider';
import { Modal } from '@/components/ui/Modal';
import { getMonthlyLogs, getWorkoutsRange, upsertDailyLog, DailyLog } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { computeReadiness, Readiness, ReadinessSleepRecord } from '@/lib/readiness';

const BAND_COLOR: Record<Readiness['label'], string> = {
    primed: 'var(--color-gold)',
    ready: 'var(--color-primary)',
    steady: 'var(--color-text-muted)',
    recovery: 'var(--color-danger)',
};

/**
 * Morning check-in + readiness card. The modal auto-opens on the first visit
 * of the day when sleep hasn't been logged yet (skippable, once per day);
 * the card shows the same readiness score the watch displays, with the
 * component breakdown behind a "why?" toggle.
 */
export function ReadinessCheckIn({ onLogged }: { onLogged?: () => void }) {
    const { t } = useLanguage();
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    const [readiness, setReadiness] = useState<Readiness | null>(null);
    const [todaySteps, setTodaySteps] = useState<number | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [showWhy, setShowWhy] = useState(false);
    const [saving, setSaving] = useState(false);

    const [sleep, setSleep] = useState(3);
    const [energy, setEnergy] = useState(3);
    const [drinks, setDrinks] = useState(0);
    const [storedDrinks, setStoredDrinks] = useState<number | null>(null);
    const [drinksTouched, setDrinksTouched] = useState(false);

    const skipKey = `readiness-checkin-skipped`;

    const load = useCallback(async (openIfUnlogged: boolean) => {
        try {
            const start = format(subDays(new Date(), 27), 'yyyy-MM-dd');
            const [logs, workouts, sleepRes] = await Promise.all([
                getMonthlyLogs(start, today),
                getWorkoutsRange(start, today),
                supabase
                    .from('sleep_records')
                    .select('duration_minutes,deep_minutes,rem_minutes')
                    .eq('date', today)
                    .order('duration_minutes', { ascending: false })
                    .limit(1)
                    .maybeSingle(),
            ]);
            const sleepRecord = (sleepRes.data as ReadinessSleepRecord | null) ?? null;
            setReadiness(computeReadiness(logs, workouts, today, sleepRecord));

            const todayLog = logs.find((l: DailyLog) => l.date === today);
            const yesterdayLog = logs.find((l: DailyLog) => l.date === yesterday);
            setTodaySteps(todayLog?.steps ?? null);
            if (todayLog?.sleep_quality) setSleep(todayLog.sleep_quality);
            if (todayLog?.energy_level) setEnergy(todayLog.energy_level);
            // Carry yesterday's drinks over as the starting value
            if (yesterdayLog?.alcohol_drinks != null) {
                setDrinks(yesterdayLog.alcohol_drinks);
                setStoredDrinks(yesterdayLog.alcohol_drinks);
            }

            const skippedToday = typeof window !== 'undefined' && localStorage.getItem(skipKey) === today;
            if (openIfUnlogged && !todayLog?.sleep_quality && !skippedToday) {
                setShowModal(true);
            }
        } catch {
            // Readiness is a bonus — never block the dashboard on it
        }
    }, [today, yesterday, skipKey]);

    useEffect(() => { load(true); }, [load]);

    async function save() {
        setSaving(true);
        try {
            await upsertDailyLog({ date: today, sleep_quality: sleep, energy_level: energy });
            if (drinksTouched || drinks !== (storedDrinks ?? 0)) {
                await upsertDailyLog({ date: yesterday, alcohol_drinks: drinks });
            }
            setShowModal(false);
            await load(false);
            onLogged?.();
        } catch (e: any) {
            toast.error(e?.message || 'Could not save');
        } finally {
            setSaving(false);
        }
    }

    function skip() {
        if (typeof window !== 'undefined') localStorage.setItem(skipKey, today);
        setShowModal(false);
    }

    const tr = t.dashboard.readiness;

    return (
        <>
            {readiness && (
                <div
                    className="p-4 rounded-2xl border shadow-sm"
                    style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-light)' }}
                >
                    <div className="flex items-center gap-4">
                        <ScoreRing score={readiness.score} color={BAND_COLOR[readiness.label]} />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <Gauge className="w-4 h-4" style={{ color: BAND_COLOR[readiness.label] }} />
                                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                                    {tr.cardTitle}
                                </p>
                                <span className="text-xs font-bold" style={{ color: BAND_COLOR[readiness.label] }}>
                                    {tr.labels[readiness.label]}
                                </span>
                            </div>
                            <p className="text-sm mt-1" style={{ color: 'var(--color-text)' }}>
                                {readiness.recommendation}
                                {todaySteps != null && (
                                    <span style={{ color: 'var(--color-text-muted)' }}>
                                        {' '}· {todaySteps.toLocaleString()} steps today
                                    </span>
                                )}
                            </p>
                            {readiness.components.length > 0 && (
                                <button
                                    onClick={() => setShowWhy(v => !v)}
                                    className="text-xs mt-1 flex items-center gap-1 font-bold"
                                    style={{ color: 'var(--color-text-muted)' }}
                                >
                                    {tr.why} {showWhy ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                            )}
                        </div>
                    </div>
                    {showWhy && (
                        <div className="mt-3 space-y-1 pl-1">
                            {readiness.components.map(c => (
                                <div key={c.name} className="flex justify-between text-xs">
                                    <span style={{ color: 'var(--color-text-muted)' }}>{c.detail}</span>
                                    <span
                                        className="font-mono font-bold"
                                        style={{ color: c.delta >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
                                    >
                                        {c.delta >= 0 ? '+' : ''}{c.delta}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <Modal isOpen={showModal} onClose={skip} title={tr.title} size="sm">
                <div className="space-y-4">
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{tr.subtitle}</p>

                    <RatingRow label={tr.sleep} value={sleep} onChange={setSleep} />
                    <RatingRow label={tr.energy} value={energy} onChange={setEnergy} />

                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>
                            {tr.drinks}
                        </p>
                        <div className="flex items-center gap-3">
                            <StepButton label="−" onClick={() => { setDrinks(d => Math.max(0, d - 1)); setDrinksTouched(true); }} />
                            <span className="text-lg font-bold w-8 text-center" style={{ color: 'var(--color-text)' }}>{drinks}</span>
                            <StepButton label="+" onClick={() => { setDrinks(d => Math.min(15, d + 1)); setDrinksTouched(true); }} />
                        </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={save}
                            disabled={saving}
                            className="flex-1 py-2.5 rounded-xl font-bold transition-all active:scale-[0.98] disabled:opacity-60"
                            style={{ background: 'var(--color-primary)', color: 'white' }}
                        >
                            {tr.save}
                        </button>
                        <button
                            onClick={skip}
                            className="px-4 py-2.5 rounded-xl font-bold border"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                        >
                            {tr.skip}
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
}

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    return (
        <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>
                {label}
            </p>
            <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                    <button
                        key={n}
                        onClick={() => onChange(n)}
                        className="flex-1 py-2 rounded-xl font-bold text-sm border transition-all active:scale-[0.96]"
                        style={
                            value === n
                                ? { background: 'var(--color-primary)', color: 'white', borderColor: 'transparent' }
                                : { background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)', borderColor: 'var(--color-border-light)' }
                        }
                        aria-pressed={value === n}
                    >
                        {n}
                    </button>
                ))}
            </div>
        </div>
    );
}

function StepButton({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="w-10 h-10 rounded-full font-bold text-lg border transition-all active:scale-[0.94]"
            style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text)', borderColor: 'var(--color-border-light)' }}
        >
            {label}
        </button>
    );
}

function ScoreRing({ score, color }: { score: number; color: string }) {
    const r = 26;
    const c = 2 * Math.PI * r;
    return (
        <svg width="68" height="68" viewBox="0 0 68 68" role="img" aria-label={`Readiness ${score}`}>
            <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeOpacity="0.18" strokeWidth="6" />
            <circle
                cx="34" cy="34" r={r} fill="none"
                stroke={color} strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${(score / 100) * c} ${c}`}
                transform="rotate(-90 34 34)"
            />
            <text x="34" y="39" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--color-text)">
                {score}
            </text>
        </svg>
    );
}
