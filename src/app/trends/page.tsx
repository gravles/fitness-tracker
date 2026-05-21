'use client';

import { useState, useEffect } from 'react';
import { getMonthlyLogs, getBodyMetricsHistory, getSettings } from '@/lib/api';
import { subDays, format } from 'date-fns';
import {
    LineChart, Line, BarChart, Bar, ComposedChart,
    XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid, Legend
} from 'recharts';
import { Loader2, TrendingUp, Scale, Camera, Calendar } from 'lucide-react';
import Link from 'next/link';
import { ExerciseProgressChart } from '@/components/analytics/ExerciseProgressChart';
import { PersonalRecordsList } from '@/components/analytics/PersonalRecordsList';
import { MuscleHeatmap } from '@/components/analytics/MuscleHeatmap';
import { getWorkoutsRange } from '@/lib/api';
import { getWorkoutDetails as getFullWorkout } from '@/lib/workout-api';

const RANGES = [
    { label: '7D', days: 7 },
    { label: '30D', days: 30 },
    { label: '90D', days: 90 },
    { label: '6M', days: 180 },
    { label: '1Y', days: 365 },
] as const;

type RangeDays = typeof RANGES[number]['days'];

function xInterval(days: RangeDays): number {
    if (days <= 7) return 0;
    if (days <= 30) return 2;
    if (days <= 90) return 6;
    if (days <= 180) return 13;
    return 29;
}

const tooltipStyle = {
    background: 'var(--color-surface-elevated)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    color: 'var(--color-text)',
    fontSize: 12,
};

