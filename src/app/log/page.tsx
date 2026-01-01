import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { DailyLogForm } from '@/components/DailyLogForm';
import { DateNavigator } from '@/components/DateNavigator';
import { parseISO, isValid } from 'date-fns';

export default function LogPage() {
    const searchParams = useSearchParams();

    // Initialize with query param or today
    const [date, setDate] = useState(() => {
        const queryDate = searchParams.get('date');
        if (queryDate) {
            const parsed = parseISO(queryDate);
            if (isValid(parsed)) return parsed;
        }
        return new Date();
    });

    return (
        <main className="p-4 pt-6 pb-24">
            <DateNavigator date={date} setDate={setDate} />
            <DailyLogForm date={date} />
        </main>
    )
}
