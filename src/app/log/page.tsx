'use client';

import { useState } from 'react';
import { DailyLogForm } from '@/components/DailyLogForm';
import { DateNavigator } from '@/components/DateNavigator';

export default function LogPage() {
    const [date, setDate] = useState(new Date());

    return (
        <main className="p-4 pt-6 pb-24">
            <DateNavigator date={date} setDate={setDate} />
            <DailyLogForm date={date} />
        </main>
    )
}
