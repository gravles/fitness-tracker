'use client';


import { useState, useEffect } from "react";
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
            alert("Failed to generate report");
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-10">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Brain className="w-6 h-6" />
                            <h2 className="text-xl font-bold">AI Weekly Analyst</h2>
                        </div>
                        <p className="text-purple-100 text-sm">Deep dive into your last 7 days of performance.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 bg-gray-50/50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500 space-y-4">
                            <div className="relative">
                                <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Brain className="w-5 h-5 text-purple-600" />
                                </div>
                            </div>
                            <p className="font-medium animate-pulse">Crunching your numbers...</p>
                        </div>
                    ) : insight ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">

                            {/* Summary Card */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-purple-600" /> Executive Summary
                                </h3>
                                <p className="text-gray-600 leading-relaxed">{insight.summary}</p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                {/* Wins */}
                                <div className="bg-green-50/50 p-5 rounded-xl border border-green-100">
                                    <h3 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                                        <CheckCircle2 className="w-5 h-5" /> Wins
                                    </h3>
                                    <ul className="space-y-2">
                                        {insight.wins.map((win, i) => (
                                            <li key={i} className="flex gap-2 text-sm text-green-900">
                                                <span>•</span> {win}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Improvements */}
                                <div className="bg-orange-50/50 p-5 rounded-xl border border-orange-100">
                                    <h3 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5" /> Focus Areas
                                    </h3>
                                    <ul className="space-y-2">
                                        {insight.improvements.map((imp, i) => (
                                            <li key={i} className="flex gap-2 text-sm text-orange-900">
                                                <span>•</span> {imp}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Alcohol Analysis */}
                            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 rounded-xl border border-blue-100">
                                <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                                    <Wine className="w-5 h-5" /> Alcohol & Recovery
                                </h3>
                                <p className="text-indigo-800 text-sm leading-relaxed">
                                    {insight.alcohol_analysis}
                                </p>
                            </div>

                            {/* Tips Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                                        <Utensils className="w-3 h-3" /> Nutrition Tip
                                    </h4>
                                    <p className="text-sm font-medium text-gray-800">{insight.nutrition_tip}</p>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                                        <Dumbbell className="w-3 h-3" /> Workout Tip
                                    </h4>
                                    <p className="text-sm font-medium text-gray-800">{insight.workout_tip}</p>
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="text-center py-10 text-gray-500">
                            No insights available.
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-200">
                    <button onClick={onClose} className="w-full py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors">
                        Close Report
                    </button>
                </div>
            </div>
        </div>
    );
}
