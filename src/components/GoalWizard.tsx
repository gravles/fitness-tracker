'use client';

import { useState } from 'react';
import { X, Loader2, Target, Sparkles, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import { createGoal, GoalType, UserGoal } from '@/lib/features';
import { haptics } from '@/lib/haptics';
import { Confetti } from './Confetti';
import { useLanguage } from '@/components/LanguageProvider';

interface GoalWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (goal: UserGoal) => void;
    currentWeight?: number;
    currentBodyFat?: number;
}

const GOAL_OPTIONS: { type: GoalType; title: string; description: string; icon: string }[] = [
    { type: 'lose_weight', title: 'Lose Weight', description: 'Burn fat while preserving muscle', icon: '🔥' },
    { type: 'build_muscle', title: 'Build Muscle', description: 'Gain strength and size', icon: '💪' },
    { type: 'maintain', title: 'Maintain', description: 'Keep your current physique', icon: '⚖️' },
    { type: 'improve_fitness', title: 'Improve Fitness', description: 'Boost endurance and energy', icon: '🏃' },
    { type: 'custom', title: 'Custom Goal', description: 'Set your own targets', icon: '🎯' },
];

export function GoalWizard({ isOpen, onClose, onComplete, currentWeight, currentBodyFat }: GoalWizardProps) {
    const { lang } = useLanguage();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    const [goalType, setGoalType] = useState<GoalType>('lose_weight');
    const [targetValue, setTargetValue] = useState<number>(currentWeight ? currentWeight - 10 : 0);
    const [targetDate, setTargetDate] = useState<string>(() => {
        const date = new Date();
        date.setMonth(date.getMonth() + 3);
        return date.toISOString().split('T')[0];
    });
    const [aiRecommendations, setAiRecommendations] = useState<any>(null);

    if (!isOpen) return null;

    const handleNext = async () => {
        haptics.tap();
        if (step === 2) {
            setLoading(true);
            try {
                const response = await fetch('/api/ai/generate-goals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ goalType, currentWeight, currentBodyFat, targetValue, targetDate, lang }),
                });
                const data = await response.json();
                setAiRecommendations(data.recommendations);
            } catch (error) {
                setAiRecommendations({
                    calories: goalType === 'lose_weight' ? 1800 : goalType === 'build_muscle' ? 2500 : 2200,
                    protein: goalType === 'build_muscle' ? 180 : 150,
                    weekly_workouts: 4,
                    advice: 'Stay consistent and trust the process!',
                });
            }
            setLoading(false);
        }
        setStep(step + 1);
    };

    const handleComplete = async () => {
        setLoading(true);
        haptics.success();
        try {
            const selectedGoal = GOAL_OPTIONS.find(g => g.type === goalType)!;
            const goal = await createGoal({
                goal_type: goalType,
                title: selectedGoal.title,
                description: selectedGoal.description,
                target_value: targetValue,
                target_unit: goalType === 'lose_weight' || goalType === 'build_muscle' ? 'lbs' : undefined,
                current_value: currentWeight,
                target_date: targetDate,
                ai_recommendations: aiRecommendations,
            });
            setShowConfetti(true);
            setTimeout(() => onComplete(goal), 2000);
        } catch (error) {
            haptics.error();
            toast.error('Failed to create goal. Please try again.');
        }
        setLoading(false);
    };

    const inputCls = "w-full p-3 border rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text)] focus:outline-none transition-colors";

    return (
        <>
            <Confetti isActive={showConfetti} onComplete={() => setShowConfetti(false)} />

            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-[var(--color-surface-elevated)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center text-white" style={{ background: 'var(--color-navy)' }}>
                        <div className="flex items-center gap-2">
                            <Target className="w-5 h-5" style={{ color: 'var(--color-gold)' }} />
                            <h3 className="font-bold">Set Your Goal</h3>
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(201,168,76,0.2)', color: 'var(--color-gold)' }}>
                                Step {step}/3
                            </span>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Step 1: Choose Goal Type */}
                    {step === 1 && (
                        <div className="p-4 space-y-3">
                            <p className="text-sm text-[var(--color-text-muted)] mb-4">What's your primary fitness goal?</p>
                            {GOAL_OPTIONS.map((option) => (
                                <button
                                    key={option.type}
                                    onClick={() => setGoalType(option.type)}
                                    className="w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all"
                                    style={goalType === option.type ? {
                                        borderColor: 'var(--color-primary)',
                                        background: 'rgba(29,95,168,0.08)'
                                    } : {
                                        borderColor: 'var(--color-border)',
                                        background: 'transparent'
                                    }}
                                >
                                    <span className="text-2xl">{option.icon}</span>
                                    <div className="text-left">
                                        <p className="font-bold text-[var(--color-text)]">{option.title}</p>
                                        <p className="text-xs text-[var(--color-text-muted)]">{option.description}</p>
                                    </div>
                                    {goalType === option.type && (
                                        <Check className="w-5 h-5 ml-auto" style={{ color: 'var(--color-primary)' }} />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Step 2: Set Targets */}
                    {step === 2 && (
                        <div className="p-4 space-y-4">
                            <p className="text-sm text-[var(--color-text-muted)]">Set your target and timeline</p>
                            {(goalType === 'lose_weight' || goalType === 'build_muscle') && (
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                                        Target Weight (lbs)
                                    </label>
                                    <input
                                        type="number"
                                        value={targetValue}
                                        onChange={(e) => setTargetValue(Number(e.target.value))}
                                        className={inputCls}
                                        style={{ borderColor: 'var(--color-border)' }}
                                        onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                                        onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; }}
                                    />
                                    {currentWeight && (
                                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                            Current: {currentWeight} lbs → Target: {targetValue} lbs
                                            ({targetValue > currentWeight ? '+' : ''}{targetValue - currentWeight} lbs)
                                        </p>
                                    )}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                                    Target Date
                                </label>
                                <input
                                    type="date"
                                    value={targetDate}
                                    onChange={(e) => setTargetDate(e.target.value)}
                                    className={inputCls}
                                    style={{ borderColor: 'var(--color-border)' }}
                                    onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                                    onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 3: AI Recommendations */}
                    {step === 3 && aiRecommendations && (
                        <div className="p-4 space-y-4">
                            <div className="flex items-center gap-2" style={{ color: 'var(--color-gold)' }}>
                                <Sparkles className="w-5 h-5" />
                                <p className="font-bold">AI-Powered Plan</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-xl text-center border" style={{ background: 'rgba(29,95,168,0.06)', borderColor: 'rgba(29,95,168,0.15)' }}>
                                    <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{aiRecommendations.calories}</p>
                                    <p className="text-xs" style={{ color: 'var(--color-primary)' }}>Daily Calories</p>
                                </div>
                                <div className="p-3 rounded-xl text-center border" style={{ background: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.15)' }}>
                                    <p className="text-2xl font-bold text-green-600">{aiRecommendations.protein}g</p>
                                    <p className="text-xs text-green-600/70">Daily Protein</p>
                                </div>
                                <div className="p-3 rounded-xl text-center col-span-2 border" style={{ background: 'var(--color-gold-muted)', borderColor: 'rgba(201,168,76,0.2)' }}>
                                    <p className="text-2xl font-bold" style={{ color: 'var(--color-gold)' }}>{aiRecommendations.weekly_workouts}x</p>
                                    <p className="text-xs" style={{ color: 'var(--color-gold)' }}>Workouts Per Week</p>
                                </div>
                            </div>

                            {aiRecommendations.advice && (
                                <div className="p-4 rounded-xl border" style={{ background: 'var(--color-gold-muted)', borderColor: 'rgba(201,168,76,0.2)' }}>
                                    <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                                        💡 {aiRecommendations.advice}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="p-4 border-t border-[var(--color-border)] flex justify-between">
                        {step > 1 ? (
                            <button
                                onClick={() => { haptics.tap(); setStep(step - 1); }}
                                className="px-4 py-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center gap-1"
                            >
                                <ChevronLeft className="w-4 h-4" /> Back
                            </button>
                        ) : (
                            <div />
                        )}

                        {step < 3 ? (
                            <button
                                onClick={handleNext}
                                disabled={loading}
                                className="px-6 py-2 text-white rounded-xl font-bold flex items-center gap-1 hover:opacity-90 disabled:opacity-50"
                                style={{ background: 'var(--color-primary)' }}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Next'}
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                onClick={handleComplete}
                                disabled={loading}
                                className="px-6 py-2 text-white rounded-xl font-bold flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                                style={{ background: 'var(--color-navy)' }}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Set Goal
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
