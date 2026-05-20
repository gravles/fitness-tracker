'use client';

import { useState, useEffect } from 'react';
import { getMonthlyLogs, getBodyMetricsHistory, getSettings } from '@/lib/api';
import { subDays, format } from 'date-fns';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, LabelList } from 'recharts';
import { Loader2, TrendingUp, Scale, Camera, Calendar } from 'lucide-react';
import Link from 'next/link';
import { ExerciseProgressChart } from '@/components/analytics/ExerciseProgressChart';
import { PersonalRecordsList } from '@/components/analytics/PersonalRecordsList';
import { MuscleHeatmap } from '@/components/analytics/MuscleHeatmap';
import { getWorkoutsRange } from '@/lib/api';
import { getWorkoutDetails as getFullWorkout } from '@/lib/workout-api';

export default function TrendsPage() {
    const [loading, setLoading] = useState(true);
    const [weightData, setWeightData] = useState<any[]>([]);
    const [proteinData, setProteinData] = useState<any[]>([]);
    const [alcoholData, setAlcoholData] = useState<any[]>([]);
    const [cycleData, setCycleData] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [goal, setGoal] = useState(150);
    const [activeTab, setActiveTab] = useState<'overview' | 'gains' | 'heatmap'>('overview');
    const [workouts, setWorkouts] = useState<any[]>([]);

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
            const [logs, metrics, userSettings, recentWorkouts] = await Promise.all([
                getMonthlyLogs(startStr, endStr),
                getBodyMetricsHistory(startStr, endStr),
                getSettings(),
                getWorkoutsRange(startStr, endStr)
            ]);

            const detailedWorkouts = await Promise.all(
                recentWorkouts.map(async (w: any) => {
                    if (w.id) {
                        try { return await getFullWorkout(w.id); } catch { return w; }
                    }
                    return w;
                })
            );
            setWorkouts(detailedWorkouts);
            setSettings(userSettings);
            if (userSettings?.target_protein) setGoal(userSettings.target_protein);

            setProteinData(logs.map(log => ({
                date: format(new Date(log.date), 'MM/dd'),
                protein: log.protein_grams
            })));
            setAlcoholData(logs.map(log => ({
                date: format(new Date(log.date), 'MM/dd'),
                drinks: log.alcohol_drinks || 0
            })));
            setWeightData(
                metrics.filter(m => m.weight).map(m => ({
                    date: format(new Date(m.date), 'MM/dd'),
                    weight: m.weight
                }))
            );

            if (userSettings?.enable_cycle_tracking !== false) {
                const cycleStats: Record<string, { count: number, totalDuration: number }> = {
                    'Light': { count: 0, totalDuration: 0 },
                    'Medium': { count: 0, totalDuration: 0 },
                    'Heavy': { count: 0, totalDuration: 0 },
                };
                logs.forEach(log => {
                    const flow = log.menstrual_flow || 'None';
                    const duration = log.movement_duration || 0;
                    if (cycleStats[flow]) {
                        cycleStats[flow].count += 1;
                        cycleStats[flow].totalDuration += duration;
                    }
                });
                setCycleData(
                    Object.entries(cycleStats).map(([flow, stats]) => ({
                        flow,
                        avgDuration: stats.count > 0 ? Math.round(stats.totalDuration / stats.count) : 0
                    }))
                );
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return (
        <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin w-8 h-8" style={{ color: 'var(--color-primary)' }} />
        </div>
    );

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'gains', label: 'Gains' },
        { id: 'heatmap', label: 'Body Map' },
    ] as const;

    return (
        <main className="p-6 pt-12 pb-24 space-y-6 max-w-2xl mx-auto">
            <div className="flex justify-between items-center">
                <h1
                    className="text-3xl font-bold"
                    style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
                >
                    Trends
                </h1>
                <div className="flex gap-2">
                    <Link
                        href="/progress"
                        className="p-2 rounded-lg transition-all"
                        style={{ background: 'var(--color-gold-muted)', color: 'var(--color-gold)' }}
                        aria-label="Progress Photos"
                    >
                        <Camera className="w-5 h-5" />
                    </Link>
                    <Link
                        href="/calendar"
                        className="p-2 rounded-lg transition-all"
                        style={{ background: 'rgba(29,95,168,0.1)', color: 'var(--color-primary)' }}
                        aria-label="History"
                    >
                        <Calendar className="w-5 h-5" />
                    </Link>
                    <Link
                        href="/metrics"
                        className="text-xs font-bold px-3 py-2 rounded-lg"
                        style={{ background: 'var(--color-navy)', color: 'var(--color-gold)' }}
                    >
                        Log Body Metrics
                    </Link>
                </div>
            </div>

            {/* Tab Switcher */}
            <div
                className="flex p-1 rounded-xl w-full max-w-md mx-auto sm:mx-0"
                style={{ background: 'var(--color-bg-subtle)' }}
            >
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="flex-1 py-2 text-sm font-bold rounded-lg transition-all"
                        style={
                            activeTab === tab.id
                                ? {
                                    background: 'var(--color-surface-elevated)',
                                    color: 'var(--color-text)',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                                }
                                : { color: 'var(--color-text-muted)' }
                        }
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Protein Chart */}
                    <section
                        className="p-6 rounded-2xl border shadow-sm"
                        style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-light)' }}
                    >
                        <div className="flex items-center gap-2 mb-6">
                            <TrendingUp className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                            <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>
                                Protein Intake (30 Days)
                            </h3>
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={proteinData}>
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} interval={2} />
                                    <YAxis width={30} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--color-surface-elevated)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: '8px',
                                            color: 'var(--color-text)',
                                        }}
                                    />
                                    <ReferenceLine y={goal} stroke="var(--color-success)" strokeDasharray="3 3" label={`Goal: ${goal}g`} />
                                    <Bar dataKey="protein" fill="var(--color-primary)" radius={[4, 4, 0, 0]}>
                                        <LabelList dataKey="protein" position="top" fontSize={10} fill="var(--color-text-muted)" />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </section>

                    {/* Alcohol Chart */}
                    <section
                        className="p-6 rounded-2xl border shadow-sm"
                        style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-light)' }}
                    >
                        <div className="flex items-center gap-2 mb-6">
                            <span className="text-xl">🍺</span>
                            <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>
                                Alcohol Consumption
                            </h3>
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={alcoholData}>
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} interval={2} />
                                    <YAxis width={30} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--color-surface-elevated)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: '8px',
                                            color: 'var(--color-text)',
                                        }}
                                    />
                                    <Bar dataKey="drinks" fill="var(--color-gold)" radius={[4, 4, 0, 0]}>
                                        <LabelList dataKey="drinks" position="top" fontSize={10} fill="var(--color-text-muted)" />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </section>

                    {/* Cycle Chart */}
                    {(settings?.enable_cycle_tracking !== false && cycleData.length > 0) && (
                        <section
                            className="p-6 rounded-2xl border shadow-sm"
                            style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-light)' }}
                        >
                            <div className="flex items-center gap-2 mb-6">
                                <span className="text-xl">🌸</span>
                                <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>
                                    Cycle Phase vs Workout Duration
                                </h3>
                            </div>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={cycleData}>
                                        <XAxis dataKey="flow" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
                                        <YAxis width={30} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} label={{ value: 'Mins', angle: -90, position: 'insideLeft' }} />
                                        <Tooltip
                                            contentStyle={{
                                                background: 'var(--color-surface-elevated)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: '8px',
                                                color: 'var(--color-text)',
                                            }}
                                        />
                                        <Bar dataKey="avgDuration" fill="#ec4899" radius={[4, 4, 0, 0]}>
                                            <LabelList dataKey="avgDuration" position="top" fontSize={10} fill="var(--color-text-muted)" />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                                <p className="text-xs text-center mt-4 italic" style={{ color: 'var(--color-text-muted)' }}>
                                    Average workout duration (minutes) grouped by menstrual flow intensity.
                                </p>
                            </div>
                        </section>
                    )}

                    {/* Weight Chart */}
                    <section
                        className="p-6 rounded-2xl border shadow-sm"
                        style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-light)' }}
                    >
                        <div className="flex items-center gap-2 mb-6">
                            <Scale className="w-5 h-5" style={{ color: 'var(--color-gold)' }} />
                            <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>
                                Weight History
                            </h3>
                        </div>
                        {weightData.length > 0 ? (
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={weightData}>
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
                                        <YAxis domain={['dataMin - 5', 'dataMax + 5']} width={30} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
                                        <Tooltip
                                            contentStyle={{
                                                background: 'var(--color-surface-elevated)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: '8px',
                                                color: 'var(--color-text)',
                                            }}
                                        />
                                        <Line type="monotone" dataKey="weight" stroke="var(--color-gold)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-gold)' }}>
                                            <LabelList dataKey="weight" position="top" offset={10} fontSize={10} fill="var(--color-text-muted)" />
                                        </Line>
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div
                                className="h-32 flex items-center justify-center text-sm italic"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                No weight data logged yet.
                            </div>
                        )}
                    </section>
                </div>
            )}

            {/* Gains Tab */}
            {activeTab === 'gains' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <ExerciseProgressChart />
                    <PersonalRecordsList />
                </div>
            )}

            {/* Heatmap Tab */}
            {activeTab === 'heatmap' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <section
                        className="p-6 rounded-2xl border shadow-sm"
                        style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-light)' }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xl">🔥</span>
                            <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>
                                Workout Heatmap (30 Days)
                            </h3>
                        </div>
                        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
                            Visualizing muscle groups targeting based on your recent activity history.
                        </p>
                        <MuscleHeatmap workouts={workouts} />
                    </section>
                </div>
            )}
        </main>
    );
}