export default function TrendsPage() {
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState<RangeDays>(30);
    const [weightData, setWeightData] = useState<any[]>([]);
    const [proteinData, setProteinData] = useState<any[]>([]);
    const [caloriesData, setCaloriesData] = useState<any[]>([]);
    const [alcoholData, setAlcoholData] = useState<any[]>([]);
    const [sleepEnergyData, setSleepEnergyData] = useState<any[]>([]);
    const [cycleData, setCycleData] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [proteinGoal, setProteinGoal] = useState(150);
    const [summaryStats, setSummaryStats] = useState({
        avgProtein: 0,
        avgCalories: 0,
        totalWorkouts: 0,
        avgSleep: 0,
        perfectDays: 0,
        loggedDays: 0,
    });
    const [activeTab, setActiveTab] = useState<'overview' | 'gains' | 'heatmap'>('overview');
    const [workouts, setWorkouts] = useState<any[]>([]);

    useEffect(() => {
        fetchData(range);
    }, [range]);

    async function fetchData(days: RangeDays) {
        setLoading(true);
        const end = new Date();
        const start = subDays(end, days);
        const startStr = format(start, 'yyyy-MM-dd');
        const endStr = format(end, 'yyyy-MM-dd');

        const dateFmt = days <= 30 ? 'MM/dd' : days <= 180 ? 'MMM d' : 'MMM yy';

        try {
            const [logs, metrics, userSettings, recentWorkouts] = await Promise.all([
                getMonthlyLogs(startStr, endStr),
                getBodyMetricsHistory(startStr, endStr),
                getSettings(),
                getWorkoutsRange(startStr, endStr),
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
            const pGoal = userSettings?.target_protein || 150;
            if (userSettings?.target_protein) setProteinGoal(pGoal);

            // --- chart data ---
            setProteinData(logs.map(log => ({
                date: format(new Date(log.date + 'T00:00:00'), dateFmt),
                protein: log.protein_grams || 0,
            })));
            setCaloriesData(logs.map(log => ({
                date: format(new Date(log.date + 'T00:00:00'), dateFmt),
                calories: log.calories || 0,
            })));
            setAlcoholData(logs.map(log => ({
                date: format(new Date(log.date + 'T00:00:00'), dateFmt),
                drinks: log.alcohol_drinks || 0,
            })));
            setSleepEnergyData(
                logs
                    .filter(log => log.sleep_quality || log.energy_level)
                    .map(log => ({
                        date: format(new Date(log.date + 'T00:00:00'), dateFmt),
                        sleep: log.sleep_quality || null,
                        energy: log.energy_level || null,
                    }))
            );
            setWeightData(
                metrics.filter((m: any) => m.weight).map((m: any) => ({
                    date: format(new Date(m.date + 'T00:00:00'), dateFmt),
                    weight: m.weight,
                }))
            );

            if (userSettings?.enable_cycle_tracking !== false) {
                const cycleStats: Record<string, { count: number; totalDuration: number }> = {
                    Light: { count: 0, totalDuration: 0 },
                    Medium: { count: 0, totalDuration: 0 },
                    Heavy: { count: 0, totalDuration: 0 },
                };
                logs.forEach((log: any) => {
                    const flow = log.menstrual_flow || 'None';
                    if (cycleStats[flow]) {
                        cycleStats[flow].count += 1;
                        cycleStats[flow].totalDuration += log.movement_duration || 0;
                    }
                });
                setCycleData(
                    Object.entries(cycleStats).map(([flow, stats]) => ({
                        flow,
                        avgDuration: stats.count > 0 ? Math.round(stats.totalDuration / stats.count) : 0,
                    }))
                );
            }

            // --- summary stats ---
            const logsWithData = logs.filter((l: any) => l.protein_grams || l.calories);
            const logsWithSleep = logs.filter((l: any) => l.sleep_quality);
            setSummaryStats({
                loggedDays: logs.length,
                avgProtein: logsWithData.length
                    ? Math.round(logsWithData.reduce((s: number, l: any) => s + (l.protein_grams || 0), 0) / logsWithData.length)
                    : 0,
                avgCalories: logsWithData.length
                    ? Math.round(logsWithData.reduce((s: number, l: any) => s + (l.calories || 0), 0) / logsWithData.length)
                    : 0,
                totalWorkouts: recentWorkouts.length,
                avgSleep: logsWithSleep.length
                    ? Math.round((logsWithSleep.reduce((s: number, l: any) => s + l.sleep_quality, 0) / logsWithSleep.length) * 10) / 10
                    : 0,
                perfectDays: logs.filter((l: any) => l.movement_completed && (l.protein_grams || 0) >= pGoal).length,
            });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const interval = xInterval(range);
    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'gains', label: 'Gains' },
        { id: 'heatmap', label: 'Body Map' },
    ] as const;

    return (
        <main className="p-6 pt-12 pb-24 space-y-6 max-w-2xl mx-auto">
            {/* Header */}
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
                        Log Body
                    </Link>
                </div>
            </div>

            {/* Range Selector */}
            <div className="flex gap-2">
                {RANGES.map(r => (
                    <button
                        key={r.days}
                        onClick={() => setRange(r.days)}
                        className="flex-1 py-1.5 text-sm font-bold rounded-lg transition-all"
                        style={
                            range === r.days
                                ? { background: 'var(--color-navy)', color: 'var(--color-gold)' }
                                : { background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }
                        }
                    >
                        {r.label}
                    </button>
                ))}
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
                                ? { background: 'var(--color-surface-elevated)', color: 'var(--color-text)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                                : { color: 'var(--color-text-muted)' }
                        }
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="p-12 flex justify-center">
                    <Loader2 className="animate-spin w-8 h-8" style={{ color: 'var(--color-primary)' }} />
                </div>
            ) : (
                <>
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6 animate-in fade-in duration-300">

                            {/* Summary Stats */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Avg Protein', value: summaryStats.avgProtein ? `${summaryStats.avgProtein}g` : '—' },
                                    { label: 'Avg Calories', value: summaryStats.avgCalories ? summaryStats.avgCalories.toLocaleString() : '—' },
                                    { label: 'Workouts', value: summaryStats.totalWorkouts || '—' },
                                    { label: 'Avg Sleep', value: summaryStats.avgSleep ? `${summaryStats.avgSleep}/5` : '—' },
                                    { label: 'Perfect Days', value: summaryStats.perfectDays || '—' },
                                    { label: 'Days Logged', value: summaryStats.loggedDays || '—' },
                                ].map(stat => (
                                    <div
                                        key={stat.label}
                                        className="p-3 rounded-xl text-center"
                                        style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border-light)' }}
                                    >
                                        <div className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{stat.value}</div>
                                        <div className="text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{stat.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Protein Chart */}
                            <ChartCard title="Protein Intake" icon={<TrendingUp className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />}>
                                <BarChart data={proteinData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} interval={interval} axisLine={false} tickLine={false} />
                                    <YAxis width={30} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <ReferenceLine y={proteinGoal} stroke="var(--color-success)" strokeDasharray="4 4" label={{ value: `Goal ${proteinGoal}g`, fontSize: 10, fill: 'var(--color-success)' }} />
                                    <Bar dataKey="protein" fill="var(--color-primary)" radius={[3, 3, 0, 0]} name="Protein (g)" />
                                </BarChart>
                            </ChartCard>

                            {/* Calories Chart */}
                            <ChartCard title="Calories" icon={<span className="text-xl">🔥</span>}>
                                <BarChart data={caloriesData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} interval={interval} axisLine={false} tickLine={false} />
                                    <YAxis width={35} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    {settings?.target_calories && (
                                        <ReferenceLine y={settings.target_calories} stroke="var(--color-gold)" strokeDasharray="4 4" label={{ value: `Goal ${settings.target_calories}`, fontSize: 10, fill: 'var(--color-gold)' }} />
                                    )}
                                    <Bar dataKey="calories" fill="var(--color-gold)" radius={[3, 3, 0, 0]} name="Calories" />
                                </BarChart>
                            </ChartCard>

                            {/* Sleep & Energy Compound Chart */}
                            {sleepEnergyData.length > 0 && (
                                <ChartCard title="Sleep Quality vs Energy" icon={<span className="text-xl">😴</span>}>
                                    <ComposedChart data={sleepEnergyData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} interval={interval} axisLine={false} tickLine={false} />
                                        <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} width={20} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={tooltipStyle} />
                                        <Legend wrapperStyle={{ fontSize: 11, color: 'var(--color-text-muted)' }} />
                                        <Line type="monotone" dataKey="sleep" stroke="var(--color-navy)" strokeWidth={2} dot={false} name="Sleep" connectNulls />
                                        <Line type="monotone" dataKey="energy" stroke="var(--color-gold)" strokeWidth={2} dot={false} name="Energy" connectNulls />
                                    </ComposedChart>
                                </ChartCard>
                            )}

                            {/* Alcohol Chart */}
                            <ChartCard title="Alcohol Consumption" icon={<span className="text-xl">🍺</span>}>
                                <BarChart data={alcoholData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} interval={interval} axisLine={false} tickLine={false} />
                                    <YAxis width={20} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Bar dataKey="drinks" fill="var(--color-gold)" radius={[3, 3, 0, 0]} name="Drinks" />
                                </BarChart>
                            </ChartCard>

                            {/* Cycle Chart */}
                            {settings?.enable_cycle_tracking !== false && cycleData.length > 0 && (
                                <ChartCard title="Cycle Phase vs Workout Duration" icon={<span className="text-xl">🌸</span>}>
                                    <BarChart data={cycleData}>
                                        <XAxis dataKey="flow" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                        <YAxis width={30} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={tooltipStyle} />
                                        <Bar dataKey="avgDuration" fill="#ec4899" radius={[3, 3, 0, 0]} name="Avg Mins" />
                                    </BarChart>
                                </ChartCard>
                            )}

                            {/* Weight Chart */}
                            <ChartCard title="Weight History" icon={<Scale className="w-5 h-5" style={{ color: 'var(--color-gold)' }} />}>
                                {weightData.length > 0 ? (
                                    <LineChart data={weightData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} interval={interval} axisLine={false} tickLine={false} />
                                        <YAxis domain={['dataMin - 3', 'dataMax + 3']} width={35} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={tooltipStyle} />
                                        {settings?.target_weight && (
                                            <ReferenceLine y={settings.target_weight} stroke="var(--color-success)" strokeDasharray="4 4" label={{ value: `Goal ${settings.target_weight}lb`, fontSize: 10, fill: 'var(--color-success)' }} />
                                        )}
                                        <Line type="monotone" dataKey="weight" stroke="var(--color-gold)" strokeWidth={3} dot={{ r: 3, fill: 'var(--color-gold)', strokeWidth: 0 }} name="Weight (lbs)" />
                                    </LineChart>
                                ) : (
                                    <div className="h-32 flex items-center justify-center text-sm italic" style={{ color: 'var(--color-text-muted)' }}>
                                        No weight data for this period.
                                    </div>
                                )}
                            </ChartCard>
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
                                        Workout Heatmap
                                    </h3>
                                </div>
                                <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
                                    Muscle groups targeted based on your recent activity.
                                </p>
                                <MuscleHeatmap workouts={workouts} />
                            </section>
                        </div>
                    )}
                </>
            )}
        </main>
    );
}

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <section
            className="p-6 rounded-2xl border shadow-sm"
            style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-light)' }}
        >
            <div className="flex items-center gap-2 mb-5">
                {icon}
                <h3 className="font-bold text-base" style={{ color: 'var(--color-text)' }}>{title}</h3>
            </div>
            <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    {children as React.ReactElement}
                </ResponsiveContainer>
            </div>
        </section>
    );
}
