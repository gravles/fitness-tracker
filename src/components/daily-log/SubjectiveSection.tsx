'use client';

import { Brain, Moon, Zap, Activity } from 'lucide-react';

interface SubjectiveSectionProps {
    subjective: {
        sleep: number;
        energy: number;
        motivation: number;
        stress: number;
        note: string;
    };
    setSubjective: (val: any) => void;
}

export function SubjectiveSection({ subjective, setSubjective }: SubjectiveSectionProps) {

    const metrics = [
        { label: 'Sleep Quality', icon: <Moon className="w-4 h-4" />, key: 'sleep' },
        { label: 'Energy', icon: <Zap className="w-4 h-4" />, key: 'energy' },
        { label: 'Motivation', icon: <Activity className="w-4 h-4" />, key: 'motivation' },
        { label: 'Stress', icon: <Activity className="w-4 h-4" />, key: 'stress' },
    ];

    return (
        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-500" /> How did you feel?
            </h3>

            <div className="space-y-6">
                {metrics.map((metric) => (
                    <div key={metric.key}>
                        <div className="flex justify-between mb-2">
                            <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                {metric.icon} {metric.label}
                            </label>
                            <span className="font-bold text-gray-900">{(subjective as any)[metric.key]}/5</span>
                        </div>
                        <input
                            type="range"
                            min="1" max="5" step="1"
                            value={(subjective as any)[metric.key]}
                            onChange={(e) => setSubjective({ ...subjective, [metric.key]: parseInt(e.target.value) })}
                            className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
                            <span>Low</span>
                            <span>High</span>
                        </div>
                    </div>
                ))}

                <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">Daily Notes</label>
                    <textarea
                        value={subjective.note}
                        onChange={(e) => setSubjective({ ...subjective, note: e.target.value })}
                        placeholder="What went well? What didn't?"
                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none h-24 resize-none"
                    />
                </div>
            </div>
        </section>
    );
}
