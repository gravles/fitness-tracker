'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getMonthlyLogs, DailyLog, isAuthError } from '@/lib/api';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, Dumbbell, Utensils, Star, X } from 'lucide-react';
import { LoadError } from '@/components/ui';

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [logs, setLogs] = useState<Record<string, DailyLog>>({});
    const [stats, setStats] = useState({ totalMovement: 0, avgProtein: 0, perfectDays: 0 });
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        fetchMonthData();
    }, [currentDate]);

    async function fetchMonthData() {
        setLoading(true);
        setLoadError(false);
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);

        try {
            const data = await getMonthlyLogs(
                format(start, 'yyyy-MM-dd'),
                format(end, 'yyyy-MM-dd')
            );

            const logMap: Record<string, DailyLog> = {};
            let totalMov = 0, totalProt = 0, protCount = 0, perfect = 0;

            data.forEach(log => {
                logMap[log.date] = log;
                if (log.movement_completed) totalMov += (log.movement_duration || 0);
                if (log.protein_grams && log.protein_grams > 0) {
                    totalProt += log.protein_grams;
                    protCount++;
                }
                if (log.movement_completed && log.nutrition_logged) perfect++;
            });

            setLogs(logMap);
            setStats({
                totalMovement: totalMov,
                avgProtein: protCount > 0 ? Math.round(totalProt / protCount) : 0,
                perfectDays: perfect
            });
        } catch (error) {
            console.error(error);
            if (!isAuthError(error)) setLoadError(true);
        } finally {
            setLoading(false);
        }
    }

    const days = eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
    });
    const startDay = getDay(startOfMonth(currentDate));
    const padding = Array(startDay).fill(null);

    return (
        <main className="p-6 pt-12 pb-24 space-y-6 max-w-2xl mx-auto">
            <header className="flex items-center justify-between">
                <h1
                    className="text-3xl font-bold"
                    style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
                >
                    History
                </h1>

                <div
                    className="flex items-center gap-1 p-1 rounded-full border shadow-sm"
                    style={{
                        background: 'var(--color-surface-elevated)',
                        borderColor: 'var(--color-border-light)',
                    }}
                >
                    <button
                        onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                        className="w-9 h-9 flex items-center justify-center rounded-full transition-all"
                        style={{ color: 'var(--color-text-muted)' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span
                        className="font-bold w-32 text-center text-sm"
                        style={{ color: 'var(--color-text)' }}
                    >
                        {format(currentDate, 'MMMM yyyy')}
                    </span>
                    <button
                        onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                        className="w-9 h-9 flex items-center justify-center rounded-full transition-all"
                        style={{ color: 'var(--color-text-muted)' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Monthly Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div
                    className="p-4 rounded-2xl border flex flex-col items-center justify-center text-center"
                    style={{
                        background: 'rgba(77,137,226,0.08)',
                        borderColor: 'rgba(77,137,226,0.2)',
                    }}
                >
                    <Dumbbell className="w-5 h-5 mb-1" style={{ color: 'var(--color-primary)' }} />
                    <span className="text-2xl font-black" style={{ color: 'var(--color-text)' }}>
                        {Math.round(stats.totalMovement / 60)}h
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-primary)' }}>
                        Active
                    </span>
                </div>
                <div
                    className="p-4 rounded-2xl border flex flex-col items-center justify-center text-center"
                    style={{
                        background: 'rgba(34,197,94,0.08)',
                        borderColor: 'rgba(34,197,94,0.2)',
                    }}
                >
                    <Utensils className="w-5 h-5 mb-1" style={{ color: 'var(--color-success)' }} />
                    <span className="text-2xl font-black" style={{ color: 'var(--color-text)' }}>
                        {stats.avgProtein}g
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-success)' }}>
                        Avg Protein
                    </span>
                </div>
                <div
                    className="p-4 rounded-2xl border flex flex-col items-center justify-center text-center"
                    style={{
                        background: 'var(--color-gold-muted)',
                        borderColor: 'var(--color-gold-border)',
                    }}
                >
                    <Star className="w-5 h-5 mb-1" style={{ color: 'var(--color-gold)' }} />
                    <span className="text-2xl font-black" style={{ color: 'var(--color-text)' }}>
                        {stats.perfectDays}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-gold)' }}>
                        Perfect Days
                    </span>
                </div>
            </div>

            {/* Calendar Grid */}
            <div
                className="p-5 rounded-3xl border relative"
                style={{
                    background: 'var(--color-surface-elevated)',
                    borderColor: 'var(--color-border-light)',
                }}
            >
                <div className="grid grid-cols-7 mb-3">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <span
                            key={i}
                            className="text-center text-xs font-bold uppercase tracking-wide"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            {d}
                        </span>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-y-3 gap-x-1.5">
                    {padding.map((_, i) => <div key={`pad-${i}`} />)}

                    {days.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const log = logs[dateStr];
                        const isCurrent = isToday(day);
                        const isPast = day < new Date() && !isCurrent;
                        const isMissed = isPast && !log;
                        const moved = log?.movement_completed;
                        const ate = log?.nutrition_logged;

                        return (
                            <Link key={dateStr} href={`/log?date=${dateStr}`} className="group relative">
                                <div
                                    className="aspect-square flex flex-col items-center justify-start pt-1 rounded-xl transition-all"
                                    style={
                                        isCurrent
                                            ? { background: 'var(--color-primary)', boxShadow: '0 4px 12px rgba(77,137,226,0.3)' }
                                            : isMissed
                                            ? { background: 'var(--color-bg-subtle)' }
                                            : {}
                                    }
                                >
                                    <span
                                        className="text-sm font-bold"
                                        style={{
                                            color: isCurrent
                                                ? 'white'
                                                : isMissed
                                                ? 'var(--color-text-muted)'
                                                : 'var(--color-text)',
                                        }}
                                    >
                                        {format(day, 'd')}
                                    </span>
                                    <div className="flex gap-0.5 mt-0.5">
                                        {isMissed && (
                                            <X className="w-2.5 h-2.5" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
                                        )}
                                        {moved && (
                                            <div
                                                className="w-1.5 h-1.5 rounded-full"
                                                style={{ background: isCurrent ? 'rgba(255,255,255,0.8)' : 'var(--color-success)' }}
                                            />
                                        )}
                                        {ate && (
                                            <div
                                                className="w-1.5 h-1.5 rounded-full"
                                                style={{ background: isCurrent ? 'rgba(255,255,255,0.5)' : 'var(--color-gold)' }}
                                            />
                                        )}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>

                {loading && (
                    <div
                        className="absolute inset-0 backdrop-blur-sm flex items-center justify-center rounded-3xl z-20"
                        style={{ background: 'var(--color-surface-elevated)/60' }}
                    >
                        <div
                            className="p-4 rounded-full shadow-lg"
                            style={{ background: 'var(--color-surface-elevated)' }}
                        >
                            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
                        </div>
                    </div>
                )}
            </div>

            {loadError && !loading && <LoadError onRetry={fetchMonthData} />}

            {/* Legend */}
            <div
                className="flex flex-wrap justify-center gap-4 text-xs font-medium"
                style={{ color: 'var(--color-text-muted)' }}
            >
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-success)' }} />
                    Movement
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-gold)' }} />
                    Nutrition
                </div>
                <div className="flex items-center gap-1.5">
                    <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px]"
                        style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                    ><X className="w-3 h-3" aria-hidden="true" /></div>
                    Missed
                </div>
                <div className="flex items-center gap-1.5">
                    <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] text-white"
                        style={{ background: 'var(--color-primary)' }}
                    >
                        Today
                    </div>
                    Current
                </div>
            </div>
        </main>
    );
}
