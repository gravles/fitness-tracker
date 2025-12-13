'use client';

import { useState, useEffect } from 'react';
import { getMonthlyLogs } from '@/lib/api';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [logs, setLogs] = useState<Set<string>>(new Set());
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

            // Create a set of dates where movement was completed
            const completedDates = new Set(
                data
                    .filter(log => log.movement_completed)
                    .map(log => log.date)
            );
            setLogs(completedDates);
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

    // Padding for start of month (Monday start? Sunday? Let's assume Sunday start for now)
    const startDay = getDay(startOfMonth(currentDate));
    const padding = Array(startDay).fill(null);

    return (
        <main className="p-6 pt-12 pb-24">
            <header className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold">History</h1>

                <div className="flex items-center gap-4 bg-white p-1 rounded-full border border-gray-100 shadow-sm">
                    <button
                        onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-500" />
                    </button>
                    <span className="font-medium w-24 text-center">{format(currentDate, 'MMMM yyyy')}</span>
                    <button
                        onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full"
                    >
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
            </header>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="grid grid-cols-7 mb-4">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                        <span key={d} className="text-center text-xs font-bold text-gray-400">{d}</span>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                    {padding.map((_, i) => <div key={`pad-${i}`} />)}

                    {days.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const isCompleted = logs.has(dateStr);
                        const isCurrent = isToday(day);

                        return (
                            <div key={dateStr} className="aspect-square flex flex-col items-center justify-center relative">
                                <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all
                                    ${isCompleted ? 'bg-green-500 text-white shadow-md shadow-green-200' : 'bg-gray-50 text-gray-400'}
                                    ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                                `}>
                                    {format(day, 'd')}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {loading && <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-2xl">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>}
            </div>

            <div className="mt-8">
                <h3 className="font-bold text-gray-900 mb-4">Summary</h3>
                <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                    <span className="text-gray-500">Days Moved</span>
                    <span className="text-xl font-bold">{logs.size} days</span>
                </div>
            </div>
        </main>
    );
}
