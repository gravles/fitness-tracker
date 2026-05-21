'use client';

import { useState, useEffect } from "react";
import { toast } from 'sonner';
import { Brain, X, TrendingUp, AlertTriangle, Wine, Dumbbell, Utensils, CheckCircle2 } from "lucide-react";
import { WeeklyInsight } from "@/lib/ai";

interface AIWeeklyInsightModalProps {
    isOpen: boolean;
    onClose: () => void;
    logs: any[];
}

export function AIWeeklyInsightModal({ isOpen, onClose, logs }: AIWeeklyInsightModalProps) {
    const [loading, setLoading] = useState(false);
    const [insight, setInsight] = useState<WeeklyInsight | null>(null);

    useEffect(() => {
        if (isOpen && logs.length > 0 && !insight) {
            generateReport();
        }
    }, [isOpen, logs]);

    async function generateReport() {
        setLoading(true);
        try {
            const res = await fetch('/api/ai/weekly-insights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logs })
            });
            const data = await res.json();
            setInsight(data);
        } catch (e) {
            console.error(e);
            toast.error("Failed to generate report");
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-10">
            <div className="bg-[var(--color-surface-elevated)] rounded-3xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 text-white flex justify-between items-start" style={{ background: 'var(--color-navy)' }}>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Brain className="w-6 h-6" style={{ color: 'var(--color-gold)' }} />
                            <h2 className="text-xl font-bold">AI Weekly Analyst</h2>
                        </div>
                        <p className="text-sm" style={{ color: 'var(--color-gold)' }}>Deep dive into your last 7 days of performance.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 bg-[var(--color-bg)]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4" style={{ color: 'var(--color-text-muted)' }}>
                            <div className="relative">
                                <div className="w-12 h-12 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Brain className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                                </div>
                            </div>
                            <p className="font-medium animate-pulse">Crunching your numbers...</p>
                        </div>
                    ) : insight ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">

                            {/* Summary Card */}
                            <div className="bg-[var(--color-surface-elevated)] p-5 rounded-xl border border-[var(--color-border-light)] shadow-sm">
                                <h3 className="font-bold text-[var(--color-text)] mb-2 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5" style={{ color: 'var(--color-primary)' }} /> Executive Summary
                                </h3>
                                <p className="text-[var(--color-text-muted)] leading-relaxed">{insight.summary}</p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                {/* Wins */}
                                <div className="p-5 rounded-xl border" style={{ background: 'rgba(34,197,94,0.05)', borderColor: 'rgba(34,197,94,0.2)' }}>
                                    <h3 className="font-bold mb-3 flex items-center gap-2 text-green-600">
                                        <CheckCircle2 className="w-5 h-5" /> Wins
                                    </h3>
                                    <ul className="space-y-2">
                                        {insight.wins.map((win, i) => (
                                            <li key={i} className="flex gap-2 text-sm text-green-700 dark:text-green-400">
                                                <span>•</span> {win}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Improvements */}
                                <div className="p-5 rounded-xl border" style={{ background: 'rgba(249,115,22,0.05)', borderColor: 'rgba(249,115,22,0.2)' }}>
                                    <h3 className="font-bold mb-3 flex items-center gap-2 text-orange-600">
                                        <AlertTriangle className="w-5 h-5" /> Focus Areas
                                    </h3>
                                    <ul className="space-y-2">
                                        {insight.improvements.map((imp, i) => (
                                            <li key={i} className="flex gap-2 text-sm text-orange-700 dark:text-orange-400">
                                                <span>•</span> {imp}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Alcohol Analysis */}
                            <div className="p-5 rounded-xl border" style={{ background: 'var(--color-gold-muted)', borderColor: 'rgba(201,168,76,0.2)' }}>
                                <h3 className="font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                                    <Wine className="w-5 h-5" style={{ color: 'var(--color-gold)' }} /> Alcohol & Recovery
                                </h3>
                                <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">
                                    {insight.alcohol_analysis}
                                </p>
                            </div>

                            {/* Tips Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-[var(--color-surface-elevated)] p-4 rounded-xl border border-[var(--color-border-light)] shadow-sm">
                                    <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase mb-2 flex items-center gap-1">
                                        <Utensils className="w-3 h-3" /> Nutrition Tip
                                    </h4>
                                    <p className="text-sm font-medium text-[var(--color-text)]">{insight.nutrition_tip}</p>
                                </div>
                                <div className="bg-[var(--color-surface-elevated)] p-4 rounded-xl border border-[var(--color-border-light)] shadow-sm">
                                    <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase mb-2 flex items-center gap-1">
                                        <Dumbbell className="w-3 h-3" /> Workout Tip
                                    </h4>
                                    <p className="text-sm font-medium text-[var(--color-text)]">{insight.workout_tip}</p>
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="text-center py-10 text-[var(--color-text-muted)] italic">
                            No insights available.
                        </div>
                    )}
                </div>

                <div className="p-4 bg-[var(--color-bg-subtle)] border-t border-[var(--color-border-light)]">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                    >
                        Close Report
                    </button>
                </div>
            </div>
        </div>
    );
}
