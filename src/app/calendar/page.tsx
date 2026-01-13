'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getMonthlyLogs, DailyLog } from '@/lib/api';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, Dumbbell, Utensils, Star, Flame } from 'lucide-react';

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [logs, setLogs] = useState<Record<string, DailyLog>>({});
    const [stats, setStats] = useState({ totalMovement: 0, avgProtein: 0, perfectDays: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMonthData();
    }, [currentDate]);

    async function fetchMonthData() {
        setLoading(true);
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);

        try {
            const data = await getMonthlyLogs(
                format(start, 'yyyy-MM-dd'),
                format(end, 'yyyy-MM-dd')
            );

            // Map logs by date
            const logMap: Record<string, DailyLog> = {};
            let totalMov = 0;
            let totalProt = 0;
            let protCount = 0;
            let perfect = 0;

            data.forEach(log => {
                logMap[log.date] = log;

                // Stats Logic
                if (log.movement_completed) {
                    totalMov += (log.movement_duration || 0);
                }
                if (log.protein_grams && log.protein_grams > 0) {
                    totalProt += log.protein_grams;
                    protCount++;
                }

                if (log.movement_completed && log.nutrition_logged) {
                    perfect++;
                }
            });

            setLogs(logMap);
            setStats({
                totalMovement: totalMov,
                avgProtein: protCount > 0 ? Math.round(totalProt / protCount) : 0,
                perfectDays: perfect
            });

        } catch (error) {
            console.error(error);
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
        <main className="p-6 pt-12 pb-24 space-y-8">
            <header className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900">History</h1>

                <div className="flex items-center gap-4 bg-white p-1 rounded-full border border-gray-100 shadow-sm">
                    <button
                        onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                        className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-500" />
                    </button>
                    <span className="font-bold w-32 text-center text-gray-800">{format(currentDate, 'MMMM yyyy')}</span>
                    <button
                        onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                        className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
            </header>

            {/* Monthly Stats Summary */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex flex-col items-center justify-center text-center">
                    <div className="mb-1 text-orange-500"><Dumbbell className="w-5 h-5" /></div>
                    <span className="text-2xl font-black text-gray-900">{Math.round(stats.totalMovement / 60)}h</span>
                    <span className="text-xs font-bold text-orange-800 uppercase tracking-wide">Active</span>
                </div>
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center justify-center text-center">
                    <div className="mb-1 text-blue-500"><Utensils className="w-5 h-5" /></div>
                    <span className="text-2xl font-black text-gray-900">{stats.avgProtein}g</span>
                    <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">Avg Protein</span>
                </div>
                <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 flex flex-col items-center justify-center text-center">
                    <div className="mb-1 text-yellow-500"><Star className="w-5 h-5" /></div>
                    <span className="text-2xl font-black text-gray-900">{stats.perfectDays}</span>
                    <span className="text-xs font-bold text-yellow-800 uppercase tracking-wide">Perfect Days</span>
                </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="grid grid-cols-7 mb-4">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                        <span key={d} className="text-center text-xs font-bold text-gray-400">{d}</span>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-y-4 gap-x-2">
                    {padding.map((_, i) => <div key={`pad-${i}`} />)}

                    {days.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const log = logs[dateStr];
                        const isCurrent = isToday(day);

                        // Indicators
                        const moved = log?.movement_completed;
                        const ate = log?.nutrition_logged;

                        return (
                            <Link
                                key={dateStr}
                                href={`/log?date=${dateStr}`}
                                className="group relative"
                            >
                                <div className={`aspect-square flex flex-col items-center justify-start pt-1 rounded-xl transition-all
                                    ${isCurrent ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105 z-10' : 'hover:bg-gray-50 text-gray-700'}
                                `}>
                                    <span className={`text-sm font-bold ${isCurrent ? 'text-white' : ''}`}>{format(day, 'd')}</span>

                                    <div className="flex gap-1 mt-1">
                                        {moved && (
                                            <div className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-white' : 'bg-green-500'}`} />
                                        )}
                                        {ate && (
                                            <div className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-blue-200' : 'bg-orange-400'}`} />
                                        )}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>

                {loading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center rounded-3xl z-20">
                    <div className="bg-white p-4 rounded-full shadow-lg">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                </div>}
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-6 text-xs font-medium text-gray-500">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" /> Movement
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-400" /> Nutrition
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-600 border border-blue-600 text-white flex items-center justify-center text-[10px]">Today</div> Current
                </div>
            </div>
        </main>
    );
}
