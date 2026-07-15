'use client';

import { useState, useEffect, useMemo } from 'react';
import { getMonthlyLogs, getBodyMetricsHistory, getSettings, isAuthError } from '@/lib/api';
import { subDays, format } from 'date-fns';
import {
    LineChart, Line, BarChart, Bar, ComposedChart,
    XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid, Legend
} from 'recharts';
import { Loader2, TrendingUp, Scale, Camera, Calendar, Activity, RefreshCw, Flame, Moon, Beer, Flower2, ChartNoAxesColumn, BicepsFlexed, Zap, Bone, Hexagon } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { LoadError } from '@/components/ui';
import { useTabParam } from '@/lib/useTabParam';
import { TabPageSkeleton } from '@/components/Skeleton';
import { ExerciseProgressChart } from '@/components/analytics/ExerciseProgressChart';
import { PersonalRecordsList } from '@/components/analytics/PersonalRecordsList';
import { MuscleHeatmap } from '@/components/analytics/MuscleHeatmap';
import { getWorkoutsRange } from '@/lib/api';
import { getWorkoutDetails as getFullWorkout } from '@/lib/workout-api';

const KG_PER_LB = 0.453592;
const LB_PER_KG = 2.20462;

const WITHINGS_CONFIG: Record<string, { label: string; color: string; isMass: boolean; fixedUnit?: string }> = {
    body_fat_pct:       { label: 'Body Fat',      color: 'var(--color-primary)', isMass: false, fixedUnit: '%'   },
    muscle_mass_kg:     { label: 'Muscle Mass',   color: 'var(--chart-2)',              isMass: true                   },
    fat_free_mass_kg:   { label: 'Fat-Free Mass', color: 'var(--chart-1)',              isMass: true                   },
    bone_mass_kg:       { label: 'Bone Mass',     color: 'var(--chart-3)',              isMass: true                   },
    hydration_kg:       { label: 'Hydration',     color: 'var(--chart-4)',              isMass: true                   },
    visceral_fat_index: { label: 'Visceral Fat',  color: 'var(--chart-5)',              isMass: false, fixedUnit: ''    },
    vascular_age:       { label: 'Vascular Age',  color: 'var(--chart-6)',              isMass: false, fixedUnit: 'yrs' },
};

const RANGES = [
    { label: '7D',  days: 7   },
    { label: '30D', days: 30  },
    { label: '90D', days: 90  },
    { label: '6M',  days: 180 },
    { label: '1Y',  days: 365 },
] as const;

type RangeDays = typeof RANGES[number]['days'];

