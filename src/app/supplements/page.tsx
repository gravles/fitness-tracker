'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import { Pill, Plus, Pencil, Trash2, CircleStop, CheckCircle2, XCircle, CalendarClock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    getSupplements, deleteSupplement, cancelFutureDoses, logAdhocDose,
    getTodaysDoses, getDosesForRange, markDoseTaken, skipDose, undoDose,
    formatDose, Supplement, SupplementDose,
} from '@/lib/supplement-api';
import { SupplementModal } from '@/components/SupplementModal';
import { DoseRow } from '@/components/SupplementDosesCard';
import { confirm } from '@/components/ConfirmDialog';
import { useTabParam } from '@/lib/useTabParam';
import { haptics } from '@/lib/haptics';

const TABS = [
    { key: 'today', label: 'Today' },
    { key: 'stack', label: 'My Stack' },
    { key: 'history', label: 'History' },
] as const;

const HISTORY_DAYS = 30;

/** taken / (taken + skipped + past-due planned); null when nothing is past due. */
function adherencePct(doses: SupplementDose[], today: string): number | null {
    let taken = 0, denom = 0;
    for (const d of doses) {
        if (d.status === 'taken') { taken++; denom++; }
        else if (d.status === 'skipped') denom++;
        else if (d.scheduled_date < today) denom++; // planned but missed
    }
    return denom ? Math.round((100 * taken) / denom) : null;
}

