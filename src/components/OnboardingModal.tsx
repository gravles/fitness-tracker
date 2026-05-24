'use client';

import { useState } from 'react';
import { ChevronRight, User, Cake, Ruler, Target, CheckCircle } from 'lucide-react';
import { updateSettings, upsertBodyMetrics } from '@/lib/api';

const FITNESS_GOALS = [
    { id: 'lose_weight',       label: 'Lose Weight',       emoji: '🔥', desc: 'Burn fat and slim down' },
    { id: 'build_muscle',      label: 'Build Muscle',      emoji: '💪', desc: 'Get stronger and bigger' },
    { id: 'maintain',          label: 'Maintain',          emoji: '⚖️',  desc: 'Stay fit and healthy' },
    { id: 'improve_fitness',   label: 'Improve Fitness',   emoji: '🏃', desc: 'Boost endurance and stamina' },
];

interface OnboardingModalProps {
    onComplete: (name: string) => void;
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
    const [step, setStep]               = useState(1);
    const [saving, setSaving]           = useState(false);

    // Form fields
    const [name, setName]               = useState('');
    const [dob, setDob]                 = useState('');
    const [heightFt, setHeightFt]       = useState('');
    const [heightIn, setHeightIn]       = useState('');
    const [weightLbs, setWeightLbs]     = useState('');
    const [goal, setGoal]               = useState('');

    const TOTAL_STEPS = 4;

    const inputClass = "w-full p-4 rounded-2xl outline-none transition-all text-lg";
    const inputStyle = {
        background: 'rgba(255,255,255,0.06)',
        border: '1.5px solid rgba(255,255,255,0.12)',
        color: '#fff',
    };

    const focusStyle = {
        borderColor: 'var(--color-gold)',
        boxShadow: '0 0 0 3px rgba(201,168,76,0.15)',
    };

    function cmFromFtIn() {
        const ft = parseFloat(heightFt) || 0;
        const inches = parseFloat(heightIn) || 0;
        return Math.round((ft * 30.48) + (inches * 2.54));
    }

    function kgFromLbs(lbs: string) {
        const l = parseFloat(lbs);
        return isNaN(l) ? null : parseFloat((l * 0.453592).toFixed(1));
    }

    async function handleFinish() {
        setSaving(true);
        try {
            const heightCm = cmFromFtIn() || null;
            const weightKg = kgFromLbs(weightLbs);

            await updateSettings({
                display_name:  name.trim() || null,
                date_of_birth: dob || null,
                height_cm:     heightCm,
                fitness_goal:  goal || null,
                target_weight: weightLbs ? parseFloat(weightLbs) : null,
            });

            // Log initial body weight if provided
            if (weightKg) {
                try {
                    const today = new Date().toISOString().slice(0, 10);
                    await upsertBodyMetrics({ date: today, weight: weightKg });
                } catch { /* non-fatal */ }
            }

            onComplete(name.trim());
        } catch (e) {
            console.error('Onboarding save failed', e);
            onComplete(name.trim()); // proceed anyway
        } finally {
            setSaving(false);
        }
    }

    const canProceed = step === 1
        ? name.trim().length >= 2
        : step === 2
        ? true   // birthday + height are optional
        : step === 3
        ? true   // weight is optional
        : !!goal;

