'use client';

import { useState, useEffect } from 'react';
import { getMonthlyLogs, getBodyMetricsHistory, getSettings } from '@/lib/api';
import { subDays, format } from 'date-fns';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, LabelList } from 'recharts';
import { Loader2, TrendingUp, Scale } from 'lucide-react';
import Link from 'next/link';

export default function TrendsPage() {
    const [loading, setLoading] = useState(true);
    const [weightData, setWeightData] = useState<any[]>([]);
    const [proteinData, setProteinData] = useState<any[]>([]);
    const [goal, setGoal] = useState(150);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        const end = new Date();
        const start = subDays(end, 30);
        const startStr = format(start, 'yyyy-MM-dd');
        const endStr = format(end, 'yyyy-MM-dd');

        try {
            const [logs, metrics, settings] = await Promise.all([
                getMonthlyLogs(startStr, endStr),
                getBodyMetricsHistory(startStr, endStr),
                getSettings()
            ]);

            if (settings?.target_protein) {
                setGoal(settings.target_protein);
            }

            // Process Protein Data from Daily Logs
            const pData = logs.map(log => ({
                date: format(new Date(log.date), 'MM/dd'),
                protein: log.protein_grams // Allow nulls to skip painting the bar
            }));
            setProteinData(pData);

            // Process Weight Data from Body Metrics
            const wData = metrics
                .filter(m => m.weight)
                .map(m => ({
                    date: format(new Date(m.date), 'MM/dd'),
                    weight: m.weight
                }));
            setWeightData(wData);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

    return (
        <main className="p-6 pt-12 pb-24 space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Trends</h1>
                <Link href="/metrics" className="bg-black text-white text-xs font-bold px-3 py-2 rounded-lg">
                    Log Body Metrics
                </Link>
            </div>

            {/* Protein Chart */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    <h3 className="font-bold text-lg">Protein Intake (30 Days)</h3>
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={proteinData}>
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={2} />
                            <YAxis width={30} tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <ReferenceLine y={goal} stroke="green" strokeDasharray="3 3" label={`Goal: ${goal}g`} />
                            <Bar dataKey="protein" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                                <LabelList dataKey="protein" position="top" fontSize={10} fill="#666" />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </section>

            {/* Weight Chart */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                    <Scale className="w-5 h-5 text-purple-500" />
                    <h3 className="font-bold text-lg">Weight History</h3>
                </div>
                {weightData.length > 0 ? (
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={weightData}>
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                <YAxis domain={['dataMin - 5', 'dataMax + 5']} width={30} tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Line type="monotone" dataKey="weight" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }}>
                                    <LabelList dataKey="weight" position="top" offset={10} fontSize={10} fill="#666" />
                                </Line>
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-32 flex items-center justify-center text-gray-400 text-sm italic">
                        No weight data logged yet.
                    </div>
                )}
            </section>
        </main>
    );
}
