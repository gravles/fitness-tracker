'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Users, Mail, Inbox, Dumbbell, UtensilsCrossed, Apple, Check, X, Heart, Trophy, Plus } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useLanguage } from '@/components/LanguageProvider';
import { Card, Button, Input } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import {
    Partnership, SharedItem, Nudge, ChallengeListItem,
    getPartnerships, invitePartner, respondToInvite,
    setPartnershipStatus, ensureMyProfile, getSharedInbox, saveSharedItem,
    dismissSharedItem, getRecentNudges, getChallenges, respondToChallenge,
} from '@/lib/partner-api';

const ITEM_ICONS = {
    workout_template: Dumbbell,
    saved_meal: UtensilsCrossed,
    favorite_food: Apple,
} as const;

export default function PartnerPage() {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [partnerships, setPartnerships] = useState<Partnership[]>([]);
    const [inbox, setInbox] = useState<SharedItem[]>([]);
    const [nudges, setNudges] = useState<Nudge[]>([]);
    const [challenges, setChallenges] = useState<ChallengeListItem[]>([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviting, setInviting] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const [partnershipList, inboxItems, nudgeList, challengeList] = await Promise.all([
                getPartnerships(),
                getSharedInbox().catch(() => [] as SharedItem[]),
                getRecentNudges().catch(() => [] as Nudge[]),
                getChallenges().catch(() => [] as ChallengeListItem[]),
            ]);
            setPartnerships(partnershipList);
            setInbox(inboxItems);
            setNudges(nudgeList);
            setChallenges(challengeList);
        } catch (error) {
            console.error('Failed to load partnerships', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        ensureMyProfile().catch(() => {});
        load();
    }, [load]);

    async function handleInvite() {
        const email = inviteEmail.trim();
        if (!email) return;
        setInviting(true);
        haptics.tap();
        try {
            await invitePartner(email);
            toast.success(t.partner.invite.sent);
            setInviteEmail('');
            haptics.success();
            await load();
        } catch (error: any) {
            haptics.error();
            toast.error(error.message || 'Failed to send invite');
        } finally {
            setInviting(false);
        }
    }

    async function handleRespond(p: Partnership, action: 'accept' | 'decline') {
        setBusyId(p.id);
        haptics.tap();
        try {
            await respondToInvite(p.id, action);
            if (action === 'accept') haptics.success();
            await load();
        } catch (error: any) {
            haptics.error();
            toast.error(error.message || 'Something went wrong');
        } finally {
            setBusyId(null);
        }
    }

    async function handleCancelInvite(p: Partnership) {
        setBusyId(p.id);
        try {
            await setPartnershipStatus(p.id, 'end');
            await load();
        } catch (error: any) {
            toast.error(error.message || 'Something went wrong');
        } finally {
            setBusyId(null);
        }
    }

    async function handleSaveItem(item: SharedItem) {
        setBusyId(item.id);
        haptics.tap();
        try {
            await saveSharedItem(item);
            toast.success(t.partner.inbox.saved);
            haptics.success();
            setInbox(prev => prev.map(i => i.id === item.id ? { ...i, status: 'saved' } : i));
        } catch (error: any) {
            haptics.error();
            toast.error(error.message || 'Failed to save');
        } finally {
            setBusyId(null);
        }
    }

    async function handleDismissItem(item: SharedItem) {
        setBusyId(item.id);
        try {
            await dismissSharedItem(item.id);
            setInbox(prev => prev.filter(i => i.id !== item.id));
        } catch (error: any) {
            toast.error(error.message || 'Something went wrong');
        } finally {
            setBusyId(null);
        }
    }

    const incomingInvites = partnerships.filter(p => p.status === 'pending' && !p.isInviter);
    const outgoingInvites = partnerships.filter(p => p.status === 'pending' && p.isInviter);
    const activePartners = partnerships.filter(p => p.status === 'active' || p.status === 'paused');
    const newInbox = inbox.filter(i => i.status === 'new');
    const nameById: Record<string, string | null> = {};
    for (const p of activePartners) {
        if (p.otherUserId) nameById[p.otherUserId] = p.otherName;
    }

    function itemTypeLabel(type: SharedItem['item_type']) {
        return type === 'workout_template' ? t.partner.inbox.workout
            : type === 'saved_meal' ? t.partner.inbox.meal
            : t.partner.inbox.food;
    }

    const nameByPartnership: Record<string, string | null> = {};
    for (const p of partnerships) nameByPartnership[p.id] = p.otherName;

    function nudgeLabel(n: Nudge) {
        // System nudges have no sender — the subject is the partner in that partnership
        if (n.nudge_type === 'system_not_logged') {
            return t.partner.nudges.notLogged(nameByPartnership[n.partnership_id] || 'Your partner');
        }
        const name = (n.from_user_id && nameById[n.from_user_id]) || 'Your partner';
        if (n.nudge_type === 'check_in') return `${name} ${t.partner.nudges.checkIn}`;
        if (n.nudge_type === 'streak_save') return `${name} ${t.partner.nudges.streakSave}`;
        return `${name} ${t.partner.nudges.encouragement}`;
    }

    return (
        <main className="min-h-screen bg-[var(--color-bg)] pb-24">
            <header className="sticky top-0 z-40 bg-[var(--color-surface)]/80 backdrop-blur-lg border-b border-[var(--color-border)]">
                <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-[var(--color-surface-elevated)]">
                        <ChevronLeft className="w-5 h-5 text-[var(--color-text)]" />
                    </Link>
                    <h1 className="font-bold text-[var(--color-text)]">{t.partner.title}</h1>
                    <div className="w-9" />
                </div>
            </header>

            <div className="max-w-md mx-auto px-4 py-6 space-y-6">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
                    </div>
                ) : (
                    <>
                        {/* Incoming invites */}
                        {incomingInvites.map(p => (
                            <Card key={p.id} className="border-[var(--color-gold-border)]">
                                <p className="font-semibold text-sm text-[var(--color-text)] mb-3">
                                    {t.partner.pending.incoming(p.otherName || 'Someone')}
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        fullWidth
                                        disabled={busyId === p.id}
                                        onClick={() => handleRespond(p, 'accept')}
                                    >
                                        <Check className="w-4 h-4" /> {t.partner.pending.accept}
                                    </Button>
                                    <Button
                                        fullWidth
                                        variant="ghost"
                                        disabled={busyId === p.id}
                                        onClick={() => handleRespond(p, 'decline')}
                                    >
                                        <X className="w-4 h-4" /> {t.partner.pending.decline}
                                    </Button>
                                </div>
                            </Card>
                        ))}

                        {/* Active partners */}
                        {activePartners.map((p, i) => (
                            <Link key={p.id} href={`/partner/${p.id}`} className="block">
                                <Card stagger={i * 50}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                                                <Users className="w-5 h-5 text-[var(--color-primary)]" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-[var(--color-text)]">
                                                    {p.otherName || p.invitee_email}
                                                </p>
                                                <p className="text-xs text-[var(--color-text-muted)]">
                                                    {p.status === 'paused'
                                                        ? t.partner.dashboard.pausedNotice.split('.')[0]
                                                        : p.accepted_at
                                                            ? `Partners ${formatDistanceToNow(parseISO(p.accepted_at), { addSuffix: true })}`
                                                            : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
                                    </div>
                                </Card>
                            </Link>
                        ))}

                        {/* Outgoing invites */}
                        {outgoingInvites.map(p => (
                            <Card key={p.id} padding="sm">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Mail className="w-4 h-4 shrink-0 text-[var(--color-text-muted)]" />
                                        <p className="text-xs text-[var(--color-text-secondary)] truncate">
                                            {t.partner.pending.outgoing(p.invitee_email)}
                                        </p>
                                    </div>
                                    <button
                                        className="text-xs text-[var(--color-danger)] font-semibold shrink-0 ml-2"
                                        disabled={busyId === p.id}
                                        onClick={() => handleCancelInvite(p)}
                                    >
                                        {t.partner.pending.cancel}
                                    </button>
                                </div>
                            </Card>
                        ))}

                        {/* Empty state */}
                        {partnerships.length === 0 && (
                            <div className="text-center py-10">
                                <Users className="w-16 h-16 mx-auto text-[var(--color-text-muted)] mb-4" />
                                <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">{t.partner.emptyTitle}</h2>
                                <p className="text-sm text-[var(--color-text-muted)] mb-2 px-4">{t.partner.emptyDesc}</p>
                            </div>
                        )}

                        {/* Shared inbox */}
                        {newInbox.length > 0 && (
                            <section>
                                <h2 className="text-sm font-bold text-[var(--color-text)] mb-3 flex items-center gap-2">
                                    <Inbox className="w-4 h-4" /> {t.partner.inbox.title}
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-primary)] text-white">
                                        {newInbox.length}
                                    </span>
                                </h2>
                                <div className="space-y-3">
                                    {newInbox.map(item => {
                                        const Icon = ITEM_ICONS[item.item_type];
                                        return (
                                            <Card key={item.id} padding="sm">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-[var(--color-gold-muted)] flex items-center justify-center shrink-0">
                                                        <Icon className="w-4 h-4 text-[var(--color-gold-text)]" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs text-[var(--color-text-muted)]">
                                                            {item.fromName || 'Your partner'} · {itemTypeLabel(item.item_type)}
                                                        </p>
                                                        <p className="font-semibold text-sm text-[var(--color-text)] truncate">
                                                            {(item.payload as any).name}
                                                        </p>
                                                        {item.message && (
                                                            <p className="text-xs italic text-[var(--color-text-secondary)] mt-1">“{item.message}”</p>
                                                        )}
                                                        <div className="flex gap-2 mt-2">
                                                            <Button
                                                                className="!py-2 text-xs"
                                                                disabled={busyId === item.id}
                                                                onClick={() => handleSaveItem(item)}
                                                            >
                                                                {t.partner.inbox.save}
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                className="!py-2 text-xs"
                                                                disabled={busyId === item.id}
                                                                onClick={() => handleDismissItem(item)}
                                                            >
                                                                {t.partner.inbox.dismiss}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* Challenges */}
                        {(challenges.length > 0 || activePartners.length > 0) && (
                            <section>
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                                        <Trophy className="w-4 h-4" /> {t.partner.challenges.title}
                                    </h2>
                                    {activePartners.length > 0 && (
                                        <Link
                                            href="/partner/challenges/new"
                                            className="text-xs font-semibold flex items-center gap-1"
                                            style={{ color: 'var(--color-primary)' }}
                                        >
                                            <Plus className="w-3.5 h-3.5" /> {t.partner.challenges.create}
                                        </Link>
                                    )}
                                </div>
                                {challenges.length === 0 ? (
                                    <p className="text-xs text-[var(--color-text-muted)]">{t.partner.challenges.empty}</p>
                                ) : (
                                    <div className="space-y-3">
                                        {challenges.map(c => (
                                            <Card key={c.id} padding="sm">
                                                <div className="flex items-center justify-between gap-2">
                                                    <Link href={`/partner/challenges/${c.id}`} className="min-w-0 flex-1">
                                                        <p className="font-semibold text-sm text-[var(--color-text)] truncate">{c.name}</p>
                                                        <p className="text-xs text-[var(--color-text-muted)]">
                                                            {c.status === 'upcoming' ? t.partner.challenges.statusUpcoming
                                                                : c.status === 'completed' ? t.partner.challenges.statusCompleted
                                                                : t.partner.challenges.statusActive}
                                                            {c.myStatus === 'joined' && ` · ${t.partner.challenges.progressOf(c.myProgress, c.target_value)}`}
                                                        </p>
                                                    </Link>
                                                    {c.myStatus === 'invited' ? (
                                                        <div className="flex gap-2 shrink-0">
                                                            <Button
                                                                className="!py-2 text-xs"
                                                                disabled={busyId === c.id}
                                                                onClick={async () => {
                                                                    setBusyId(c.id);
                                                                    try {
                                                                        await respondToChallenge(c.id, 'join');
                                                                        haptics.success();
                                                                        await load();
                                                                    } catch (error: any) {
                                                                        toast.error(error.message || 'Something went wrong');
                                                                    } finally { setBusyId(null); }
                                                                }}
                                                            >
                                                                {t.partner.challenges.join}
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                className="!py-2 text-xs"
                                                                disabled={busyId === c.id}
                                                                onClick={async () => {
                                                                    setBusyId(c.id);
                                                                    try {
                                                                        await respondToChallenge(c.id, 'decline');
                                                                        await load();
                                                                    } catch (error: any) {
                                                                        toast.error(error.message || 'Something went wrong');
                                                                    } finally { setBusyId(null); }
                                                                }}
                                                            >
                                                                {t.partner.challenges.decline}
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <Link href={`/partner/challenges/${c.id}`}>
                                                            <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
                                                        </Link>
                                                    )}
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Recent encouragements */}
                        {nudges.length > 0 && (
                            <section>
                                <h2 className="text-sm font-bold text-[var(--color-text)] mb-3 flex items-center gap-2">
                                    <Heart className="w-4 h-4" /> {t.partner.nudges.title}
                                </h2>
                                <div className="space-y-2">
                                    {nudges.slice(0, 5).map(n => (
                                        <Card key={n.id} padding="sm" elevated={false}>
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-xs text-[var(--color-text-secondary)]">
                                                    {n.message ? `${nudgeLabel(n)}: “${n.message}”` : nudgeLabel(n)}
                                                </p>
                                                <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
                                                    {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
                                                </span>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Invite form */}
                        <section>
                            <h2 className="text-sm font-bold text-[var(--color-text)] mb-3">{t.partner.invite.title}</h2>
                            <Card>
                                <div className="space-y-3">
                                    <Input
                                        type="email"
                                        placeholder={t.partner.invite.emailPlaceholder}
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleInvite()}
                                    />
                                    <Button fullWidth disabled={inviting || !inviteEmail.trim()} onClick={handleInvite}>
                                        {inviting
                                            ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.partner.invite.sending}</>
                                            : t.partner.invite.send}
                                    </Button>
                                </div>
                            </Card>
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}
