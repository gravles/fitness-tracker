'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Loader2, Trophy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { useLanguage } from '@/components/LanguageProvider';
import { Card, Button, Input, Select } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import {
    Partnership, ChallengeType,
    getPartnerships, createChallenge,
} from '@/lib/partner-api';

export default function NewChallengePage() {
    const { t } = useLanguage();
    const router = useRouter();
    const [partners, setPartners] = useState<Partnership[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    const [name, setName] = useState('');
    const [challengeType, setChallengeType] = useState<ChallengeType>('streak');
    const [targetValue, setTargetValue] = useState('7');
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
    const [isAnonymous, setIsAnonymous] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        getPartnerships()
            .then(all => {
                const active = all.filter(p => p.status === 'active' && p.otherUserId);
                setPartners(active);
                if (active.length === 1) setSelectedIds(new Set([active[0].id]));
            })
            .catch(() => setPartners([]))
            .finally(() => setLoading(false));
    }, []);

    function toggle(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else if (next.size < 7) next.add(id);
            return next;
        });
    }

    const valid = name.trim().length > 0
        && Number(targetValue) > 0
        && startDate && endDate && endDate >= startDate
        && selectedIds.size >= 1;

    async function handleCreate() {
        if (!valid) return;
        setCreating(true);
        haptics.tap();
        try {
            const id = await createChallenge({
                name: name.trim(),
                challengeType,
                targetValue: Number(targetValue),
                startDate,
                endDate,
                isAnonymous,
                partnershipIds: Array.from(selectedIds),
            });
            haptics.success();
            router.push(`/partner/challenges/${id}`);
        } catch (error: any) {
            haptics.error();
            toast.error(error.message || 'Failed to create challenge');
            setCreating(false);
        }
    }

    return (
        <main className="min-h-screen bg-[var(--color-bg)] pb-24">
            <header className="sticky top-0 z-40 bg-[var(--color-surface)]/80 backdrop-blur-lg border-b border-[var(--color-border)]">
                <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/partner" className="p-2 -ml-2 rounded-full hover:bg-[var(--color-surface-elevated)]">
                        <ChevronLeft className="w-5 h-5 text-[var(--color-text)]" />
                    </Link>
                    <h1 className="font-bold text-[var(--color-text)]">{t.partner.challenges.create}</h1>
                    <div className="w-9" />
                </div>
            </header>

            <div className="max-w-md mx-auto px-4 py-6 space-y-5">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
                    </div>
                ) : partners.length === 0 ? (
                    <div className="text-center py-16">
                        <Trophy className="w-14 h-14 mx-auto text-[var(--color-text-muted)] mb-4" />
                        <p className="text-sm text-[var(--color-text-muted)]">{t.partner.share.noPartners}</p>
                    </div>
                ) : (
                    <>
                        <Card className="space-y-4">
                            <Input
                                label={t.partner.challenges.name}
                                placeholder="30-day logging streak"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                            <Select
                                label={t.partner.challenges.typeLabel}
                                value={challengeType}
                                onChange={e => setChallengeType(e.target.value as ChallengeType)}
                            >
                                <option value="streak">{t.partner.challenges.types.streak}</option>
                                <option value="protein_days">{t.partner.challenges.types.proteinDays}</option>
                                <option value="workout_count">{t.partner.challenges.types.workoutCount}</option>
                            </Select>
                            <Input
                                label={t.partner.challenges.target}
                                type="number"
                                inputMode="numeric"
                                min={1}
                                value={targetValue}
                                onChange={e => setTargetValue(e.target.value)}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label={t.partner.challenges.startDate}
                                    type="date"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                />
                                <Input
                                    label={t.partner.challenges.endDate}
                                    type="date"
                                    value={endDate}
                                    min={startDate}
                                    onChange={e => setEndDate(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={() => setIsAnonymous(!isAnonymous)}
                                className="w-full flex items-center justify-between p-3 rounded-xl border text-left"
                                style={{
                                    borderColor: isAnonymous ? 'var(--color-gold-border)' : 'var(--color-border-light)',
                                    background: isAnonymous ? 'var(--color-gold-muted)' : 'var(--color-bg-subtle)',
                                }}
                            >
                                <div>
                                    <p className="text-sm font-semibold text-[var(--color-text)]">{t.partner.challenges.anonymous}</p>
                                    <p className="text-[11px] text-[var(--color-text-muted)]">{t.partner.challenges.anonymousDesc}</p>
                                </div>
                                {isAnonymous && <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--color-gold-text)' }} />}
                            </button>
                        </Card>

                        <section>
                            <h2 className="text-sm font-bold text-[var(--color-text)] mb-3">
                                {t.partner.challenges.inviteMembers}
                            </h2>
                            <div className="space-y-2">
                                {partners.map(p => {
                                    const selected = selectedIds.has(p.id);
                                    return (
                                        <button
                                            key={p.id}
                                            onClick={() => toggle(p.id)}
                                            className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                                                selected
                                                    ? 'border-[var(--color-gold)] bg-[var(--color-gold-muted)]'
                                                    : 'border-[var(--color-border-light)] bg-[var(--color-surface-elevated)]'
                                            }`}
                                        >
                                            <span className="text-sm font-semibold text-[var(--color-text)] truncate">
                                                {p.otherName || p.invitee_email}
                                            </span>
                                            {selected && <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--color-gold-text)' }} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        <Button fullWidth disabled={!valid || creating} onClick={handleCreate}>
                            {creating
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <><Trophy className="w-4 h-4" /> {t.partner.challenges.createBtn}</>}
                        </Button>
                    </>
                )}
            </div>
        </main>
    );
}