function xInterval(days: RangeDays): number {
    if (days <= 7)   return 0;
    if (days <= 30)  return 2;
    if (days <= 90)  return 6;
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
    const [loading, setLoading]             = useState(true);
    const [loadError, setLoadError]         = useState(false);
    const [range, setRange]                 = useState<RangeDays>(30);
    const [rawMetrics, setRawMetrics]       = useState<any[]>([]);
    const [proteinData, setProteinData]     = useState<any[]>([]);
    const [caloriesData, setCaloriesData]   = useState<any[]>([]);
    const [alcoholData, setAlcoholData]     = useState<any[]>([]);
    const [sleepEnergyData, setSleepEnergyData] = useState<any[]>([]);
    const [cycleData, setCycleData]         = useState<any[]>([]);
    const [settings, setSettings]           = useState<any>(null);
    const [proteinGoal, setProteinGoal]     = useState(150);
    const [summaryStats, setSummaryStats]   = useState({
        avgProtein: 0, avgCalories: 0, totalWorkouts: 0,
        avgSleep: 0, perfectDays: 0, loggedDays: 0,
    });
    const [activeTab, setActiveTab] = useTabParam(['overview', 'body', 'gains', 'heatmap'] as const, 'overview');
    const [workouts, setWorkouts]   = useState<any[]>([]);
    const [unit, setUnit]           = useState<'imperial' | 'metric'>('imperial');
    const [syncingWithings, setSyncingWithings] = useState(false);

    // Load unit preference
    useEffect(() => {
        const saved = localStorage.getItem('fitness_unit_pref');
        if (saved === 'metric') setUnit('metric');
    }, []);

    const toggleUnit = (next: 'imperial' | 'metric') => {
        setUnit(next);
        localStorage.setItem('fitness_unit_pref', next);
    };

    const weightUnit = unit === 'metric' ? 'kg' : 'lbs';
    const massUnit   = unit === 'metric' ? 'kg' : 'lbs';

    // Derived date format from current range
    const dateFmt = range <= 30 ? 'MM/dd' : range <= 180 ? 'MMM d' : 'MMM yy';

    // Unit-aware weight chart data
    const weightChartData = useMemo(() =>
        rawMetrics
            .filter(m => m.weight)
            .map(m => ({
                date:   format(new Date(m.date + 'T00:00:00'), dateFmt),
                weight: unit === 'metric'
                    ? Math.round(m.weight * KG_PER_LB * 10) / 10
                    : m.weight,
            })),
        [rawMetrics, unit, dateFmt]
    );

    // Unit-aware body comp chart data
    const bodyCompChartData = useMemo(() =>
        rawMetrics
            .filter(m => m.measurements && (
                m.measurements.body_fat_pct    !== undefined ||
                m.measurements.muscle_mass_kg  !== undefined ||
                m.measurements.fat_free_mass_kg !== undefined ||
                m.measurements.bone_mass_kg    !== undefined
            ))
            .map(m => {
                const meas = m.measurements || {};
                const toMass = (kg: number | undefined) =>
                    kg === undefined ? null
                    : unit === 'metric' ? kg
                    : Math.round(kg * LB_PER_KG * 10) / 10;
                return {
                    date:          format(new Date(m.date + 'T00:00:00'), dateFmt),
                    body_fat_pct:  meas.body_fat_pct  ?? null,
                    muscle_mass:   toMass(meas.muscle_mass_kg),
                    fat_free_mass: toMass(meas.fat_free_mass_kg),
                    bone_mass:     toMass(meas.bone_mass_kg),
                    hydration:     toMass(meas.hydration_kg),
                    visceral_fat:  meas.visceral_fat_index ?? null,
                    vascular_age:  meas.vascular_age ?? null,
                };
            }),
        [rawMetrics, unit, dateFmt]
    );

    // Latest Withings entry for summary card
    const latestBodyComp = useMemo(() =>
        [...rawMetrics].reverse().find(m =>
            m.measurements?.body_fat_pct !== undefined ||
            m.measurements?.muscle_mass_kg !== undefined
        ),
        [rawMetrics]
    );

    async function handleSyncWithings() {
        setSyncingWithings(true);
        try {
            const { supabase: sb } = await import('@/lib/supabase');
            const { data: { session } } = await sb.auth.getSession();
            const res = await fetch('/api/integrations/withings/sync', {
                method: 'POST',
                headers: { Authorization: `Bearer ${session?.access_token}` },
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Synced ${data.synced ?? ''} entries from Withings`);
                fetchData(range);
            } else {
                toast.error(data.error || 'Sync failed');
            }
        } catch {
            toast.error('Sync failed');
        } finally {
            setSyncingWithings(false);
        }
    }

    useEffect(() => { fetchData(range); }, [range]);

    async function fetchData(days: RangeDays) {
        setLoading(true);
        setLoadError(false);
        const end      = new Date();
        const start    = subDays(end, days);
        const startStr = format(start, 'yyyy-MM-dd');
        const endStr   = format(end,   'yyyy-MM-dd');
        const localFmt = days <= 30 ? 'MM/dd' : days <= 180 ? 'MMM d' : 'MMM yy';

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

            // Store raw metrics for unit-aware derived computations
            setRawMetrics(metrics as any[]);

            // --- chart data ---
            setProteinData(logs.map(log => ({
                date:    format(new Date(log.date + 'T00:00:00'), localFmt),
                protein: log.protein_grams || 0,
            })));
            setCaloriesData(logs.map(log => ({
                date:     format(new Date(log.date + 'T00:00:00'), localFmt),
                calories: log.calories || 0,
            })));
            setAlcoholData(logs.map(log => ({
                date:   format(new Date(log.date + 'T00:00:00'), localFmt),
                drinks: log.alcohol_drinks || 0,
            })));
            setSleepEnergyData(
                logs
                    .filter(log => log.sleep_quality || log.energy_level)
                    .map(log => ({
                        date:   format(new Date(log.date + 'T00:00:00'), localFmt),
                        sleep:  log.sleep_quality || null,
                        energy: log.energy_level  || null,
                    }))
            );

            if (userSettings?.enable_cycle_tracking === true) {
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
            const logsWithData  = logs.filter((l: any) => l.protein_grams || l.calories);
            const logsWithSleep = logs.filter((l: any) => l.sleep_quality);
            setSummaryStats({
                loggedDays:    logs.length,
                avgProtein:    logsWithData.length
                    ? Math.round(logsWithData.reduce((s: number, l: any) => s + (l.protein_grams || 0), 0) / logsWithData.length) : 0,
                avgCalories:   logsWithData.length
                    ? Math.round(logsWithData.reduce((s: number, l: any) => s + (l.calories || 0), 0) / logsWithData.length) : 0,
                totalWorkouts: recentWorkouts.length,
                avgSleep:      logsWithSleep.length
                    ? Math.round((logsWithSleep.reduce((s: number, l: any) => s + l.sleep_quality, 0) / logsWithSleep.length) * 10) / 10 : 0,
                perfectDays:   logs.filter((l: any) => l.movement_completed && (l.protein_grams || 0) >= pGoal).length,
            });
        } catch (error) {
            console.error(error);
            if (!isAuthError(error)) setLoadError(true);
        } finally {
            setLoading(false);
        }
    }

    const interval = xInterval(range);

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'body',     label: 'Body'     },
        { id: 'gains',    label: 'Gains'    },
        { id: 'heatmap',  label: 'Map'      },
    ] as const;

    // Target weight in display units
    const targetWeightDisplay = settings?.target_weight
        ? (unit === 'metric' ? Math.round(settings.target_weight * KG_PER_LB * 10) / 10 : settings.target_weight)
        : null;

    return (
        <main className="p-6 pt-12 pb-24 space-y-6 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <h1
                        className="text-3xl font-bold"
                        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
                    >
                        Trends
                    </h1>
                    {/* Unit Toggle */}
                    <div
                        className="flex text-xs font-bold rounded-full overflow-hidden"
                        style={{ border: '1px solid var(--color-border)' }}
                    >
                        <button
                            onClick={() => toggleUnit('imperial')}
                            className="px-2.5 py-1 transition-all"
                            style={unit === 'imperial'
                                ? { background: 'var(--color-navy)', color: 'var(--color-gold)' }
                                : { background: 'transparent', color: 'var(--color-text-muted)' }
                            }
                        >lbs</button>
                        <button
                            onClick={() => toggleUnit('metric')}
                            className="px-2.5 py-1 transition-all"
                            style={unit === 'metric'
                                ? { background: 'var(--color-navy)', color: 'var(--color-gold)' }
                                : { background: 'transparent', color: 'var(--color-text-muted)' }
                            }
                        >kg</button>
                    </div>
                </div>
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
                        style={{ background: 'rgba(77,137,226,0.1)', color: 'var(--color-primary)' }}
                        aria-label="History"
                    >
                        <Calendar className="w-5 h-5" />
                    </Link>
                    <Link
                        href="/metrics"
                        className="text-xs font-bold px-3 py-2 rounded-lg focus-ring"
                        style={{ background: 'var(--color-navy)', color: 'var(--color-gold)', border: '1px solid var(--color-gold-border)' }}
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

            {/* Tab Switcher — 4 tabs */}
            <div
                className="flex p-1 rounded-xl w-full"
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
                <TabPageSkeleton cards={4} />
            ) : loadError ? (
                <LoadError onRetry={() => fetchData(range)} />
            ) : (
                <>
                    {/* ── Overview Tab ── */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6 animate-in fade-in duration-300">

                            {/* Summary Stats */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Avg Protein',  value: summaryStats.avgProtein   ? `${summaryStats.avgProtein}g`           : '—' },
                                    { label: 'Avg Calories', value: summaryStats.avgCalories  ? summaryStats.avgCalories.toLocaleString() : '—' },
                                    { label: 'Workouts',     value: summaryStats.totalWorkouts || '—' },
                                    { label: 'Avg Sleep',    value: summaryStats.avgSleep      ? `${summaryStats.avgSleep}/5`             : '—' },
                                    { label: 'Perfect Days', value: summaryStats.perfectDays   || '—' },
                                    { label: 'Days Logged',  value: summaryStats.loggedDays    || '—' },
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
                            <ChartCard title="Calories" icon={<Flame className="w-5 h-5 text-[var(--chart-5)]" aria-hidden="true" />}>
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

                            {/* Sleep & Energy */}
                            {sleepEnergyData.length > 0 && (
                                <ChartCard title="Sleep Quality vs Energy" icon={<Moon className="w-5 h-5 text-[var(--chart-3)]" aria-hidden="true" />}>
                                    <ComposedChart data={sleepEnergyData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} interval={interval} axisLine={false} tickLine={false} />
                                        <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} width={20} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={tooltipStyle} />
                                        <Legend wrapperStyle={{ fontSize: 11, color: 'var(--color-text-muted)' }} />
                                        <Line type="monotone" dataKey="sleep"  stroke="var(--color-navy)" strokeWidth={2} dot={false} name="Sleep"  connectNulls />
                                        <Line type="monotone" dataKey="energy" stroke="var(--color-gold)" strokeWidth={2} dot={false} name="Energy" connectNulls />
                                    </ComposedChart>
                                </ChartCard>
                            )}

                            {/* Alcohol Chart */}
                            <ChartCard title="Alcohol Consumption" icon={<Beer className="w-5 h-5 text-[var(--chart-5)]" aria-hidden="true" />}>
                                <BarChart data={alcoholData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} interval={interval} axisLine={false} tickLine={false} />
                                    <YAxis width={20} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Bar dataKey="drinks" fill="var(--color-gold)" radius={[3, 3, 0, 0]} name="Drinks" />
                                </BarChart>
                            </ChartCard>

                            {/* Cycle Chart */}
                            {settings?.enable_cycle_tracking === true && cycleData.length > 0 && (
                                <ChartCard title="Cycle Phase vs Workout Duration" icon={<Flower2 className="w-5 h-5 text-[var(--chart-6)]" aria-hidden="true" />}>
                                    <BarChart data={cycleData}>
                                        <XAxis dataKey="flow" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                        <YAxis width={30} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={tooltipStyle} />
                                        <Bar dataKey="avgDuration" fill="var(--chart-6)" radius={[3, 3, 0, 0]} name="Avg Mins" />
                                    </BarChart>
                                </ChartCard>
                            )}

                            {/* Weight Chart */}
                            <ChartCard title={`Weight (${weightUnit})`} icon={<Scale className="w-5 h-5" style={{ color: 'var(--color-gold)' }} />}>
                                {weightChartData.length > 0 ? (
                                    <LineChart data={weightChartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} interval={interval} axisLine={false} tickLine={false} />
                                        <YAxis domain={['dataMin - 3', 'dataMax + 3']} width={35} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={tooltipStyle} />
                                        {targetWeightDisplay && (
                                            <ReferenceLine y={targetWeightDisplay} stroke="var(--color-success)" strokeDasharray="4 4" label={{ value: `Goal ${targetWeightDisplay}${weightUnit}`, fontSize: 10, fill: 'var(--color-success)' }} />
                                        )}
                                        <Line type="monotone" dataKey="weight" stroke="var(--color-gold)" strokeWidth={3} dot={{ r: 3, fill: 'var(--color-gold)', strokeWidth: 0 }} name={`Weight (${weightUnit})`} />
                                    </LineChart>
                                ) : (
                                    <div className="h-32 flex items-center justify-center text-sm italic" style={{ color: 'var(--color-text-muted)' }}>
                                        No weight data for this period.
                                    </div>
                                )}
                            </ChartCard>
                        </div>
                    )}

                    {/* ── Body Tab ── */}
                    {activeTab === 'body' && (
                        <div className="space-y-6 animate-in fade-in duration-300">

                            {/* Sync Withings button */}
                            <div className="flex justify-end">
                                <button
                                    onClick={handleSyncWithings}
                                    disabled={syncingWithings}
                                    className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                                    style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-primary)', border: '1px solid var(--color-border)' }}
                                >
                                    {syncingWithings
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <RefreshCw className="w-4 h-4" />}
                                    Sync Withings
                                </button>
                            </div>

                            {/* Latest Withings summary card */}
                            {latestBodyComp ? (
                                <section
                                    className="p-5 rounded-2xl border space-y-3"
                                    style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-light)' }}
                                >
                                    <div className="flex items-center gap-2">
                                        <Activity className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                                        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                                            Latest Reading · {format(new Date(latestBodyComp.date + 'T00:00:00'), 'MMM d, yyyy')}
                                        </span>
                                        <span
                                            className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                                            style={{ background: 'var(--color-primary)', color: 'white', opacity: 0.85 }}
                                        >
                                            Withings
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                        {/* Weight tile */}
                                        {latestBodyComp.weight && (
                                            <div className="rounded-xl p-3 text-center" style={{ background: 'var(--color-bg-subtle)' }}>
                                                <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Weight</p>
                                                <p className="text-lg font-bold" style={{ color: 'var(--color-gold)' }}>
                                                    {unit === 'metric'
                                                        ? Math.round(latestBodyComp.weight * KG_PER_LB * 10) / 10
                                                        : latestBodyComp.weight}
                                                    <span className="text-sm font-normal ml-0.5">{weightUnit}</span>
                                                </p>
                                            </div>
                                        )}
                                        {/* Body comp tiles */}
                                        {Object.entries(WITHINGS_CONFIG).map(([key, config]) => {
                                            const rawVal = latestBodyComp.measurements?.[key];
                                            if (rawVal === undefined) return null;
                                            const val     = config.isMass
                                                ? (unit === 'metric' ? rawVal : Math.round(rawVal * LB_PER_KG * 10) / 10)
                                                : rawVal;
                                            const unitStr = config.isMass ? massUnit : (config.fixedUnit ?? '');
                                            return (
                                                <div key={key} className="rounded-xl p-3 text-center" style={{ background: 'var(--color-bg-subtle)' }}>
                                                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>{config.label}</p>
                                                    <p className="text-lg font-bold" style={{ color: config.color }}>
                                                        {val}<span className="text-sm font-normal ml-0.5">{unitStr}</span>
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            ) : (
                                <div
                                    className="p-6 rounded-2xl border text-center text-sm"
                                    style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-light)', color: 'var(--color-text-muted)' }}
                                >
                                    No body composition data for this period.<br />
                                    <Link href="/settings" className="underline mt-1 inline-block" style={{ color: 'var(--color-primary)' }}>
                                        Sync from Withings in Settings
                                    </Link>
                                </div>
                            )}

                            {/* Weight Trend */}
                            <ChartCard title={`Weight (${weightUnit})`} icon={<Scale className="w-5 h-5" style={{ color: 'var(--color-gold)' }} />}>
                                {weightChartData.length > 0 ? (
                                    <LineChart data={weightChartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} interval={interval} axisLine={false} tickLine={false} />
                                        <YAxis domain={['dataMin - 3', 'dataMax + 3']} width={35} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={tooltipStyle} />
                                        {targetWeightDisplay && (
                                            <ReferenceLine y={targetWeightDisplay} stroke="var(--color-success)" strokeDasharray="4 4" label={{ value: `Goal ${targetWeightDisplay}${weightUnit}`, fontSize: 10, fill: 'var(--color-success)' }} />
                                        )}
                                        <Line type="monotone" dataKey="weight" stroke="var(--color-gold)" strokeWidth={3} dot={{ r: 3, fill: 'var(--color-gold)', strokeWidth: 0 }} name={`Weight (${weightUnit})`} />
                                    </LineChart>
                                ) : (
                                    <div className="h-32 flex items-center justify-center text-sm italic" style={{ color: 'var(--color-text-muted)' }}>
                                        No weight data for this period.
                                    </div>
                                )}
                            </ChartCard>

                            {/* Body Fat % Trend */}
                            {bodyCompChartData.some(d => d.body_fat_pct !== null) && (
                                <ChartCard title="Body Fat %" icon={<ChartNoAxesColumn className="w-5 h-5 text-[var(--chart-1)]" aria-hidden="true" />}>
                                    <LineChart data={bodyCompChartData.filter(d => d.body_fat_pct !== null)}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} interval={interval} axisLine={false} tickLine={false} />
                                        <YAxis domain={['dataMin - 1', 'dataMax + 1']} width={30} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} unit="%" />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}%`, 'Body Fat']} />
                                        <Line type="monotone" dataKey="body_fat_pct" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 3, fill: 'var(--color-primary)', strokeWidth: 0 }} name="Body Fat %" />
                                    </LineChart>
                                </ChartCard>
                            )}

                            {/* Muscle Mass Trend */}
                            {bodyCompChartData.some(d => d.muscle_mass !== null) && (
                                <ChartCard title={`Muscle Mass (${massUnit})`} icon={<BicepsFlexed className="w-5 h-5 text-[var(--chart-2)]" aria-hidden="true" />}>
                                    <LineChart data={bodyCompChartData.filter(d => d.muscle_mass !== null)}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} interval={interval} axisLine={false} tickLine={false} />
                                        <YAxis domain={['dataMin - 1', 'dataMax + 1']} width={35} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v} ${massUnit}`, 'Muscle Mass']} />
                                        <Line type="monotone" dataKey="muscle_mass" stroke="var(--chart-2)" strokeWidth={3} dot={{ r: 3, fill: 'var(--chart-2)', strokeWidth: 0 }} name={`Muscle Mass (${massUnit})`} />
                                    </LineChart>
                                </ChartCard>
                            )}

                            {/* Fat-Free Mass Trend */}
                            {bodyCompChartData.some(d => d.fat_free_mass !== null) && (
                                <ChartCard title={`Fat-Free Mass (${massUnit})`} icon={<Zap className="w-5 h-5 text-[var(--chart-4)]" aria-hidden="true" />}>
                                    <LineChart data={bodyCompChartData.filter(d => d.fat_free_mass !== null)}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} interval={interval} axisLine={false} tickLine={false} />
                                        <YAxis domain={['dataMin - 1', 'dataMax + 1']} width={35} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v} ${massUnit}`, 'Fat-Free Mass']} />
                                        <Line type="monotone" dataKey="fat_free_mass" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 3, fill: 'var(--chart-1)', strokeWidth: 0 }} name={`Fat-Free Mass (${massUnit})`} />
                                    </LineChart>
                                </ChartCard>
                            )}

                            {/* Bone Mass Trend */}
                            {bodyCompChartData.some(d => d.bone_mass !== null) && (
                                <ChartCard title={`Bone Mass (${massUnit})`} icon={<Bone className="w-5 h-5 text-[var(--color-text-muted)]" aria-hidden="true" />}>
                                    <LineChart data={bodyCompChartData.filter(d => d.bone_mass !== null)}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} interval={interval} axisLine={false} tickLine={false} />
                                        <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} width={35} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v} ${massUnit}`, 'Bone Mass']} />
                                        <Line type="monotone" dataKey="bone_mass" stroke="var(--chart-3)" strokeWidth={3} dot={{ r: 3, fill: 'var(--chart-3)', strokeWidth: 0 }} name={`Bone Mass (${massUnit})`} />
                                    </LineChart>
                                </ChartCard>
                            )}

                            {/* Visceral Fat Index */}
                            {bodyCompChartData.some(d => d.visceral_fat !== null) && (
                                <ChartCard title="Visceral Fat Index" icon={<Hexagon className="w-5 h-5 text-[var(--chart-5)]" aria-hidden="true" />}>
                                    <LineChart data={bodyCompChartData.filter(d => d.visceral_fat !== null)}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} interval={interval} axisLine={false} tickLine={false} />
                                        <YAxis domain={['dataMin - 1', 'dataMax + 1']} width={25} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v, 'Visceral Fat']} />
                                        <Line type="monotone" dataKey="visceral_fat" stroke="var(--chart-5)" strokeWidth={3} dot={{ r: 3, fill: 'var(--chart-5)', strokeWidth: 0 }} name="Visceral Fat Index" />
                                    </LineChart>
                                </ChartCard>
                            )}

                        </div>
                    )}

                    {/* ── Gains Tab ── */}
                    {activeTab === 'gains' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <ExerciseProgressChart />
                            <PersonalRecordsList />
                        </div>
                    )}

                    {/* ── Map Tab ── */}
                    {activeTab === 'heatmap' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <section
                                className="p-6 rounded-2xl border shadow-sm"
                                style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-light)' }}
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <Flame className="w-5 h-5 text-[var(--chart-5)]" aria-hidden="true" />
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
