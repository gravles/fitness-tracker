'use client';

import { useState } from 'react';
import { Camera, X, Check, Loader2, ChefHat, Sparkles } from 'lucide-react';
import { FoodCamera } from './FoodCamera';

interface MenuScannerProps {
    onClose: () => void;
    onLog: (item: any) => void;
}

export function MenuScanner({ onClose, onLog }: MenuScannerProps) {
    const [step, setStep] = useState<'camera' | 'analyzing' | 'results'>('camera');
    const [recommendations, setRecommendations] = useState<any[]>([]);

    async function handleCapture(imageSrc: string) {
        setStep('analyzing');
        try {
            const res = await fetch('/api/ai/scan-menu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageSrc })
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error);
            if (Array.isArray(data)) {
                setRecommendations(data);
                setStep('results');
            } else {
                throw new Error("Invalid response format");
            }

        } catch (error: any) {
            console.error(error);
            alert('Scane Failed: ' + error.message);
            onClose();
        }
    }

    if (step === 'camera') {
        return (
            <div className="fixed inset-0 z-50 bg-black">
                <div className="absolute top-4 right-4 z-10">
                    <button onClick={onClose} className="p-2 bg-black/50 text-white rounded-full">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <FoodCamera onClose={onClose} onCapture={handleCapture} />
                <div className="absolute top-10 left-0 right-0 text-center pointer-events-none">
                    <span className="bg-black/60 text-white px-4 py-2 rounded-full text-sm font-bold backdrop-blur-md">
                        Scan Menu for Healthy Options
                    </span>
                </div>
            </div>
        );
    }

    if (step === 'analyzing') {
        return (
            <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur flex flex-col items-center justify-center text-white">
                <ChefHat className="w-16 h-16 text-yellow-500 animate-bounce mb-4" />
                <h3 className="text-xl font-bold mb-2">Analyzing Menu...</h3>
                <p className="text-gray-400 text-sm">Finding high-protein gems 💎</p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white p-4 border-b flex justify-between items-center shadow-sm">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-500" /> Best Options
                </h3>
                <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {recommendations.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <p>No healthy options found... maybe try the water? 😅</p>
                    </div>
                ) : (
                    recommendations.map((rec, idx) => (
                        <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                            {idx === 0 && (
                                <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                                    TOP PICK
                                </div>
                            )}

                            <h4 className="font-bold text-lg text-gray-900 mb-1">{rec.name}</h4>
                            <p className="text-sm text-gray-500 mb-3">{rec.description}</p>

                            <div className="bg-blue-50 p-3 rounded-xl mb-4 border border-blue-100">
                                <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-1">Why it's good</p>
                                <p className="text-sm text-blue-600 leading-snug">{rec.reason}</p>
                            </div>

                            <div className="flex items-center justify-between mt-2">
                                <div className="text-xs font-medium text-gray-600">
                                    <span className="block font-bold text-gray-900 text-base">{rec.protein}g Protein</span>
                                    {rec.calories} kcal • {rec.carbs}g C • {rec.fat}g F
                                </div>
                                <button
                                    onClick={() => onLog({
                                        name: rec.name,
                                        calories: rec.calories,
                                        protein: rec.protein,
                                        carbs: rec.carbs,
                                        fat: rec.fat
                                    })}
                                    className="bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center gap-2"
                                >
                                    Log Meal <Check className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
