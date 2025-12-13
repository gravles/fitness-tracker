'use client';

import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, addDays, isSameDay, subDays } from 'date-fns';

interface DateNavigatorProps {
    date: Date;
    setDate: (date: Date) => void;
}

export function DateNavigator({ date, setDate }: DateNavigatorProps) {
    const isToday = isSameDay(date, new Date());
    const isFuture = date > new Date();

    return (
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 sticky top-4 z-30">
            <button
                onClick={() => setDate(subDays(date, 1))}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100 active:scale-95 transition-all"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center">
                <span className="text-sm font-medium text-gray-500 uppercase tracking-widest">
                    {isToday ? 'Today' : format(date, 'EEEE')}
                </span>
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span className="text-xl font-bold text-gray-900">
                        {format(date, 'MMM d, yyyy')}
                    </span>
                </div>
            </div>

            <button
                onClick={() => setDate(addDays(date, 1))}
                disabled={isToday} // Logic: Can we log future? User req says "Date selector (defaults to today, can log historical)". Usually future logging is rare. Let's disable for now to keep it simple.
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${isToday
                    ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 active:scale-95'}`}
            >
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>
    );
}
