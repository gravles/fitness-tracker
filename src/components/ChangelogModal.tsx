'use client';

import { X, Sparkles, Rocket, Zap, Bug } from 'lucide-react';

interface ChangelogModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ChangelogModal({ isOpen, onClose }: ChangelogModalProps) {
    if (!isOpen) return null;

    const changes = [
        {
            version: "v1.2 (AI Update)",
            date: "Today",
            features: [
                { icon: <Sparkles className="w-4 h-4 text-yellow-500" />, text: "Added AI Weekly Insights with alcohol analysis." },
                { icon: <Rocket className="w-4 h-4 text-purple-500" />, text: "Launched 'Feature Tutorial' for new users." },
                { icon: <Zap className="w-4 h-4 text-blue-500" />, text: "Improved AI Workout Coach speed and accuracy." },
            ]
        },
        {
            version: "v1.1",
            date: "Last Week",
            features: [
                { icon: <Rocket className="w-4 h-4 text-green-500" />, text: "Added Conversational Workout Logging." },
                { icon: <Sparkles className="w-4 h-4 text-orange-500" />, text: "Introduced 'Smart Coach' tips on dashboard." },
            ]
        },
        {
            version: "v1.0",
            date: "Initial Release",
            features: [
                { icon: <Bug className="w-4 h-4 text-gray-500" />, text: "Core tracking: Food, Workouts, and Habits." },
            ]
        }
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[80vh]">

                <div className="bg-gray-900 p-6 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            🚀 What's New
                        </h2>
                        <p className="text-gray-400 text-sm">Changelog & Updates</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 overflow-y-auto space-y-8">
                    {changes.map((release, i) => (
                        <div key={i} className="relative pl-4 border-l-2 border-gray-100">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-100 border-2 border-blue-500"></div>
                            <div className="mb-2">
                                <h3 className="font-bold text-gray-900 text-lg">{release.version}</h3>
                                <p className="text-xs font-bold text-gray-400 uppercase">{release.date}</p>
                            </div>
                            <ul className="space-y-3">
                                {release.features.map((feat, j) => (
                                    <li key={j} className="flex gap-3 text-sm text-gray-600">
                                        <div className="mt-0.5 shrink-0">{feat.icon}</div>
                                        {feat.text}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100">
                    <button onClick={onClose} className="w-full py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors">
                        Close
                    </button>
                </div>

            </div>
        </div>
    );
}
