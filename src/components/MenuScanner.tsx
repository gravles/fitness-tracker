'use client';

import { useState, useEffect } from 'react';
import { Camera, X, Check, ChefHat, Sparkles } from 'lucide-react';
import { createPortal } from 'react-dom';
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        try {
            const res = await fetch('/api/ai/scan-menu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageSrc }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const data = await res.json();

            if (data.error) throw new Error(data.error);
            if (Array.isArray(data)) {
                setRecommendations(data);
                setStep('results');
            } else {
                throw new Error("Invalid response format");
            }

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.error("Menu scan timed out");
                alert("Scan Timed Out: The menu image might be too large or the AI is taking too long. Try a smaller section of the menu.");
            } else {
                console.error(error);
                alert('Scan Failed: ' + error.message);
            }
            onClose();
        } finally {
            clearTimeout(timeoutId);
        }
    }

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted) return null;

    let content;

    if (step === 'camera') {
        content = (
            <div className="fixed inset-0 z-[100] bg-black">
                <div className="absolute top-4 right-4 z-10">
                    <button onClick={onClose} className="p-2 bg-black/50 text-white rounded-full">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <FoodCamera onClose={onClose} onCapture={handleCapture} autoStart={true} />
                <div className="absolute top-10 left-0 right-0 text-center pointer-events-none">
                    <span className="bg-black/60 text-white px-4 py-2 rounded-full text-sm font-bold backdrop-blur-md">
                        Scan Menu for Healthy Options
                    </span>
                </div>
            </div>
        );
    } else if (step === 'analyzing') {
        content = (
            <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur flex flex-col items-center justify-center text-white">
                <ChefHat className="w-16 h-16 animate-bounce mb-4" style={{ color: 'var(--color-gold)' }} />
                <h3 className="text-xl font-bold mb-2">Analyzing Menu...</h3>
                <p className="text-gray-400 text-sm">Finding high-protein gems 💎</p>
            </div>
        );
    } else {
        content = (
            <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: 'var(--color-bg)' }}>
                {/* Header */}
                <div className="bg-[var(--color-surface-elevated)] p-4 border-b border-[var(--color-border-light)] flex justify-between items-center shadow-sm">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-[var(--color-text)]">
                        <Sparkles className="w-5 h-5" style={{ color: 'var(--color-gold)' }} /> Best Options
                    </h3>
                    <button onClick={onClose} className="p-2 bg-[var(--color-bg-subtle)] rounded-full hover:bg-[var(--color-bg-muted)]">
                        <X className="w-5 h-5 text-[var(--color-text-muted)]" />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {recommendations.length === 0 ? (
                        <div className="text-center py-20 text-[var(--color-text-muted)]">
                            <p>No healthy options found... maybe try the water? 😅</p>
                        </div>
                    ) : (
                        recommendations.map((rec, idx) => (
                            <div key={idx} className="bg-[var(--color-surface-elevated)] p-5 rounded-2xl shadow-sm border border-[var(--color-border-light)] relative overflow-hidden">
                                {idx === 0 && (
                                    <div
                                        className="absolute top-0 right-0 text-[10px] font-bold px-3 py-1 rounded-bl-xl"
                                        style={{ background: 'var(--color-gold)', color: 'var(--color-navy)' }}
                                    >
                                        TOP PICK
                                    </div>
                                )}

                                <h4 className="font-bold text-lg text-[var(--color-text)] mb-1">{rec.name}</h4>
                                <p className="text-sm text-[var(--color-text-muted)] mb-3">{rec.description}</p>

                                <div className="p-3 rounded-xl mb-4 border" style={{ background: 'rgba(29,95,168,0.06)', borderColor: 'rgba(29,95,168,0.15)' }}>
                                    <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--color-primary)' }}>Why it's good</p>
                                    <p className="text-sm leading-snug" style={{ color: 'var(--color-primary)' }}>{rec.reason}</p>
                                </div>

                                <div className="flex items-center justify-between mt-2">
                                    <div className="text-xs font-medium text-[var(--color-text-muted)]">
                                        <span className="block font-bold text-[var(--color-text)] text-base">{rec.protein}g Protein</span>
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
                                        className="text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center gap-2"
                                        style={{ background: 'var(--color-navy)' }}
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

    return createPortal(content, document.body);
}
