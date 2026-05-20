'use client';

import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, addDays, isSameDay, subDays } from 'date-fns';

interface DateNavigatorProps {
    date: Date;
    setDate: (date: Date) => void;
}

export function DateNavigator({ date, setDate }: DateNavigatorProps) {
    const isToday = isSameDay(date, new Date());

    return (
        <div
            className="flex items-center justify-between p-3 rounded-2xl mb-6 sticky top-4 z-30"
            style={{
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-border-light)',
                boxShadow: 'var(--shadow-md)',
            }}
        >
            <button
                onClick={() => setDate(subDays(date, 1))}
                className="w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-95 tap-target focus-ring"
                style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                aria-label="Previous day"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="relative flex flex-col items-center cursor-pointer select-none">
                <input
                    type="date"
                    value={format(date, 'yyyy-MM-dd')}
                    onChange={e => {
                        if (e.target.value) {
                            const [y, m, d] = e.target.value.split('-').map(Number);
                            setDate(new Date(y, m - 1, d));
                        }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    aria-label="Pick a date"
                />
                <span
                    className="text-[10px] font-bold tracking-widest uppercase"
                    style={{ color: isToday ? 'var(--color-gold)' : 'var(--color-text-muted)' }}
                >
                    {isToday ? 'Today' : format(date, 'EEEE')}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
                    <span
                        className="text-lg font-bold"
                        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
                    >
                        {format(date, 'MMM d, yyyy')}
                    </span>
                </div>
            </div>

            <button
                onClick={() => !isToday && setDate(addDays(date, 1))}
                disabled={isToday}
                className="w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-95 tap-target focus-ring disabled:cursor-not-allowed"
                style={{
                    background: 'var(--color-bg-subtle)',
                    color: isToday ? 'var(--color-border)' : 'var(--color-text-muted)',
                }}
                onMouseEnter={e => { if (!isToday) e.currentTarget.style.color = 'var(--color-text)'; }}
                onMouseLeave={e => { if (!isToday) e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                aria-label="Next day"
            >
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>
    );
}
