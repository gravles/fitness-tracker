'use client';

import { useState, useEffect } from 'react';
import { getPersonalRecords, PersonalRecord } from '@/lib/analytics';
import { Trophy, Medal, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export function PersonalRecordsList() {
    const [records, setRecords] = useState<PersonalRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPRs();
    }, []);

    async function loadPRs() {
        try {
            const data = await getPersonalRecords();
            setRecords(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />;

    if (records.length === 0) return null;

    return (
        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <h3 className="font-bold text-lg">Personal Records</h3>
            </div>

            <div className="space-y-3">
                {records.slice(0, 5).map((pr, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${i === 0 ? 'bg-yellow-100 text-yellow-700' :
                                    i === 1 ? 'bg-gray-200 text-gray-700' :
                                        i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-white text-gray-500 border border-gray-200'
                                }`}>
                                {i + 1}
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-gray-900">{pr.exercise_name}</h4>
                                <div className="flex items-center gap-1 text-xs text-gray-400">
                                    <Calendar className="w-3 h-3" />
                                    {format(new Date(pr.date), 'MMM d, yyyy')}
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="block font-black text-lg text-gray-900">{pr.max_weight}<span className="text-xs font-medium text-gray-400 ml-0.5">lbs</span></span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
