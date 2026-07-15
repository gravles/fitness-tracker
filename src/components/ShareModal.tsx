'use client';

import { useState } from 'react';
import { Share2, Copy, Check, Twitter, Loader2, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { shareAchievement, SharedAchievement } from '@/lib/features';
import { haptics } from '@/lib/haptics';
import { Confetti } from './Confetti';
import { Modal } from './ui/Modal';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: SharedAchievement['achievement_type'];
    data: {
        title: string;
        subtitle?: string;
        emoji?: string;
        stats?: { label: string; value: string | number }[];
    };
}

export function ShareModal({ isOpen, onClose, type, data }: ShareModalProps) {
    const [loading, setLoading] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    if (!isOpen) return null;

    async function handleGenerateLink() {
        setLoading(true);
        haptics.tap();

        try {
            const result = await shareAchievement(type, data);
            setShareUrl(result.shareUrl);
            setShowConfetti(true);
            haptics.success();
        } catch (error) {
            console.error('Failed to generate share link', error);
            haptics.error();
            toast.error('Failed to generate share link. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    async function handleCopy() {
        if (!shareUrl) return;

        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            haptics.tap();
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy', error);
        }
    }

    async function handleNativeShare() {
        if (!shareUrl || !navigator.share) return;

        haptics.tap();
        try {
            await navigator.share({
                title: data.title,
                text: `${data.emoji || '🎉'} ${data.title}${data.subtitle ? ` - ${data.subtitle}` : ''}`,
                url: shareUrl,
            });
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                console.error('Share failed', error);
            }
        }
    }

    function handleTwitterShare() {
        if (!shareUrl) return;

        haptics.tap();
        const text = `${data.emoji || '🎉'} ${data.title}${data.subtitle ? ` - ${data.subtitle}` : ''}\n\nTracking my fitness journey! 💪`;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
        window.open(twitterUrl, '_blank');
    }

    return (
        <>
            <Confetti isActive={showConfetti} onComplete={() => setShowConfetti(false)} />

            <Modal isOpen onClose={onClose} title="Share Achievement" size="sm" sheet={false}>
                    {/* Preview Card */}
                    <div>
                        <div className="p-6 rounded-2xl text-white text-center shadow-lg" style={{ background: 'var(--color-navy)' }}>
                            <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: 'var(--color-gold-border)' }}>
                                <Trophy className="w-7 h-7" style={{ color: 'var(--color-gold)' }} aria-hidden="true" />
                            </div>
                            <h4 className="text-xl font-bold mb-1">{data.title}</h4>
                            {data.subtitle && (
                                <p className="text-white/80 text-sm">{data.subtitle}</p>
                            )}
                            {data.stats && data.stats.length > 0 && (
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    {data.stats.map((stat, idx) => (
                                        <div key={idx} className="bg-white/10 rounded-lg p-2">
                                            <p className="text-lg font-bold">{stat.value}</p>
                                            <p className="text-xs text-white/70">{stat.label}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 space-y-3">
                        {!shareUrl ? (
                            <button
                                onClick={handleGenerateLink}
                                disabled={loading}
                                className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
                                Generate Share Link
                            </button>
                        ) : (
                            <>
                                {/* Copy Link */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={shareUrl}
                                        readOnly
                                        className="flex-1 px-3 py-2 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg)] text-[var(--color-text)] text-sm truncate"
                                    />
                                    <button
                                        onClick={handleCopy}
                                        className="px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-center gap-1 text-[var(--color-text)]"
                                    >
                                        {copied ? <Check className="w-4 h-4 text-[var(--color-success)]" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>

                                {/* Share options */}
                                <div className="flex gap-2">
                                    {typeof navigator !== 'undefined' && 'share' in navigator && (
                                        <button
                                            onClick={handleNativeShare}
                                            className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium flex items-center justify-center gap-2"
                                        >
                                            <Share2 className="w-4 h-4" />
                                            Share
                                        </button>
                                    )}
                                    <button
                                        onClick={handleTwitterShare}
                                        className="flex-1 py-3 bg-sky-500 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                                    >
                                        <Twitter className="w-4 h-4" />
                                        Tweet
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
            </Modal>
        </>
    );
}
