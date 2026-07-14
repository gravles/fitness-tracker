'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, ChevronRight, Flame } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { Card } from '@/components/ui';
import { Partnership, getPartnerships, getSharedInbox, getPartnerDashboard } from '@/lib/partner-api';

interface PartnerPreview {
    partnership: Partnership;
    streak: number | null;
}

/**
 * Dashboard tile for the workout partner feature. Hidden entirely when the
 * user has no partnerships and no pending invites.
 */
export function PartnerCard({ stagger }: { stagger?: number }) {
    const { t } = useLanguage();
    const [previews, setPreviews] = useState<PartnerPreview[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [inboxCount, setInboxCount] = useState(0);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [partnerships, inbox] = await Promise.all([
                    getPartnerships(),
                    getSharedInbox().catch(() => []),
                ]);
                if (cancelled) return;

                const active = partnerships.filter(p => p.status === 'active');
                const incoming = partnerships.filter(p => p.status === 'pending' && !p.isInviter);
                setPendingCount(incoming.length);
                setInboxCount(inbox.filter(i => i.status === 'new').length);

                // Streak preview for up to 2 partners (best-effort)
                const previewList: PartnerPreview[] = await Promise.all(
                    active.slice(0, 2).map(async p => {
                        try {
                            const dashboard = await getPartnerDashboard(p.id);
                            return { partnership: p, streak: dashboard.summary?.streak ?? null };
                        } catch {
                            return { partnership: p, streak: null };
                        }
                    })
                );
                if (!cancelled) setPreviews(previewList);
            } catch {
                // Not signed in / table missing — card simply stays hidden
            } finally {
                if (!cancelled) setLoaded(true);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    if (!loaded || (previews.length === 0 && pendingCount === 0 && inboxCount === 0)) return null;

    return (
        <Link href="/partner" className="block">
            <Card stagger={stagger} padding="sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
                            <Users className="w-5 h-5 text-[var(--color-primary)]" />
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-sm text-[var(--color-text)]">{t.partner.title}</p>
                            {pendingCount > 0 ? (
                                <p className="text-xs font-medium" style={{ color: 'var(--color-gold-text)' }}>
                                    {pendingCount === 1 ? '1 pending invite' : `${pendingCount} pending invites`}
                                </p>
                            ) : previews.length > 0 ? (
                                <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                                    {previews.map(({ partnership, streak }) => (
                                        <span key={partnership.id} className="flex items-center gap-1 truncate">
                                            {partnership.otherName || partnership.invitee_email}
                                            {streak != null && (
                                                <>
                                                    <Flame className="w-3 h-3" style={{ color: 'var(--color-gold-text)' }} />
                                                    <span className="tabular-nums">{streak}</span>
                                                </>
                                            )}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {inboxCount > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-primary)] text-white">
                                {inboxCount}
                            </span>
                        )}
                        <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
                    </div>
                </div>
            </Card>
        </Link>
    );
}
