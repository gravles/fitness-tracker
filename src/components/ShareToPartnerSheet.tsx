'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Users, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/LanguageProvider';
import { Button, Textarea } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import {
    Partnership, SharedItemType,
    WorkoutTemplatePayload, SavedMealPayload, FavoriteFoodPayload,
    getPartnerships, shareItemToPartner,
} from '@/lib/partner-api';

interface ShareToPartnerSheetProps {
    open: boolean;
    onClose: () => void;
    itemType: SharedItemType;
    payload: WorkoutTemplatePayload | SavedMealPayload | FavoriteFoodPayload;
}

/**
 * Bottom sheet for sending a workout template / meal / food idea to a partner.
 * The payload is a snapshot — the recipient saves a copy into their own library.
 */
export function ShareToPartnerSheet({ open, onClose, itemType, payload }: ShareToPartnerSheetProps) {
    const { t } = useLanguage();
    const [partners, setPartners] = useState<Partnership[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        getPartnerships()
            .then(all => {
                const active = all.filter(p => p.status === 'active' && p.otherUserId);
                setPartners(active);
                setSelectedId(active.length === 1 ? active[0].id : null);
            })
            .catch(() => setPartners([]))
            .finally(() => setLoading(false));
    }, [open]);

    if (!open) return null;

    async function handleShare() {
        const partner = partners.find(p => p.id === selectedId);
        if (!partner) return;
        setSending(true);
        haptics.tap();
        try {
            await shareItemToPartner(partner, itemType, payload, message.trim() || undefined);
            toast.success(t.partner.share.sent);
            haptics.success();
            setMessage('');
            onClose();
        } catch (error: any) {
            haptics.error();
            toast.error(error.message || 'Failed to share');
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div
                className="relative w-full max-w-md rounded-t-3xl p-6 pb-8 space-y-4 animate-in"
                style={{ background: 'var(--color-surface-elevated)' }}
            >
                <div className="flex items-center justify-between">
                    <h2 className="font-bold text-[var(--color-text)]">{t.partner.share.title}</h2>
                    <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-[var(--color-bg-subtle)]">
                        <X className="w-5 h-5 text-[var(--color-text-muted)]" />
                    </button>
                </div>

                <p className="text-sm font-semibold text-[var(--color-text-secondary)] truncate">
                    “{(payload as any).name}”
                </p>

                {loading ? (
                    <div className="flex justify-center py-6">
                        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
                    </div>
                ) : partners.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
                        {t.partner.share.noPartners}
                    </p>
                ) : (
                    <>
                        <div className="space-y-2">
                            {partners.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedId(p.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                                        selectedId === p.id
                                            ? 'border-[var(--color-gold)] bg-[var(--color-gold-muted)]'
                                            : 'border-[var(--color-border-light)] bg-[var(--color-bg-subtle)]'
                                    }`}
                                >
                                    <Users className="w-4 h-4 shrink-0" style={{
                                        color: selectedId === p.id ? 'var(--color-gold-text)' : 'var(--color-text-muted)',
                                    }} />
                                    <span className="text-sm font-semibold text-[var(--color-text)] truncate">
                                        {p.otherName || p.invitee_email}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <Textarea
                            rows={2}
                            placeholder={t.partner.share.messagePlaceholder}
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                        />

                        <Button fullWidth disabled={!selectedId || sending} onClick={handleShare}>
                            {sending
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <><Send className="w-4 h-4" /> {t.partner.share.send}</>}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
