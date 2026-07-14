'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Loader2, Trophy, Medal, LogOut, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { useLanguage } from '@/components/LanguageProvider';
import { Card, Button } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { confirm } from '@/components/ConfirmDialog';
import { ChallengeDetail, getChallengeDetail, respondToChallenge } from '@/lib/partner-api';

export default function ChallengeDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const { t } = useLanguage();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState<ChallengeDetail | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            setDetail(await getChallengeDetail(id));
        } catch (error: any) {
            toast.error(error.message || 'Failed to load challenge');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    async function handleAction(action: 'join' | 'decline' | 'leave' | 'cancel') {
        if (action === 'leave' || action === 'cancel') {
            const ok = await confirm({
                title: t.partner.challenges.leave,
                message: action === 'cancel'
                    ? 'Cancel this challenge for everyone?'
                    : 'Leave this challenge? Your progress will no longer count.',
                danger: true,
            });
            if (!ok) return;
        }
        setBusy(true);
        haptics.tap();
        try {
            await respondToChallenge(id, action);
            if (action === 'decline' || action === 'leave' || action === 'cancel') {
                router.push('/partner');
                return;
            }
            haptics.success();
            await load();
        } catch (error: any) {
            haptics.error();
            toast.error(error.message || 'Something went wrong');
        } finally {
            setBusy(false);
        }
    }

    const c = detail?.challenge;
    const statusLabel = c?.status === 'upcoming' ? t.partner.challenges.statusUpcoming
        : c?.status === 'completed' ? t.partner.challenges.statusCompleted
        : t.partner.challenges.statusActive;
    const typeLabel = c?.challengeType === 'streak' ? t.partner.challenges.types.streak
        : c?.challengeType === 'protein_days' ? t.partner.challenges.types.proteinDays
        : t.partner.challenges.types.workoutCount;

    return (
        <main className="min-h-screen bg-[var(--color-bg)] pb-24">
            <header className="sticky top-0 z-40 bg-[var(--color-surface)]/80 backdrop-blur-lg border-b border-[var(--color-border)]">
                <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/partner" className="p-2 -ml-2 rounded-full hover:bg-[var(--color-surface-elevated)]">
                        <ChevronLeft className="w-5 h-5 text-[var(--color-text)]" />
                    </Link>
                    <h1 className="font-bold text-[var(--color-text)] truncate">{c?.name ?? '…'}</h1>
                    <div className="w-9" />
                </div>
            </header>

            <div className="max-w-md mx-auto px-4 py-6 space-y-6">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
                    </div>
                ) : !detail || !c ? null : (
                    <>
                        <Card>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-full bg-[var(--color-gold-muted)] flex items-center justify-center shrink-0">
                                    <Trophy className="w-5 h-5" style={{ color: 'var(--color-gold-text)' }} />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-sm text-[var(--color-text)]">{typeLabel} · {statusLabel}</p>
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                        {format(parseISO(c.startDate), 'MMM d')} – {format(parseISO(c.endDate), 'MMM d')}
                                        {' · '}{t.partner.challenges.target}: {c.targetValue}
                                    </p>
                                </div>
                            </div>
                            {c.description && (
                                <p className="text-xs text-[var(--color-text-secondary)]">{c.description}</p>
                            )}
                        </Card>

                        {detail.myStatus === 'invited' && (
                            <div className="flex gap-2">
                                <Button fullWidth disabled={busy} onClick={() => handleAction('join')}>
                                    {t.partner.challenges.join}
                                </Button>
                                <Button fullWidth variant="ghost" disabled={busy} onClick={() => handleAction('decline')}>
                                    {t.partner.challenges.decline}
                                </Button>
                            </div>
                        )}

                        <section>
                            <h2 className="text-sm font-bold text-[var(--color-text)] mb-3">
                                {t.partner.challenges.leaderboard}
                            </h2>
                            <div className="space-y-2">
                                {detail.leaderboard.map((row, i) => {
                                    const pct = Math.min(100, Math.round((row.progress / c.targetValue) * 100));
                                    return (
                                        <Card
                                            key={`${row.alias}-${i}`}
                                            padding="sm"
                                            className={row.isMe ? 'border-[var(--color-gold-border)]' : ''}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                                                    style={{
                                                        background: i === 0 ? 'var(--color-gold-muted)' : 'var(--color-bg-subtle)',
                                                        color: i === 0 ? 'var(--color-gold-text)' : 'var(--color-text-muted)',
                                                    }}
                                                >
                                                    {i === 0 ? <Medal className="w-4 h-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-sm font-semibold text-[var(--color-text)] truncate">
                                                            {row.name || row.alias}
                                                            {row.isMe && (
                                                                <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                                                    style={{ background: 'var(--color-gold-muted)', color: 'var(--color-gold-text)' }}>
                                                                    {t.partner.challenges.you}
                                                                </span>
                                                            )}
                                                        </p>
                                                        <span className="text-xs tabular-nums text-[var(--color-text-secondary)] shrink-0 ml-2">
                                                            {t.partner.challenges.progressOf(row.progress, c.targetValue)}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-subtle)' }}>
                                                        <div
                                                            className="h-full rounded-full transition-all"
                                                            style={{
                                                                width: `${pct}%`,
                                                                background: pct >= 100 ? 'var(--color-success)' : 'var(--color-primary)',
                                                            }}
                                                        />
                                                    </div>
                                                    {row.status === 'invited' && (
                                                        <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Invited — not joined yet</p>
                                                    )}
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        </section>

                        {detail.myStatus === 'joined' && c.status !== 'completed' && (
                            <button
                                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold"
                                style={{ color: 'var(--color-danger)' }}
                                disabled={busy}
                                onClick={() => handleAction(c.isCreator ? 'cancel' : 'leave')}
                            >
                                {c.isCreator ? <XCircle className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                                {c.isCreator ? 'Cancel challenge' : t.partner.challenges.leave}
                            </button>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}
