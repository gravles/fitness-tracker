'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Mic, Camera, Dumbbell, Brain, ChevronRight, ChevronLeft, X, ChefHat } from 'lucide-react';

interface FeatureTutorialProps {
    onClose?: () => void;
    forceOpen?: boolean;
}

export function FeatureTutorial({ onClose, forceOpen }: FeatureTutorialProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (forceOpen) {
            setIsOpen(true);
            setStep(0);
        } else {
            const seen = localStorage.getItem('has_seen_tutorial_v1');
            if (!seen) {
                setTimeout(() => setIsOpen(true), 1500);
            }
        }
    }, [forceOpen]);

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem('has_seen_tutorial_v1', 'true');
        if (onClose) onClose();
    };

    const steps = [
        {
            title: "Welcome to AI Fitness!",
            desc: "Your personal tracker just got a major brain upgrade. Let's take a quick tour of the new AI superpowers.",
            icon: <Sparkles className="w-12 h-12 text-yellow-400" />,
            bg: 'var(--color-navy)'
        },
        {
            title: "Voice Logging",
            desc: "Don't type. Just say 'I ate 2 eggs and toast' or 'I ran 5k in 25 mins'. We handle the tracking.",
            icon: <Mic className="w-12 h-12 text-blue-300" />,
            bg: 'var(--color-primary)'
        },
        {
            title: "Snap & Track",
            desc: "Not sure about macros? Snap a photo of your meal. Our AI identifies the food and estimates calories instantly.",
            icon: <Camera className="w-12 h-12 text-purple-300" />,
            bg: '#6d28d9'
        },
        {
            title: "AI Workout Coach",
            desc: "Ask the Coach to 'Build me a chest workout'. It creates a plan based on your equipment. Click 'Save' to track it instantly.",
            icon: <Brain className="w-12 h-12 text-green-300" />,
            bg: '#059669'
        },
        {
            title: "Workout Builder",
            desc: "Create your own custom templates or edit the AI's suggestions. Track sets, reps, and weights in real-time.",
            icon: <Dumbbell className="w-12 h-12 text-pink-300" />,
            bg: '#db2777'
        },
        {
            title: "Menu Scanner",
            desc: "Eating out? Scan a restaurant menu to find the high-protein, healthy gems hidden in the list.",
            icon: <ChefHat className="w-12 h-12 text-orange-300" />,
            bg: '#ea580c'
        },
        {
            title: "Weekly Analyst",
            desc: "Every week, get a deep-dive report on your progress, including sleep, alcohol impact, and nutrition tips.",
            icon: <Brain className="w-12 h-12 text-indigo-300" />,
            bg: 'var(--color-navy)'
        }
    ];

    if (!isOpen) return null;

    const current = steps[step];

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/60 backdrop-blur-md p-6 pt-20">
            <div className="w-full max-w-sm bg-[var(--color-surface-elevated)] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">

                {/* Hero Section */}
                <div
                    className="p-8 flex flex-col items-center justify-center text-center text-white relative transition-all duration-300"
                    style={{ background: current.bg }}
                >
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="mb-4 p-4 bg-white/10 rounded-full shadow-lg backdrop-blur-sm">
                        {current.icon}
                    </div>
                    <h2 className="text-2xl font-bold mb-2">{current.title}</h2>
                </div>

                {/* Content */}
                <div className="p-8 text-center space-y-6">
                    <p className="text-[var(--color-text-muted)] leading-relaxed text-lg">
                        {current.desc}
                    </p>

                    {/* Dots */}
                    <div className="flex justify-center gap-2">
                        {steps.map((_, i) => (
                            <div
                                key={i}
                                className="h-2 rounded-full transition-all"
                                style={{
                                    width: i === step ? '16px' : '8px',
                                    background: i === step ? 'var(--color-primary)' : 'var(--color-border)'
                                }}
                            />
                        ))}
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-between items-center pt-2">
                        <button
                            onClick={() => step > 0 && setStep(step - 1)}
                            className={`p-3 rounded-full hover:bg-[var(--color-bg-subtle)] transition ${step === 0 ? 'invisible' : ''}`}
                        >
                            <ChevronLeft className="w-6 h-6 text-[var(--color-text-muted)]" />
                        </button>

                        <button
                            onClick={() => {
                                if (step < steps.length - 1) {
                                    setStep(step + 1);
                                } else {
                                    handleClose();
                                }
                            }}
                            className="text-white px-8 py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-all flex items-center gap-2"
                            style={{ background: 'var(--color-navy)' }}
                        >
                            {step === steps.length - 1 ? "Let's Go!" : "Next"} <ChevronRight className="w-4 h-4" />
                        </button>

                        <div className="w-12" />
                    </div>
                </div>
            </div>
        </div>
    );
}
