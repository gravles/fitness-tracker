'use client';

import { useState, useEffect } from 'react';
import { getUniqueExercises, getExerciseHistory, ExerciseStats } from '@/lib/analytics';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { Loader2, TrendingUp, Filter } from 'lucide-react';

export function ExerciseProgressChart() {
    const [loading, setLoading] = useState(true);
    const [exercises, setExercises] = useState<string[]>([]);
    const [selectedExercise, setSelectedExercise] = useState<string>('');
    const [data, setData] = useState<ExerciseStats[]>([]);
    const [metric, setMetric] = useState<'estimated_1rm' | 'weight' | 'volume'>('estimated_1rm');

    useEffect(() => {
        loadExercises();
    }, []);

    useEffect(() => {
        if (selectedExercise) {
            loadHistory(selectedExercise);
        }
    }, [selectedExercise]);

    async function loadExercises() {
        try {
            const list = await getUniqueExercises();
            setExercises(list);
            if (list.length > 0) setSelectedExercise(list[0]);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function loadHistory(name: string) {
        setLoading(true);
        try {
            const history = await getExerciseHistory(name);
            setData(history);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    if (loading && exercises.length === 0) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

    if (exercises.length === 0) return <div className="text-center p-8 text-gray-400 italic">No workout data found yet. Go lift something! 🏋️‍♂️</div>;

    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">

            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    <h3 className="font-bold text-lg">Gains Tracker</h3>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                        value={selectedExercise}
                        onChange={e => setSelectedExercise(e.target.value)}
                        className="p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 font-medium flex-1 sm:flex-none max-w-[200px]"
                    >
                        {exercises.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>

                    <select
                        value={metric}
                        onChange={e => setMetric(e.target.value as any)}
                        className="p-2 border border-blue-200 rounded-lg text-sm bg-blue-50 text-blue-700 font-bold"
                    >
                        <option value="estimated_1rm">Est. 1RM</option>
                        <option value="weight">Max Weight</option>
                        <option value="volume">Volume Load</option>
                    </select>
                </div>
            </div>

            {/* Chart */}
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} dy={10} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Line
                            type="monotone"
                            dataKey={metric}
                            stroke="#8b5cf6"
                            strokeWidth={3}
                            dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 0 }}
                            activeDot={{ r: 6 }}
                            animationDuration={1000}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Stats Footer */}
            {data.length > 0 && (
                <div className="flex justify-between items-center text-xs text-gray-500 pt-4 border-t border-gray-50">
                    <div>
                        Started: <span className="font-bold text-gray-900">{data[0].date}</span>
                    </div>
                    <div>
                        Current: <span className="font-bold text-gray-900">{data[data.length - 1][metric]}</span>
                    </div>
                    <div className="text-green-600 font-bold">
                        {
                            Math.round(((data[data.length - 1][metric] - data[0][metric]) / data[0][metric]) * 100)
                        }% Impr.
                    </div>
                </div>
            )}
        </div>
    );
}
