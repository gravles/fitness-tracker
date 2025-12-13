'use client';

import { useState, useEffect } from 'react';
import { upsertBodyMetrics, getBodyMetricsHistory } from '@/lib/api';
import { Loader2, Scale, Camera } from 'lucide-react';
import { format, subDays } from 'date-fns';

export default function BodyMetricsPage() {
    const [loading, setLoading] = useState(false);
    const [weight, setWeight] = useState<string>('');
    const [photoUrl, setPhotoUrl] = useState('');
    const [measurements, setMeasurements] = useState({ waist: '', chest: '', arms: '' });
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        loadHistory();
    }, []);

    async function loadHistory() {
        const end = new Date();
        const start = subDays(end, 90);
        try {
            const data = await getBodyMetricsHistory(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
            setHistory(data.reverse()); // Show newest first
        } catch (error) {
            console.error(error);
        }
    }

    async function handleSave() {
        if (!weight) return;
        setLoading(true);
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        try {
            await upsertBodyMetrics({
                date: todayStr,
                weight: parseFloat(weight),
                photo_url: photoUrl || null,
                measurements: {
                    waist: parseFloat(measurements.waist) || 0,
                    chest: parseFloat(measurements.chest) || 0,
                    arms: parseFloat(measurements.arms) || 0,
                }
            });
            alert('Saved!');
            setWeight('');
            setPhotoUrl('');
            setMeasurements({ waist: '', chest: '', arms: '' });
            loadHistory();
        } catch (error) {
            alert('Error saving metrics');
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="p-6 pt-12 pb-24 space-y-8">
            <h1 className="text-3xl font-bold text-gray-900">Body Metrics</h1>

            {/* Input Form */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-2">
                        <Scale className="w-4 h-4" /> Weight (lbs)
                    </label>
                    <input
                        type="number"
                        step="0.1"
                        placeholder="0.0"
                        value={weight}
                        onChange={e => setWeight(e.target.value)}
                        className="w-full p-4 bg-gray-50 rounded-xl text-2xl font-bold text-center"
                    />
                </div>

                <div className="grid grid-cols-3 gap-2">
                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Waist (in)</label>
                        <input type="number" step="0.1" placeholder="0" className="w-full p-2 bg-gray-50 rounded-lg text-center"
                            value={measurements.waist} onChange={e => setMeasurements({ ...measurements, waist: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Chest (in)</label>
                        <input type="number" step="0.1" placeholder="0" className="w-full p-2 bg-gray-50 rounded-lg text-center"
                            value={measurements.chest} onChange={e => setMeasurements({ ...measurements, chest: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Arms (in)</label>
                        <input type="number" step="0.1" placeholder="0" className="w-full p-2 bg-gray-50 rounded-lg text-center"
                            value={measurements.arms} onChange={e => setMeasurements({ ...measurements, arms: e.target.value })} />
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-2">
                        <Camera className="w-4 h-4" /> Photo URL (Optional)
                    </label>
                    <input
                        type="text"
                        placeholder="https://..."
                        value={photoUrl}
                        onChange={e => setPhotoUrl(e.target.value)}
                        className="w-full p-3 bg-gray-50 rounded-xl text-sm"
                    />
                </div>

                <button
                    onClick={handleSave}
                    disabled={loading || !weight}
                    className="w-full py-4 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin" /> : 'Log Measurement'}
                </button>
            </section>

            {/* History List */}
            <section>
                <h3 className="font-bold text-gray-900 mb-4">Recent History</h3>
                <div className="space-y-3">
                    {history.map((entry) => (
                        <div key={entry.id} className="bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center">
                            <div>
                                <p className="font-bold text-gray-900">{format(new Date(entry.date), 'MMM d, yyyy')}</p>
                                <div className="flex gap-2 text-xs text-gray-500">
                                    {entry.measurements?.waist > 0 && <span>W: {entry.measurements.waist}"</span>}
                                    {entry.measurements?.chest > 0 && <span>C: {entry.measurements.chest}"</span>}
                                </div>
                                {entry.photo_url && <span className="text-xs text-blue-500 block mt-1">📸 Photo attached</span>}
                            </div>
                            <div className="text-xl font-bold text-purple-600">
                                {entry.weight} <span className="text-sm font-normal text-gray-400">lbs</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}
