'use client';

import { X, Sparkles, Rocket, Zap, Bug, Dumbbell, Brain } from 'lucide-react';

interface ChangelogModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ChangelogModal({ isOpen, onClose }: ChangelogModalProps) {
    if (!isOpen) return null;

    const changes = [
        {
            version: "v1.3 (Workout Builder)",
            date: "Just Now",
            features: [
                { icon: <Dumbbell className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "Added Workout Builder & Active Tracker." },
                { icon: <Brain className="w-4 h-4 text-green-500" />, text: "Smart Coach can now build and save workouts." },
                { icon: <Zap className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />, text: "Integrated real-time set/rep logging." },
            ]
        },
        {
            version: "v1.2 (AI Update)",
            date: "Today",
            features: [
                { icon: <Sparkles className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />, text: "Added AI Weekly Insights with alcohol analysis." },
                { icon: <Rocket className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "Launched 'Feature Tutorial' for new users." },
                { icon: <Zap className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />, text: "Improved AI Workout Coach speed and accuracy." },
            ]
        },
        {
            version: "v1.1",
            date: "Last Week",
            features: [
                { icon: <Rocket className="w-4 h-4 text-green-500" />, text: "Added Conversational Workout Logging." },
                { icon: <Sparkles className="w-4 h-4 text-orange-400" />, text: "Introduced 'Smart Coach' tips on dashboard." },
            ]
        },
        {
            version: "v1.0",
            date: "Initial Release",
            features: [
                { icon: <Bug className="w-4 h-4 text-[var(--color-text-muted)]" />, text: "Core tracking: Food, Workouts, and Habits." },
            ]
        }
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-10">
            <div className="bg-[var(--color-surface-elevated)] rounded-3xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[80vh]">

                <div className="p-6 text-white flex justify-between items-center" style={{ background: 'var(--color-navy)' }}>
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            🚀 What's New
                        </h2>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--color-gold)' }}>Changelog & Updates</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-8">
                    {changes.map((release, i) => (
                        <div key={i} className="relative pl-4 border-l-2 border-[var(--color-border-light)]">
                            <div
                                className="absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2"
                                style={{ background: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
                            />
                            <div className="mb-2">
                                <h3 className="font-bold text-[var(--color-text)] text-lg">{release.version}</h3>
                                <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase">{release.date}</p>
                            </div>
                            <ul className="space-y-3">
                                {release.features.map((feat, j) => (
                                    <li key={j} className="flex gap-3 text-sm text-[var(--color-text-muted)]">
                                        <div className="mt-0.5 shrink-0">{feat.icon}</div>
                                        {feat.text}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-[var(--color-bg-subtle)] border-t border-[var(--color-border-light)]">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                    >
                        Close
                    </button>
                </div>

            </div>
        </div>
    );
}
