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
            setHistory(data.reverse());
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
        <main className="p-6 pt-12 pb-24 space-y-8 max-w-2xl mx-auto">
            <h1
                className="text-3xl font-bold text-[var(--color-text)]"
                style={{ fontFamily: 'var(--font-display)' }}
            >
                Body Metrics
            </h1>

            <section
                className="p-6 rounded-2xl border shadow-sm space-y-4"
                style={{
                    background: 'var(--color-surface-elevated)',
                    borderColor: 'var(--color-border-light)',
                }}
            >
                <div>
                    <label
                        className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-2"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        <Scale className="w-4 h-4" /> Weight (lbs)
                    </label>
                    <input
                        type="number"
                        step="0.1"
                        placeholder="0.0"
                        value={weight}
                        onChange={e => setWeight(e.target.value)}
                        className="w-full p-4 rounded-xl text-2xl font-bold text-center outline-none transition-all"
                        style={{
                            background: 'var(--color-bg-subtle)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                        }}
                        onFocus={e => {
                            e.currentTarget.style.borderColor = 'var(--color-gold)';
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.15)';
                        }}
                        onBlur={e => {
                            e.currentTarget.style.borderColor = 'var(--color-border)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    />
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {[
                        { key: 'waist', label: 'Waist (in)' },
                        { key: 'chest', label: 'Chest (in)' },
                        { key: 'arms', label: 'Arms (in)' },
                    ].map(({ key, label }) => (
                        <div key={key}>
                            <label
                                className="text-xs font-bold uppercase tracking-wide mb-1 block"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                {label}
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                placeholder="0"
                                className="w-full p-2 rounded-lg text-center outline-none transition-all"
                                style={{
                                    background: 'var(--color-bg-subtle)',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-text)',
                                }}
                                value={measurements[key as keyof typeof measurements]}
                                onChange={e => setMeasurements({ ...measurements, [key]: e.target.value })}
                                onFocus={e => {
                                    e.currentTarget.style.borderColor = 'var(--color-gold)';
                                }}
                                onBlur={e => {
                                    e.currentTarget.style.borderColor = 'var(--color-border)';
                                }}
                            />
                        </div>
                    ))}
                </div>

                <div>
                    <label
                        className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-2"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        <Camera className="w-4 h-4" /> Photo URL (Optional)
                    </label>
                    <input
                        type="text"
                        placeholder="https://..."
                        value={photoUrl}
                        onChange={e => setPhotoUrl(e.target.value)}
                        className="w-full p-3 rounded-xl text-sm outline-none transition-all"
                        style={{
                            background: 'var(--color-bg-subtle)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                        }}
                        onFocus={e => {
                            e.currentTarget.style.borderColor = 'var(--color-gold)';
                        }}
                        onBlur={e => {
                            e.currentTarget.style.borderColor = 'var(--color-border)';
                        }}
                    />
                </div>

                <button
                    onClick={handleSave}
                    disabled={loading || !weight}
                    className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98]"
                    style={{
                        background: 'var(--color-primary)',
                        color: 'white',
                    }}
                >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Log Measurement'}
                </button>
            </section>

            <section>
                <h3
                    className="font-bold mb-4"
                    style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
                >
                    Recent History
                </h3>
                <div className="space-y-3">
                    {history.map((entry) => (
                        <div
                            key={entry.id}
                            className="p-4 rounded-xl flex justify-between items-center border"
                            style={{
                                background: 'var(--color-surface-elevated)',
                                borderColor: 'var(--color-border-light)',
                            }}
                        >
                            <div>
                                <p className="font-bold" style={{ color: 'var(--color-text)' }}>
                                    {format(new Date(entry.date), 'MMM d, yyyy')}
                                </p>
                                <div className="flex gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                    {entry.measurements?.waist > 0 && <span>W: {entry.measurements.waist}"</span>}
                                    {entry.measurements?.chest > 0 && <span>C: {entry.measurements.chest}"</span>}
                                </div>
                                {entry.photo_url && (
                                    <span className="text-xs block mt-1" style={{ color: 'var(--color-primary)' }}>
                                        📸 Photo attached
                                    </span>
                                )}
                            </div>
                            <div className="text-xl font-bold" style={{ color: 'var(--color-gold)' }}>
                                {entry.weight}{' '}
                                <span className="text-sm font-normal" style={{ color: 'var(--color-text-muted)' }}>
                                    lbs
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}
