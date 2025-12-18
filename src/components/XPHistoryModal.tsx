'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Trophy } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import { getMonthlyLogs, getSettings } from '@/lib/api';
import { calculateXP, XPTargets } from '@/lib/gamification';

interface XPHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface XPLog {
    date: string;
    xp: number;
    details: string[];
}

export function XPHistoryModal({ isOpen, onClose }: XPHistoryModalProps) {
    const [loading, setLoading] = useState(true);
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

            // Fetch logs and settings to calculate XP correctly
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

                return {
                    date: log.date,
                    xp,
                    details
                };
            }).filter(h => h.xp > 0).reverse(); // Only show days with XP, newest first

            setHistory(xpHistory);
            setTotalRecentXP(xpHistory.reduce((acc, curr) => acc + curr.xp, 0));

        } catch (error) {
            console.error('Error fetching XP history', error);
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        <h3 className="font-bold text-gray-900">XP History <span className="text-xs font-normal text-gray-500">(Last 30 Days)</span></h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-4 bg-blue-50 border-b border-blue-100">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">Recent Gains</p>
                    <p className="text-2xl font-black text-blue-900">+{totalRecentXP} XP</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 italic">
                            No XP earned recently. Get moving!
                        </div>
                    ) : (
                        history.map((day) => (
                            <div key={day.date} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div>
                                    <p className="text-sm font-bold text-gray-900">
                                        {format(parseISO(day.date), 'EEE, MMM d')}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {day.details.join(' • ')}
                                    </p>
                                </div>
                                <div className="bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm font-bold text-green-600 text-sm">
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
