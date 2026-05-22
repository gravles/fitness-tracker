'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { upsertBodyMetrics, getBodyMetricsHistory } from '@/lib/api';
import { Loader2, Scale, Camera, ImageIcon, Activity, Zap, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { supabase } from '@/lib/supabase';

const KG_PER_LB = 0.453592;
const LB_PER_KG = 2.20462;
const CM_PER_IN = 2.54;

const WITHINGS_CONFIG: Record<string, { label: string; color: string; isMass: boolean; fixedUnit?: string }> = {
    body_fat_pct:       { label: 'Body Fat',      color: 'var(--color-primary)', isMass: false, fixedUnit: '%'   },
    muscle_mass_kg:     { label: 'Muscle Mass',   color: '#22c55e',              isMass: true                   },
    fat_free_mass_kg:   { label: 'Fat-Free Mass', color: '#3b82f6',              isMass: true                   },
    bone_mass_kg:       { label: 'Bone Mass',     color: '#a855f7',              isMass: true                   },
    hydration_kg:       { label: 'Hydration',     color: '#06b6d4',              isMass: true                   },
    visceral_fat_index: { label: 'Visceral Fat',  color: '#f97316',              isMass: false, fixedUnit: ''    },
    vascular_age:       { label: 'Vascular Age',  color: '#ec4899',              isMass: false, fixedUnit: 'yrs' },
};

export default function BodyMetricsPage() {
    const [loading, setLoading]     = useState(false);
    const [weight, setWeight]       = useState<string>('');
    const [photoUrl, setPhotoUrl]   = useState('');
    const [photoUploading, setPhotoUploading] = useState(false);
    const [measurements, setMeasurements]     = useState({ waist: '', chest: '', arms: '' });
    const [history, setHistory]     = useState<any[]>([]);
    const [unit, setUnit]           = useState<'imperial' | 'metric'>('imperial');
    const photoInputRef = useRef<HTMLInputElement>(null);

    // Load unit preference
    useEffect(() => {
        const saved = localStorage.getItem('fitness_unit_pref');
        if (saved === 'metric') setUnit('metric');
    }, []);

    const toggleUnit = (next: 'imperial' | 'metric') => {
        setUnit(next);
        localStorage.setItem('fitness_unit_pref', next);
    };

    // Helpers
    const weightUnit      = unit === 'metric' ? 'kg' : 'lbs';
    const massUnit        = unit === 'metric' ? 'kg' : 'lbs';
    const measureUnit     = unit === 'metric' ? 'cm' : 'in';

    const displayWeight = (lbs: number) =>
        unit === 'metric' ? Math.round(lbs * KG_PER_LB * 10) / 10 : lbs;

    const displayMass = (kg: number) =>
        unit === 'imperial' ? Math.round(kg * LB_PER_KG * 10) / 10 : kg;

    const displayMeasure = (inches: number) =>
        unit === 'metric' ? Math.round(inches * CM_PER_IN * 10) / 10 : inches;

    async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setPhotoUploading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');
            const ext = file.name.split('.').pop() || 'jpg';
            const path = `${session.user.id}/metrics/${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from('progress-photos')
                .upload(path, file, { upsert: true });
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage
                .from('progress-photos')
                .getPublicUrl(path);
            setPhotoUrl(publicUrl);
            toast.success('Photo uploaded!');
        } catch (err: any) {
            toast.error('Failed to upload photo');
            console.error(err);
        } finally {
            setPhotoUploading(false);
        }
    }

    useEffect(() => { loadHistory(); }, []);

    async function loadHistory() {
        const end   = new Date();
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
        // Convert input to lbs for storage (DB always stores lbs)
        const weightLbs = unit === 'metric'
            ? Math.round(parseFloat(weight) * LB_PER_KG * 10) / 10
            : parseFloat(weight);
        // Convert measurements to inches for storage
        const waistIn = parseFloat(measurements.waist) || 0;
        const chestIn = parseFloat(measurements.chest) || 0;
        const armsIn  = parseFloat(measurements.arms)  || 0;
        const toInches = (v: number) => unit === 'metric' ? v / CM_PER_IN : v;

        try {
            await upsertBodyMetrics({
                date:       todayStr,
                weight:     weightLbs,
                photo_url:  photoUrl || null,
                measurements: {
                    waist: toInches(waistIn),
                    chest: toInches(chestIn),
                    arms:  toInches(armsIn),
                }
            });
            toast.success('Saved!');
            setWeight('');
            setPhotoUrl('');
            setMeasurements({ waist: '', chest: '', arms: '' });
            loadHistory();
        } catch (error) {
            toast.error('Error saving metrics');
        } finally {
            setLoading(false);
        }
    }

    // Most recent entry with body comp data
    const latestBodyComp = history.find(e =>
        e.measurements?.body_fat_pct !== undefined ||
        e.measurements?.muscle_mass_kg !== undefined
    );

    return (
        <main className="p-6 pt-12 pb-24 space-y-8 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h1
                        className="text-3xl font-bold"
                        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}
                    >
                        Body Metrics
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
                <Link
                    href="/trends"
                    className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl transition-all active:scale-95"
                    style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-primary)' }}
                >
                    <TrendingUp className="w-4 h-4" />
                    Stats
                </Link>
            </div>

            {/* Body Composition Summary (Withings data) */}
            {latestBodyComp && (
                <section
                    className="p-5 rounded-2xl border space-y-3"
                    style={{
                        background: 'var(--color-surface-elevated)',
                        borderColor: 'var(--color-border-light)',
                    }}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                            Body Composition · {format(new Date(latestBodyComp.date + 'T00:00:00'), 'MMM d')}
                        </span>
                        <span
                            className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'var(--color-primary)', color: 'white', opacity: 0.85 }}
                        >
                            Withings
                        </span>
                    </div>

                    {/* Weight tile */}
                    {latestBodyComp.weight && (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            <div
                                className="rounded-xl p-3 text-center"
                                style={{ background: 'var(--color-bg-subtle)' }}
                            >
                                <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Weight</p>
                                <p className="text-lg font-bold" style={{ color: 'var(--color-gold)' }}>
                                    {displayWeight(latestBodyComp.weight)}
                                    <span className="text-sm font-normal ml-0.5">{weightUnit}</span>
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {Object.entries(WITHINGS_CONFIG).map(([key, config]) => {
                            const rawVal = latestBodyComp.measurements?.[key];
                            if (rawVal === undefined) return null;
                            const val = config.isMass ? displayMass(rawVal) : rawVal;
                            const unitStr = config.isMass ? massUnit : (config.fixedUnit ?? '');
                            return (
                                <div
                                    key={key}
                                    className="rounded-xl p-3 text-center"
                                    style={{ background: 'var(--color-bg-subtle)' }}
                                >
                                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>{config.label}</p>
                                    <p className="text-lg font-bold" style={{ color: config.color }}>
                                        {val}<span className="text-sm font-normal ml-0.5">{unitStr}</span>
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Manual log form */}
            <section
                className="p-6 rounded-2xl border shadow-sm space-y-4"
                style={{
                    background: 'var(--color-surface-elevated)',
                    borderColor: 'var(--color-border-light)',
                }}
            >
                <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                        Log Manually
                    </span>
                </div>

                <div>
                    <label
                        className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-2"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        <Scale className="w-4 h-4" /> Weight ({weightUnit})
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
                        { key: 'waist', label: `Waist (${measureUnit})` },
                        { key: 'chest', label: `Chest (${measureUnit})` },
                        { key: 'arms',  label: `Arms (${measureUnit})`  },
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
                                onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-gold)'; }}
                                onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                            />
                        </div>
                    ))}
                </div>

                <div>
                    <label
                        className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-2"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        <Camera className="w-4 h-4" /> Photo (Optional)
                    </label>
                    <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                    {photoUrl ? (
                        <div className="relative">
                            <img src={photoUrl} alt="Progress" className="w-full h-40 object-cover rounded-xl" />
                            <button
                                onClick={() => setPhotoUrl('')}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                                style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
                            >✕</button>
                        </div>
                    ) : (
                        <button
                            onClick={() => photoInputRef.current?.click()}
                            disabled={photoUploading}
                            className="w-full py-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-all"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                        >
                            {photoUploading
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                                : <><ImageIcon className="w-4 h-4" /> Take or upload a photo</>
                            }
                        </button>
                    )}
                </div>

                <button
                    onClick={handleSave}
                    disabled={loading || !weight}
                    className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98]"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Log Measurement'}
                </button>
            </section>

            {/* History */}
            <section>
                <h3
                    className="font-bold mb-4"
                    style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
                >
                    History
                </h3>
                <div className="space-y-3">
                    {history.map((entry) => {
                        const isWithings  = entry.source === 'withings';
                        const withingsKeys = Object.keys(WITHINGS_CONFIG).filter(
                            k => entry.measurements?.[k] !== undefined
                        );
                        const waistVal = entry.measurements?.waist > 0 ? displayMeasure(entry.measurements.waist) : null;
                        const chestVal = entry.measurements?.chest > 0 ? displayMeasure(entry.measurements.chest) : null;
                        return (
                            <div
                                key={entry.id}
                                className="p-4 rounded-xl border"
                                style={{
                                    background: 'var(--color-surface-elevated)',
                                    borderColor: 'var(--color-border-light)',
                                }}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold" style={{ color: 'var(--color-text)' }}>
                                                {format(new Date(entry.date + 'T00:00:00'), 'MMM d, yyyy')}
                                            </p>
                                            {isWithings && (
                                                <span
                                                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                                                    style={{ background: 'var(--color-primary)', color: 'white', opacity: 0.8 }}
                                                >
                                                    Withings
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-2 text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                            {waistVal && <span>Waist: {waistVal}{measureUnit}</span>}
                                            {chestVal && <span>Chest: {chestVal}{measureUnit}</span>}
                                        </div>
                                        {entry.photo_url && (
                                            <span className="text-xs block mt-1" style={{ color: 'var(--color-primary)' }}>
                                                📸 Photo attached
                                            </span>
                                        )}
                                    </div>
                                    {entry.weight && (
                                        <div className="text-xl font-bold text-right" style={{ color: 'var(--color-gold)' }}>
                                            {displayWeight(entry.weight)}
                                            <span className="text-sm font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>{weightUnit}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Withings body comp pills */}
                                {withingsKeys.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                        {withingsKeys.map(key => {
                                            const config  = WITHINGS_CONFIG[key];
                                            const rawVal  = entry.measurements[key];
                                            const val     = config.isMass ? displayMass(rawVal) : rawVal;
                                            const unitStr = config.isMass ? massUnit : (config.fixedUnit ?? '');
                                            return (
                                                <span
                                                    key={key}
                                                    className="text-xs px-2 py-1 rounded-full font-medium"
                                                    style={{ background: 'var(--color-bg-subtle)', color: config.color }}
                                                >
                                                    {config.label}: {val}{unitStr}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {history.length === 0 && (
                        <p className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            No measurements yet. Log one above or sync from Withings in Settings.
                        </p>
                    )}
                </div>
            </section>
        </main>
    );
}
