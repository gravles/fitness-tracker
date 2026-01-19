'use client';

import { useState, useEffect } from 'react';
import { getPersonalRecords, PersonalRecord } from '@/lib/analytics';
import { Trophy, Medal, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export function PersonalRecordsList() {
    const [records, setRecords] = useState<PersonalRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

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

    const filtered = records.filter(pr => pr.exercise_name.toLowerCase().includes(search.toLowerCase()));

    if (loading) return <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />;

    if (records.length === 0) return null;

    return (
        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    <h3 className="font-bold text-lg">Personal Records</h3>
                </div>
                <input
                    type="text"
                    placeholder="Search exercises..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full sm:w-auto px-4 py-2 bg-gray-50 rounded-lg text-sm border border-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {filtered.map((pr, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group hover:border-yellow-200 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${i < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-white text-gray-500 border border-gray-200'}`}>
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
                {filtered.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-4">No records found matching "{search}"</p>
                )}
            </div>
        </section>
    );
}