export default function SupplementsPage() {
    const [tab, setTab] = useTabParam(TABS.map(t => t.key), 'today');
    const today = format(new Date(), 'yyyy-MM-dd');

    const [supplements, setSupplements] = useState<Supplement[]>([]);
    const [todayDoses, setTodayDoses] = useState<SupplementDose[]>([]);
    const [historyDoses, setHistoryDoses] = useState<SupplementDose[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [modal, setModal] = useState<Supplement | 'new' | null>(null);

    const loadAll = useCallback(async () => {
        try {
            const [supps, doses, history] = await Promise.all([
                getSupplements(),
                getTodaysDoses(),
                getDosesForRange(format(subDays(new Date(), HISTORY_DAYS - 1), 'yyyy-MM-dd'), today),
            ]);
            setSupplements(supps);
            setTodayDoses(doses);
            setHistoryDoses(history);
        } catch (e) {
            console.error('Error loading supplements:', e);
        } finally {
            setLoading(false);
        }
    }, [today]);

    useEffect(() => { loadAll(); }, [loadAll]);

    async function mutateDose(dose: SupplementDose, action: () => Promise<SupplementDose>) {
        haptics.tap();
        setBusyId(dose.id);
        try {
            const updated = await action();
            const apply = (list: SupplementDose[]) => list.map(d => d.id === dose.id ? updated : d);
            setTodayDoses(apply);
            setHistoryDoses(apply);
        } catch {
            toast.error('Failed to update dose');
        } finally {
            setBusyId(null);
        }
    }

    async function handleLogNow(supp: Supplement) {
        haptics.tap();
        setBusyId(supp.id);
        try {
            const dose = await logAdhocDose({ supplement: supp });
            setTodayDoses(prev => [...prev, dose]);
            setHistoryDoses(prev => [...prev, dose]);
            toast.success(`${supp.name} logged`);
        } catch {
            toast.error('Failed to log dose');
        } finally {
            setBusyId(null);
        }
    }

    async function handleStop(supp: Supplement) {
        const ok = await confirm({
            title: `Stop ${supp.name}?`,
            message: 'This removes all remaining scheduled doses. Past history and the entry itself are kept.',
            confirmLabel: 'Stop',
            danger: true,
        });
        if (!ok) return;
        try {
            await cancelFutureDoses(supp.id, today);
            toast.success(`${supp.name} stopped`);
            loadAll();
        } catch {
            toast.error('Failed to stop schedule');
        }
    }

    async function handleDelete(supp: Supplement) {
        const ok = await confirm({
            title: `Delete ${supp.name}?`,
            message: 'This removes it from your stack. Past dose history is kept, but unscheduled future doses are not removed automatically — use Stop first if it is still scheduled.',
            danger: true,
        });
        if (!ok) return;
        try {
            await cancelFutureDoses(supp.id, today);
            await deleteSupplement(supp.id);
            toast.success(`${supp.name} deleted`);
            loadAll();
        } catch {
            toast.error('Failed to delete');
        }
    }

    // History grouped by day, newest first
    const historyByDay = new Map<string, SupplementDose[]>();
    for (const d of historyDoses) {
        const list = historyByDay.get(d.scheduled_date) ?? [];
        list.push(d);
        historyByDay.set(d.scheduled_date, list);
    }
    const historyDays = [...historyByDay.keys()].sort().reverse();
    const overallAdherence = adherencePct(historyDoses, today);

    return (
        <main className="p-6 pt-12 pb-28 space-y-5 max-w-2xl mx-auto">
            <header className="flex items-start justify-between gap-3">
                <div>
                    <h1
                        className="text-2xl font-semibold"
                        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
                    >
                        Supplements & Meds
                    </h1>
                    <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                        Doses, schedules & reminders
                    </p>
                </div>
                <button
                    onClick={() => setModal('new')}
                    aria-label="Add supplement or medication"
                    className="p-3 rounded-full transition-all active:scale-95 shadow-sm focus-ring tap-target"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                >
                    <Plus className="w-5 h-5" aria-hidden="true" />
                </button>
            </header>

            {/* Tabs */}
            <div
                className="flex rounded-xl p-1 border"
                role="tablist"
                style={{ background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-light)' }}
            >
                {TABS.map(({ key, label }) => (
                    <button
                        key={key}
                        role="tab"
                        aria-selected={tab === key}
                        onClick={() => setTab(key)}
                        className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all"
                        style={tab === key
                            ? { background: 'var(--color-surface-elevated)', color: 'var(--color-text)', boxShadow: 'var(--shadow-sm, 0 1px 2px rgb(0 0 0 / 0.08))' }
                            : { color: 'var(--color-text-muted)' }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-text-muted)' }} aria-label="Loading" />
                </div>
            ) : (
                <>
                    {/* ── Today ── */}
                    {tab === 'today' && (
                        todayDoses.length === 0 ? (
                            <EmptyState
                                text={supplements.length === 0
                                    ? 'Nothing here yet. Add a supplement or medication to start tracking doses.'
                                    : 'No doses scheduled for today.'}
                                actionLabel={supplements.length === 0 ? 'Add your first' : undefined}
                                onAction={() => setModal('new')}
                            />
                        ) : (
                            <div className="space-y-2">
                                {todayDoses.map(dose => (
                                    <DoseRow
                                        key={dose.id}
                                        dose={dose}
                                        busy={busyId === dose.id}
                                        onTake={() => mutateDose(dose, () => markDoseTaken(dose.id))}
                                        onSkip={() => mutateDose(dose, () => skipDose(dose.id))}
                                        onUndo={() => mutateDose(dose, () => undoDose(dose.id))}
                                    />
                                ))}
                            </div>
                        )
                    )}

                    {/* ── My Stack ── */}
                    {tab === 'stack' && (
                        supplements.length === 0 ? (
                            <EmptyState
                                text="Your stack is empty. Add the supplements and medications you take."
                                actionLabel="Add your first"
                                onAction={() => setModal('new')}
                            />
                        ) : (
                            <div className="space-y-2">
                                {supplements.map(supp => {
                                    const doseLabel = formatDose(supp);
                                    return (
                                        <div
                                            key={supp.id}
                                            className="p-3 rounded-xl border space-y-2"
                                            style={{ borderColor: 'var(--color-border-light)', background: 'var(--color-surface-elevated)' }}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="font-bold text-sm text-[var(--color-text)] truncate">{supp.name}</p>
                                                        {supp.kind === 'medication' && (
                                                            <span
                                                                className="px-1.5 py-px rounded-md text-[10px] font-bold flex-shrink-0"
                                                                style={{ background: 'var(--color-gold-muted)', color: 'var(--color-gold-text)' }}
                                                            >
                                                                Rx
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                                                        {[doseLabel, supp.form, supp.notes].filter(Boolean).join(' · ') || '—'}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleLogNow(supp)}
                                                    disabled={busyId === supp.id}
                                                    className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                                                    style={{ background: 'var(--color-primary)', color: 'white' }}
                                                >
                                                    {busyId === supp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Log dose'}
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                                                <button onClick={() => setModal(supp)} className="flex items-center gap-1 hover:text-[var(--color-text)]">
                                                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Edit
                                                </button>
                                                <button onClick={() => handleStop(supp)} className="flex items-center gap-1 hover:text-[var(--color-text)]">
                                                    <CircleStop className="w-3.5 h-3.5" aria-hidden="true" /> Stop
                                                </button>
                                                <button onClick={() => handleDelete(supp)} className="flex items-center gap-1 hover:text-[var(--color-danger)]">
                                                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Delete
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}

                    {/* ── History ── */}
                    {tab === 'history' && (
                        historyDoses.length === 0 ? (
                            <EmptyState text="No dose history yet — it shows up here once you start logging." />
                        ) : (
                            <div className="space-y-4">
                                {overallAdherence !== null && (
                                    <div
                                        className="p-4 rounded-xl border flex items-center justify-between"
                                        style={{ borderColor: 'var(--color-border-light)', background: 'var(--color-surface-elevated)' }}
                                    >
                                        <span className="text-sm font-semibold text-[var(--color-text)]">Adherence · last {HISTORY_DAYS} days</span>
                                        <span className="text-xl font-bold tabular-nums" style={{ color: 'var(--color-success)' }}>{overallAdherence}%</span>
                                    </div>
                                )}
                                {historyDays.map(date => (
                                    <section key={date} aria-label={date}>
                                        <h2 className="text-xs font-bold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--color-text-muted)' }}>
                                            {date === today ? 'Today' : format(new Date(date + 'T00:00:00'), 'EEE, MMM d')}
                                        </h2>
                                        <div className="space-y-1.5">
                                            {(historyByDay.get(date) ?? []).map(dose => (
                                                <div
                                                    key={dose.id}
                                                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-sm"
                                                    style={{ borderColor: 'var(--color-border-light)', background: 'var(--color-bg-subtle)' }}
                                                >
                                                    <div className="min-w-0 flex-1 flex items-center gap-2">
                                                        {dose.status === 'taken' && <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-success)' }} aria-label="Taken" />}
                                                        {dose.status === 'skipped' && <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} aria-label="Skipped" />}
                                                        {dose.status === 'planned' && <CalendarClock className="w-4 h-4 flex-shrink-0" style={{ color: dose.scheduled_date < today ? 'var(--color-danger)' : 'var(--color-text-muted)' }} aria-label={dose.scheduled_date < today ? 'Missed' : 'Planned'} />}
                                                        <span className="font-semibold text-[var(--color-text)] truncate">{dose.name}</span>
                                                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>{formatDose(dose)}</span>
                                                    </div>
                                                    <span className="text-xs flex-shrink-0 tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                                                        {dose.scheduled_time?.slice(0, 5) ?? (dose.taken_at ? format(new Date(dose.taken_at), 'HH:mm') : '—')}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        )
                    )}
                </>
            )}

            <p className="text-[11px] leading-snug text-center pt-2" style={{ color: 'var(--color-text-muted)' }}>
                For personal tracking only — not medical advice. Follow your prescriber&apos;s directions.
            </p>

            {modal !== null && (
                <SupplementModal
                    supplement={modal === 'new' ? null : modal}
                    onClose={() => setModal(null)}
                    onSaved={() => { setModal(null); loadAll(); }}
                />
            )}
        </main>
    );
}

function EmptyState({ text, actionLabel, onAction }: { text: string; actionLabel?: string; onAction?: () => void }) {
    return (
        <div
            className="rounded-2xl border p-8 text-center space-y-3"
            style={{ borderColor: 'var(--color-border-light)', background: 'var(--color-surface-elevated)' }}
        >
            <Pill className="w-8 h-8 mx-auto" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{text}</p>
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
