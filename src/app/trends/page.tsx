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
    const [alcoholData, setAlcoholData] = useState<any[]>([]);
    const [cycleData, setCycleData] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
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
            const [logs, metrics, userSettings] = await Promise.all([
                getMonthlyLogs(startStr, endStr),
                getBodyMetricsHistory(startStr, endStr),
                getSettings()
            ]);

            setSettings(userSettings);

            if (userSettings?.target_protein) {
                setGoal(userSettings.target_protein);
            }

            // Process Protein Data from Daily Logs
            const pData = logs.map(log => ({
                date: format(new Date(log.date), 'MM/dd'),
                protein: log.protein_grams // Allow nulls to skip painting the bar
            }));
            setProteinData(pData);

            // Process Alcohol Data
            const aData = logs.map(log => ({
                date: format(new Date(log.date), 'MM/dd'),
                drinks: log.alcohol_drinks || 0
            }));
            setAlcoholData(aData);

            // Process Weight Data from Body Metrics
            const wData = metrics
                .filter(m => m.weight)
                .map(m => ({
                    date: format(new Date(m.date), 'MM/dd'),
                    weight: m.weight
                }));
            setWeightData(wData);

            // Process Cycle Data (if enabled)
            if (userSettings?.enable_cycle_tracking !== false) {
                // We need to fetch workouts to correlate, but getMonthlyLogs gives us basic movement_completed.
                // For a deeper analysis (duration), we ideally need detailed workouts or legacy data.
                // For now, let's use 'movement_duration' from logs (legacy) combined with a future fetchWorkouts if we had a bulk endpoint (which we don't yet).
                // Actually, let's rely on daily_logs.movement_duration (legacy) AND we'll assume for MVP we only check the logs table data for now, 
                // as the new 'workouts' table data isn't bulk fetchable efficiently without a new API method.
                // LIMITATION: This chart currently only correlates LEGACY single-workout duration or boolean completion.
                // TODO: Add getWorkoutsRange to API for full support.

                // Group by Menstrual Flow
                const cycleStats: Record<string, { count: number, totalDuration: number }> = {
                    'None': { count: 0, totalDuration: 0 },
                    'Light': { count: 0, totalDuration: 0 },
                    'Medium': { count: 0, totalDuration: 0 },
                    'Heavy': { count: 0, totalDuration: 0 },
                };

                logs.forEach(log => {
                    const flow = log.menstrual_flow || 'None';
                    // Fallback to 0 if duration is missing
                    const duration = log.movement_duration || 0;

                    if (cycleStats[flow]) {
                        cycleStats[flow].count += 1;
                        cycleStats[flow].totalDuration += duration;
                    }
                });

                const cData = Object.entries(cycleStats).map(([flow, stats]) => ({
                    flow,
                    avgDuration: stats.count > 0 ? Math.round(stats.totalDuration / stats.count) : 0
                })).filter(d => d.flow !== 'None'); // Optional: hide 'None' if we only care about the period phases

                setCycleData(cData);
            }

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

            {/* Alcohol Chart */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                    <span className="text-xl">🍺</span>
                    <h3 className="font-bold text-lg">Alcohol Consumption</h3>
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={alcoholData}>
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={2} />
                            <YAxis width={30} tick={{ fontSize: 10 }} allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="drinks" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                                <LabelList dataKey="drinks" position="top" fontSize={10} fill="#666" />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </section>

            {/* Cycle Intelligence Chart */}
            {(settings?.enable_cycle_tracking !== false && cycleData.length > 0) && (
                <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <span className="text-xl">🌸</span>
                        <h3 className="font-bold text-lg">Cycle Phase vs Workout Duration</h3>
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={cycleData}>
                                <XAxis dataKey="flow" tick={{ fontSize: 12 }} />
                                <YAxis width={30} tick={{ fontSize: 10 }} label={{ value: 'Mins', angle: -90, position: 'insideLeft' }} />
                                <Tooltip />
                                <Bar dataKey="avgDuration" fill="#ec4899" radius={[4, 4, 0, 0]}>
                                    <LabelList dataKey="avgDuration" position="top" fontSize={10} fill="#666" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                        <p className="text-xs text-center text-gray-500 mt-4 italic">
                            Average workout duration (minutes) grouped by menstrual flow intensity.
                        </p>
                    </div>
                </section>
            )}

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
