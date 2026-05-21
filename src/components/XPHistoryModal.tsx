'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Trophy, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, parseISO } from 'date-fns';
import { getMonthlyLogs, getSettings, recalculateTotalXP } from '@/lib/api';
import { calculateXP, XPTargets } from '@/lib/gamification';

interface XPHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    lifetimeXP: number;
    currentLevel?: number;
    onSync?: () => void;
    onShare?: () => void;
}

interface XPLog {
    date: string;
    xp: number;
    details: string[];
}

export function XPHistoryModal({ isOpen, onClose, lifetimeXP, currentLevel, onSync, onShare }: XPHistoryModalProps) {
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [history, setHistory] = useState<XPLog[]>([]);
    const [totalRecentXP, setTotalRecentXP] = useState(0);

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
        }
    }, [isOpen]);

    async function fetchHistory() {
        setLoading(true);
        try {
            const today = new Date();
            const start = format(subDays(today, 30), 'yyyy-MM-dd');
            const end = format(today, 'yyyy-MM-dd');

            const [logs, settings] = await Promise.all([
                getMonthlyLogs(start, end),
                getSettings()
            ]);

            const targets: XPTargets = {
                daily_protein: settings?.target_protein || 0,
                daily_calories: settings?.target_calories || 0
            };

            const xpHistory: XPLog[] = logs.map(log => {
                const xp = calculateXP(log, targets);
                const details = [];

                if (log.movement_completed || (log.movement_duration || 0) > 0) details.push('Movement');
                if (targets.daily_protein && (log.protein_grams || 0) >= targets.daily_protein) details.push('Protein Goal');
                if (targets.daily_calories && (log.calories || 0) > 0) details.push('Tracked Cals');
                if (log.habits && log.habits.length > 0) details.push(`${log.habits.length} Habits`);

                return { date: log.date, xp, details };
            }).filter(h => h.xp > 0).reverse();

            setHistory(xpHistory);
            setTotalRecentXP(xpHistory.reduce((acc, curr) => acc + curr.xp, 0));

        } catch (error) {
            console.error('Error fetching XP history', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSync() {
        if (!confirm('This will recalculate your total XP based on your complete history. Continue?')) return;
        setSyncing(true);
        try {
            await recalculateTotalXP();
            if (onSync) onSync();
            onClose();
            toast.success('XP Synced Successfully!');
        } catch (error) {
            console.error(error);
            toast.error('Failed to sync XP');
        } finally {
            setSyncing(false);
        }
    }

    if (!isOpen) return null;

    const showSync = totalRecentXP > lifetimeXP;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[var(--color-surface-elevated)] rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-[var(--color-border-light)] flex justify-between items-center bg-[var(--color-bg-subtle)]">
                    <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5" style={{ color: 'var(--color-gold)' }} />
                        <h3 className="font-bold text-[var(--color-text)]">
                            XP History <span className="text-xs font-normal text-[var(--color-text-muted)]">(Last 30 Days)</span>
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--color-bg-muted)] rounded-full transition-colors">
                        <X className="w-5 h-5 text-[var(--color-text-muted)]" />
                    </button>
                </div>

                <div className="p-4 border-b border-[var(--color-border-light)] flex justify-between items-center" style={{ background: 'var(--color-gold-muted)' }}>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-gold)' }}>Recent Gains</p>
                        <p className="text-2xl font-black" style={{ color: 'var(--color-text)' }}>+{totalRecentXP} XP</p>
                    </div>
                    <div className="flex gap-2">
                        {onShare && (
                            <button
                                onClick={onShare}
                                className="text-xs text-white px-3 py-2 rounded-lg font-bold shadow-md flex items-center gap-1"
                                style={{ background: 'var(--color-navy)' }}
                            >
                                <Share2 className="w-3 h-3" /> Share
                            </button>
                        )}
                        {showSync && (
                            <button
                                onClick={handleSync}
                                disabled={syncing}
                                className="text-xs text-white px-3 py-2 rounded-lg font-bold shadow-md flex items-center gap-1"
                                style={{ background: 'var(--color-primary)' }}
                            >
                                {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sync XP'}
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-10 text-[var(--color-text-muted)] italic">
                            No XP earned recently. Get moving!
                        </div>
                    ) : (
                        history.map((day) => (
                            <div key={day.date} className="flex justify-between items-center p-3 bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border-light)]">
                                <div>
                                    <p className="text-sm font-bold text-[var(--color-text)]">
                                        {format(parseISO(day.date), 'EEE, MMM d')}
                                    </p>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                        {day.details.join(' • ')}
                                    </p>
                                </div>
                                <div className="px-3 py-1 rounded-full border border-[var(--color-border)] shadow-sm font-bold text-sm" style={{ background: 'var(--color-surface-elevated)', color: 'var(--color-success)' }}>
                                    +{day.xp}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
