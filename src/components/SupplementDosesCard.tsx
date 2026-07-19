'use client';

import { useState, useEffect } from 'react';
import { Pill, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getTodaysDoses, markDoseTaken, skipDose, undoDose, formatDose, SupplementDose } from '@/lib/supplement-api';
import { haptics } from '@/lib/haptics';
import { useLanguage } from '@/components/LanguageProvider';
import { Card } from '@/components/ui';

/** One scheduled dose with a one-tap "take" action.
 *  Shared between the dashboard card and the Supplements page. */
export function DoseRow({
    dose,
    busy,
    onTake,
    onSkip,
    onUndo,
}: {
    dose: SupplementDose;
    busy: boolean;
    onTake: () => void;
    onSkip?: () => void;
    onUndo?: () => void;
}) {
    const { t } = useLanguage();
    const doseLabel = formatDose(dose);

    return (
        <div
            className="flex items-center justify-between gap-3 p-3 rounded-xl border"
            style={{ borderColor: 'var(--color-border-light)', background: 'var(--color-bg-subtle)' }}
        >
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                    {dose.scheduled_time ? <span>{dose.scheduled_time.slice(0, 5)}</span> : <span>As needed</span>}
                    {dose.kind === 'medication' && (
                        <span
                            className="px-1.5 py-px rounded-md font-bold"
                            style={{ background: 'var(--color-gold-muted)', color: 'var(--color-gold-text)' }}
                        >
                            Rx
                        </span>
                    )}
                </div>
                <p className="font-bold text-sm text-[var(--color-text)] truncate mt-0.5">{dose.name}</p>
                {(doseLabel || dose.notes) && (
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {doseLabel}{doseLabel && dose.notes ? ' · ' : ''}{dose.notes ?? ''}
                    </p>
                )}
            </div>

            {dose.status === 'planned' && (
                <div className="flex-shrink-0 flex items-center gap-1.5">
                    {onSkip && (
                        <button
                            onClick={onSkip}
                            disabled={busy}
                            aria-label={`Skip ${dose.name}`}
                            className="px-2.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                            style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-light)' }}
                        >
                            {t.dashboard.doseSkip}
                        </button>
                    )}
                    <button
                        onClick={onTake}
                        disabled={busy}
                        aria-label={`Mark ${dose.name} taken`}
                        className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
                        style={{ background: 'var(--color-primary)', color: 'white' }}
                    >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.dashboard.doseTake}
                    </button>
                </div>
            )}
            {dose.status === 'taken' && (
                <button
                    onClick={onUndo}
                    disabled={busy || !onUndo}
                    className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold"
                    style={{ color: 'var(--color-success)' }}
                    aria-label={onUndo ? `Undo ${dose.name}` : undefined}
                >
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> {t.dashboard.doseTaken}
                </button>
            )}
            {dose.status === 'skipped' && (
                <button
                    onClick={onUndo}
                    disabled={busy || !onUndo}
                    className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold"
                    style={{ color: 'var(--color-text-muted)' }}
                    aria-label={onUndo ? `Undo ${dose.name}` : undefined}
                >
                    <XCircle className="w-4 h-4" aria-hidden="true" /> {t.dashboard.doseSkipped}
                </button>
            )}
        </div>
    );
}

export function SupplementDosesCard({ stagger }: { stagger?: number }) {
    const { t } = useLanguage();
    const [doses, setDoses] = useState<SupplementDose[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => {
        getTodaysDoses()
            .then(setDoses)
            .catch(err => console.error('Error loading supplement doses:', err))
            .finally(() => setLoading(false));
    }, []);

    async function mutate(dose: SupplementDose, action: () => Promise<SupplementDose>) {
        haptics.tap();
        setBusyId(dose.id);
        try {
            const updated = await action();
            setDoses(prev => prev.map(d => d.id === dose.id ? updated : d));
        } catch {
            toast.error('Failed to update dose');
        } finally {
            setBusyId(null);
        }
    }

    if (loading || doses.length === 0) return null;

    return (
        <Card stagger={stagger} aria-label={t.dashboard.supplementDoses}>
            <div className="flex items-center gap-2 mb-3">
                <Pill className="w-4 h-4" style={{ color: 'var(--color-success)' }} aria-hidden="true" />
                <h3 className="font-semibold text-sm text-[var(--color-text)] uppercase tracking-wide">{t.dashboard.supplementDoses}</h3>
            </div>

            <div className="space-y-2">
                {doses.map(dose => (
                    <DoseRow
                        key={dose.id}
                        dose={dose}
                        busy={busyId === dose.id}
                        onTake={() => mutate(dose, () => markDoseTaken(dose.id).then(d => { toast.success(`${dose.name} taken!`); return d; }))}
                        onSkip={() => mutate(dose, () => skipDose(dose.id))}
                        onUndo={() => mutate(dose, () => undoDose(dose.id))}
                    />
                ))}
            </div>
        </Card>
    );
}
