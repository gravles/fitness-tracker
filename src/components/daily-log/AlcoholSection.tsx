'use client';

import { Plus, Minus } from 'lucide-react';

interface AlcoholSectionProps {
    alcohol: number;
    setAlcohol: (val: number) => void;
}

export function AlcoholSection({ alcohol, setAlcohol }: AlcoholSectionProps) {
    return (
        <section className="bg-[var(--color-surface-elevated)] p-6 rounded-2xl border border-[var(--color-border-light)] shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-[var(--color-text)]">
                <span className="text-xl">🍺</span> Alcohol
            </h3>
            <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)] font-medium">Standard Drinks</span>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setAlcohol(Math.max(0, alcohol - 1))}
                        className="w-10 h-10 rounded-full bg-[var(--color-bg-subtle)] flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-bg-muted)] active:scale-95 transition-all"
                    >
                        <Minus className="w-5 h-5" />
                    </button>
                    <span className="text-2xl font-bold w-8 text-center text-[var(--color-text)]">{alcohol}</span>
                    <button
                        onClick={() => setAlcohol(alcohol + 1)}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-95 transition-all"
                        style={{ background: 'var(--color-primary)' }}
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </section>
    );
}
