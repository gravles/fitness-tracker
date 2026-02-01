'use client';

import { useState } from 'react';
import { X, Loader2, Target, Sparkles, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { createGoal, GoalType, UserGoal } from '@/lib/features';
import { haptics } from '@/lib/haptics';
import { Confetti } from './Confetti';

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
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    // Form state
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
            // Generate AI recommendations
            setLoading(true);
            try {
                const response = await fetch('/api/ai/generate-goals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        goalType,
                        currentWeight,
                        currentBodyFat,
                        targetValue,
                        targetDate,
                    }),
                });
                const data = await response.json();
                setAiRecommendations(data.recommendations);
            } catch (error) {
                console.error('Failed to generate recommendations', error);
                // Set defaults if AI fails
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

    const handleBack = () => {
        haptics.tap();
        setStep(step - 1);
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

            setTimeout(() => {
                onComplete(goal);
            }, 2000);

        } catch (error) {
            console.error('Failed to create goal', error);
            haptics.error();
            alert('Failed to create goal. Please try again.');
        }
        setLoading(false);
    };

    return (
        <>
            <Confetti isActive={showConfetti} onComplete={() => setShowConfetti(false)} />

            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-[var(--color-surface-elevated)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                        <div className="flex items-center gap-2">
                            <Target className="w-5 h-5" />
                            <h3 className="font-bold">Set Your Goal</h3>
                            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Step {step}/3</span>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Step 1: Choose Goal Type */}
                    {step === 1 && (
                        <div className="p-4 space-y-3">
                            <p className="text-sm text-[var(--color-text-secondary)] mb-4">What's your primary fitness goal?</p>
                            {GOAL_OPTIONS.map((option) => (
                                <button
                                    key={option.type}
                                    onClick={() => setGoalType(option.type)}
                                    className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all tap-target ${goalType === option.type
                                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                            : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                                        }`}
                                >
                                    <span className="text-2xl">{option.icon}</span>
                                    <div className="text-left">
                                        <p className="font-bold text-[var(--color-text)]">{option.title}</p>
                                        <p className="text-xs text-[var(--color-text-muted)]">{option.description}</p>
                                    </div>
                                    {goalType === option.type && (
                                        <Check className="w-5 h-5 text-[var(--color-primary)] ml-auto" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Step 2: Set Targets */}
                    {step === 2 && (
                        <div className="p-4 space-y-4">
                            <p className="text-sm text-[var(--color-text-secondary)]">Set your target and timeline</p>

                            {(goalType === 'lose_weight' || goalType === 'build_muscle') && (
                                <div>
                                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                                        Target Weight (lbs)
                                    </label>
                                    <input
                                        type="number"
                                        value={targetValue}
                                        onChange={(e) => setTargetValue(Number(e.target.value))}
                                        className="w-full p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)]"
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
                                    className="w-full p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg)] text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)]"
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 3: AI Recommendations */}
                    {step === 3 && aiRecommendations && (
                        <div className="p-4 space-y-4">
                            <div className="flex items-center gap-2 text-purple-600">
                                <Sparkles className="w-5 h-5" />
                                <p className="font-bold">AI-Powered Plan</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
                                    <p className="text-2xl font-bold text-blue-600">{aiRecommendations.calories}</p>
                                    <p className="text-xs text-blue-600/70">Daily Calories</p>
                                </div>
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
                                    <p className="text-2xl font-bold text-green-600">{aiRecommendations.protein}g</p>
                                    <p className="text-xs text-green-600/70">Daily Protein</p>
                                </div>
                                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-center col-span-2">
                                    <p className="text-2xl font-bold text-purple-600">{aiRecommendations.weekly_workouts}x</p>
                                    <p className="text-xs text-purple-600/70">Workouts Per Week</p>
                                </div>
                            </div>

                            {aiRecommendations.advice && (
                                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-700">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
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
                                onClick={handleBack}
                                className="px-4 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] flex items-center gap-1"
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
                                className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-xl font-bold flex items-center gap-1 hover:opacity-90 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Next'}
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                onClick={handleComplete}
                                disabled={loading}
                                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
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
