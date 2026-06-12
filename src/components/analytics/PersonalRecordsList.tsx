'use client';

import { useState, useEffect } from 'react';
import { getPersonalRecords, PersonalRecord } from '@/lib/analytics';
import { Trophy, Calendar } from 'lucide-react';
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

    if (loading) return <div className="h-20 bg-[var(--color-bg-muted)] rounded-xl animate-pulse" />;

    if (records.length === 0) return null;

    return (
        <section className="bg-[var(--color-surface-elevated)] p-6 rounded-2xl border border-[var(--color-border-light)] shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5" style={{ color: 'var(--color-gold)' }} />
                    <h3 className="font-bold text-lg text-[var(--color-text)]">Personal Records</h3>
                </div>
                <input
                    type="text"
                    placeholder="Search exercises..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full sm:w-auto px-4 py-2 bg-[var(--color-bg-subtle)] rounded-lg text-sm border border-[var(--color-border-light)] outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
                    onFocus={e => { e.target.style.borderColor = 'var(--color-gold)'; }}
                    onBlur={e => { e.target.style.borderColor = ''; }}
                />
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {filtered.map((pr, i) => (
                    <div
                        key={i}
                        className="flex items-center justify-between p-3 bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border-light)] transition-colors"
                        style={{}}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(224,179,90,0.4)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '')}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
                                style={i < 3
                                    ? { background: 'rgba(224,179,90,0.15)', color: 'var(--color-gold)' }
                                    : { background: 'var(--color-surface-elevated)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }
                                }
                            >
                                {i + 1}
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-[var(--color-text)]">{pr.exercise_name}</h4>
                                <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                                    <Calendar className="w-3 h-3" />
                                    {format(new Date(pr.date), 'MMM d, yyyy')}
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="block font-black text-lg text-[var(--color-text)]">
                                {pr.max_weight}<span className="text-xs font-medium text-[var(--color-text-muted)] ml-0.5">lbs</span>
                            </span>
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <p className="text-center text-[var(--color-text-muted)] text-sm py-4">No records found matching "{search}"</p>
                )}
            </div>
        </section>
    );
}
