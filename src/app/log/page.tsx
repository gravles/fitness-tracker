'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DailyLogForm } from '@/components/DailyLogForm';
import { DateNavigator } from '@/components/DateNavigator';
import { parseISO, isValid } from 'date-fns';
import { useCarMode } from '@/lib/useCarMode';
import { DriveModeLog } from '@/components/DriveMode';

export default function LogPage() {
    const searchParams = useSearchParams();
    const { carMode, toggle: toggleCarMode } = useCarMode();

    // Initialize with query param or today
    const [date, setDate] = useState(() => {
        const queryDate = searchParams.get('date');
        if (queryDate) {
            const parsed = parseISO(queryDate);
            if (isValid(parsed)) return parsed;
        }
        return new Date();
    });

    if (carMode) {
        return <DriveModeLog onExit={toggleCarMode} />;
    }

    return (
        <main className="p-4 pt-6 pb-24" style={{ maxWidth: 'min(900px, 100%)', margin: '0 auto' }}>
            {/* Car Mode toggle banner */}
            <div className="flex items-center justify-end mb-2">
                <button
                    onClick={toggleCarMode}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
                    style={{
                        background: 'var(--color-bg-subtle)',
                        color: 'var(--color-text-muted)',
                        border: '1px solid var(--color-border)',
                    }}
                >
                    🚗 Car Mode
                </button>
            </div>
            <DateNavigator date={date} setDate={setDate} />
            <DailyLogForm date={date} />
        </main>
    );
}
