'use client';

import { useState, useEffect } from 'react';
import { Scale, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getEarliestWeightEntries, setBodyWeightForDate, BodyMetrics, isAuthError } from '@/lib/api';
import { useLanguage } from '@/components/LanguageProvider';
import { confirm } from '@/components/ConfirmDialog';

const LB_PER_KG = 2.20462;

interface StartingWeightSectionProps {
    weightUnit: 'imperial' | 'metric';
}

/**
 * Shows the user's first weigh-in (the baseline every weight trend is measured
 * from) and lets them correct or remove it. body_metrics.weight is stored in lbs.
 */
export function StartingWeightSection({ weightUnit }: StartingWeightSectionProps) {
    const { t, lang } = useLanguage();
    const [entries, setEntries] = useState<BodyMetrics[] | null>(null);
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState('');
    const [busy, setBusy] = useState(false);

    const unitLabel = weightUnit === 'metric' ? 'kg' : 'lbs';
    const toDisplay = (lbs: number) =>
        weightUnit === 'metric' ? Math.round((lbs / LB_PER_KG) * 10) / 10 : Math.round(lbs * 10) / 10;
    const toLbs = (v: number) =>
        weightUnit === 'metric' ? Math.round(v * LB_PER_KG * 10) / 10 : v;

    async function load() {
        try {
            setEntries(await getEarliestWeightEntries(2));
        } catch (error) {
            if (!isAuthError(error)) console.error(error);
            setEntries([]);
        }
    }

    useEffect(() => { load(); }, []);

    const first = entries?.[0];
    if (!first || first.weight == null) return null;

    const firstWeight = first.weight;
    const next = entries?.[1]?.weight ?? null;
    // Older onboarding saved the first weigh-in in kg while everything else is lbs
    const kgFixLbs = Math.round(firstWeight * LB_PER_KG * 10) / 10;
    const looksLikeKg = next !== null && Math.abs(kgFixLbs - next) / next < 0.05;

    const dateLabel = new Date(first.date + 'T00:00:00').toLocaleDateString(
        lang === 'fr' ? 'fr-FR' : 'en-US',
        { month: 'short', day: 'numeric', year: 'numeric' },
    );

    async function save(weightLbs: number | null, successMsg: string) {
        setBusy(true);
        try {
            await setBodyWeightForDate(first!.date, weightLbs);
            toast.success(successMsg);
            setEditing(false);
            setValue('');
            await load();
        } catch (error) {
            console.error(error);
            toast.error(t.settings.targets.startingWeightFailed);
        } finally {
            setBusy(false);
        }
    }

    function handleSave() {
        const parsed = parseFloat(value);
        if (!parsed || parsed <= 0) return;
        save(toLbs(parsed), t.settings.targets.startingWeightUpdated);
    }

    async function handleRemove() {
        const ok = await confirm({
            title: t.settings.targets.removeConfirmTitle,
            message: t.settings.targets.removeConfirm.replace('{date}', dateLabel),
            confirmLabel: t.common.remove,
            danger: true,
        });
        if (ok) save(null, t.settings.targets.startingWeightRemoved);
    }

    return (
        <div className="pt-4 space-y-3" style={{ borderTop: '1px solid var(--color-border-light)' }}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-muted)' }}>
                        {t.settings.targets.startingWeight}
                    </p>
                    <p className="font-bold text-lg flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                        <Scale className="w-4 h-4" style={{ color: 'var(--color-gold)' }} aria-hidden="true" />
                        {toDisplay(firstWeight)} {unitLabel}
                        <span className="text-sm font-normal" style={{ color: 'var(--color-text-muted)' }}>· {dateLabel}</span>
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        {t.settings.targets.startingWeightDesc}
                    </p>
                </div>
            </div>

            {looksLikeKg && !editing && (
                <div
                    className="p-3 rounded-xl flex items-start gap-2 text-sm"
                    style={{ background: 'var(--color-gold-muted)', color: 'var(--color-text)' }}
                >
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-gold)' }} aria-hidden="true" />
                    <div className="space-y-2">
                        <p>{t.settings.targets.looksLikeKg.replace('{next}', `${toDisplay(next!)} ${unitLabel}`)}</p>
                        <button
                            onClick={() => save(kgFixLbs, t.settings.targets.startingWeightUpdated)}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-lg font-bold text-xs disabled:opacity-60"
                            style={{ background: 'var(--color-gold)', color: 'var(--color-navy)' }}
                        >
                            {t.settings.targets.fixTo.replace('{value}', `${toDisplay(kgFixLbs)} ${unitLabel}`)}
                        </button>
                    </div>
                </div>
            )}

            {editing ? (
                <div className="space-y-3">
                    <div>
                        <label
                            htmlFor="starting-weight-input"
                            className="block text-xs font-bold uppercase tracking-widest mb-1.5"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            {t.settings.targets.correctWeight} ({unitLabel})
                        </label>
                        <input
                            id="starting-weight-input"
                            type="number"
                            inputMode="decimal"
                            autoFocus
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            className="w-full p-3 rounded-xl outline-none"
                            style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={busy || !(parseFloat(value) > 0)}
                            className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                            style={{ background: 'var(--color-primary)', color: 'white' }}
                        >
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t.common.save}
                        </button>
                        <button
                            onClick={() => { setEditing(false); setValue(''); }}
                            disabled={busy}
                            className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                            style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text)' }}
                        >
                            {t.common.cancel}
                        </button>
                    </div>
                    <button
                        onClick={handleRemove}
                        disabled={busy}
                        className="w-full text-sm font-medium py-1"
                        style={{ color: 'var(--color-danger, #e5484d)' }}
                    >
                        {t.settings.targets.removeStartingWeight}
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => { setValue(String(toDisplay(firstWeight))); setEditing(true); }}
                    className="w-full py-2.5 rounded-xl font-bold text-sm border"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                >
                    {t.settings.targets.resetStartingWeight}
                </button>
            )}
        </div>
    );
}