    const stepContent = () => {
        switch (step) {
            case 1:
                return (
                    <>
                        <div className="text-6xl mb-4" aria-hidden="true">👋</div>
                        <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                            Welcome!
                        </h2>
                        <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
                            Let's personalise FitnessTracker for you. First, what should we call you?
                        </p>
                        <input
                            type="text"
                            placeholder="Your first name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            autoFocus
                            maxLength={40}
                            className={inputClass}
                            style={inputStyle}
                            onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
                            onBlur={e => Object.assign(e.currentTarget.style, { borderColor: 'rgba(255,255,255,0.12)', boxShadow: 'none' })}
                            onKeyDown={e => { if (e.key === 'Enter' && canProceed) setStep(2); }}
                        />
                    </>
                );
            case 2:
                return (
                    <>
                        <div className="text-6xl mb-4" aria-hidden="true">🎂</div>
                        <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                            Birthday &amp; Height
                        </h2>
                        <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
                            This helps calibrate your AI coach. Both are optional.
                        </p>

                        <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                            Date of Birth
                        </label>
                        <input
                            type="date"
                            value={dob}
                            onChange={e => setDob(e.target.value)}
                            className={`${inputClass} mb-5`}
                            style={{ ...inputStyle, colorScheme: 'dark' }}
                            onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
                            onBlur={e => Object.assign(e.currentTarget.style, { borderColor: 'rgba(255,255,255,0.12)', boxShadow: 'none' })}
                        />

                        <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                            Height
                        </label>
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <input
                                    type="number"
                                    placeholder="5"
                                    value={heightFt}
                                    onChange={e => setHeightFt(e.target.value)}
                                    min={0} max={8}
                                    className={inputClass}
                                    style={inputStyle}
                                    onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
                                    onBlur={e => Object.assign(e.currentTarget.style, { borderColor: 'rgba(255,255,255,0.12)', boxShadow: 'none' })}
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: 'var(--color-gold)' }}>ft</span>
                            </div>
                            <div className="relative flex-1">
                                <input
                                    type="number"
                                    placeholder="10"
                                    value={heightIn}
                                    onChange={e => setHeightIn(e.target.value)}
                                    min={0} max={11}
                                    className={inputClass}
                                    style={inputStyle}
                                    onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
                                    onBlur={e => Object.assign(e.currentTarget.style, { borderColor: 'rgba(255,255,255,0.12)', boxShadow: 'none' })}
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: 'var(--color-gold)' }}>in</span>
                            </div>
                        </div>
                    </>
                );
            case 3:
                return (
                    <>
                        <div className="text-6xl mb-4" aria-hidden="true">⚖️</div>
                        <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                            Current Weight
                        </h2>
                        <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
                            We'll log this as your starting point. You can skip this.
                        </p>
                        <div className="relative">
                            <input
                                type="number"
                                placeholder="185"
                                value={weightLbs}
                                onChange={e => setWeightLbs(e.target.value)}
                                min={50} max={700}
                                className={inputClass}
                                style={inputStyle}
                                onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
                                onBlur={e => Object.assign(e.currentTarget.style, { borderColor: 'rgba(255,255,255,0.12)', boxShadow: 'none' })}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: 'var(--color-gold)' }}>lbs</span>
                        </div>
                    </>
                );
            case 4:
                return (
                    <>
                        <div className="text-6xl mb-4" aria-hidden="true">🎯</div>
                        <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                            What&apos;s your goal?
                        </h2>
                        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>
                            This shapes your AI coaching and recommendations.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            {FITNESS_GOALS.map(g => (
                                <button
                                    key={g.id}
                                    onClick={() => setGoal(g.id)}
                                    className="p-4 rounded-2xl text-left transition-all active:scale-95"
                                    style={{
                                        background: goal === g.id ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.06)',
                                        border: `1.5px solid ${goal === g.id ? 'var(--color-gold)' : 'rgba(255,255,255,0.12)'}`,
                                    }}
                                >
                                    <div className="text-2xl mb-1.5">{g.emoji}</div>
                                    <div className="font-bold text-sm text-white">{g.label}</div>
                                    <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{g.desc}</div>
                                </button>
                            ))}
                        </div>
                    </>
                );
        }
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md"
            aria-modal="true"
            role="dialog"
        >
            <div
                className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
                style={{ background: 'var(--color-navy)' }}
            >
                {/* Progress bar */}
                <div className="h-1 w-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div
                        className="h-full transition-all duration-500"
                        style={{ width: `${(step / TOTAL_STEPS) * 100}%`, background: 'var(--color-gold)' }}
                    />
                </div>

                <div className="p-8">
                    {/* Step indicator */}
                    <div className="flex items-center justify-between mb-8">
                        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(201,168,76,0.6)' }}>
                            Step {step} of {TOTAL_STEPS}
                        </span>
                        <div className="flex gap-1.5">
                            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                                <div
                                    key={i}
                                    className="rounded-full transition-all duration-300"
                                    style={{
                                        width: i + 1 === step ? '20px' : '6px',
                                        height: '6px',
                                        background: i + 1 <= step ? 'var(--color-gold)' : 'rgba(255,255,255,0.15)',
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Step content */}
                    {stepContent()}

                    {/* Buttons */}
                    <div className="flex gap-3 mt-8">
                        {step > 1 && (
                            <button
                                onClick={() => setStep(s => s - 1)}
                                className="flex-1 py-4 rounded-2xl font-bold text-sm transition-all"
                                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
                            >
                                Back
                            </button>
                        )}
                        <button
                            onClick={() => {
                                if (step < TOTAL_STEPS) {
                                    setStep(s => s + 1);
                                } else {
                                    handleFinish();
                                }
                            }}
                            disabled={(step === 1 && !canProceed) || (step === TOTAL_STEPS && !goal) || saving}
                            className="flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40"
                            style={{ background: 'var(--color-gold)', color: 'var(--color-navy)' }}
                        >
                            {saving ? (
                                <span>Saving…</span>
                            ) : step < TOTAL_STEPS ? (
                                <><span>Continue</span><ChevronRight className="w-5 h-5" /></>
                            ) : (
                                <><CheckCircle className="w-5 h-5" /><span>Let&apos;s Go!</span></>
                            )}
                        </button>
                    </div>

                    {/* Skip for optional steps */}
                    {(step === 2 || step === 3) && (
                        <button
                            onClick={() => setStep(s => s + 1)}
                            className="w-full mt-3 text-sm font-medium"
                            style={{ color: 'rgba(255,255,255,0.35)' }}
                        >
                            Skip for now
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
